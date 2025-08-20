"""
수동 청킹 및 키워드 기반 그래프 구성 모듈
----------------------------------------

이 모듈은 규칙 기반(수동)으로 텍스트를 문장 단위로 분할/토큰화하고,
LDA/TF-IDF/인접 유사도 등을 활용해 재귀적으로 청킹하여 키워드 노드/엣지를 생성합니다.

구성 요소 개요:
- `split_into_tokenized_sentence`: 문장 단위 분할과 명사구 추출
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
import re
from konlpy.tag import Okt
from gensim import corpora, models
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
from collections import defaultdict
from .node_gen_ver5 import _extract_from_chunk
from .node_gen_ver5 import extract_noun_phrases

okt = Okt()

# 불용어 정의 
stop_words = ['하다', '되다', '이다', '있다', '같다', '그리고', '그런데', '하지만', '또한', "매우", "것", "수", "때문에", "그러나", "나름", "아마", "대한"]


def extract_keywords_by_tfidf(tokenized_chunks: list[str]):
    """토큰화된 문단 리스트에서 TF-IDF 상위 키워드를 추출합니다.

    Args:
        tokenized_chunks: 각 문단의 토큰 리스트들의 리스트
        topn: 문단별 상위 키워드 개수

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
        top_indices = row.argsort()[::-1]
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

def grouping_into_smaller_chunks(chunk:list[int], similarity_matrix:np.ndarray, threshold:int):
    """
    임계값을 기준으로 입력 그룹에서 더 작은 그룹들을 생성합니다.
    유사도 행렬을 참조하여 연속적인 두 문장 사이의 유사도가 임계값 이상이면 같은 그룹으로 묶습니다.

    Args:
        chunk:입력 그룹, 문장 인덱스의 리스트
        similarity_matrix: 문장 간의 유사도 값을 저장하고 있는 행렬
        threshold: 그룹화의 기준이 되는 임계값

    returns:
        new_chunk_groups: 새롭게 생성된 더 작은 그룹들
    """
    new_chunk_groups = []
    visited = set()
    for idx in range(len(chunk)):
        if idx in visited:
            continue
        new_chunk = [idx]
        visited.add(idx)
        for next_idx in range(idx + 1, len(chunk)):
            if next_idx in visited:
                continue
            if similarity_matrix[chunk[next_idx]][chunk[next_idx-1]]>=threshold:
                new_chunk.append(next_idx)
                visited.add(next_idx)
            else:
                break
        new_chunk_groups.append(new_chunk)

    return new_chunk_groups

#def generate_graph():
    



def recurrsive_chunking(chunk: list[int], source_id:str ,depth: int, already_made:list[str], top_keyword:str,  similarity_matrix, threshold: int,
                        lda_model, dictionary, num_topics=5):
    """유사도/키워드 기반 재귀 청킹.

    로직 요약:
      - depth=0에서 LDA로 전체 토픽 키워드(top_keyword) 추정, 초기 threshold 계산
      - depth>0에서는 인접 유사도/토큰 수/깊이 제한으로 종료 여부 판단
      - 종료 조건 미충족 시 유사도 기반으로 그룹핑 후 재귀 분할
      - 각 단계에서 대표 키워드 노드 및 하위 키워드 노드/엣지를 구성

    Args:
        chunk: 현재 단계에서 분할 대상인 (토큰화된 문장, 인덱스) 페어릐 리스트({"tokens", "index"})
        source_id: 소스 식별자(그래프 노드 메타데이터)
        depth: 현재 재귀 깊이(0부터 시작)
        already_made: 중복 노드 생성을 방지하기 위한 이름 캐시
        top_keyword: 상위 단계에서 전달된 대표 키워드(또는 depth=0일 때 LDA에서 추정)
        threshold: 인접 문장 유사도 기준값(초기값은 depth=0에서 계산)
        lda_model, dictionary, num_topics: LDA 추정 관련 파라미터

    Returns:
        Tuple[list[dict], dict, list[str]]: (청킹 결과 리스트, {"nodes", "edges"}, 업데이트된 already_made)
    """
    flag=-1
    result=[]
    nodes_and_edges={"nodes":[], "edges":[]}
    #현재 그룹 내부 문장들의 인덱스만 저장한 리스트를 생성
    chunk_indices=[c["index"] for c in chunk]


    # 종료 조건
    if depth > 0:
        # chunk가 세 문장 이하이거나 chunk의 크기가 20토큰 이하인 경우 더 이상 쪼개지 않음
        if len(chunk)<=3 or sum([len(c["tokens"]) for c in chunk])<=20:
            flag=1
        
        #depth가 5 이상일 경우 더 깊이 탐색하지 않음
        if(depth >= 5):
            flag=2
            length=len(chunk)
            sizes = sum([len(c["tokens"]) for c in chunk])
            result=[]
            #depth가 5이상이지만 크기가 500토큰 이상일 경우 유사도를 기반으로 5개까지 쪼갬
            if (sizes>500):
                num_chunks= length if length<5 else 5
                _, _, similarity_matrix=lda_keyword_and_similarity(chunk, lda_model, dictionary)
                consec_similarity=[(similarity_matrix[i][i+1],i) for i in range(length-1)]
                consec_similarity=sorted(consec_similarity, key=lambda x:x[0], reverse=True)[:num_chunks]
                consec_similarity=sorted(consec_similarity, key=lambda x:x[1], reverse=True)

                for _, idx in consec_similarity:
                     result+=[{ "chunks": [c["index"] for c in chunk if c["index"]<=idx],
                                "keyword": top_keyword}]

        
        
        #chunk간의 유사도 구하기를 실패했을 때 재귀호출을 종료
        # depth가 1 이상일 경우, 이전 단계에서 tf-idf로 구하여 전달된 키워드가 top_keyword이다
        # 만족된 종료 조건이 있을 경우
        if flag != -1:
            if top_keyword not in already_made:
                already_made.append(top_keyword)
            result += [{ "chunks":chunk_indices, "keyword": top_keyword}]
            # 포맷 문자열 수정 및 변수명 오타(flag) 수정
            logging.info(f"depth {depth} 청킹 종료, flag:{flag}")
            return result ,{"nodes":[], "edges":[]}, already_made

    #depth가 0일 경우
    else:
        #lda로 전체 텍스트의 키워드와 각 chunk의 주제간의 유사도를 구함
        # depth가 0일 경우 lda가 추론한 전체 텍스트의 topic이 해당 chunk(==full text)의 top keyword가 됨
        top_keyword, lda_model, similarity_matrix = lda_keyword_and_similarity(chunk, lda_model, dictionary)
        already_made.append(top_keyword)
        top_keyword+="*"
        #지식 그래프의 루트 노드를 생성
        top_node={"label":top_keyword,
            "name":top_keyword,
            "descriptions":[],
            "source_id":source_id
            }
        nodes_and_edges["nodes"].append(top_node)
        
        #모든 문장들의 유사도들의 평균을 초기 threshold로 설정
        #이후에는 depth가 깊어질 때 마다 1.1씩 곱해짐
        try:
            if similarity_matrix.size > 0:
                flattened = similarity_matrix[np.triu_indices_from(similarity_matrix, k=1)]
                threshold = np.quantile(flattened, 0.25)
            else:
                # 예외 변수(e)가 없는 영역이므로 일반 메시지로 로깅
                logging.error("similarity_matrix 생성 오류: empty or invalid matrix")
                return [], {}, []
                
        except Exception as e:
            logging.error(f"threshold 계산 중 오류: {e}")
            threshold = 0.5  # 기본값 설정

    #입력 그룹을 더 작은 그룹으로 분할합니다.
    new_chunk_groups=grouping_into_smaller_chunks(chunk_indices, similarity_matrix, threshold)


    # 새롭게 나눠진 chunk group을 바탕으로 text를 분할하여 go_chunk를 만듦
    # go_chunk는 다시 한 번 chunking하기 위해 제귀적으로 호출되는 함수의 argument가 됨
    # 또한 새롭게 나눠진 chunk group들의 tf-idf 기반 키워드를 추출하기 위해
    # 토큰화되어 분할된 리스트인 get_topics를 만듦 
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


    # 이번 단계 chunking 결과를 바탕으로 노드와 엣지를 제작
    keywords=[]


    chunk_topics=extract_keywords_by_tfidf(get_topics)
    #tf-idf방식으로 추출한 topic keyword 중 중복없이 하나를 뽑아 각 chunk의 대표 키워드로 삼는다
    #각 chunk의 대표 키워드로 노드를 생성한다.
    for idx, topics in enumerate(chunk_topics):
        for t_idx in range(len(topics)):
            if topics[t_idx] not in already_made:
                if sum([len(sentence["tokens"]) for sentence in go_chunk[idx]])< 20:
                    chunk_node={"label":topics[t_idx],"name":topics[t_idx],
                                "descriptions":[c["index"] for c in go_chunk[idx]],
                                "source_id":source_id}
                    edge={"source": top_keyword, "target": topics[t_idx], "relation":"관련"}
                    keywords.append(topics[t_idx])
                else:
                    connective_node=topics[t_idx]+"*"
                    chunk_node={"label":topics[t_idx],"name":connective_node,"descriptions":[], "source_id":source_id}
                    edge={"source": top_keyword, "target": connective_node, "relation":"관련"}
                    keywords.append(connective_node)
                nodes_and_edges["nodes"].append(chunk_node)
                nodes_and_edges["edges"].append(edge)
                already_made.append(topics[t_idx])
                break
            else:
                if t_idx>=len(topics):
                    keywords.append("None")

    
    # 재귀적으로 각 청크 그룹을 더 세분화
    current_result = []
    for idx, c in enumerate(go_chunk):
        result, graph, already_made_updated = recurrsive_chunking(c, source_id ,depth+1, already_made, keywords[idx], similarity_matrix, threshold*1.1,
                                      lda_model=lda_model, dictionary=dictionary, num_topics=num_topics)
        #중복되는 노드가 만들어지지 않도록 already_made를 업데이트
        already_made=already_made_updated
        current_result+=(result)
        nodes_and_edges["nodes"]+=graph["nodes"]
        nodes_and_edges["edges"]+=graph["edges"]

    return current_result, nodes_and_edges, already_made


def lda_keyword_and_similarity(chunk, lda_model, dictionary):
    """
    gensim의 lda 모델을 사용하여 청크의 토픽 키워드를 추출하고
    청크를 구성하는 각 문장의 토픽 벡터를 생성합니다.
    각 문장의 토픽 벡터간의 유사도를 내적으로 계산하여 유사도 행렬을 생성합니다.
    추출한 토픽 키워드, 생성한 lda 모델, 유사도 행렬을 반환합니다.
    """
    """LDA 기반 키워드 추정과 토픽 분포 유사도 행렬 계산.

    Args:
        chunk: {"tokens": List[str], "index": int}의 리스트
        lda_model: 재사용 가능한 LDA 모델(없으면 학습)
        dictionary: 재사용 가능한 gensim Dictionary(없으면 생성)

    Returns:
        Tuple[str, models.LdaModel, np.ndarray]: (top_keyword, lda_model, similarity_matrix)
    """
    tokens = [c["tokens"] for c in chunk]
     
    # LDA 모델이 없으면 학습하고, 있으면 재사용
    try:
        if lda_model is None or dictionary is None:
            dictionary = corpora.Dictionary(tokens)
            corpus = [dictionary.doc2bow(text) for text in tokens]
            lda_model = models.LdaModel(corpus, num_topics=5, id2word=dictionary, passes=20, iterations=400, random_state=8)
    
    except Exception as e:
        logging.error(f"LDA 처리 중 오류 발생: {e}")
        return "", lda_model, np.array([])
    
    corpus = [dictionary.doc2bow(text) for text in tokens]

    topic_distributions = []
    for bow in corpus:
        dist = lda_model.get_document_topics(bow, minimum_probability=0)
        dense_vec = [prob for _, prob in sorted(dist, key=lambda x: x[0])]
        topic_distributions.append(dense_vec)

    topic_vectors = np.array(topic_distributions)
    sim_matrix = cosine_similarity(topic_vectors)

    # LDA 모델에서 첫 번째 토픽의 상위 키워드를 추출
    top_topic_terms = lda_model.show_topic(0, topn= 1)
    # top_topic_terms가 비어있지 않고 첫 번째 요소가 존재하는지 확인
    # (LDA 모델이 토픽을 생성하지 못했을 경우 방지)
    top_keyword = top_topic_terms[0][0] if top_topic_terms and len(top_topic_terms) > 0 else ""

    return top_keyword, lda_model ,sim_matrix


def split_into_tokenized_sentence(text:str):
    """텍스트를 문장 단위로 분할하고 문장별 명사구 토큰을 생성합니다.

    Returns:
        Tuple[List[Dict], List[str]]: ({"tokens", "index"} 리스트, 원본 문장 리스트)
    """
    # text를 문장 단위로 쪼갬
    """
    text를 문장 단위로 쪼갭니다.
    """
    tokenized_sentences=[]
    texts=[]
    for p in re.split(r'(?<=[.!?])\s+', text.strip()):
        texts.append(p.strip())

    for idx, sentence in enumerate(texts):
        tokens = extract_noun_phrases(sentence)
        # 빈 토큰 배열인 경우 기본 토큰 추가
        if not tokens:
            tokens = [sentence.strip()]  # 원본 문장을 토큰으로 사용
        tokenized_sentences.append({"tokens": tokens,
                                    "index":idx})

        
    return tokenized_sentences, texts



def extract_graph_components(text: str, source_id: str):
    """전체 파이프라인을 수행해 노드/엣지를 생성합니다.

    단계:
      1) 문장 분할 및 명사구 기반 토큰화
      2) 텍스트 길이에 따라 재귀 청킹 사용 여부 결정
      3) 청킹 결과 및 문장 인덱스를 통해 노드/엣지 생성

    Returns:
        Tuple[List[Dict], List[Dict]]: (노드 리스트, 엣지 리스트)

    길이가 긴 텍스트를 재귀적으로 chunking합니다.
    짧은 텍스트는 자체적으로 토픽을 추출하고 전체 텍스트를 하나의 청크로 간주합니다.
    각 청크에서 노드와 엣지를 추출하여 반환합니다.
    """
    
    # 모든 노드와 엣지를 저장할 리스트
    all_nodes = []
    all_edges = []
    chunks=[]
    tokenized, sentences = split_into_tokenized_sentence(text)
    
    if len(text)>=2000:
        chunks, nodes_and_edges, already_made = recurrsive_chunking(tokenized, source_id, 0, [], "", None, 0, None, None)
        if chunks==[]:
            logging.info("chunking에 실패하였습니다.")
            
        logging.info("chunking이 완료되었습니다.")
        all_nodes=nodes_and_edges["nodes"]
        all_edges=nodes_and_edges["edges"]

    
    else:
        top_keyword, _, _=lda_keyword_and_similarity(tokenized, None, None)
        if len(top_keyword)<1:
            logging.error("LDA  keyword 추출에 실패했습니다.")
        already_made=[top_keyword]
        top_keyword+="*"
        chunk=list(range(len(sentences)))
        chunks=[{"chunks":chunk, "keyword":top_keyword}]
        all_nodes.append({"name":top_keyword, "label":top_keyword, "source_id":source_id, "descriptions":[]})
        logging.info("chunking없이 노드와 엣지를 추출합니다.")
    

    # chunk의 크기가 2문장 이하인 노드는 그냥 chunk 자체를 노드로
    # 각 노드의 description을 문장 인덱스 리스트에서 실제 텍스트로 변환
    for node in all_nodes:
        resolved_description=""
        if node["descriptions"] != []:
            resolved_description="".join([sentences[idx] for idx in node["descriptions"]])

        node["original_sentences"]=[{"original_sentence":resolved_description,
                                    "source_id":source_id,
                                    "score": 1.0}]
        node["descriptions"]=[{"description":resolved_description, "source_id":source_id}]


    for c in chunks:
        if "chunks" in c:
            current_chunk = c["chunks"]  # 리스트 of 리스트
            relevant_sentences = [sentences[idx] for idx in current_chunk]
            if c["keyword"] != "":
                nodes, edges, already_made = _extract_from_chunk(relevant_sentences, source_id, c["keyword"], already_made)
            all_nodes += nodes
            all_edges += edges


    logging.info(f"✅ 총 {len(all_nodes)}개의 노드와 {len(all_edges)}개의 엣지가 추출되었습니다.")
    return all_nodes, all_edges      


def manual_chunking(text:str):
    """
    지식 그래프 생성에 GPT 모델을 사용하기 위해 텍스트를 적절한 크기로 청킹합니다.

    소스 없이 텍스트만 받아 수동 청킹 결과를 반환합니다.

    Returns:
        List[str]: 재귀 청킹 결과(각 청크의 텍스트)
    """
    tokenized, sentences = split_into_tokenized_sentence(text)
    chunks, _, _ =recurrsive_chunking(tokenized, "-1" , 0, [], "", None, 0, None, None)
    #chunking 결과를 바탕으로, 더 이상 chunking하지 않는 chunk들은 node/edge를

    final_chunks=[]
    for c in chunks:
        chunk=""
        # 각 청크의 문장 인덱스들을 실제 텍스트로 변환
        for idx in c["chunks"]:
            # 인덱스가 sentences 배열의 범위 내에 있는지 확인
            # (인덱스 오류 방지)
            if idx < len(sentences):
                chunk+=sentences[idx]
        final_chunks.append(chunk)

    return final_chunks

