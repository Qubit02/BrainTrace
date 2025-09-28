<img width="3000" height="500" alt="Brain Trace (3)" src="https://github.com/user-attachments/assets/8f92baaa-158e-4475-b34a-5f1f440649ac" />

<p align="center"><i>지식 그래프를 활용한 지식 관리 시스템</i></p>

Brain Trace System (BrainT)는 사용자가 업로드한 PDF, TXT, DOCX, Markdown 문서에서 핵심 개념과 개념 간의 관계를 자동으로 추출하고, 이를 지식 그래프 형태로 저장하여 활용하는 시스템입니다. 문서 내용을 단순히 저장하는 것을 넘어, 개념 단위로 구조화하여 탐색하고 활용할 수 있도록 돕습니다.

사용자가 질문을 입력하면, 시스템은 지식 그래프에서 관련된 개념들을 중심으로 의미 있는 노드들을 탐색하고, 필요 시 문서 내 해당 개념이 포함된 부분(청크)을 함께 가져와, 문서 기반의 답변을 제공합니다. 이때, 답변은 단순한 키워드 검색이 아닌, 그래프 구조를 따라 의미를 이해하고 연결하는 방식으로 생성됩니다. 또한, 기능을 로컬 또는 클라우드의 구동 환경을 선택하여 실행할 수 있으며, 외부 서버와의 연결 없이도 작동하므로 보안에 민감한 환경에서도 사용할 수 있습니다. 

문서를 계속 추가할수록 그래프는 더욱 정교해지고, 검색과 탐색의 깊이와 정확성도 함께 향상됩니다. 흩어져 있던 정보들이 유기적으로 연결되며, 지식은 단순히 쌓이는 것을 넘어 구조화되고 유의미하게 진화하는 형태로 재탄생합니다.

---

## 시스템 아키텍처

![시스템 아키텍처](https://github.com/user-attachments/assets/232bcdbe-6238-4b5b-8e5d-cace17a23d94)

---

## 지식 그래프 생성 파이프라인

<p>BrainTrace는 다양한 유형의 학습 자료를 다음의 다섯 단계로 지식 그래프로 변환합니다.</p>

<img width="2048" height="800" alt="flowchart_height_800" src="https://github.com/user-attachments/assets/f8efb47b-f155-466f-809b-d4ff0568e508" />

1. **텍스트 추출**:
   PDF, 텍스트 파일, 메모, Markdown, DOCX 등의 소스에서 텍스트를 추출합니다.

   ```python
   # backend/routers/brain_graph.py (발췌)
   @router.get("/getSourceContent",
       summary="소스 파일의 텍스트 내용 가져오기",
       description="주어진 source_id에 대한 파일 유형에 따라 텍스트 내용을 반환합니다.")
   async def get_source_content(source_id: str, brain_id: str):
       db = SQLiteHandler()
       pdf = db.get_pdf(int(source_id))
       textfile = db.get_textfile(int(source_id))
       memo = db.get_memo(int(source_id))
       md = db.get_mdfile(int(source_id))
       docx = db.get_docxfile(int(source_id))
       if pdf:
           content = pdf.get('pdf_text', '')
           title = pdf.get('pdf_title', '')
           file_type = 'pdf'
       elif textfile:
           content = textfile.get('txt_text', '')
           title = textfile.get('txt_title', '')
           file_type = 'textfile'
       # ... (memo/md/docx 분기에도 제목 포함)
       return {"content": content, "title": title, "type": file_type}
   ```

2. **토큰화**:
   추출된 텍스트를 의미 있는 단위(문장, 명사구 등)로 분할합니다.

   ```python
   # backend/services/node_gen_ver5.py (발췌)
   def split_into_tokenized_sentence(text:str):
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
   ```

3. **청킹**:
   주제별로 유사한 문장들을 묶어 전체 텍스트를 1000~2000자 사이의 청크로 분할합니다.
   지식 그래프의 골격을 생성합니다.

   ```python
   # backend/services/manual_chunking_sentences.py (발췌)
   def recurrsive_chunking(chunk: list[int], source_id:str ,depth: int, top_keyword:str ,already_made:list[str], similarity_matrix, threshold: int):
       """유사도/키워드 기반 재귀 청킹.

       로직 요약:
         - depth=0에서 LDA로 전체 토픽 키워드(top_keyword) 추정, 초기 threshold 계산
         - depth>0에서는 청크 크기/깊이 제한으로 종료 여부 판단
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
        # lda로 전체 텍스트의 키워드와 각 chunk의 주제간의 유사도를 구함
        # depth가 0일 경우 lda가 추론한 전체 텍스트의 topic이 해당 chunk(==full text)의 top keyword가 됨
        top_keyword, similarity_matrix = lda_keyword_and_similarity(chunk)
        already_made.append(top_keyword)
        top_keyword+="*"
        # 지식 그래프의 루트 노드를 생성
        top_node={"label":top_keyword,
            "name":top_keyword,
            "descriptions":[],
            "source_id":source_id
            }
        nodes_and_edges["nodes"].append(top_node)

        # 유사도 matrix의 하위 25% 값을 첫 임계값으로 설정
        # 이후에는 depth가 깊어질 때 마다 1.1씩 곱해짐
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
        result, graph, already_made_updated = recurrsive_chunking(c, source_id ,depth+1, keywords[idx], already_made, similarity_matrix, threshold*1.1,)
        #중복되는 노드가 만들어지지 않도록 already_made를 업데이트
        already_made=already_made_updated
        current_result+=(result)
        nodes_and_edges["nodes"]+=graph["nodes"]
        nodes_and_edges["edges"]+=graph["edges"]

    return current_result, nodes_and_edges, already_made
   ```

4. **노드 및 엣지 생성**:
   각 청크에서 개념(노드)과 관계(엣지)를 추출합니다.

   ```python
   # backend/services/node_gen_ver5.py (발췌)
   def _extract_from_chunk(sentences: list[str], source_id:str ,keyword: str, already_made:list[str]) -> tuple[dict, dict, list[str]]:
       """
       최종적으로 분할된 청크를 입력으로 호출됩니다.
       각 청크에서 노드와 엣지를 생성하고
       청킹 함수가 생성한 지식 그래프의 뼈대와 병합합니다.
       """
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

       # score순으로 topic keyword를 정렬
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
   ```

5. **그래프 병합**:
   모든 청크에서 노드/엣지를 통합된 지식 그래프로 병합합니다.
   ```python
   # backend/neo4j_db/Neo4jHandler.py (발췌)
   def insert_nodes_and_edges(self, nodes, edges, brain_id):
       def _insert(tx, nodes, edges, brain_id):
           for node in nodes:
               new_descriptions = [json.dumps(d, ensure_ascii=False) for d in node.get("descriptions", []) if isinstance(d, dict)]
               new_originals = [json.dumps(o, ensure_ascii=False) for o in node.get("original_sentences", []) if isinstance(o, dict)]
               tx.run(
                   """
                   MERGE (n:Node {name: $name, brain_id: $brain_id})
                   ON CREATE SET n.label=$label, n.descriptions=$new_descriptions, n.original_sentences=$new_originals
                   ON MATCH SET  n.label=$label,
                                 n.descriptions = CASE WHEN n.descriptions IS NULL THEN $new_descriptions ELSE n.descriptions + [item IN $new_descriptions WHERE NOT item IN n.descriptions] END,
                                 n.original_sentences = CASE WHEN n.original_sentences IS NULL THEN $new_originals ELSE n.original_sentences + [item IN $new_originals WHERE NOT item IN n.original_sentences] END
                   """,
                   name=node["name"], label=node["label"], new_descriptions=new_descriptions, new_originals=new_originals, brain_id=brain_id
               )
           for edge in edges:
               tx.run(
                   """
                   MATCH (a:Node {name:$source, brain_id:$brain_id})
                   MATCH (b:Node {name:$target, brain_id:$brain_id})
                   MERGE (a)-[r:REL {relation:$relation, brain_id:$brain_id}]->(b)
                   """,
                   source=edge["source"], target=edge["target"], relation=edge["relation"], brain_id=brain_id
               )
   ```

---

## 청킹 함수 동작 과정

<p>청킹 함수는 재귀적으로 호출되며 다음 동작을 반복합니다.</p>

<img width="960" height="460" alt="image" src="https://github.com/user-attachments/assets/ce93db48-6e44-4520-8d28-b4c3d6ea2623" />

1. **명사구 추출**: 텍스트를 문장 단위로 분할하고 명사구를 추출합니다.

   ```python
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

   ```

2. **LDA 모듈을 통한 주제 벡터 변환 & 유사도 계산**: 각 문장을 주제 벡터로 변환하고 벡터간의 내적값을 계산하여 행렬로 저장합니다.

   ```python
   # backend/services/manual_chunking_sentences.py (발췌)
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
       top_topic_terms = lda_model.show_topic(0, topn= 1)
       # top_topic_terms가 비어있지 않고 첫 번째 요소가 존재하는지 확인
       # (LDA 모델이 토픽을 생성하지 못했을 경우 방지)
       top_keyword = top_topic_terms[0][0] if top_topic_terms and len(top_topic_terms) > 0 else ""

       return top_keyword, sim_matrix
   ```

3. **Grouping**: 주제적으로 다른 문장 사이를 경계로 청크를 구성합니다.

   ```python
      # backend/services/manual_chunking_sentneces.py (발췌)
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

   ```

4. **각 청크에서 노드 및 엣지 생성**: 각 청크에서 tf-idf 키워드를 추출하고 노드와 엣지를 생성합니다.

   ```python
   # backend/services/manual_chunking_sentences.py (발췌)
   def extract_keywords_by_tfidf(tokenized_chunks: list[str]):
   """토큰화된 문장 리스트에서 TF-IDF 상위 키워드를 추출합니다.

   Args:
    tokenized_chunks: 토큰화된 문장의 리스트

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

   ```

지식 그래프에 대한 더 자세한 설명은 [KNOWLEDGE_GRAPH.md](./KNOWLEDGE_GRAPH.md)에서 확인할 수 있습니다.

---

## 결과물

<div style="margin-left:20px;">

<details open>
<summary>&nbsp;<b>홈 화면</b></summary>

![홈 화면](https://github.com/user-attachments/assets/4b7aaf24-4aa0-48e2-9a05-6552227d85d6)

</details>

<details open>
<summary>&nbsp;<b>메인 화면</b></summary>

![메인 화면](https://github.com/user-attachments/assets/787208fc-36d7-4942-9e6f-c9cf88ac3151)

</details>

</div>

### 주요 기능 데모

<table style="background-color:#ffffff; border-collapse:separate; border-spacing:10px;">
  <tr>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/97312636-239b-4b67-89b2-0d66bee06c63" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>새 프로젝트 생성</b></div>
      <div align="center"><sub>프로젝트 이름과 환경을 선택하여 새 프로젝트를 시작할 수 있습니다.</sub></div>
    </td>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/d6da0b94-91fd-403b-98a8-176905c8f4e9" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>업로드 시 그래프 생성</b></div>
      <div align="center"><sub>파일을 업로드하면 자동으로 노드와 엣지가 생성되어 그래프에 반영됩니다.</sub></div>
    </td>
  </tr>
  <tr><td colspan="2" style="height:16px;"></td></tr>
  <tr style="background-color:#ffffff;">
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/cfa1261a-5c2b-4205-ab56-88d42dc13f73" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>소스 하이라이팅</b></div>
      <div align="center"><sub>특정 소스를 클릭하여 내용을 확인하고 하이라이팅할 수 있습니다.</sub></div>
    </td>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/3037ef1f-a1ae-4eea-9316-9d440bdc0d97" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>Q&A 후 참조된 노드</b></div>
      <div align="center"><sub>답변에 사용된 노드를 그래프 뷰에서 확인할 수 있습니다.</sub></div>
    </td>
  </tr>
  <tr><td colspan="2" style="height:16px;"></td></tr>
  <tr style="background-color:#ffffff;">
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/1993ab88-c964-4a55-870d-432dd724c602" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>출처 보기</b></div>
      <div align="center"><sub>답변에 사용된 노드가 어떤 소스를 참고했는지 확인합니다.</sub></div>
    </td>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/1e08bce0-c322-43b0-8f8c-91e231e8bee5" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>소스 노드 보기</b></div>
      <div align="center"><sub>특정 소스가 생성한 노드를 그래프 뷰에서 확인합니다.</sub></div>
    </td>
  </tr>
  <tr><td colspan="2" style="height:16px;"></td></tr>
  <tr style="background-color:#ffffff;">
    <td width="50%" valign="top" style="padding:8px; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/1c7bebe5-246b-4495-9fda-9758d610740a" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>메모 작성 및 소스로 추가</b></div>
      <div align="center"><sub>메모를 작성하고 소스로 변환하여 그래프에 반영할 수 있습니다.</sub></div>
    </td> 
    <td width="50%" valign="top" style="padding:8px; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/afe3a647-cb89-47ec-a024-0b2516f154c9" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>음성에서 메모 생성</b></div>
      <div align="center"><sub>녹음된 오디오를 텍스트로 변환하여 메모로 저장합니다.</sub></div>
    </td>
  </tr>
  <tr><td colspan="2" style="height:16px;"></td></tr>
  <tr style="background-color:#ffffff;">
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/79a58805-a6b2-4e08-88ff-6dfe9d301acd" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>소스 삭제</b></div>
      <div align="center"><sub>특정 소스를 삭제하면 해당 소스로 생성된 노드도 함께 삭제됩니다.</sub></div>
    </td>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/8497e9c6-d81d-4419-8509-8336fb8ab666" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>탐색 기능</b></div>
      <div align="center"><sub>파일 내용이나 키워드로 유사한 소스를 찾습니다.</sub></div>
    </td>
  </tr>
  <tr><td colspan="2" style="height:16px;"></td></tr>
  <tr>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/921bb0fd-0812-4e5a-ad12-fcb24cec4b76" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>전체 화면 라이트 모드 노드 검색</b></div>
      <div align="center"><sub>노드 검색으로 원하는 노드로 카메라를 이동합니다.</sub></div>
    </td>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://raw.githubusercontent.com/yes6686/portfolio/main/전체화면 다크모드.gif" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>전체 화면 다크 모드</b></div>
      <div align="center"><sub>어두운 테마에서 그래프를 탐색하며 속성을 자유롭게 조절합니다.</sub></div>
    </td>
  </tr>
</table>

---

## 시연 영상

<div align="center">
  <a href="https://youtu.be/CkKStA9WHhY" target="_blank">
    <img src="https://img.youtube.com/vi/CkKStA9WHhY/maxresdefault.jpg" alt="데모 비디오" style="width:70%; max-width:500px; border:2px solid #ddd; border-radius:10px; box-shadow:0 4px 8px rgba(0,0,0,0.2); transition: transform 0.2s;" />
  </a>
</div>

---

## 팀원 소개

|                         팀장 / Full Stack                         |                                Backend                                 |                               DevOps                               |                                AI                                 |
| :---------------------------------------------------------------: | :--------------------------------------------------------------------: | :----------------------------------------------------------------: | :---------------------------------------------------------------: |
| <img src="https://github.com/yes6686.png?size=200" width="100" /> | <img src="https://github.com/kimdonghyuk0.png?size=200" width="100" /> | <img src="https://github.com/Mieulchi.png?size=200" width="100" /> | <img src="https://github.com/selyn-a.png?size=200" width="100" /> |
|               [안예찬](https://github.com/yes6686)                |               [김동혁](https://github.com/kimdonghyuk0)                |               [유정균](https://github.com/Mieulchi)                |               [장세린](https://github.com/selyn-a)                |

---

라이선스는 저장소의 [LICENSE](./LICENSE) 파일을 참고하세요.
