import logging
import re
from konlpy.tag import Okt
from gensim import corpora, models
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
from collections import defaultdict
from .chunk_service import chunk_text
from .node_gen_ver5 import extract_nodes

okt = Okt()
# 불용어 정의 
stop_words = ['하다', '되다', '이다', '있다', '같다', '그리고', '그런데', '하지만', '또한', "매우", "것", "수", "때문에", "그러나"]


#문단을 문자열 리스트로 입력으로 받아 tf-idf를 기반으로 문단 별 키워드를 추출합니다.
def extract_keywords_by_tfidf(tokenized_chunks:list[str], topn=5):
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



def recurrsive_chunking(chunk: list[dict], depth: int, already_made:list[str], top_keyword:str, threshold: int,
                        lda_model=None, dictionary=None, num_topics=5):
    from sklearn.metrics.pairwise import cosine_similarity
    
    # 종료 조건
    if depth > 0:
        # chunk가 한 문장이라더 이상 쪼갤 수 없을 경우
        if len(chunk)==1:
            result = [{"depth": depth, "chunks": [c["index"] for c in chunk], "keyword": top_keyword}]
            return result ,{"nodes":[], "edges":[]}
        
        # depth가 5 이상이고 chunk 사이즈가 700토큰을 넘지 않을 경우
        # depth가 5 이상이더라도 chunk가 너무 크면 계속 chunking
        sizes = [len(c["tokens"]) for c in chunk]
        if( sum(sizes) < 700 and depth > 5):
            result = [{"depth": depth, "chunks": [c["index"] for c in chunk], "keyword": top_keyword}]
            return result ,{"nodes":[], "edges":[]}

    # LDA 모델이 없으면 학습하고, 있으면 재사용
    tokens = [c["tokens"] for c in chunk]
    if lda_model is None or dictionary is None:
        dictionary = corpora.Dictionary(tokens)
        corpus = [dictionary.doc2bow(text) for text in tokens]
        lda_model = models.LdaModel(corpus, num_topics=num_topics, id2word=dictionary, passes=10, random_state=35)

    # depth가 0일 경우 lda가 추론한 전체 텍스트의 topic이 해당 chunk(==full text)의 top keyword가 됨
    if depth==0:
        top_keyword, topic_vectors, _ = lda_keyword_and_similarity(tokens, lda_model, dictionary, num_topics, topn=1)
    # depth가 1 이상일 경우, 이전 단계에서 tf-idf로 구한 키워드가 top keyword로 전달됨 
    else:
        _, topic_vectors, _ = lda_keyword_and_similarity(tokens, lda_model, dictionary, num_topics, topn=1)
    # chunk 내부의 원소들 간의 유사도를 계산
    similarity_matrix = cosine_similarity(topic_vectors)


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
    already_made=[]
    keywords=[]

    top_node={"label":top_keyword,
              "name":top_keyword,
              "description":""
    }
    already_made.append(top_keyword)
    nodes_and_edges["nodes"].append(top_node)
    chunk_topics=extract_keywords_by_tfidf(get_topics, 7)


    for idx, topics in enumerate(chunk_topics):
        for t in topics:
            if t not in already_made:
                if sum([len(chunk["tokens"]) for chunk in go_chunk[idx]])< 30:
                    chunk_node={"label":t,"name":t,"description":[c["index"] for c in go_chunk[idx]]}
                else:
                    chunk_node={"label":t,"name":t,"description":""}
                edge={"source": top_keyword, "target": t, "relation":""}
                nodes_and_edges["nodes"].append(chunk_node)
                nodes_and_edges["edges"].append(edge)
                already_made.append(t)
                keywords.append(t)
                break
    
    current_result = []
    for idx, c in enumerate(go_chunk):
        print(f"depth {depth+1} 진입")
        result, graph = recurrsive_chunking(c, depth+1, already_made, keywords[idx],threshold*1.1,
                                      lda_model=lda_model, dictionary=dictionary, num_topics=num_topics)
        current_result+=(result)
        nodes_and_edges["nodes"]+=graph["nodes"]
        nodes_and_edges["edges"]+=graph["edges"]

    return current_result, nodes_and_edges


def lda_keyword_and_similarity(paragraphs_tokenized, lda_model, dictionary, num_topics=5, topn=1):
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

def split_into_tokenized_sentence(text:str):
        #text를 문단 단위로 쪼갬
    merge=""
    sentences=[]
    texts=[]
    index=0
    for p in re.split(r'(?<=[.!?])\s+', text.strip()):
        sentence = {
            "text": p.strip(),
            "index": index
        }
        sentences.append(sentence)
        texts.append(p.strip())
        index += 1
    return tokenization(sentences), texts

def extract_graph_components(text: str, source_id: str):
    """
    input 텍스트의 전체 주제를 추출하고 재귀적으로 chunking을 시작합니다.
    chunking이 끝나면 return값을 바탕으로 노드와 엣지를 생성하여 반환합니다.
    """
    
    # 모든 노드와 엣지를 저장할 리스트
    all_nodes = []
    all_edges = []

    tokenized, sentences = split_into_tokenized_sentence(text)
    print(tokenized)
    chunks, nodes_and_edges=recurrsive_chunking(tokenized, 0, [], "", threshold=0.6,)
    all_nodes=nodes_and_edges["nodes"]
    all_edges=nodes_and_edges["edges"]

    for node in all_nodes:
        if node["description"]!="":
            descriptions=""
            for idx in node["description"]:
                descriptions+=sentences[idx]
            node["description"]=descriptions
    
    logging.info(f"✅ 총 {len(all_nodes)}개의 노드와 {len(all_edges)}개의 엣지가 추출되었습니다.")
    return all_nodes, all_edges       
"""
    for c in chunks:
        chunk=""
        if len(c["chunks"])>5:
            for idx in c["chunks"]:
                chunk+=sentences[idx]
            nodes, edges=extract_nodes(chunk)
            all_nodes+=nodes
            all_edges+=edges

"""        


    #더 이상 청킹할 수 없을 때까지 재귀적으로 함수를 호출
    #"노드는 { \"label\": string, \"name\": string, \"description\": string } 형식의 객체 배열, "
    #"엣지는 { \"source\": string, \"target\": string, \"relation\": string } 형식의 객체 배열로 출력해줘. "

    #logging.info(f"✅ 총 개의 노드와 개의 청크가 추출되었습니다.")
    #return all_nodes, all_edges


def manual_chunking(text:str):
    tokenized, sentences = split_into_tokenized_sentence(text)
    chunks, nodes_and_edges=recurrsive_chunking(tokenized, 0, {}, "", threshold=0.6)
    nodes=nodes_and_edges["nodes"]
    edges=nodes_and_edges["edges"]
    #chunking 결과를 바탕으로, 더 이상 chunking하지 않는 chunk들은 node/edge를


    final_chunks=[]
    for c in chunks:
        chunk=""
        for idx in c["chunks"]:
            print(sentences[idx])
            chunk+=sentences[idx]
        final_chunks.append(chunk)
        print(final_chunks)
    return final_chunks


text = """보성전문학교 시절부터 대한민국 국내에서 오랫동안 인식되어 왔던 고려대의 모습은 하기와 같다.

① 야성적, 활동적, 정열적
고려대학교의 교풍은 야성, 활기와 정열 등으로 대표된다. 무섭고 사나운 호랑이, 강렬하게 검붉은 크림슨색 등 고대를 대표하거나 '고대' 하면 떠오르는 상징들은 대부분 위의 특징들과 연관된 경우가 많다. 이는 고려대학교가 그 전신인 보성전문학교 시절 사실상 유일한 민족·민립의 지도자 양성기구였기 때문에, 민족정신이라는 시대적 요구가 교수와 학생들에게 특별히 더 부하됐고, 그것이 학생들의 지사적 또는 투사적 저항 기질을 배태시켰던 데 기인한다는 견해가 있다.[20]

② 협동적, 끈끈함
고려대에서는 졸업생을 '동문', '동창' 등의 단어 대신 '교우(校友)'라고 부른다. 이는 학교를 같이 다녔다는 이유만으로 친구라는 의미이다. 사회에서 고려대 출신 간에는 유대가 매우 강한 편이며 이러한 문화는 개인주의 성향이 강해진 현대에도 사라지지 않고 건강하게 이어지고 있다. 고대에는 자기 이익만 앞세우려 하기보다는, 타인과 소통하고 서로의 장점을 살려 일을 분담함으로써 시너지를 내는 문화가 발달돼 있다. 또한 일대일 간의 관계보다는 폭넓은 집단 내에서의 관계를 더 선호하는 편이다.[21] 구성원들의 애교심이 워낙 커서 그런지, 정치적 이념 및 경제적 이해관계가 다르더라도 같은 고대 동문 사이에는 좀 더 상대방의 입장에 서서 생각해보고 인간적 신뢰에 입각하여 갈등을 풀어가려는 전통이 이어지고 있다. 실제로 고려대에는 동아리 조직이 발달해 그 구성원이 인간관계를 다지고 팀플레이를 하는 풍조가 강하다. 공부도 물론 중요시하지만, 개인의 성적만을 챙기는 능력보다는 인간관계를 충실히 하는 능력, 남을 이끄는 지도력이나 상급자, 동료와 화합하는 친화력 등을 더 높이 평가하는 편이다. 다른 그 무엇보다도 장기적인 대인관계와 신뢰감을 중시하는 습관, 조직을 위해 희생하고 봉사하고 오욕 뒤집어쓰는 일을 두려워하지 않는 기질이 이런 문화 속에서 길러지는 건 당연한 일이다.[22] 21세기 들어서 오프라인 커넥션만이 아니라 온라인 커넥션의 중요성이 매우 커졌는데, 이에 발맞춰 고대에서는 인터넷 커뮤니티도 매우 활발하게 운영되고 있다. 고려대학교 에브리타임도 상당히 활성화되어 있는 편이지만, 특히 고대의 자랑 중 하나인 고파스의 경우 각종 게시판에서 유통되고 누적되는 정보가 매우 방대할 뿐 아니라 영양가도 높다.[23]

③ 개방적, 포용적
고대생의 끈끈한 이미지를 생각한다면 외부에 대해 배타적이고 폐쇄적일 것처럼 생각하기 쉽지만 고려대 교수들 가운데 자교 출신 비율이 58.2%에 불과한 것,#[24] 꼭 고대 학부 출신이 아니더라도[25] 맡은 바 최선을 다한다면 선뜻 주류 교우로 받아들이는 문화 등에서 알 수 있듯이 고대는 오히려 외부에 대해 상당히 개방적인 태도를 취하는 학교다. 이는 고대생들의 인간관계가 소규모 그룹으로 이루어지는 게 아니라 대규모 커뮤니티 중심으로 이루어진다는 데 기인하는데, 꼭 고대 학부 출신이 아니더라도 고대 공동체 내에 잘 적응해 맡은 바 능력을 제대로 보여주기만 하면 고대 석박사 출신이어도 모교 학사 출신 못지 않게 교우로서 인정해 준다. 고대 공동체 구성원들이 각 교수 및 학생의 특기와 전문성을 존중하는 것 역시, 그들이 개인의 소소한 친밀감이나 친목의식보다 큰 조직 내에서의 역할 분담과 성취 의식을 더 지향한다는 데 기인한다. 교수들도 이런 학교의 문화에 큰 자긍심을 느끼며, 어느 학생이든 '고대'와의 인연이 있다면 언제나 그들을 반갑게 맞이 하고 함께할 준비가 되어 있다.

④ 굳건함, 집념
연구에 있어서는 특유의 집념과 저력을 발휘하는데, 그로 인해 지구력, 참을성, 우직함으로 장기간의 꾸준한 연구가 필요한 분야에서 강점을 보인다. 예를 들어 법학은 오랜 시간의 공부를 참아내야 하는 분야이고, 한학, 철학이나 역사학도 어마어마한 양의 독서를 요하는 분야이다. 이에 대해서는 캠퍼스 곳곳에 서 있는 육중한 석조 건물이 고대생의 기질에 영향을 미치는 것 같다는 말이 있다.

⑤ 비판적, 저항적
학문적 기조는, 기성 학문에 수긍하기보다 독자적 대안을 제시하려는 경향이 강한 편이다. 데이터 분석을 통한 수리논증이 대세가 될 때에 그에 맞서 이론분석의 방법론을 동등하게 강조하기도 했고, 미국/일본 유학파가 주류를 이룰 때에는 그에 맞서 영국, 프랑스, 독일 등의 학문을 적극적으로 도입하고 소개하기도 했다. 또한 새로운 사조가 들어와 학계의 주류가 되었을 때도 거기에 맹목적으로 따르지 않고 전통적, 기본적, 원칙적인 입장을 같이 강조해왔다. 일제 시절에는 일본 문화가 워낙 주류를 차지하다 보니 학문에 있어서도 민족주의적 경향이 매우 강했다.[26] 다만 광복을 맞은 지 오랜 시간이 지나 그 민족주의가 반대로 정치적 주류로 떠올랐고, 점차 병폐가 드러나게 된 이후로는 민족주의적 경향을 빠르게 희석시키고 있는 추세이기도 하다. 또한, 해방 이후 한글 쓰기 운동이 대두되고 대한민국 교육이 한문을 점점 소홀히 하기 시작할 때에는 한문 해석 능력의 저하를 우려해 학생들의 한문 실력을 대단히 중시했고, 이는 오늘날까지 일부 학과의 교내 졸업 요건에 한자 급수를 포함시킴으로써 이어 오고 있다.

⑥ 교풍의 변화
이렇듯 고려대의 학풍은 특유의 굳건함, 저력과 함께 정(情)이 합쳐진 모습으로 대표되어 왔고 이는 위에서 언급한 다양한 이점을 가지고 왔다. 그러나 과거에는 이러한 측면이 과다해 학내에 수직적, 강압적 악폐습이 존재했으며, 실제 동문 모임이나 학교 생활에서 일명 '고대인다운 모습'을 지나치게 강요하여 개인적 반발을 불러일으킨다는 측면도 일부 존재하였다. 고려대학교가 지켜 왔던 ‘굳건한 기질’ 역시 다르게 말하면 보수적, 즉 변화에 소극적이라는 단점이 될 수도 있는 것이었다. 실제로 21세기 들어 인터넷·디지털 혁명이 일어나고 법학과 의학 분야에 전문대학원 체제가 도입되며 이공계의 중요성이 강조되는 등 급격한 변화가 일어났지만, 고려대학교의 구성원은 이러한 변화를 따르는 것에 소극적이었다. 그러나 2010년대 이후 고려대학교의 공동체 문화 역시 자유주의와 개인주의를 상당 부분 수용하는 방향으로 다듬어졌으며,[27] 학사행정에 있어서도 혁신의 바람을 몰고 오는 등의 변화가 일어났다.[28] 이를 단적으로 보여주는 사례가 몇 가지 존재하는데 첫째는 총학생회의 장기간 계속되는 부재이다. 1990년대경까지 지속되었던 사회운동의 시대에 고려대는 그 중심에 서 있었고 이러한 학생운동의 흐름은 대개 사회주의 또는 PC주의 성향의 학생회 및 회장이 이어나가고 있었다. 그런데 이러한 자리가 장기간 공석이 된 것은, 출마한 후보의 자질 문제도 존재하지만, 궁극적으로는 과거와 같이 전체주의, 집단주의적 사상으로 똘똘 뭉쳐 정치 투쟁 방식으로 세상을 바꾼다는 생각 자체를 학생들이 더 이상 하지 않게 된 것이 크다고 할 수 있다. 요즘 학생들은 과거와 같은 민중혁명 방식보다 학문지식 또는 과학기술에 의한 진보 방식을 더 선호하는 추세이기 때문이다. 둘째로는 집단 행사의 약화이다. 본교에는 4.18 구국 대장정, 사발식과 같은 단체 행사가 많이 존재했으며 이는 한때 학교의 아이덴티티를 형성한다고 일컬어지기도 했다. 그러나 2010년대부터는 인권의 중요성이 부각됐고 그로 인해 이러한 행사 속에 묻혀 왔던 다양한 폐해가 드러나게 되자, 이에 맞춰 재학생들 사이에서는 강제 참여에 대한 비판론이 대두되었고 결국 이러한 행사는 옛날과 같은 일방적 강요가 아니라 선택적 참여로 바뀌는 수순을 밟게 됐다.[29] 이에 더하여 새로운 교육을 중시하는 자율형 고등학교 및 국제고 출신 학생, 해외 유학생이 늘면서 학과 내의 가부장적 색채나 시대착오적 위계 질서 또는 파시즘스러운 문화 행태 또한 학과를 가리지 않고 사라지게 되었다.[30]

상기를 종합하면, 고려대학교는 격동하는 한국 근현대사에서 특유의 끈끈한 공동체 정신 및 정의감 등으로 주목받았으나 이제는 변화하는 현대 사회의 요구에 맞게 과거의 공동체문 화에서 부정적인 부분은 보완하고 그와 동시에 자유주의적 면모를 더하여 새롭게 발전해 나가는, 신구의 조화를 이루어낸 대학교라고 할 수 있다. 분명 이는 긍정적인 변화이나, 자칫 너무 극단적인 변화를 추구하여 그간 유지된 고유의 기질까지 사라지지 않도록 하는 노력이 필요하다고 할 것이다."""

#extract_graph_components(text,"1234")
# print(manual_chunking(text))