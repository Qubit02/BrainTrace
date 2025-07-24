"""
성능 개선을 위해 gpu 연산을 도입하고, 임베딩을 병렬적으로 처리하도록 수정했습니다.
"""

from langchain.text_splitter import RecursiveCharacterTextSplitter
import logging

#pip install konlpy, pip install transformers torch scikit-learn

import re
import torch
from collections import defaultdict
from transformers import AutoTokenizer, AutoModel
from typing import List, Dict
from konlpy.tag import Okt
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
from tqdm import tqdm
from collections import Counter

MODEL_NAME = "nlpai-lab/KoE5"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModel.from_pretrained(MODEL_NAME)
model.eval()

stopwords = set([
    "사실", "경우", "시절", "내용", "점", "것", "수", "때", "정도", "이유", "상황", "뿐", "매우", "아주", "또한", "그리고", "그러나"
])

okt = Okt()

def extract_noun_phrases(text: str) -> list:
    """
    명사구를 추출합니다.

    """
    words = okt.pos(text, norm=True, stem=True)
    phrases=[]
    current_phrase=[]

    for word, tag in words:
        if '\n' in word:
            continue
        elif tag in ["Noun", "Alpha"]:
            if word not in stopwords and len(word) > 1:
                current_phrase.append(word)
        elif tag == "Adjective" and word[-1] not in '다요죠며지만':
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
    phrase_to_indices = defaultdict(set)

    # 각 phrase가 등장한 sentence 인덱스를 수집
    for info in phrase_info:
        phrase_to_indices[info["phrase"]].add(info["sentence_index"])

    total_sentences = len(sentences)

    phrase_embeddings = {}
    central_vecs = []

        # phrase별 평균 임베딩 계산
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [
            executor.submit(compute_phrase_embedding, phrase, indices, sentences, total_sentences)
            for phrase, indices in phrase_to_indices.items()
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

    topic = sorted(scores.items(), key=lambda x: x[1][0], reverse=True)[:10]

    emb_array = np.stack(emb_list)
    sim_matrix = cosine_similarity(emb_array)

    return scores, phrases, sim_matrix, topic


def group_phrases(
    phrases: List[str],
    phrase_scores: List[dict],
    sim_matrix: np.ndarray,
    threshold: float = 0.98
) -> list[Dict]:
    ungrouped = list(range(len(phrases)))  # 인덱스 기반으로
    groups = []

    while ungrouped:
        i = ungrouped.pop()
        group = [i]
        to_check = set()

        for j in ungrouped:
            if sim_matrix[i][j] >= threshold:
                to_check.add(j)

        valid_members = []
        for j in to_check:
            if all(sim_matrix[j][k] >= threshold for k in group):
                valid_members.append(j)

        for j in valid_members:
            group.append(j)
            ungrouped.remove(j)

        groups.append(group)

    # 대표 명사구 설정: 중심성 점수가 가장 높은 것
    group_infos = []
    for group in groups:
        best_idx = max(group, key=lambda idx: phrase_scores[phrases[idx]][0])
        group_infos.append({
            "representative": phrases[best_idx],
            "members": [phrases[idx] for idx in group]
        })

    return group_infos


def extract_nodes(text: str) -> str:
    phrase_info=[]
    sentences = re.split(r'(?<=[.!?])\s+|(?<=[다요죠오])\s*$|\n', text.strip(), flags=re.MULTILINE)
    sentences=[s.strip() for s in sentences if s.strip()]

    # 각 문장에서 명사구 추출
    for s_idx, sentence in enumerate(sentences):
        phrases=extract_noun_phrases(sentence)
        for p in phrases:
            phrase_info.append({
                "sentence_index": s_idx,
                "phrase": p
            })
    
    print(phrase_info)
 
    phrase_scores, phrases, sim_matrix, topic=compute_scores(phrase_info, sentences)
    groups=group_phrases(phrases, phrase_scores, sim_matrix)

    print(topic)
    print("--------------------------------------------------")
    print("📌 명사구 그룹 정보:")
    for g in groups:
        print(f"{g['representative']} ← {g['members']}")
    

