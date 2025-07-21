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

def is_pronoun_like_phrase(tokens: list[str]) -> bool:
    pronouns = {
        "이", "그", "저", "본", "해당", "그런", "전술한", "앞서", "말한", "이런", "이러한", "그러한"
    }
    
    if len(tokens) <2:
        return False
    
    check_len = min(2, len(tokens))
    for i in range(check_len):
        if tokens[i] in pronouns:
            return True
    return False

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
        elif tag == "Adjective" and word[-1] not in '다요죠':
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


def normalize_coreferences(text: str) -> str:
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
 
    phrase_scores, phrases, sim_matrix, topic=compute_scores(phrase_info, sentences)
    groups=group_phrases(phrases, phrase_scores, sim_matrix)

    print(topic)
    print("--------------------------------------------------")
    print("📌 명사구 그룹 정보:")
    for g in groups:
        print(f"{g['representative']} ← {g['members']}")
    

texts="""① 야성적, 활동적, 정열적
고려대학교의 교풍은 야성, 활기와 정열 등으로 대표된다. 무섭고 사나운 호랑이, 강렬하게 검붉은 크림슨색 등 고대를 대표하거나 '고대' 하면 떠오르는 상징들은 대부분 위의 특징들과 연관된 경우가 많다. 이는 고려대학교가 그 전신인 보성전문학교 시절 사실상 유일한 민족·민립의 지도자 양성기구였기 때문에, 민족정신이라는 시대적 요구가 교수와 학생들에게 특별히 더 부하됐고, 그것이 학생들의 지사적 또는 투사적 저항 기질을 배태시켰던 데 기인한다는 견해가 있다.[20]

② 협동적, 끈끈함
고려대에서는 졸업생을 '동문', '동창' 등의 단어 대신 '교우(校友)'라고 부른다. 이는 학교를 같이 다녔다는 이유만으로 친구라는 의미이다. 사회에서 고려대 출신 간에는 유대가 매우 강한 편이며 이러한 문화는 개인주의 성향이 강해진 현대에도 사라지지 않고 건강하게 이어지고 있다. 고대에는 자기 이익만 앞세우려 하기보다는, 타인과 소통하고 서로의 장점을 살려 일을 분담함으로써 시너지를 내는 문화가 발달돼 있다. 또한 일대일 간의 관계보다는 폭넓은 집단 내에서의 관계를 더 선호하는 편이다.[21] 구성원들의 애교심이 워낙 커서 그런지, 정치적 이념 및 경제적 이해관계가 다르더라도 같은 고대 동문 사이에는 좀 더 상대방의 입장에 서서 생각해보고 인간적 신뢰에 입각하여 갈등을 풀어가려는 전통이 이어지고 있다. 실제로 고려대에는 동아리 조직이 발달해 그 구성원이 인간관계를 다지고 팀플레이를 하는 풍조가 강하다. 공부도 물론 중요시하지만, 개인의 성적만을 챙기는 능력보다는 인간관계를 충실히 하는 능력, 남을 이끄는 지도력이나 상급자, 동료와 화합하는 친화력 등을 더 높이 평가하는 편이다. 다른 그 무엇보다도 장기적인 대인관계와 신뢰감을 중시하는 습관, 조직을 위해 희생하고 봉사하고 오욕 뒤집어쓰는 일을 두려워하지 않는 기질이 이런 문화 속에서 길러지는 건 당연한 일이다.[22] 21세기 들어서 오프라인 커넥션만이 아니라 온라인 커넥션의 중요성이 매우 커졌는데, 이에 발맞춰 고대에서는 인터넷 커뮤니티도 매우 활발하게 운영되고 있다. 고려대학교 에브리타임도 상당히 활성화되어 있는 편이지만, 특히 고대의 자랑 중 하나인 고파스의 경우 각종 게시판에서 유통되고 누적되는 정보가 매우 방대할 뿐 아니라 영양가도 높다.[23]"""
results=normalize_coreferences(texts)

