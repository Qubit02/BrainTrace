"""
재귀적 청킹 및 그래프 뼈대 생성모듈
----------------------------------------

이 모듈은 규칙 기반(수동)으로 텍스트를 문장 단위로 분할/토큰화하고,
LDA/TF-IDF/인접 유사도 등을 활용해 재귀적으로 청킹하여 키워드 노드/엣지를 생성합니다.

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
import re
from konlpy.tag import Okt
from gensim import corpora, models
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
from collections import defaultdict
from .node_gen_ver5 import _extract_from_chunk
from .node_gen_ver5 import split_into_tokenized_sentence
import langid

# 한국어용 형태소 분석기
okt = Okt()

# 불용어 정의 
stop_words = ['하다', '되다', '이다', '있다', '같다', '그리고', '그런데', '하지만', '또한', "매우", "것", "수", "때문에", "그러나", "나름", "아마", "대한"]


def extract_keywords_by_tfidf(tokenized_chunks: list[str]):
    """토큰화된 문단 리스트에서 TF-IDF 상위 키워드를 추출합니다.

    Args:
        tokenized_chunks: 각 문단의 토큰 리스트들의 리스트

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


def check_termination_condition(chunk: list[dict], depth:int):
    """
    재귀함수의 종료 조건 달성 여부를 체크하고 flag를 반환합니다.
        flag 1: chunk가 세 문장 이하이거나 chunk의 크기가 20토큰 이하인 경우
        flag 2: depth 5 이상이고 chunk 크기가 500 토큰 이하인 경우
        flag 3: depth 5 이상이고 chunk 크리가 500 토큰 초과일 경우

    """
    flag=-1
    size = sum([len(c["tokens"]) for c in chunk])
    # flag 1:chunk가 다섯 문장 이하이거나 chunk의 크기가 20토큰 이하인 경우 더 이상 쪼개지 않음
    if len(chunk)<=5 or size<=50:
        flag=1
    
    #depth가 5 이상일 경우 더 깊이 탐색하지 않음
    if(depth >= 5):
        flag=2
        #depth가 5이상이지만 크기가 500토큰 이상일 경우 유사도를 기반으로 5개까지 쪼갬
        if (size>500):
            flag=3

    return flag


def nonrecurrsive_chunking(chunk:list[dict], similarity_matrix:np.ndarray, top_keyword:str):
    """
    depth 5 이상인데 청크가 500토큰 이하인 경우,
    최대 5개의 그룹으로 분할하여 반환합니다.
    이렇게 생성된 5개의 그룹은 지식 그래프의 깊이가 너무 깊어지는 것을 방지하기 위해
    각 청크를 위한 키워드를 생성하지 않고 입력 청크의 키워드(top_keyword)를 해당 그룹의 키워드로 합니다.

    Args:
        chunk: 입력 청크
        similarity_matrix: 각 문장간 유사도를 저장한 행렬
        top_keyword: 입력 청크의 키워드
    
    Return:
        result: 분할한 그룹을 저장한 리스트, 각 그룹을 구성하는 문장 인덱스
    """
    length=len(chunk)
    num_chunks= length if length<5 else 5
    consec_similarity=[] #현재 청크 내부의 연속적인 index간의 유사도만 저장
    for i in range(length-1):
        current=chunk[i]["index"]
        next=chunk[i+1]["index"]
        consec_similarity.append(similarity_matrix[current][next]) 
    consec_similarity=sorted(consec_similarity, key=lambda x:x[0], reverse=True)[:num_chunks]
    consec_similarity=sorted(consec_similarity, key=lambda x:x[1], reverse=True)

    for _, idx in consec_similarity:
            result+=[{ "chunks": [c["index"] for c in chunk if c["index"]<=idx],
                    "keyword": top_keyword}]
    
    return result


def gen_node_edges_for_new_groups(chunk:list[dict], new_chunk_groups, top_keyword, already_made, source_id):
    """
    인덱스 리스트로 표현된 그룹들을 다음 재귀 호출을 위한 청크의 형식으로 변환합니다.
    각 청크의 키워드를 추출하여 노드를 생성합니다.
    생성된 노드들을 현재 depth의 키워드 노드와 연결하는 엣지를 생성합니다.

    Args:
        chunk: 현재 depth의 전체 청크 정보
        new_chunk_groups: 문장 인덱스 리스트로 표현된 새롭게 생성된 그룹 정보
        already_made: 이미 생성된 노드 이름들을 저장한 리스트
    """

    # new_chunk_gorup에 저장된 문장 인덱스를 바탕으로 go_chunk와 get_topics를 생성
    # go_chunk는 다시 한 번 chunking하기 위해 제귀적으로 호출되는 함수의 argument
    # get_topics는 또한 새롭게 나눠진 chunk group들의 핵심 키워드 추출을 위한 함수의 argument
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
    nodes=[]
    edges=[]

    chunk_topics=extract_keywords_by_tfidf(get_topics)
    # tf-idf방식으로 추출한 topic keyword 중 중복없이 하나를 뽑아 각 chunk의 대표 키워드로 삼는다
    # 각 chunk의 대표 키워드로 노드를 생성한다
    for idx, topics in enumerate(chunk_topics):
        for t_idx in range(len(topics)):
            #토픽 키워드가 이미 노드가 생성된 키워드가 아니면 노드를 생성
            if topics[t_idx] not in already_made:
                #토픽 키워드가 파생된 문장의 길이가 15토큰 이하이면 문장을 description으로 저장
                if sum([len(sentence["tokens"]) for sentence in go_chunk[idx]])< 15:
                    chunk_node={"label":topics[t_idx],"name":topics[t_idx],
                                "descriptions":[c["index"] for c in go_chunk[idx]],
                                "source_id":source_id}
                    edge={"source": top_keyword, "target": topics[t_idx], "relation":"관련"}
                    keywords.append(topics[t_idx])
                #토픽 키워드가 파생된 문장의 길이가 길면 description이 빈 노드를 생성
                else:
                    connective_node=topics[t_idx]+"*"
                    chunk_node={"label":topics[t_idx],"name":connective_node,"descriptions":[], "source_id":source_id}
                    edge={"source": top_keyword, "target": connective_node, "relation":"관련"}
                    keywords.append(connective_node)
                nodes.append(chunk_node)
                edges.append(edge)
                already_made.append(topics[t_idx])
                break
    
    #키워드 중복 등으로 인하여 토픽 키워드의 개수가 chunk의 개수보다 적을 경우
    check_num_t=len(go_chunk)-len(keywords)
    if check_num_t > 0:
        keywords+=check_num_t*["none"]

    
    return nodes, edges, go_chunk, keywords



def recurrsive_chunking(chunk: list[int], source_id:str ,depth: int, top_keyword:str ,already_made:list[str], similarity_matrix, threshold: int):
    """유사도/키워드 기반 재귀 청킹.

    로직 요약:
      - depth=0에서 LDA로 전체 토픽 키워드(top_keyword) 추정, 초기 threshold 계산
      - depth>0에서는 인접 유사도/토큰 수/깊이 제한으로 종료 여부 판단
      - 종료 조건 미충족 시 유사도 기반으로 그룹핑 후 재귀 분할
      - 각 단계에서 대표 키워드 노드 및 하위 키워드 노드/엣지를 구성

    Args:
        chunk: 현재 단계에서 분할 대상인 (토큰화된 문장, 인덱스) 페어의 리스트({"tokens", "index"})
        source_id: 소스 식별자(그래프 노드 메타데이터)
        depth: 현재 재귀 깊이(0부터 시작)
        already_made: 중복 노드 생성을 방지하기 위한 이름 캐시
        top_keyword: 상위 단계에서 전달된 대표 키워드(또는 depth=0일 때 LDA에서 추정)
        threshold: 인접 문장 유사도 기준값(초기값은 depth=0에서 계산)
        lda_model, dictionary, num_topics: LDA 추정 관련 파라미터

    Returns:
        Tuple[list[dict], dict, list[str]]: (청킹 결과 리스트, {"nodes", "edges", "keyword"}, 업데이트된 already_made)
    """
    result=[]
    nodes_and_edges={"nodes":[], "edges":[]}
    chunk_indices=[c["index"] for c in chunk] #현재 그룹 내부 문장들의 인덱스만 저장한 리스트를 생성


    if depth == 0:
        #lda로 전체 텍스트의 키워드와 각 chunk의 주제간의 유사도를 구함
        # depth가 0일 경우 lda가 추론한 전체 텍스트의 topic이 해당 chunk(==full text)의 top keyword가 됨
        top_keyword, similarity_matrix = lda_keyword_and_similarity(chunk)
        already_made.append(top_keyword)
        top_keyword+="*"
        #지식 그래프의 루트 노드를 생성
        top_node={"label":top_keyword,
            "name":top_keyword,
            "descriptions":[],
            "source_id":source_id
            }
        nodes_and_edges["nodes"].append(top_node)
        
        #유사도 matrix의 하위 25% 값을 첫 임계값으로 설정
        #이후에는 depth가 깊어질 때 마다 1.1씩 곱해짐
        try:
            if similarity_matrix.size > 0:
                flattened = similarity_matrix[np.triu_indices_from(similarity_matrix, k=1)]
                threshold = np.quantile(flattened, 0.25)
            else:
                logging.error("similarity_matrix 생성 오류: empty or invalid matrix")
                return [], {}, []
                
        except Exception as e:
            logging.error(f"threshold 계산 중 오류: {e}")
            threshold = 0.5  # 기본값 설정

    else:
        # depth가 0이 아닐 경우
        # 종료 조건 체크
        flag = check_termination_condition(chunk, depth)

        if flag==3:
            result = nonrecurrsive_chunking(chunk, similarity_matrix, top_keyword)
            return result, nodes_and_edges, already_made
        
        # chunk간의 유사도 구하기를 실패했을 때 재귀호출을 종료
        # depth가 1 이상일 경우, 이전 단계에서 tf-idf로 구하여 전달된 키워드가 top_keyword이다
        # 만족된 종료 조건이 있을 경우
        if flag != -1:
            result += [{ "chunks":chunk_indices, "keyword": top_keyword}]
            # 포맷 문자열 수정 및 변수명 오타(flag) 수정
            logging.info(f"depth {depth} 청킹 종료, flag:{flag}")
            return result , nodes_and_edges, already_made


    # 입력 그룹을 더 작은 그룹으로 분할
    new_chunk_groups = grouping_into_smaller_chunks(chunk_indices, similarity_matrix, threshold)

    # 생성된 작은 그룹들의 키워드를 추출하고 노드&엣지 생성
    nodes, edges, go_chunk, keywords = gen_node_edges_for_new_groups(chunk, new_chunk_groups, top_keyword, already_made, source_id)
    nodes_and_edges["nodes"]+=nodes
    nodes_and_edges["edges"]+=edges
    
    # 재귀적으로 함수를 호출하며 생성된 그룹을 더 세분화
    current_result = []
    for idx, c in enumerate(go_chunk):
        if idx > len(keywords)-1 or len(keywords)==0:
            logging.error(f"keyword generation error\nkeywords:{keywords}\nnumber of chunks:{len(go_chunk)}")
            break
        result, graph, already_made_updated = recurrsive_chunking(c, source_id ,depth+1, keywords[idx], already_made, similarity_matrix, threshold*1.1,)
        #중복되는 노드가 만들어지지 않도록 already_made를 업데이트
        already_made=already_made_updated
        current_result+=(result)
        nodes_and_edges["nodes"]+=graph["nodes"]
        nodes_and_edges["edges"]+=graph["edges"]

    return current_result, nodes_and_edges, already_made


def lda_keyword_and_similarity(chunk:list[dict]):
    """
    gensim의 lda 모델을 사용하여 청크의 토픽 키워드를 추출하고
    청크를 구성하는 각 문장의 토픽 벡터를 생성합니다.
    각 문장의 토픽 벡터간의 유사도를 내적으로 계산하여 유사도 행렬을 생성합니다.
    추출한 토픽 키워드, 생성한 lda 모델, 유사도 행렬을 반환합니다.

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
    top_topic_terms = lda_model.show_topic(0, topn= 5)
    # top_topic_terms가 비어있지 않고 첫 번째 요소가 존재하는지 확인
    top_keyword=""

    #LDA가 추출한 키워드 중 첫번째 명사 키워드를 top_keyword로 지정
    for topic in top_topic_terms:
        word_with_tag=okt.pos(topic[0], norm=True, stem=True)
        
        for word, tag in word_with_tag:
            if tag in ["Noun", "Alpha"]:
                top_keyword=word
                break
        
        if top_keyword != "":
            break


    return top_keyword, sim_matrix



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

    lang, _ =langid.classify(text)
    if lang=="en":
        logging.info("영어 텍스트입니다.")
    elif lang=="ko":    
        logging.info("한국어 텍스트입니다.")
    
    tokenized, sentences = split_into_tokenized_sentence(text, lang)
    
    #텍스트가 2000자 이상인 경우 재귀 청킹 함수를 호출한다
    if len(text)>=2000:
        chunks, nodes_and_edges, already_made = recurrsive_chunking(tokenized, source_id, 0, "", [],  None, 0)
        if chunks==[]:
            logging.info("chunking에 실패하였습니다.")
            
        logging.info("chunking이 완료되었습니다.")
        all_nodes=nodes_and_edges["nodes"]
        all_edges=nodes_and_edges["edges"]

    #텍스트가 1000자 이하인 경우는 재귀 청킹 함수을 호출하지 않는다.
    else:
        top_keyword, _ =lda_keyword_and_similarity(tokenized)
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
            relevant_sentences="".join(relevant_sentences)
            if c["keyword"] != "":
                nodes, edges, already_made = _extract_from_chunk(relevant_sentences, source_id, lang , c["keyword"], already_made)
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
    lang, _ =langid.classify(text)
    tokenized, sentences = split_into_tokenized_sentence(text, lang)
    chunks, _, _ =recurrsive_chunking(tokenized, "-1" , 0, [], None, 0, None, None)
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
