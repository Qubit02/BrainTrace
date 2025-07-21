"""embedding 모델을 KoE5로 변경하고 대명사성 명사구 flag를 통해서 
conference resolution을 시도합니다.
유사한 명사구들 중 가장 길이가 긴 명사구가 대표 명사구가 됩니다.
sliding window 방식을 사용하며, 
각 noun phrase가 첫 등장한 문장의 context만 반영하는 오류가 존재합니다."""


from langchain.text_splitter import RecursiveCharacterTextSplitter
import logging

#pip install konlpy, pip install transformers torch scikit-learn

import re
import torch
from transformers import AutoTokenizer, AutoModel
from typing import List, Dict
from konlpy.tag import Okt
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

MODEL_NAME = "nlpai-lab/KoE5"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModel.from_pretrained(MODEL_NAME)
model.eval()

stopwords = set([
    "사실", "경우", "시절", "내용", "점", "것", "수", "때", "정도", "이유", "상황", "뿐", "매우", "아주"
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


def sliding_windows(sentences: list[str], window_size: int = 2, stride: int = 1) -> list[str]:
    """
    문장 리스트에서 슬라이딩 윈도우 방식으로 문맥 창을 만듭니다.
    
    Args:
        sentences (list[str]): 분리된 문장 리스트
        window_size (int): 한 윈도우에 포함될 문장 수
        stride (int): 다음 윈도우로 이동할 문장 수

    Returns:
        list[str]: 슬라이딩 윈도우 형태로 묶인 텍스트 리스트
    """
    windows = []
    for i in range(0, len(sentences) - window_size + 1, stride):
        window = sentences[i:i + window_size]
        windows.append(window)
    return windows

def extract_noun_phrases(text: str) -> list[dict]:
    """
    명사구를 추출하고, 지시어(대명사성) 명사구 여부를 판별해 반환합니다.

    Returns:
        List of dicts like:
        [
            {"phrase": "RAG 검색 시스템", "is_pronoun_like": False},
            {"phrase": "이 시스템", "is_pronoun_like": True}
        ]
    """
    words = okt.pos(text, norm=True, stem=True)


    noun_phrases = []
    current_phrase = []
    is_pronoun = False

    for word, tag in words:
        if '\n' in word:
            continue
        elif tag in ["Noun",  "Alpha"]:
            current_phrase.append(word)
        elif tag =='Adjective' and word[-1] not in '다요죠':
            current_phrase.append(word)
        else:
            if current_phrase:
                is_pronoun=is_pronoun_like_phrase(current_phrase)
                phrase = " ".join(current_phrase)
                noun_phrases.append({
                    "phrase": phrase,
                    "pronoun_like": is_pronoun
                })
                current_phrase = []
                is_pronoun = False

    if current_phrase:
        is_pronoun = is_pronoun_like_phrase(current_phrase)
        noun_phrases.append({
            "phrase": " ".join(current_phrase),
            "is_pronoun_like": is_pronoun
        })

    return noun_phrases

def get_embedding(text: str) -> np.ndarray:
    """
    KoE5 모델로 입력 텍스트 임베딩을 추출합니다. ([CLS] 벡터 사용)
    """
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
    cls_embedding = outputs.last_hidden_state[:, 0, :]  # [CLS] 토큰의 벡터
    return cls_embedding.squeeze().cpu().numpy()

def compute_similarity_matrix(
    phrase_info: List[Dict],
    windows: List[List[str]],
) -> tuple[np.ndarray, List[str]]:
    """
    명사구 리스트와 윈도우를 기반으로 임베딩하고 유사도 행렬 계산
    """
    embeddings = []
    labels = []

    for item in phrase_info:
        phrase = item["phrase"]
        win_idx = item["window_index"]
        context = " ".join(windows[win_idx])

        # 문맥 내에서 명사구 강조
        highlighted = context.replace(phrase, f"[{phrase}]")

        emb = get_embedding(highlighted)
        embeddings.append(emb)
        labels.append(phrase)

    sim_matrix = cosine_similarity(embeddings)

    return sim_matrix, labels

def group_phrases_and_replace(
    text: str,
    phrase_info: List[Dict],
    sim_matrix: np.ndarray,
    threshold: float = 0.98
) -> tuple[str, List[Dict]]:
    n = len(phrase_info)
    ungrouped = set(range(n))
    groups = []

    while ungrouped:
        i = ungrouped.pop()
        group = [i]
        to_check = set()

        # 후보: 아직 그룹에 속하지 않은 인덱스 중 i와 유사도가 threshold 이상인 것
        for j in ungrouped:
            if sim_matrix[i][j] >= threshold:
                to_check.add(j)

        # 완전 연결된 클러스터 조건을 만족하는 j만 그룹에 포함
        valid_members = []
        for j in to_check:
            if all(sim_matrix[j][k] >= threshold for k in group):  # 기존 그룹과 모두 연결되어야 함
                valid_members.append(j)

        for j in valid_members:
            group.append(j)
            ungrouped.remove(j)

        groups.append(group)

    # 그룹 → 대표 명사구 설정
    phrase_map = {}
    group_infos = []
    for group in groups:
        phrases = [phrase_info[i]['phrase'] for i in group]
        rep_phrase = max(phrases, key=len)
        for i in group:
            phrase_map[phrase_info[i]['phrase']] = rep_phrase
        group_infos.append({
            "representative": rep_phrase,
            "members": phrases
        })

    # 긴 명사구부터 치환
    sorted_phrases = sorted(phrase_map.keys(), key=len, reverse=True)
    replaced_text = text
    for phrase in sorted_phrases:
        replaced_text = replaced_text.replace(phrase, phrase_map[phrase])

    return replaced_text, group_infos

def normalize_coreferences(text: str) -> str:
    """
    같은 대상을 지칭하는 명사구들을 첫 번째 명사구로 통일
    """
    results=[]
    sentences = re.split(r'(?<=[.!?])\s+|(?<=[다요죠오])\s*$', text.strip(), flags=re.MULTILINE)
    sentences=[s.strip() for s in sentences if s.strip()]
    windows = sliding_windows(sentences, window_size=2, stride=1)

    # 각 문장에서 명사구 추출
    for w_idx, window in enumerate(windows):
        if w_idx==0:
            phrases=extract_noun_phrases(window[0])
            s_idx=0
        else:
            phrases=extract_noun_phrases(window[1])
            s_idx=1
        s_idx += w_idx

        for p in phrases:
            results.append({
                "window_index": w_idx,
                "sentence_index": s_idx,
                "phrase": p["phrase"],
                "pronoun_like": p["pronoun_like"]
            })
    
    sim_matrix, labels = compute_similarity_matrix(results, windows)

    new_text, groups = group_phrases_and_replace(text, results, sim_matrix)

    print("✅ 치환된 텍스트:")
    print(new_text)
    print("📌 명사구 그룹 정보:")
    for g in groups:
        print(f"{g['representative']} ← {g['members']}")
    
    return results

texts="""① 야성적, 활동적, 정열적
고려대학교의 교풍은 야성, 활기와 정열 등으로 대표된다. 무섭고 사나운 호랑이, 강렬하게 검붉은 크림슨색 등 고대를 대표하거나 '고대' 하면 떠오르는 상징들은 대부분 위의 특징들과 연관된 경우가 많다. 이는 고려대학교가 그 전신인 보성전문학교 시절 사실상 유일한 민족·민립의 지도자 양성기구였기 때문에, 민족정신이라는 시대적 요구가 교수와 학생들에게 특별히 더 부하됐고, 그것이 학생들의 지사적 또는 투사적 저항 기질을 배태시켰던 데 기인한다는 견해가 있다.[20]

② 협동적, 끈끈함
고려대에서는 졸업생을 '동문', '동창' 등의 단어 대신 '교우(校友)'라고 부른다. 이는 학교를 같이 다녔다는 이유만으로 친구라는 의미이다. 사회에서 고려대 출신 간에는 유대가 매우 강한 편이며 이러한 문화는 개인주의 성향이 강해진 현대에도 사라지지 않고 건강하게 이어지고 있다. 고대에는 자기 이익만 앞세우려 하기보다는, 타인과 소통하고 서로의 장점을 살려 일을 분담함으로써 시너지를 내는 문화가 발달돼 있다. 또한 일대일 간의 관계보다는 폭넓은 집단 내에서의 관계를 더 선호하는 편이다.[21] 구성원들의 애교심이 워낙 커서 그런지, 정치적 이념 및 경제적 이해관계가 다르더라도 같은 고대 동문 사이에는 좀 더 상대방의 입장에 서서 생각해보고 인간적 신뢰에 입각하여 갈등을 풀어가려는 전통이 이어지고 있다. 실제로 고려대에는 동아리 조직이 발달해 그 구성원이 인간관계를 다지고 팀플레이를 하는 풍조가 강하다. 공부도 물론 중요시하지만, 개인의 성적만을 챙기는 능력보다는 인간관계를 충실히 하는 능력, 남을 이끄는 지도력이나 상급자, 동료와 화합하는 친화력 등을 더 높이 평가하는 편이다. 다른 그 무엇보다도 장기적인 대인관계와 신뢰감을 중시하는 습관, 조직을 위해 희생하고 봉사하고 오욕 뒤집어쓰는 일을 두려워하지 않는 기질이 이런 문화 속에서 길러지는 건 당연한 일이다.[22] 21세기 들어서 오프라인 커넥션만이 아니라 온라인 커넥션의 중요성이 매우 커졌는데, 이에 발맞춰 고대에서는 인터넷 커뮤니티도 매우 활발하게 운영되고 있다. 고려대학교 에브리타임도 상당히 활성화되어 있는 편이지만, 특히 고대의 자랑 중 하나인 고파스의 경우 각종 게시판에서 유통되고 누적되는 정보가 매우 방대할 뿐 아니라 영양가도 높다.[23]"""
results=normalize_coreferences(texts)


"""
for item in results:
    if(item['pronoun_like']==True):
        print(item)
"""
