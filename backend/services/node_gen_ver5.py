"""
성능 개선을 위해 gpu 연산을 도입하고, 임베딩을 병렬적으로 처리하도록 수정했습니다.
"""
import logging

#pip install konlpy, pip install transformers torch scikit-learn

import re
import torch
from collections import defaultdict
from transformers import AutoTokenizer, AutoModel
from typing import List, Dict
from konlpy.tag import Okt
from sklearn.metrics.pairwise import cosine_similarity
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
from tqdm import tqdm


MODEL_NAME = "nlpai-lab/KoE5"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModel.from_pretrained(MODEL_NAME)
model.eval()

stopwords = set([
    "사실", "경우", "시절", "내용", "점", "것", "수", "때", "정도", "이유", "상황", "뿐", "매우", "아주", "또한", "그리고", "그러나"
])

okt = Okt()

def extract_noun_phrases(sentence: str) -> list[str]:
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
        elif tag in ["Noun", "Alpha"]:
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

# 한 phrase의 임베딩을 계산하는 병렬 처리용 함수
def compute_phrase_embedding(phrase: str, indices: List[int], sentences: List[str], total_sentences: int) -> tuple:
    highlighted_texts = [sentences[idx].replace(phrase, f"[{phrase}]") for idx in indices]
    embeddings = get_embeddings_batch(highlighted_texts)
    avg_emb = np.mean(embeddings, axis=0)
    tf = len(indices) / total_sentences
    return phrase, (tf, avg_emb)

def get_embeddings_batch(texts: List[str]) -> np.ndarray:
    inputs = tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
    cls_embeddings = outputs.last_hidden_state[:, 0, :]  # [CLS] 토큰 임베딩
    return cls_embeddings.cpu().numpy()

def compute_scores(
    phrase_info: List[dict], 
    sentences: List[str]
) -> tuple[Dict[str, tuple[float, np.ndarray]], List[str], np.ndarray]:

    scores = {}
    total_sentences = len(sentences)

    phrase_embeddings = {}
    central_vecs = []

        # phrase별 평균 임베딩 계산=>phrase별 말고 모든 문장 일반 임베딩으로?
        # 이거 없애도 될듯(중복 계산, 이미 임베딩 벡터 산출할 때 구함)
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [
            executor.submit(compute_phrase_embedding, phrase, indices, sentences, total_sentences)
            for phrase, indices in phrase_info.items()
        ]

        for future in tqdm(as_completed(futures), total=len(futures), desc="Embedding phrases"):
            phrase, (tf, avg_emb) = future.result()
            phrase_embeddings[phrase] = (tf, avg_emb)
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

    return scores, phrases, sim_matrix

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
    for t in target_keywords:
        if t != source_keyword:
            relation=""
            for s_idx in phrase_info[t]:
                if source_keyword in sentences[s_idx]:
                    relation+=sentences[s_idx]
            relation="관련" if relation=="" else relation
            edges.append({"source":source_keyword, 
                        "target":t,
                        "relation":relation})
        
    return edges

def make_node(name, phrase_info, sentences:list[str], source_id:str):
    """
    노드를 만들 키워드와 키워드의 등장 위치를 입력 받아 노드를 생성합니다.
    args:   name: 노드를 만들 키워드
            phrase_info: 해당 키워드의 등장 인덱스
            sentences: 전체 텍스트가 문장 단위로 분해된 string의  list
            source_id: 입력 문서의 고유 source_id       
    """
    description=[]
    ori_sentences=[]
    s_indices=[idx for idx in phrase_info[name]]
    if len(s_indices)<=2:
        des="".join([sentences[idx] for idx in s_indices])
        ori_sentences.append({"original_sentence":des,
                    "source_id":source_id,
                    "score": 1.0})    
    else:
        des = ""
    description.append({"description":des,
                        "source_id":source_id})
    
    node={"label":name, "name":name,"source_id":source_id, "descriptions":description, "original_sentences":ori_sentences}

    return node
        

def _extract_from_chunk(sentences: list[str], source_id:str ,keyword: str, already_made:list[str]) -> tuple[dict, dict, list[str]]:
    nodes=[]
    edges=[]

    # 각 명사구가 등장한 문장의 index를 수집
    phrase_info = defaultdict(set)
    for s_idx, sentence in enumerate(sentences):
        phrases=extract_noun_phrases(sentence)
        for p in phrases:
            phrase_info[p].add(s_idx)

    phrase_scores, phrases, sim_matrix = compute_scores(phrase_info, sentences)
    groups=group_phrases(phrases, phrase_scores, sim_matrix)

    #score순으로 topic keyword를 정렬
    sorted_keywords = sorted(phrase_scores.items(), key=lambda x: x[1][0], reverse=True)
    sorted_keywords=[k[0] for k in sorted_keywords]

    cnt=0
    for t in sorted_keywords:
        if keyword != "":
            edges+=make_edges(sentences, keyword, [t], phrase_info)
        if t not in already_made:
            nodes.append(make_node(t, phrase_info, sentences, source_id))
            already_made.append(t)
            cnt+=1
            if t in groups:
                related_keywords=[]
                for idx in range(min(len(groups[t]), 5)):
                    if phrases[idx] not in already_made:
                        related_keywords.append(phrases[idx])
                        already_made.append(phrases[idx])
                        nodes.append(make_node(phrases[idx], phrase_info, sentences, source_id))
                        edges+=make_edges(sentences, t, related_keywords, phrase_info)   
                    
        if cnt==5:
            break

    return nodes, edges, already_made

