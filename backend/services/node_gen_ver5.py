"""
청크로부터 노드&엣지 생성모듈
----------------------------------------

청킹 함수로부터 분할된 작은 텍스트 그룹(청크)에서 노드와 엣지를 추출합니다.
청킹함수가 생성한 지식그래프의 뺘대와 연결되어 하나의 그래프로 병합됩니다.

구성 요소 개요:
- `extract_keywords_by_tfidf`: 각 청크 토큰에서 TF-IDF 상위 키워드 추출
- `lda_keyword_and_similarity`: LDA를 통해 전체/부분 토픽 추정 및 토픽 분포 유사도 행렬 계산
- `recurrsive_chunking`: 유사도 기반 재귀 청킹(종료 조건/깊이/토큰 수 등 고려)
- `extract_graph_components`: 전체 파이프라인 실행 → 노드/엣지 구축
- `manual_chunking`: 소스 없는(-1) 케이스에 대한 청킹 결과만 반환

주의:
- 형태소 분석기(Okt), gensim LDA 등 외부 라이브러리에 의존합니다. 대형 텍스트에서는 시간이 소요될 수 있습니다.
- 재귀 청킹은 종료 조건(depth, 토큰 수, 유사도 행렬 유효성 등)을 통해 무한 분할을 방지합니다.

This file uses the spaCy `en_core_web_sm` model (© Explosion AI),
licensed under CC BY 4.0.
Source: https://spacy.io/models/en#en_core_web_sm

"""
import logging

#pip install konlpy, pip install transformers torch scikit-learn

import re
from collections import defaultdict
from typing import List, Dict
from konlpy.tag import Okt
from sklearn.metrics.pairwise import cosine_similarity
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
from tqdm import tqdm
import spacy
from .embedding_service import store_embeddings
from .embedding_service import get_embeddings_batch
import langid


stopwords = set([
    "사실", "경우", "시절", "내용", "점", "것", "수", "때", "정도", "이유", "상황", "뿐", "매우", "아주", "또한", "그리고", "그러나", "대한", "관한"
])

stopwords_en= set([
    "the", "an", "which", "they", "this", "you", "me"
])


# 한국어용 형태소 분석기
okt = Okt()

# 영어용 spaCy 모델 
nlp_en = spacy.load("en_core_web_sm")


def extract_noun_phrases_ko(sentence: str) -> list[str]:
    """
    문장을 입력 받으면 명사구를 추출하고
    추출한 명사구들의 리스트로 토큰화하여 반환합니다. 
    """
    #문장을 품사를 태깅한 단어의 리스트로 변환합니다.
    words = okt.pos(sentence, norm=True, stem=True)
    phrases=[]
    current_phrase=[]

    for word, tag in words:
        if '\n' in word:
            continue
        elif tag in ["Noun", "Alpha", "Number"]:
            if word not in stopwords and len(word) > 1:
                current_phrase.append(word)
        elif tag in ["Adjective", "Verb"] and len(word)>1 and word[-1] not in '다요죠며지만':
            current_phrase.append(word)
        else:
            if current_phrase:
                phrase = " ".join(current_phrase)
                phrases.append(phrase)
                current_phrase = []

    if current_phrase:
        phrase = " ".join(current_phrase)
        phrases.append(phrase)

    return phrases

def extract_noun_phrases_en(sentence: str) -> list[str]:
    """
    영어 문장에서 명사구를 추출합니다.
    """
    doc = nlp_en(sentence)
    phrases = []

    # spaCy의 noun_chunks 사용
    for chunk in doc.noun_chunks:
        phrase = chunk.text.strip()
        phrase=phrase.lower()
        if phrase  not in stopwords_en and len(phrase)>=2:
            phrases.append(phrase)

    return phrases


def compute_phrase_embedding(
    phrase: str,
    indices: List[int],
    sentences: List[str],
    total_sentences: int,
    lang:str
) -> tuple[str, tuple[float, np.ndarray], np.ndarray]:
    """
    특정 phrase가 포함된 문장들의 임베딩을 구해 평균벡터를 반환.
    - phrase: 현재 구하는 단어/구절
    - indices: phrase가 등장한 문장 인덱스 리스트
    - sentences: 전체 문장 리스트
    - total_sentences: 전체 문장 수
    반환: (phrase, (tf, avg_emb), embeddings)
    """
    # 강조 표시
    highlighted_texts = [sentences[idx].replace(phrase, f"[{phrase}]") for idx in indices]

    # 문장 임베딩
    embeddings = get_embeddings_batch(highlighted_texts, lang)  # shape: (N, D)
    embeddings = np.atleast_2d(embeddings)

    # 평균 벡터 계산
    avg_emb = np.mean(embeddings, axis=0)
    avg_emb = np.ravel(avg_emb)  # shape (D,)

    # TF (빈도 비율)
    tf = len(indices) / total_sentences

    return phrase, (tf, avg_emb), embeddings

    
# 각 키워드의 중요도 점수 계산 함수
# 중심 벡터와의 유사도로 중심성 점수를 계산하고 tf 점수와 곱하여 중요도 점수를 산출
def compute_scores(
    phrase_info: List[dict], 
    sentences: List[str],
    lang:str
) -> tuple[Dict[str, tuple[float, np.ndarray]], List[str], np.ndarray]:
    scores = {}
    all_embeddings = {}
    total_sentences = len(sentences)

    phrase_embeddings = {}
    central_vecs = []

    # 각 키워드가 등장한 문장을 임베딩한 후 평균을 내어, 키워드 별로 의미 벡터를 생성
    # 또한 각 키워드의 tf 점수를 산출함
    with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [
                executor.submit(compute_phrase_embedding, phrase, indices, sentences, total_sentences, lang)
                for phrase, indices in phrase_info.items()
            ]

            for future in tqdm(as_completed(futures), total=len(futures), desc="Embedding phrases"):
                phrase, (tf, avg_emb), embedded_vec = future.result()
                phrase_embeddings[phrase] = (tf, avg_emb)
                all_embeddings[phrase]=embedded_vec
                central_vecs.append(avg_emb)

    # 청크 내 모든 문장들의 임베딩 값의 평균으로 청크의 주제를 나타내는 중심 벡터를 산출
    central_vec = np.mean(central_vecs, axis=0)

    # 중심 벡터와의 유사도를 계산하여 각 키워드의 중심성 점수 산출
    # tf 점수와 곱하여 각 키워드의 중요도 점수를 최종적으로 계산
    # 중요도 점수 상위 5개의 키워드가 노드로 선택됨
    phrases = list(phrase_embeddings.keys())
    tf_list = []
    emb_list = []

    for phrase in phrases:
        tf, emb = phrase_embeddings[phrase]
        tf_adj = tf * cosine_similarity([emb], [central_vec])[0][0]
        scores[phrase] = [tf_adj, emb]
        tf_list.append(tf_adj)
        emb_list.append(emb)

    emb_array = np.stack(emb_list)
    sim_matrix = cosine_similarity(emb_array)

    return scores, phrases, sim_matrix, all_embeddings

#유사도를 기반으로 각 명사구를 그룹으로 묶음
def group_phrases(
    phrases: List[str],
    phrase_scores: List[dict],
    sim_matrix: np.ndarray,
    threshold: float = 0.98
) ->dict:
    ungrouped = list(range(len(phrases)))  # 인덱스 기반으로
    groups = []

    while ungrouped:
        i = ungrouped.pop()
        group = [i]
        to_check = set()

        for j in ungrouped:
            if sim_matrix[i][j] >= threshold:
                to_check.add(j)

        #같은 그룹이 되기 위해서는 그룹 내 모든 명사구들과 유사도가 임계값 이상이어야함
        valid_members = []
        for j in to_check:
            if all(sim_matrix[j][k] >= threshold for k in group):
                valid_members.append(j)

        for j in valid_members:
            group.append(j)
            ungrouped.remove(j)

        groups.append(group)

    # 대표 명사구 설정: 중심성 점수가 가장 높은 것
    group_infos = {}
    for group in groups:
        sorted_group =sorted(group, key=lambda idx: phrase_scores[phrases[idx]][0], reverse=True)
        representative=sorted_group[0]
        group_infos[phrases[representative]]=sorted_group[1:]

    return group_infos

def make_edges(sentences:list[str], source_keyword:str, target_keywords:list[str], phrase_info):
    """
    루트 노드인 source keyword와 주변노드인 target keywords(여러 개)를 입력 받아,
    이들 사이의 엣지들을 생성합니다.
    """
    edges=[]
    source=source_keyword[:-1] if source_keyword[-1] == "*" else source_keyword
    if source in phrase_info.keys():
        source_idx = [idx for idx in phrase_info[source]]
    else:
        source_idx=[]
    for t in target_keywords:
        if t != source:
            target_idx=[idx for idx in phrase_info[t]]
            relation=""
            for s_idx in source_idx:
                if s_idx in target_idx:
                    relation+=sentences[s_idx]
            
            relation="관련" if relation=="" else relation
            edges.append({"source":source_keyword, 
                "target":t,
                "relation":relation})
        
    return edges

def make_node(name, s_indices, sentences:list[str], id:tuple, embeddings):
    """
    노드를 만들 키워드와 키워드의 등장 위치를 입력 받아 노드를 생성합니다.
    args:   name: 노드를 만들 키워드
            phrase_info: 해당 키워드의 등장 인덱스
            sentences: 전체 텍스트가 문장 단위로 분해된 string의  list
            source_id: 입력 문서의 고유 source_id       
    """
    description=[]
    ori_sentences=[]
    brain_id, source_id=id

    if len(s_indices)!=0:
        for idx in s_indices[:min(len(s_indices),5)]:
            description.append({"description":sentences[idx],
                            "source_id":source_id})
            ori_sentences.append({"original_sentence":sentences[idx],
                            "source_id":source_id,
                            "score": 1.0})   

    else:
        description.append({"description":"",
                        "source_id":source_id})
        ori_sentences.append({"original_sentence":"",
                        "source_id":source_id,
                        "score": 1.0})   
    
    node={"label":name, "name":name,"source_id":source_id, "descriptions":description, "original_sentences":ori_sentences}
    store_embeddings(node, brain_id, embeddings)

    return node

def split_into_tokenized_sentence(text: str) -> tuple[List, List[str]]:
    """
    텍스트를 문장으로 분할합니다.

    수정된 로직:
    1. 텍스트를 줄바꿈 문자(\\n)를 기준으로 텍스트 덩어리와 \\n으로 분리합니다.
    2. 텍스트 덩어리를 순회하며 \\n을 만났을 때, 그 *이전까지의 텍스트* 길이를 확인합니다.
    3. 길이가 25자 이하이면, \\n을 유효한 문장 분리점으로 취급합니다. (제목/소제목 등을 감지하기 위함)
    4. 길이가 25자 초과이면, \\n을 무시하고(공백으로 치환) 다음 텍스트 덩어리와 합칩니다. 
       (문장이 끝나지 않았으나 한 줄이 넘어간 경우로 간주)
    5. 이렇게 재구성된 텍스트 덩어리들(merged_lines)을 대상으로 
       intra_line_pattern 정규식을 적용해 최종 문장을 분리합니다.
    """
    
    tokenized_sentences: List[dict] = [] # 반환 타입에 맞게 List[dict]로 수정
    final_sentences: List[str] = []
    
    cleaned_text = text.strip()
    if not cleaned_text:
        return (tokenized_sentences, final_sentences)

    intra_line_pattern = r'(?<=[.!?])\s+|(?<=[다요]\.)\s*|(?<=[^a-zA-Z가-힣\s,()[]{}=-%^$@])\s+'
    
    # [ 목록 표시 분리 패턴 ]
    list_marker_split_pattern = r'(?=[0-9a-zA-Z가-힣]\.\s+)'
    list_marker_pattern_for_removal = r'\s+[0-9a-zA-Z가-힣]\.'

    # [ 1단계: 줄바꿈 처리 ]
    blocks = re.split(r'(\n)', cleaned_text)
    
    merged_lines = []
    current_line = ""
    
    for block in blocks:
        if block == '\n':
            # \n을 만났을 때, 현재까지 누적된 current_line을 검사
            stripped_line = current_line.strip()
            
            if not stripped_line:
                # 빈 줄 (연속된 \n) 처리
                current_line = ""
                continue
            
            # [핵심 로직]
            # 이전 텍스트 덩어리가 25자 이하일 때만 \n을 분리점으로 인정
            if len(stripped_line) <= 25:
                merged_lines.append(stripped_line) # 분리점으로 인정 (별도 덩어리로 추가)
                current_line = ""                  # 새 덩어리 시작
            else:
                # 30자 초과 시, \n을 공백으로 치환하여 다음 덩어리와 연결
                current_line += " " 
        else:
            # \n이 아닌 텍스트 덩어리는 일단 현재 라인에 추가
            current_line += block
            
    # 반복문이 끝난 후 남아있는 마지막 텍스트 덩어리 처리
    stripped_last_line = current_line.strip()
    if stripped_last_line:
        merged_lines.append(stripped_last_line)

    # [ 2단계: 정규식으로 문장 분리 ]
    candidate_sentences = []
    for line in merged_lines:
        # 25자 이하의 짧은 줄도, 25자 초과로 합쳐진 긴 줄도
        # 모두 intra_line_pattern으로 한 번 더 분리 시도
        sub_sentences = re.split(intra_line_pattern, line)
        candidate_sentences.extend(sub_sentences)


    # [3단계: 목록 필터링]
    # 모든 문장 후보에 대해 필터링 로직 일괄 적용
    for s in candidate_sentences:
        s = s.strip()
        if not s:
            continue

        #  목록 표시(1., a., 가.) 앞에서 추가로 분리
        sub_fragments = re.split(list_marker_split_pattern, s)

        for fragment in sub_fragments:
            fragment = fragment.strip()

            # 목록 마커("1. ", "a. ")를 감지하고 삭제
            fragment = re.sub(list_marker_pattern_for_removal, '', fragment)
            fragment = fragment.strip() # 마커 삭제 후 남을 수 있는 공백 제거
            
            if not fragment:
                continue

            # 원본 필터링 로직 (길이, 실제 문자 수)
            real_chars = re.sub(r'[^a-zA-Z0-9가-힣]', '', fragment)
            if len(fragment) <= 1 or len(real_chars) <= 1:
                continue
            
            # 필터링을 통과한 최종 문장 조각
            final_sentences.append(fragment)

    texts = final_sentences

    # 각 문장의 언어를 감지하여 맞는 임베딩 모델로 임베딩
    for idx, sentence in enumerate(texts):
        lang = check_lang(sentence)

        # 한국어 임베딩 모델 호출
        if lang == "ko":
            tokens = extract_noun_phrases_ko(sentence)
        # 영어 임베딩 모델 호출
        elif lang == "en":
            tokens = extract_noun_phrases_en(sentence)
        else:
            tokens = [sentence.strip()]

        if not tokens:
            tokens = [sentence.strip()]  # fallback
            logging.error(f"한국어도 영어도 아닌 텍스트가 포함되어있습니다: {sentence}")

        tokenized_sentences.append({"tokens": tokens, "index": idx})

    return tokenized_sentences, texts


        

def _extract_from_chunk(sentences: str, id:tuple ,keyword: str, already_made:list[str]) -> tuple[dict, dict, list[str]]:
    """
    최종적으로 분할된 청크를 입력으로 호출됩니다.
    각 청크에서 중요한 키워드를 골라 노드를 생성하고
    keyword로 입력받은 노드를 source로 하는 엣지를 생성합니다.
    이를 통해 청킹 함수가 생성한 지식 그래프와 병합됩니다.
    """
    nodes=[]
    edges=[]

    # 명사구로 해당 명사구가 등장한 모든 문장 index를 검색할 수 있도록
    # 각 명사구를 key로, 명사구가 등장한 문장의 인덱스들의 list를 value로 하는 딕셔너리를 생성합니다.
    phrase_info = defaultdict(set)
    lang, _ = langid.classify("".join(sentences))
    phrases, sentences = split_into_tokenized_sentence(sentences)

    for p in phrases:
        for token in p["tokens"]:
            phrase_info[token].add(p["index"])

    
    phrase_scores, phrases, sim_matrix, all_embeddings = compute_scores(phrase_info, sentences, lang)
    groups=group_phrases(phrases, phrase_scores, sim_matrix)

    #score순으로 topic keyword를 정렬
    sorted_keywords = sorted(phrase_scores.items(), key=lambda x: x[1][0], reverse=True)
    sorted_keywords=[k[0] for k in sorted_keywords]

    contents=phrase_info.keys()

    # 청킹함수에서 전달받은 청크의 주제 키워드를 노드로 생성
    cnt=0
    if keyword != "":
        if keyword[-1]=="*":
            find = keyword[:-1]
        else:
            find = keyword
        if find in contents:
            nodes.append(make_node(keyword, list(phrase_info[find]), sentences, id, all_embeddings[find]))
        else:
            return [], [], already_made

    # 점수가 높은 키워드 중 중복(이미 노드로 만들어진 키워드)을 제외하여 상위 5개를 노드로 생성
    for t in sorted_keywords:
        # {청크의 주제 키워드 노드}와 {청크 내부 중요도 점수 상위 키워드} 간의 엣지를 생성
        if keyword != "":
            edges+=make_edges(sentences, keyword, [t], phrase_info)
            print(edges)
        else:
            break
        if t not in already_made:
            nodes.append(make_node(t, list(phrase_info[t]), sentences, id, all_embeddings[t]))
            already_made.append(t)
            cnt+=1
            
            # 노드로 선정된 키워드와 유사도가 높은 키워드가 있으면 하위노드로 생성합니다 
            if t in groups:
                related_keywords=[]
                for idx in range(min(len(groups[t]), 5)):
                    if phrases[idx] not in already_made:
                        related_keywords.append(phrases[idx])
                        already_made.append(phrases[idx])
                        node=make_node(phrases[idx], list(phrase_info[t]), sentences, id, all_embeddings[phrases[idx]])
                        nodes.append(node)
                        edge=make_edges(sentences, t, related_keywords, phrase_info)
                        edges+=edge  
                    
        if cnt==5:
            break
    return nodes, edges, already_made


def check_lang(text:str):
    lang, _ =langid.classify(text)
    return lang
