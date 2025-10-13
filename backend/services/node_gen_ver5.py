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

        # phrase별 평균 임베딩 계산=>phrase별 말고 모든 문장 일반 임베딩으로?
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

    # 중심 벡터 계산
    central_vec = np.mean(central_vecs, axis=0)

    # vector stack for cosine_similarity
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
#상위 5개의 노드를 먼저 선별하고 걔네끼리만 유사도를 계산하면 더 빠를듯
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
    source_idx = [idx for idx in phrase_info[source]]
    for t in target_keywords:
        if t != source:
            target_idx=[idx for idx in phrase_info[t]]
            relation=""
            for s_idx in source_idx:
                if s_idx in target_idx:
                    relation=sentences[s_idx]
                    edges.append({"source":source_keyword, 
                                    "target":t,
                                    "relation":relation})
            
            relation="관련" if relation=="" else relation
        
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
    텍스트를 문장 단위로 분할하고 문장별 명사구 토큰을 생성합니다.
    2단계 분리 로직 적용:
    1. 먼저 줄바꿈으로 전체 텍스트를 분리.
    2. 각 줄을 다시 문장 종결 부호로 분리하여 더 정확한 결과를 도출.
    """
    """
    텍스트를 문장 단위로 분할하고, 짧거나 무의미한 조각을 필터링합니다.
    (수정) 2단계 분리 로직 + 필터링 기능 추가
    """
    tokenized_sentences = []
    final_sentences = []
    cleaned_text = text.strip()

    lines = cleaned_text.splitlines()
    intra_line_pattern = r'(?<=[.!?])\s+|(?<=[다요]\.)\s*|(?<=[^a-zA-Z가-힣\s,])\s+'
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        sub_sentences = re.split(intra_line_pattern, line)
        
        for s in sub_sentences:
            s = s.strip()
            if not s:
                continue

            # [필터링 로직 추가]
            # 1. 문장에서 알파벳, 한글, 숫자만 추출
            #    예: "가." -> "가", "1)" -> "1", "CPU" -> "CPU"
            real_chars = re.sub(r'[^a-zA-Z0-9가-힣]', '', s)
            
            # 2. 필터링 조건 적용
            #    - 조건 1: 문장 전체의 길이가 1 이하인 경우 (예: "ㅇ")
            #    - 조건 2: 실질적인 문자가 1개 이하인 경우 (예: "가.", "1)")
            if len(s) <= 1 or len(real_chars) <= 1:
                continue  # 조건에 해당하면 무시하고 다음 조각으로 넘어감

            # 필터링을 통과한 문장만 최종 리스트에 추가
            final_sentences.append(s)

    texts = final_sentences


    for idx, sentence in enumerate(texts):
        lang = check_lang(sentence)

        if lang == "ko":
            tokens = extract_noun_phrases_ko(sentence)
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
    print(f"phrases:{phrases}")

    for p in phrases:
        for token in p["tokens"]:
            phrase_info[token].add(p["index"])

    print(f"phrase info:{phrase_info}")
    
    phrase_scores, phrases, sim_matrix, all_embeddings = compute_scores(phrase_info, sentences, lang)
    groups=group_phrases(phrases, phrase_scores, sim_matrix)

    #score순으로 topic keyword를 정렬
    sorted_keywords = sorted(phrase_scores.items(), key=lambda x: x[1][0], reverse=True)
    sorted_keywords=[k[0] for k in sorted_keywords]

    cnt=0
    if keyword != "":
        if phrase_info[keyword[:-1]] != []:
            nodes.append(make_node(keyword, list(phrase_info[keyword[:-1]]), sentences, id, all_embeddings[keyword[:-1]]))

    for t in sorted_keywords:
        if keyword != "":
            edges+=make_edges(sentences, keyword, [t], phrase_info)
        if t not in already_made:
            nodes.append(make_node(t, list(phrase_info[t]), sentences, id, all_embeddings[t]))
            already_made.append(t)
            cnt+=1
            if t in groups:
                related_keywords=[]
                for idx in range(min(len(groups[t]), 5)):
                    if phrases[idx] not in already_made:
                        related_keywords.append(phrases[idx])
                        already_made.append(phrases[idx])
                        nodes.append(make_node(phrases[idx], list(phrase_info[t]), sentences, id, all_embeddings[phrases[idx]]))
                        edges+=make_edges(sentences, t, related_keywords, phrase_info)   
                    
        if cnt==5:
            break
    

    return nodes, edges, already_made


def check_lang(text:str):
    lang, _ =langid.classify(text)
    return lang