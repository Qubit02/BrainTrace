"""pip install gensim, scikit-learn, konlpy"""

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


#문단을 문자열 리스트로 입력으로 받아 tf-idf를 기반으로 문단 별 키워드를 추출합니다.
def extract_keywords_by_tfidf(tokenized_chunks:list[str], topn:int):
    #각 단어의 tf-idf 점수를 계산한 메트릭스를 생성합니다.
    vectorizer = TfidfVectorizer(stop_words=stop_words, max_features=1000)
    text_chunks = [' '.join(chunk) for chunk in tokenized_chunks]
    tfidf_matrix = vectorizer.fit_transform(text_chunks)
    feature_names = vectorizer.get_feature_names_out()

    #각 문단 i의 tf-idf 벡터를 배열로 변환하고, 값이 큰 순서대로 정렬 후 상위 5개를 추출합니다.
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


#의미있는 단어구들을 추출하여 토큰화
def tokenization(paragraphs: list[dict]) -> list[list[str]]:
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


def recurrsive_chunking(chunk: list[dict], source_id:int ,depth: int, already_made:list[str], top_keyword:str, threshold: int,
                        lda_model=None, dictionary=None, num_topics=5):
    
    # 종료 조건
    if depth > 0:
        # chunk가 세 문장 이하이거나 chunk의 크기가 20토큰 이하인 경우 더 이상 쪼개지 않음
        if len(chunk)<=3 or sum([len(c["tokens"]) for c in chunk])<=20:
            result = [{ "chunks": [c["index"] for c in chunk], "keyword": top_keyword}]
            return result ,{"nodes":[], "edges":[]}, already_made
        
        #depth가 5 이상일 경우 더 깊이 탐색하지 않음
        if(depth >= 5):
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
            else:
                result = [{ "chunks": [c["index"] for c in chunk], "keyword": top_keyword}]
 
            return result ,{"nodes":[], "edges":[]}, already_made


    #lda로 전체 텍스트의 키워드와 각 chunk의 주제간의 유사도를 구함
    # depth가 0일 경우 lda가 추론한 전체 텍스트의 topic이 해당 chunk(==full text)의 top keyword가 됨
    if depth==0:
        top_keyword, lda_model, similarity_matrix = lda_keyword_and_similarity(chunk, lda_model, dictionary)
    # depth가 1 이상일 경우, 이전 단계에서 tf-idf로 구하여 전달된 키워드가 top_keyword이다
    else:
        _, _, similarity_matrix = lda_keyword_and_similarity(chunk, lda_model, dictionary)


    #depth가 0인 경우 모든 문장들의 유사도들의 평균을 초기 threshold로 설정
    #이후에는 depth가 깊어질 때 마다 1.1씩 곱해짐
    if depth==0:
        flattened = similarity_matrix[np.triu_indices_from(similarity_matrix, k=1)]
        threshold = np.quantile(flattened, 0.25)

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
            if similarity_matrix[next_idx][next_idx-1]>=threshold:
                new_chunk.append(next_idx)
                visited.add(next_idx)
            else:
                break
        new_chunk_groups.append(new_chunk)

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
    nodes_and_edges={"nodes":[], "edges":[]}
    already_made=[] #중복된 노드 생성 방지를 위한 list
    keywords=[]

    #현재 chunk를 대표하는 top keyword를 노드로 생성
    #top keyword는 depth가 0일 경우 lda 모델이 추출한 전체 텍스트의 주제 키워드이다
    #depth가 0이 아닐 경우에는 이전 depth에서 전달한 tf-idf 방식으로 구한 해당 chunk의 키워드이다.
    if source_id != -1:
        top_node={"label":top_keyword,
                "name":top_keyword,
                "descriptions":[]
        }
        already_made.append(top_keyword)
        nodes_and_edges["nodes"].append(top_node)
        chunk_topics=extract_keywords_by_tfidf(get_topics, 7)

        #tf-idf방식으로 추출한 topic keyword 중 중복없이 하나를 뽑아 각 chunk의 대표 키워드로 삼는다
        for idx, topics in enumerate(chunk_topics):
            for t_idx in range(len(topics)):
                if topics[t_idx] not in already_made:
                    if sum([len(sentence["tokens"]) for sentence in go_chunk[idx]])< 20:
                        chunk_node={"label":topics[t_idx],"name":topics[t_idx],
                                    "descriptions":[c["index"] for c in go_chunk[idx]]}
                    else:
                        chunk_node={"label":topics[t_idx],"name":topics[t_idx],"descriptions":[]}
                    edge={"source": top_keyword, "target": topics[t_idx], "relation":"관련"}
                    nodes_and_edges["nodes"].append(chunk_node)
                    nodes_and_edges["edges"].append(edge)
                    already_made.append(topics[t_idx])
                    keywords.append(topics[t_idx])
                    break
                else:
                    if t_idx==len(topics):
                        keywords.append("None")
    else:
        keywords+=[""]*len(go_chunk)
    
    # 재귀적으로 각 청크 그룹을 더 세분화
    current_result = []
    for idx, c in enumerate(go_chunk):
        result, graph, already_made_updated = recurrsive_chunking(c, source_id ,depth+1, already_made, keywords[idx],threshold*1.1,
                                      lda_model=lda_model, dictionary=dictionary, num_topics=num_topics)
        #중복되는 노드가 만들어지지 않도록 already_made를 업데이트
        already_made=already_made_updated
        current_result+=(result)
        nodes_and_edges["nodes"]+=graph["nodes"]
        nodes_and_edges["edges"]+=graph["edges"]

    return current_result, nodes_and_edges, already_made


def lda_keyword_and_similarity(chunk, lda_model, dictionary):
    tokens = [c["tokens"] for c in chunk]
     
    # LDA 모델이 없으면 학습하고, 있으면 재사용
    if lda_model is None or dictionary is None:
        dictionary = corpora.Dictionary(tokens)
        corpus = [dictionary.doc2bow(text) for text in tokens]
        lda_model = models.LdaModel(corpus, num_topics=5, id2word=dictionary, passes=20, iterations=400, random_state=8)
    
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
        #text를 문단 단위로 쪼갬
    tokenized_sentences=[]
    texts=[]
    for p in re.split(r'(?<=[.!?])\s+', text.strip()):
        texts.append(p.strip())

    for idx, sentence in enumerate(texts):
        tokenized_sentences.append({"tokens":extract_noun_phrases(sentence),
                                    "index":idx})
        
    return tokenized_sentences, texts


def extract_graph_components(text: str, source_id: str):
    """
    input 텍스트의 전체 주제를 추출하고 재귀적으로 chunking을 시작합니다.
    chunking이 끝나면 return값을 바탕으로 노드와 엣지를 생성하여 반환합니다.
    """
    
    # 모든 노드와 엣지를 저장할 리스트
    all_nodes = []
    all_edges = []
    tokenized, sentences = split_into_tokenized_sentence(text)
    
    if len(text)>=2000:
        chunks, nodes_and_edges, already_made = recurrsive_chunking(tokenized, source_id, 0, [], "", 0,)
        logging.info("chunking이 완료되었습니다.")
        all_nodes=nodes_and_edges["nodes"]
        all_edges=nodes_and_edges["edges"]
    else:
        chunks=[{"chunks":list(range(len(sentences))), "keyword":""}]
        already_made=[]
        logging.info("chunking없이 노드와 엣지를 추출합니다.")

    #chunk의 크기가 2문장 이하인 노드는 그냥 chunk 자체를 노드로
    # 각 노드의 description을 문장 인덱스 리스트에서 실제 텍스트로 변환
    for node in all_nodes:
        if node["descriptions"] != []:
            resolved_description="".join([sentences[idx] for idx in node["descriptions"]])
            node["descriptions"]={"description":resolved_description,
                                    "source_id":source_id}
            node["original_sentences"]={"description":resolved_description,
                                    "source_id":source_id,
                                    "score": 1.0}
        else:
            node["descriptions"]=[{"description":"", "source_id":source_id}]
            
    for c in chunks:
        if "chunks" in c:
            current_chunk = c["chunks"]  # 리스트 of 리스트
            if len(current_chunk)<=2:
                continue
            relevant_sentences = [sentences[idx] for idx in current_chunk]
            nodes, edges, already_made = _extract_from_chunk(relevant_sentences, source_id,c["keyword"], already_made)
            all_nodes += nodes
            all_edges += edges



    logging.info(f"✅ 총 {len(all_nodes)}개의 노드와 {len(all_edges)}개의 엣지가 추출되었습니다.")
    return all_nodes, all_edges      


def manual_chunking(text:str):
    tokenized, sentences = split_into_tokenized_sentence(text)
    chunks, _, _ =recurrsive_chunking(tokenized, -1 , 0, {}, "", 0)
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



