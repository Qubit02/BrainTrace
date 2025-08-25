"""
수동 청킹(문단 기반) 및 키워드/토픽 추출 모듈
------------------------------------------

이 모듈은 규칙 기반으로 텍스트를 문단 단위로 분할/토큰화하고,
LDA/TF-IDF/유사도 기반 그룹핑을 활용해 재귀적으로 청킹합니다.
각 단계의 대표 키워드를 노드로, 상하위 키워드 간의 관계를 엣지로 구성하는 것을 목표로 합니다.

구성 요소 개요:
- `split_into_tokenized_para`: 텍스트 → 문단 분할 및 토큰화
- `extract_keywords_by_tfidf`: 문단별 TF-IDF 상위 키워드 추출
- `lda_keyword_and_similarity`: LDA 기반 전체/부분 토픽 분포와 유사도 계산
- `recurrsive_chunking`: 유사도 기반 재귀 청킹(깊이/토큰 수/임계값 고려)
- `extract_graph_components`: 전체 파이프라인 실행(노드/엣지 산출)
- `manual_chunking`: 청킹 결과만 문자열 리스트로 반환

주의:
- 본 파일은 실험/프로토타입 성격의 로직이 포함되어 있으며, 상위 레이어와의 데이터 계약(노드/엣지 스키마)과
  일부 차이가 있을 수 있습니다. 예: 키 이름 오타(공백 포함) 등은 실제 사용 시 표준 스키마로 정비해야 합니다.
- `|`(비트 연산자)와 `or`(논리 연산자) 혼용 등 잠재적 버그 포인트가 있으니 주석을 참고하세요.
"""
import logging
import re
from konlpy.tag import Okt
from gensim import corpora, models
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
from collections import defaultdict
from chunk_service import chunk_text
from node_gen_ver5 import extract_nodes

okt = Okt()
# 불용어 정의 
stop_words = ['하다', '되다', '이다', '있다', '같다', '그리고', '그런데', '하지만', '또한', "매우", "것", "수", "때문에", "그러나"]



def extract_keywords_by_tfidf(tokenized_chunks: list[str], topn: int = 5):
    """토큰화된 문단 리스트에서 TF-IDF 상위 키워드를 추출합니다.

    Args:
        tokenized_chunks: 각 문단의 토큰 리스트들의 리스트
        topn: 문단별 상위 키워드 개수(기본 5)

    Returns:
        List[List[str]]: 문단별 키워드 리스트들의 리스트
    """
    # 각 단어의 TF-IDF 점수를 계산한 메트릭스를 생성
    vectorizer = TfidfVectorizer(stop_words=stop_words, max_features=1000)
    text_chunks = [' '.join(chunk) for chunk in tokenized_chunks]
    tfidf_matrix = vectorizer.fit_transform(text_chunks)
    feature_names = vectorizer.get_feature_names_out()

    # 각 문단 i의 TF-IDF 벡터를 배열로 변환하고, 값이 큰 순서대로 상위 topn 키워드 선정
    keywords_per_paragraph = []
    for i in range(tfidf_matrix.shape[0]):
        row = tfidf_matrix[i].toarray().flatten()
        top_indices = row.argsort()[::-1][:topn]
        top_keywords = [feature_names[j] for j in top_indices if row[j] > 0  ]
        for k in top_keywords:
            if k not in stop_words:
                keywords_per_paragraph.append(top_keywords)
                break

    return keywords_per_paragraph


def tokenization(paragraphs: list[dict]) -> list[list[str]]:
    """문단 리스트에서 명사/명사구를 추출해 토큰화합니다.

    Args:
        paragraphs: {"text": str, "index": int} 형식 문단 리스트

    Returns:
        List[Dict]: {"tokens": List[str], "index": int} 리스트
    """
    tokenized = []
    okt = Okt()
    for p in paragraphs:
        tokens = okt.nouns(p["text"])
        filtered_tokens = [t for t in tokens if t not in stop_words and len(t)>1]
        tokenized_para={}
        tokenized_para["tokens"]=filtered_tokens
        tokenized_para["index"]=p["index"]
        tokenized.append(tokenized_para)
    return tokenized


def recurrsive_chunking(
    chunk: list[dict],
    depth: int,
    already_made: list[str],
    top_keyword: str,
    threshold: int,
    lda_model=None,
    dictionary=None,
    num_topics: int = 5,
):
    """유사도/키워드 기반 재귀 청킹.

    로직 요약:
      - depth=0에서 LDA로 전체 토픽 키워드(top_keyword) 추정
      - depth>0에서는 인접 유사도/토큰 수/깊이 제한으로 종료 여부 판단
      - 종료 조건 미충족 시 유사도 기반 그룹핑 후 재귀 분할
      - 각 단계에서 대표 키워드 노드와 하위 키워드 노드/엣지 구성

    Returns:
      Tuple[dict, dict]: (현재 분기 청킹 결과, {"nodes", "edges"})
    """
    from sklearn.metrics.pairwise import cosine_similarity

    # LDA 모델이 없으면 학습하고, 있으면 재사용
    tokens = [c["tokens"] for c in chunk]
    if lda_model is None or dictionary is None:
        dictionary = corpora.Dictionary(tokens)
        corpus = [dictionary.doc2bow(text) for text in tokens]
        lda_model = models.LdaModel(corpus, num_topics=num_topics, id2word=dictionary, passes=10, random_state=35)

    # LDA 결과 계산
    if depth==0:
        top_keyword, topic_vectors, _ = lda_keyword_and_similarity(tokens, lda_model, dictionary, num_topics, topn=1)
    else:
        _, topic_vectors, _ = lda_keyword_and_similarity(tokens, lda_model, dictionary, num_topics, topn=1)

    similarity_matrix = cosine_similarity(topic_vectors)

    # 종료 조건
    if depth > 0:
        sizes = [len(c["tokens"]) for c in chunk]
        # 주의: 아래 `|`는 비트 연산자입니다. 논리 연산 의도라면 `or`가 적절합니다.
        if sum(sizes) <= 250 | depth > 5:
            result = {"depth": depth, "chunks": [[c["index"] for c in chunk]], "keyword": top_keyword}
            return result ,{"nodes":[], "edges":[]}


    # 유사도 기반 chunk 묶기
    new_chunk_groups = []
    visited = set()
    for idx, _ in enumerate(chunk):
        if idx in visited:
            continue
        new_chunk = [idx]
        visited.add(idx)
        for next_idx in range(idx + 1, len(chunk)):
            if next_idx in visited:
                continue
            if any(similarity_matrix[i][next_idx] >= threshold for i in new_chunk):
                new_chunk.append(next_idx)
                visited.add(next_idx)
            else:
                break
        new_chunk_groups.append(new_chunk)

    # 재귀적 호출
    go_chunk = []
    get_topics = []
    for group in new_chunk_groups:
        go_chunk_temp = []
        get_topics_temp = []
        for mem in group:
            get_topics_temp += chunk[mem]["tokens"]
            go_chunk_temp.append(chunk[mem])
        go_chunk.append(go_chunk_temp)
        get_topics.append(get_topics_temp)

    nodes_and_edges={"nodes":[], "edges":[]}
    already_made=[]  # 중복 노드 생성을 방지하기 위한 캐시. 주의: 상위 인자와 같은 이름이므로 혼동 주의
    keywords=[]

    # 대표 토픽 노드 생성
    # 주의: 현재 스키마는 " description"(앞 공백 포함) 키를 사용합니다. 표준 스키마와 불일치 가능
    top_node={"label":top_keyword,
              "name":top_keyword,
              " description":""}
    already_made.append(top_keyword)
    nodes_and_edges["nodes"].append(top_node)
    chunk_topics=extract_keywords_by_tfidf(get_topics, 7)

    for topics in chunk_topics:
        for t in topics:
            if t not in already_made:
                # 하위 키워드 노드 및 관계 구성
                chunk_node={"label":t, "name":t, " description":""}
                edge={"source": top_keyword, "target": t, "relation":""}
                nodes_and_edges["nodes"].append(chunk_node)
                nodes_and_edges["edges"].append(edge)
                already_made.append(t)
                keywords.append(t)
                break
    
    
    current_result = []
    for idx, c in enumerate(go_chunk):
        result, graph = recurrsive_chunking(c, depth+1, already_made, keywords[idx],threshold*1.2,
                                      lda_model=lda_model, dictionary=dictionary, num_topics=num_topics)
        current_result.append(result)
        nodes_and_edges["nodes"]+=graph["nodes"]
        nodes_and_edges["edges"]+=graph["edges"]

    return current_result, nodes_and_edges


def lda_keyword_and_similarity(paragraphs_tokenized, lda_model, dictionary, num_topics: int = 5, topn: int = 1):
    """LDA 기반 키워드 추정과 토픽 분포 유사도 행렬 계산.

    Args:
        paragraphs_tokenized: 각 문단의 토큰 리스트들의 리스트
        lda_model: 재사용 가능한 LDA 모델(없으면 학습 단계에서 주입됨)
        dictionary: 재사용 가능한 gensim Dictionary
        num_topics: LDA 토픽 개수
        topn: 상위 키워드 개수(표현용)

    Returns:
        Tuple[str, np.ndarray, np.ndarray]: (top_keyword, topic_vectors, sim_matrix)
    """
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np

    corpus = [dictionary.doc2bow(text) for text in paragraphs_tokenized]

    topic_distributions = []
    for bow in corpus:
        dist = lda_model.get_document_topics(bow, minimum_probability=0)
        dense_vec = [prob for _, prob in sorted(dist, key=lambda x: x[0])]
        topic_distributions.append(dense_vec)

    topic_vectors = np.array(topic_distributions)
    sim_matrix = cosine_similarity(topic_vectors)

    top_topic_terms = lda_model.show_topic(0, topn=topn)
    top_keyword = top_topic_terms[0][0] if top_topic_terms else ""

    return top_keyword, topic_vectors, sim_matrix

def split_into_tokenized_para(text: str):
    """텍스트를 문단 단위로 분할하고 문단별 명사 토큰을 생성합니다.

    Returns:
        Tuple[List[Dict], List[List[str]]]: ({"tokens", "index"} 리스트, 원본 문단 텍스트 리스트)
    """
    # text를 문단 단위로 쪼갬
    merge=""
    paragraphs=[]
    texts=[]
    index=0
    for p in text.strip().split("\n"):
        if p.strip():
            if len(p)<60: #문단이 60글자 이하이면 다음 문단에 병합
                merge+=p
            else:
                para={}
                para["text"]=merge+"\n"+p
                para["index"]=index
                paragraphs.append(para)
                texts.append([merge+"\n"+p])
                index+=1
                merge=""
    return tokenization(paragraphs), texts

def extract_graph_components(text: str, source_id: str):
    """전체 파이프라인을 수행해 노드/엣지를 생성합니다. (문단 기반)

    단계:
      1) 문단 분할 및 명사 기반 토큰화
      2) 재귀 청킹 수행(깊이/유사도/임계값)
      3) 청킹 결과를 바탕으로 노드/엣지 구성(현재 함수에서는 템플릿 상태)

    Returns:
        Tuple[List[Dict], List[Dict]]: (노드 리스트, 엣지 리스트)
    """
    
    # 모든 노드와 엣지를 저장할 리스트
    all_nodes = []
    all_edges = []

    tokenized, paragraphs = split_into_tokenized_para(text)
    chunks, nodes_and_edges=recurrsive_chunking(tokenized, 0, [], "", threshold=0.6,)

    """
    for branch in chunking_result:
        if "topics" not in branch:
            leaf_chunk=""
            for c in branch["chunks"]:
                leaf_chunk+=paragraphs[c]"""
            
          

    
    #더 이상 청킹할 수 없을 때까지 재귀적으로 함수를 호출
    "노드는 { \"label\": string, \"name\": string, \"description\": string } 형식의 객체 배열, "
    "엣지는 { \"source\": string, \"target\": string, \"relation\": string } 형식의 객체 배열로 출력해줘. "

    # TODO: 실제 노드/엣지 산출과 로그 수치 보강 필요
    logging.info(f"✅ 총 개의 노드와 개의 청크가 추출되었습니다.")
    return all_nodes, all_edges



def manual_chunking(text: str):


    return text

