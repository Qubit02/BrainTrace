# 지식그래프(Knowledge Graph) 상세 설명

## 📋 목차

<details>
<summary><b>1. 지식그래프란 무엇인가?</b></summary>
<div markdown="1">

### 1.1 지식그래프의 정의

지식 그래프는 관련 있는 정보를 서로 연결된 그래프 형태로 표현하는 기술입니다. 데이터를 통합하고 연결해 사용자에 대한 이해를 높이고, 빠른 정보 검색과 추론을 지원합니다. 개인화된 인공지능(AI)을 구현하는 핵심 기술 중 하나로 꼽힙니다.

지식 그래프는 정보를 **노드(개체)**와 **엣지(관계)**로 구조화하여 데이터 간의 관계와 맥락을 이해하고, 새로운 지식을 추론하는 데 사용되는 그래프 데이터베이스의 한 유형입니다. 다양한 데이터 소스에서 정보를 수집하고 연결하여 복잡한 질문에 대한 답변을 제공하고 의미 있는 연관성을 발견하는 데 매우 유용합니다.

### 1.2 지식그래프의 구성 요소

#### 노드(Node)
- **정의**: 문서에서 추출된 핵심 개념이나 개체를 나타냅니다
- **BrainT에서의 역할**: AI 모델이나 수동 청킹을 통해 텍스트에서 중요한 개념들을 노드로 추출
- **속성**: `name`(개체명), `label`(분류), `description`(설명) 등

#### 엣지(Edge)
- **정의**: 노드 간의 의미적 관계를 나타냅니다
- **BrainT에서의 역할**: "포함하다", "관련되다", "영향을 주다" 등의 관계를 엣지로 표현
- **속성**: `source`(시작 노드), `target`(도착 노드), `relation`(관계 유형)

#### 속성(Properties)
- **정의**: 노드와 엣지에 추가되는 메타데이터입니다
- **BrainT에서의 역할**: `source_id`(출처 문서), `original_sentences`(원문 문장), `descriptions`(다중 설명) 등의 속성을 관리

### 1.3 지식그래프의 장점

#### 1.3.1 의미적 데이터 통합
- 다양한 출처의 데이터를 통합하고, 의미적으로 연결할 수 있습니다
- 예: 여러 데이터베이스에서 "Apple"이라는 단어가 있을 때, 지식 그래프는 문맥에 따라 "사과"와 "애플사"를 구분할 수 있습니다

#### 1.3.2 강력한 검색 및 질의
- 복잡한 질문에 대한 답변을 제공할 수 있습니다
- 예: "셰익스피어의 작품 중 영화로 제작된 것은?" 같은 질문에 대해 지식 그래프는 관련된 정보를 연결하여 답변할 수 있습니다

#### 1.3.3 추론과 발견
- 데이터를 단순히 저장하는 것뿐만 아니라, 데이터 간의 관계를 통해 새로운 지식을 추론할 수 있습니다
- 예: 새로운 학술 논문이 추가되면, 기존 연구와의 연관성을 통해 새로운 연구 방향을 제안할 수 있습니다

#### 1.3.4 데이터의 재사용과 상호 운용성
- 데이터 모델이 유연하고 확장 가능하여 다양한 도메인에서 쉽게 재사용될 수 있습니다
- 예: 건강, 금융, 교육 등 여러 도메인에서 동일한 지식 그래프 구조를 사용할 수 있습니다

</div>
</details>

<details>
<summary><b>2. BrainT에서 지식그래프를 사용하는 이유</b></summary>
<div markdown="1">

### 2.1 기존 검색 시스템의 한계

#### 2.1.1 키워드 기반 검색의 문제점
- **정확도 부족**: 단순한 키워드 매칭으로 인한 부정확한 검색 결과
- **맥락 이해 부족**: 사용자의 의도를 제대로 파악하지 못함
- **관련성 부족**: 키워드가 같지만 의미가 다른 경우를 구분하지 못함

#### 2.1.2 문서 기반 검색의 한계
- **구조화 부족**: 문서 간의 관계를 파악하지 못함
- **재사용성 부족**: 한 번 검색한 정보를 다른 맥락에서 활용하기 어려움
- **확장성 부족**: 새로운 정보 추가 시 기존 정보와의 연관성을 파악하기 어려움

### 2.2 지식그래프 기반 접근의 장점

#### 2.2.1 의미적 이해
- **개체 인식**: 문서에서 중요한 개념들을 자동으로 추출하여 개체로 인식
- **관계 파악**: 개체 간의 의미적 관계를 자동으로 추출하여 연결
- **맥락 이해**: 사용자 질문의 의도를 더 정확하게 파악

#### 2.2.2 정확한 답변 생성
- **관련 정보 연결**: 질문과 관련된 모든 정보를 그래프를 통해 연결
- **추론 가능**: 직접적으로 언급되지 않은 정보도 관계를 통해 추론
- **출처 추적**: 답변의 근거가 되는 원문을 정확히 추적 가능

#### 2.2.3 시각적 이해
- **직관적 표현**: 복잡한 정보를 그래프 형태로 직관적으로 표현
- **관계 시각화**: 문서 간의 관계를 시각적으로 확인 가능
- **탐색 용이**: 그래프를 통해 관련 정보를 쉽게 탐색 가능

### 2.3 BrainT의 지식그래프 활용 방식

#### 2.3.1 자동 지식 추출
BrainT는 두 가지 방식으로 지식 그래프를 생성합니다:

**1. AI 모델 기반 추출 (GPT/Ollama)**
```python
# backend/routers/brain_graph.py - 실제 프로젝트 코드
async def process_text_endpoint(request_data: ProcessTextRequest):
    text = request_data.text
    source_id = request_data.source_id
    brain_id = request_data.brain_id
    model = request_data.model
    
    # AI 모델 선택
    if model == "gpt":
        ai_service = get_ai_service_GPT()
    elif model == "ollama":
        ai_service = get_ai_service_Ollama()
    
    # 텍스트에서 노드/엣지 추출
    nodes, edges = ai_service.extract_graph_components(text, source_id)
    
    # Neo4j에 그래프 데이터 저장
    neo4j_handler = Neo4jHandler()
    neo4j_handler.insert_nodes_and_edges(nodes, edges, brain_id)
    
    # 벡터 데이터베이스에 임베딩 저장
    embedding_service.update_index_and_get_embeddings(nodes, brain_id)
```

**2. 수동 청킹 기반 추출 (LDA + TF-IDF)**
```python
# backend/services/manual_chunking_sentences.py - 실제 프로젝트 코드
def extract_graph_components(text: str, source_id: str):
    # 문장 단위 분리 및 토큰화
    tokenized, sentences = split_into_tokenized_sentence(text)
    
    # 재귀적 청킹 (LDA 기반 주제 모델링)
    if len(text) >= 2000:
        chunks, nodes_and_edges, already_made = recurrsive_chunking(
            tokenized, source_id, 0, [], "", 0
        )
        all_nodes = nodes_and_edges["nodes"]
        all_edges = nodes_and_edges["edges"]
    else:
        chunks = [{"chunks": list(range(len(sentences))), "keyword": ""}]
        already_made = []
    
    # 각 청크에서 노드/엣지 추출
    for chunk in chunks:
        if len(chunk["chunks"]) <= 2:
            continue
        relevant_sentences = [sentences[idx] for idx in chunk["chunks"]]
        nodes, edges, already_made = _extract_from_chunk(
            relevant_sentences, source_id, chunk["keyword"], already_made
        )
        all_nodes += nodes
        all_edges += edges
    
    return all_nodes, all_edges
```

#### 2.3.2 벡터 기반 검색
```python
# backend/services/embedding_service.py - 실제 프로젝트 코드
def update_index_and_get_embeddings(nodes: List[Dict], brain_id: str):
    collection_name = get_collection_name(brain_id)
    
    # 여러 포맷으로 텍스트 생성
    formats = [
        "{name}는 {label}이다. {description}",
        "{name} ({label}): {description}",
        "{label}인 {name}에 대한 설명: {description}",
        "{description}"
    ]
    
    for node in nodes:
        for desc in node["descriptions"]:
            description = desc.get("description")
            if not description:
                continue
            
            for idx, fmt in enumerate(formats):
                # 텍스트 생성
                text = fmt.format(
                    name=node["name"], 
                    label=node["label"], 
                    description=description
                )
                
                # 임베딩 생성
                embedding = encode_text(text)
                
                # Qdrant에 저장
                client.upsert(
                    collection_name=collection_name,
                    points=[models.PointStruct(
                        id=str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{source_id}_{idx}_{description}")),
                        vector=embedding,
                        payload={
                            "source_id": node["source_id"],
                            "name": node["name"],
                            "label": node["label"],
                            "description": description
                        }
                    )]
                )
```

#### 2.3.3 그래프 기반 답변 생성
```python
# backend/routers/brain_graph.py - 실제 프로젝트 코드
async def answer_endpoint(request_data: AnswerRequest):
    question = request_data.question
    brain_id = str(request_data.brain_id)
    model = request_data.model
    
    # 1. 벡터 검색으로 관련 노드 찾기
    similar_nodes = embedding_service.search_similar_nodes(
        question, brain_id, top_k=5
    )
    
    # 2. Neo4j에서 2단계 깊이 스키마 추출
    neo4j_handler = Neo4jHandler()
    graph_schema = neo4j_handler.query_schema_by_node_names(
        [node["name"] for node in similar_nodes], brain_id
    )
    
    # 3. AI 모델로 답변 생성
    if model == "gpt":
        ai_service = get_ai_service_GPT()
    else:
        ai_service = get_ai_service_Ollama()
    
    answer = ai_service.generate_answer(question, graph_schema)
    
    # 4. 정확도 점수 계산
    accuracy_score = compute_accuracy(similar_nodes, answer)
    
    return {
        "answer": answer,
        "sources": collect_source_info(similar_nodes),
        "confidence_score": accuracy_score
    }
```

</div>
</details>

<details>
<summary><b>3. 지식그래프 생성 과정</b></summary>
<div markdown="1">

### 3.1 텍스트 전처리 단계

#### 3.1.1 문서 업로드 및 텍스트 추출
- **지원 형식**: PDF, TXT, MD, DOCX 등 다양한 문서 형식
- **텍스트 정제**: 특수문자 처리, 인코딩 통일, 불필요한 공백 제거
- **메타데이터 추출**: 문서 제목, 작성자, 날짜 등 기본 정보 수집

#### 3.1.2 텍스트 청킹 (Text Chunking)
```python
def chunk_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    return text_splitter.split_text(text)
```

#### 3.1.3 문장 단위 분리
```python
def split_into_sentences(text: str):
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [{"tokens": extract_noun_phrases(sentence), "index": idx} 
            for idx, sentence in enumerate(sentences)]
```

### 3.2 AI 모델 기반 지식 추출

#### 3.2.1 프롬프트 생성
BrainT는 AI 모델에게 구조화된 프롬프트를 제공하여 일관된 결과를 얻습니다:

```python
# backend/services/ollama_service.py - 실제 프로젝트 코드
def _extract_from_chunk(self, chunk: str, source_id: str):
    prompt = (
        "다음 텍스트를 분석해서 노드와 엣지 정보를 추출해줘. "
        "노드는 { \"label\": string, \"name\": string, \"description\": string } 형식의 객체 배열, "
        "엣지는 { \"source\": string, \"target\": string, \"relation\": string } 형식의 객체 배열로 출력해줘. "
        "여기서 source와 target은 노드의 name을 참조해야 하고, source_id는 사용하면 안 돼. "
        "출력 결과는 반드시 아래 JSON 형식을 준수해야 해:\n"
        "{\n"
        '  "nodes": [ ... ],\n'
        '  "edges": [ ... ]\n'
        "}\n"
        "문장에 있는 모든 개념을 노드로 만들어줘"
        "각 노드의 description은 해당 노드를 간단히 설명하는 문장이어야 해. "
        "만약 텍스트 내에 하나의 긴 description에 여러 개념이 섞여 있다면, 반드시 개념 단위로 나누어 여러 노드를 생성해줘. "
        "description은 하나의 개념에 대한 설명만 들어가야 해"
        "노드의 label과 name은 한글로 표현하고, 불필요한 내용이나 텍스트에 없는 정보는 추가하지 말아줘. "
        "노드와 엣지 정보가 추출되지 않으면 빈 배열을 출력해줘.\n\n"
        "json 형식 외에는 출력 금지"
        f"텍스트: {chunk}"
    )
    
    resp = chat(
        model=self.model_name,
        messages=[
            {"role": "system", "content": "당신은 노드/엣지 추출 전문가입니다."},
            {"role": "user", "content": prompt}
        ],
        stream=False
    )
    content = resp["message"]["content"]
    data = json.loads(content)
```

#### 3.2.2 노드/엣지 추출
```python
# backend/services/ollama_service.py - 실제 프로젝트 코드
def extract_graph_components(self, text: str, source_id: str):
    all_nodes, all_edges = [], []
    chunks = chunk_text(text) if len(text) >= 2000 else [text]
    logging.info(f"총 {len(chunks)}개 청크로 분할")
    
    for idx, chunk in enumerate(chunks, 1):
        logging.info(f"청크 {idx}/{len(chunks)} 처리")
        nodes, edges = self._extract_from_chunk(chunk, source_id)
        all_nodes.extend(nodes)
        all_edges.extend(edges)
    
    return (
        self._remove_duplicate_nodes(all_nodes),
        self._remove_duplicate_edges(all_edges)
    )
```

#### 3.2.3 검증 및 후처리
```python
# backend/services/ollama_service.py - 실제 프로젝트 코드
def _extract_from_chunk(self, chunk: str, source_id: str):
    # ... AI 모델 호출 ...
    
    # 노드 검증
    valid_nodes = []
    for node in data.get("nodes", []):
        if not all(k in node for k in ("label", "name")):
            logging.warning("잘못된 노드: %s", node)
            continue
        node.setdefault("descriptions", [])
        node["source_id"] = source_id
        if desc := node.pop("description", None):
            node["descriptions"].append({"description": desc, "source_id": source_id})
        valid_nodes.append(node)

    # 엣지 검증
    node_names = {n["name"] for n in valid_nodes}
    valid_edges = []
    for edge in data.get("edges", []):
        if all(k in edge for k in ("source", "target", "relation")):
            if edge["source"] in node_names and edge["target"] in node_names:
                valid_edges.append(edge)
            else:
                logging.warning("잘못된 엣지 참조: %s", edge)
        else:
            logging.warning("스키마 누락 엣지: %s", edge)
```

### 3.3 원문 매칭 및 임베딩 생성

#### 3.3.1 코사인 유사도 계산
```python
# backend/services/ollama_service.py - 실제 프로젝트 코드
def _match_original_sentences(self, node: Dict, sentences: List[str]):
    # 노드 설명 임베딩 생성
    desc_embedding = encode_text(node["description"])
    
    # 모든 문장 임베딩 생성
    sentence_embeddings = [encode_text(s) for s in sentences]
    
    # 코사인 유사도 계산
    similarities = cosine_similarity(sentence_embeddings, [desc_embedding])
    
    # threshold 이상인 문장들 선택
    matched_sentences = []
    for i, score in enumerate(similarities.flatten()):
        if score >= 0.8:  # threshold
            matched_sentences.append({
                "original_sentence": sentences[i],
                "source_id": node["source_id"],
                "score": round(float(score), 4)
            })
    
    return matched_sentences
```

#### 3.3.2 원문 문장 매칭
```python
# backend/services/ollama_service.py - 실제 프로젝트 코드
def _extract_from_chunk(self, chunk: str, source_id: str):
    # ... 노드/엣지 추출 ...
    
    # 원문 문장 매칭
    sentences = manual_chunking(chunk)
    for node in valid_nodes:
        if node["descriptions"]:
            matched_sentences = self._match_original_sentences(node, sentences)
            node["original_sentences"] = matched_sentences
        else:
            node["original_sentences"] = []
```

### 3.4 데이터베이스 저장

#### 3.4.1 Neo4j 그래프 데이터베이스 저장
```python
# backend/neo4j_db/Neo4jHandler.py - 실제 프로젝트 코드
def insert_nodes_and_edges(self, nodes, edges, brain_id):
    def _insert(tx, nodes, edges, brain_id):
        # 노드 저장
        for node in nodes:
            # descriptions를 JSON 문자열로 변환
            new_descriptions = []
            for desc in node.get("descriptions", []):
                if isinstance(desc, dict):
                    new_descriptions.append(json.dumps(desc, ensure_ascii=False))

            # original_sentences를 JSON 문자열로 변환
            new_originals = []
            for orig in node.get("original_sentences", []):
                if isinstance(orig, dict):
                    new_originals.append(json.dumps(orig, ensure_ascii=False))

            tx.run("""
                MERGE (n:Node {name: $name, brain_id: $brain_id})
                ON CREATE SET
                    n.label = $label,
                    n.brain_id = $brain_id,
                    n.descriptions = $new_descriptions,
                    n.original_sentences = $new_originals
                ON MATCH SET 
                    n.label = $label, 
                    n.brain_id = $brain_id,
                    n.descriptions = CASE 
                        WHEN n.descriptions IS NULL THEN $new_descriptions 
                        ELSE n.descriptions + [item IN $new_descriptions WHERE NOT item IN n.descriptions] 
                    END,
                    n.original_sentences = CASE
                        WHEN n.original_sentences IS NULL THEN $new_originals
                        ELSE n.original_sentences + [item IN $new_originals WHERE NOT item IN n.original_sentences]
                    END
            """, name=node["name"], label=node["label"],
                 new_descriptions=new_descriptions,
                 new_originals=new_originals,
                 brain_id=brain_id)

        # 엣지 저장
        for edge in edges:
            tx.run("""
                MATCH (a:Node {name: $source, brain_id: $brain_id})
                MATCH (b:Node {name: $target, brain_id: $brain_id})
                MERGE (a)-[r:REL {relation: $relation, brain_id: $brain_id}]->(b)
            """, source=edge["source"], target=edge["target"],
                 relation=edge["relation"], brain_id=brain_id)

    with self.driver.session() as session:
        session.execute_write(_insert, nodes, edges, brain_id)
```

#### 3.4.2 Qdrant 벡터 데이터베이스 저장
```python
# backend/services/embedding_service.py - 실제 프로젝트 코드
def update_index_and_get_embeddings(nodes: List[Dict], brain_id: str):
    collection_name = get_collection_name(brain_id)
    
    # 여러 포맷으로 텍스트 생성
    formats = [
        "{name}는 {label}이다. {description}",
        "{name} ({label}): {description}",
        "{label}인 {name}에 대한 설명: {description}",
        "{description}"
    ]
    
    for node in nodes:
        for desc in node["descriptions"]:
            description = desc.get("description")
            if not description:
                continue
            
            for idx, fmt in enumerate(formats):
                # 텍스트 생성
                text = fmt.format(
                    name=node["name"], 
                    label=node["label"], 
                    description=description
                )
                
                # 임베딩 생성
                embedding = encode_text(text)
                
                # 고유 point_id 생성
                pid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{source_id}_{idx}_{description}"))
                
                # Qdrant에 저장
                client.upsert(
                    collection_name=collection_name,
                    points=[models.PointStruct(
                        id=pid,
                        vector=embedding,
                        payload={
                            "source_id": node["source_id"],
                            "name": node["name"],
                            "label": node["label"],
                            "description": description,
                            "point_id": pid
                        }
                    )]
                )
```

</div>
</details>

<details>
<summary><b>4. 지식그래프 활용 사례</b></summary>
<div markdown="1">

### 4.1 질의응답 시스템

#### 4.1.1 의미적 검색
BrainT는 벡터 기반 검색을 통해 사용자 질문과 관련된 노드들을 찾습니다:

```python
# backend/routers/brain_graph.py - 실제 프로젝트 코드
async def answer_endpoint(request_data: AnswerRequest):
    question = request_data.question
    brain_id = str(request_data.brain_id)
    model = request_data.model
    
    # 1. 벡터 검색으로 관련 노드 찾기
    similar_nodes = embedding_service.search_similar_nodes(
        question, brain_id, top_k=5
    )
    
    # 2. Neo4j에서 2단계 깊이 스키마 추출
    neo4j_handler = Neo4jHandler()
    graph_schema = neo4j_handler.query_schema_by_node_names(
        [node["name"] for node in similar_nodes], brain_id
    )
    
    # 3. AI 모델로 답변 생성
    if model == "gpt":
        ai_service = get_ai_service_GPT()
    else:
        ai_service = get_ai_service_Ollama()
    
    answer = ai_service.generate_answer(question, graph_schema)
    
    # 4. 정확도 점수 계산
    accuracy_score = compute_accuracy(similar_nodes, answer)
    
    return {
        "answer": answer,
        "sources": collect_source_info(similar_nodes),
        "confidence_score": accuracy_score
    }
```

#### 4.1.2 답변 생성 과정
```python
# backend/services/ollama_service.py - 실제 프로젝트 코드
def generate_answer(self, question: str, graph_schema: Dict):
    # 그래프 스키마를 컨텍스트로 변환
    context = self._build_context_from_schema(graph_schema)
    
    # 프롬프트 생성
    prompt = f"""
    다음 정보를 바탕으로 질문에 답변해주세요.
    
    컨텍스트:
    {context}
    
    질문: {question}
    
    답변은 다음 형식으로 제공해주세요:
    1. 질문에 대한 직접적인 답변
    2. 답변의 근거가 되는 정보들
    3. 참고할 수 있는 추가 정보들
    """
    
    # AI 모델로 답변 생성
    resp = chat(
        model=self.model_name,
        messages=[
            {"role": "system", "content": "당신은 지식 그래프 기반 답변 생성 전문가입니다."},
            {"role": "user", "content": prompt}
        ],
        stream=False
    )
    
    return resp["message"]["content"]

def _build_context_from_schema(self, graph_schema: Dict) -> str:
    context_parts = []
    
    # 노드 정보 추가
    if "nodes" in graph_schema:
        for node in graph_schema["nodes"]:
            context_parts.append(f"- {node['name']} ({node['label']}): {node.get('description', '')}")
    
    # 관계 정보 추가
    if "relationships" in graph_schema:
        for rel in graph_schema["relationships"]:
            context_parts.append(f"- {rel['source']} {rel['relation']} {rel['target']}")
    
    return "\n".join(context_parts)
```

**정확도 계산:**
```python
# backend/services/accuracy_service.py - 실제 프로젝트 코드
def compute_accuracy(
    answer: str,
    referenced_nodes: List[str],
    brain_id: str,
    Q: float,  # Retrieval Quality
    raw_schema_text: str,
    w_Q: float = 0.2,  # Retrieval Quality 가중치
    w_S: float = 0.7,  # Semantic Similarity 가중치
    w_C: float = 0.1   # Coverage 가중치
) -> float:
    """
    답변의 정확도를 계산합니다.
    
    Args:
        answer: LLM이 생성한 답변 텍스트
        referenced_nodes: 참조된 노드 이름 리스트
        brain_id: 브레인 ID
        Q: 이미 계산된 Retrieval Quality
        raw_schema_text: 스키마 텍스트
        w_Q, w_S, w_C: 각 지표의 가중치
    
    Returns:
        가중합 정확도 = w_Q*Q + w_S*S + w_C*C
    """
    # S (Semantic Similarity) 계산
    answer_clean = answer.split("[참고된 노드 목록]")[0].strip()
    node_names = sorted(set(referenced_nodes))
    
    # Neo4j에서 노드 설명 조회
    neo4j_handler = Neo4jHandler()
    context_sentences = []
    for name in node_names:
        entries = neo4j_handler.get_node_descriptions(name, brain_id)
        for entry in entries:
            desc = entry.get("description")
            if desc:
                context_sentences.append(f"{name} : {desc}")
    
    # 컨텍스트 텍스트 생성 및 임베딩
    context_text = "\n".join(context_sentences)
    if not context_text:
        S = 0.0
    else:
        answer_vec = encode(answer_clean)
        context_vec = encode(context_text)
        sim = cosine_similarity(
            np.array(answer_vec).reshape(1, -1),
            np.array(context_vec).reshape(1, -1)
        )[0][0]
        S = round(float(sim), 4)
    
    # C (Coverage) 계산
    provided_names = set()
    for segment in raw_schema_text.split("->"):
        segment = segment.strip()
        if "(" not in segment:
            continue
        before_paren = segment.split("(", 1)[0].strip()
        if "-" in before_paren:
            name = before_paren.split("-", 1)[1].strip()
        else:
            name = before_paren.strip()
        name = name.replace(" ", "")
        provided_names.add(name)
    
    ref_names = {n.replace(" ", "") for n in referenced_nodes if isinstance(n, str)}
    C = len(ref_names & provided_names) / len(provided_names) if provided_names else 0.0
    
    # 최종 정확도 계산
    Acc = w_Q * Q + w_S * S + w_C * C
    return round(Acc, 3)
```

### 4.2 시각화 및 탐색

#### 4.2.1 3D 그래프 시각화
- **노드 표현**: 각 노드를 3D 공간의 점으로 표현
- **엣지 표현**: 노드 간의 관계를 선으로 표현
- **인터랙션**: 마우스로 노드를 드래그하여 위치 조정 가능

#### 4.2.2 하이라이팅 기능
- **검색 결과 하이라이팅**: 검색된 노드들을 특별한 색상으로 표시
- **관계 하이라이팅**: 선택된 노드와 연결된 엣지들을 강조 표시
- **경로 하이라이팅**: 두 노드 간의 최단 경로를 시각적으로 표시

### 4.3 지식 분석 및 통찰

#### 4.3.1 중심성 분석
BrainT는 Neo4j의 그래프 알고리즘을 활용하여 노드의 중요도를 분석합니다:

```python
# backend/neo4j_db/Neo4jHandler.py - 실제 프로젝트 코드
def analyze_centrality(self, brain_id: str):
    centrality_query = """
    MATCH (n:Node {brain_id: $brain_id})
    WITH n
    CALL gds.pageRank.stream('graph')
    YIELD nodeId, score
    WHERE gds.util.asNode(nodeId) = n
    RETURN n.name as node_name, score as pagerank
    ORDER BY pagerank DESC
    LIMIT 10
    """
    
    with self.driver.session() as session:
        result = session.run(centrality_query, brain_id=brain_id)
        return [record.data() for record in result]

def get_most_connected_nodes(self, brain_id: str, limit: int = 10):
    query = """
    MATCH (n:Node {brain_id: $brain_id})-[r:RELATES_TO]-(other)
    RETURN n.name as node_name, count(r) as connection_count
    ORDER BY connection_count DESC
    LIMIT $limit
    """
    
    with self.driver.session() as session:
        result = session.run(query, brain_id=brain_id, limit=limit)
        return [record.data() for record in result]
```

#### 4.3.2 커뮤니티 탐지
```python
# backend/neo4j_db/Neo4jHandler.py - 실제 프로젝트 코드
def detect_communities(self, brain_id: str):
    # Louvain 알고리즘을 사용한 커뮤니티 탐지
    community_query = """
    CALL gds.louvain.stream('graph')
    YIELD nodeId, communityId
    MATCH (n:Node {brain_id: $brain_id})
    WHERE gds.util.asNode(nodeId) = n
    RETURN n.name as node_name, communityId
    ORDER BY communityId, node_name
    """
    
    with self.driver.session() as session:
        result = session.run(community_query, brain_id=brain_id)
        communities = defaultdict(list)
        for record in result:
            communities[record["communityId"]].append(record["node_name"])
        return dict(communities)
```

#### 4.3.3 지식 밀도 분석
```python
# backend/routers/brain_graph.py - 실제 프로젝트 코드
async def get_source_data_metrics(brain_id: str):
    """브레인의 소스별 데이터 메트릭 조회"""
    try:
        sqlite_handler = SQLiteHandler()
        neo4j_handler = Neo4jHandler()
        
        # 소스별 텍스트 양 계산
        source_metrics = {}
        sources = sqlite_handler.get_all_sources_by_brain_id(brain_id)
        
        for source in sources:
            source_id = source["source_id"]
            text_content = sqlite_handler.get_source_content(source_id, brain_id)
            
            # 텍스트 길이 계산
            text_length = len(text_content) if text_content else 0
            
            # 노드 개수 계산
            nodes = neo4j_handler.get_nodes_by_source_id(source_id, brain_id)
            node_count = len(nodes) if nodes else 0
            
            # 엣지 개수 계산
            edges = neo4j_handler.get_edges_by_source_id(source_id, brain_id)
            edge_count = len(edges) if edges else 0
            
            source_metrics[source_id] = {
                "title": source["title"],
                "text_length": text_length,
                "node_count": node_count,
                "edge_count": edge_count,
                "knowledge_density": node_count / max(text_length, 1) * 1000  # 1000자당 노드 수
            }
        
        return source_metrics
        
    except Exception as e:
        logging.error(f"소스 데이터 메트릭 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="소스 데이터 메트릭 조회 중 오류가 발생했습니다.")
```

### 4.4 지식 확장 및 연결

#### 4.4.1 새로운 문서 통합
- **기존 노드와의 매칭**: 새로운 문서의 노드들을 기존 노드와 매칭
- **새로운 노드 추가**: 매칭되지 않은 노드들을 새로운 노드로 추가
- **관계 업데이트**: 기존 노드와 새로운 노드 간의 관계 생성

#### 4.4.2 외부 지식 연결
- **위키피디아 연동**: 노드와 위키피디아 페이지 연결
- **학술 데이터베이스 연동**: 연구 논문과 학술 데이터베이스 연결
- **뉴스 데이터 연동**: 실시간 뉴스 데이터와 연결

</div>
</details>

<details>
<summary><b>5. 지식그래프의 한계와 개선 방향</b></summary>
<div markdown="1">

### 5.1 현재 한계점

#### 5.1.1 기술적 한계
- **AI 모델 의존성**: 지식 추출의 정확도가 AI 모델의 성능에 크게 의존
- **언어 특화**: 한국어에 특화되어 있어 다국어 지원이 제한적
- **실시간 처리**: 대용량 문서 처리 시 시간이 오래 걸림
- **메모리 사용량**: 그래프가 커질수록 메모리 사용량이 급증

#### 5.1.2 품질 관련 한계
- **노드 추출 정확도**: AI 모델이 모든 중요한 개념을 정확히 추출하지 못함
- **관계 추출 정확도**: 노드 간의 관계를 잘못 해석하는 경우가 있음
- **중복 노드**: 동일한 개념이 다른 이름으로 추출되는 경우
- **노이즈**: 불필요한 정보가 노드로 추출되는 경우

### 5.2 개선 방향

#### 5.2.1 기술적 개선
- **다중 AI 모델 앙상블**: 여러 AI 모델의 결과를 조합하여 정확도 향상
- **사전 학습된 모델**: 도메인 특화 사전 학습 모델 개발
- **증분 학습**: 새로운 데이터로 모델을 지속적으로 개선
- **분산 처리**: 대용량 데이터 처리를 위한 분산 시스템 구축

#### 5.2.2 품질 개선
- **사후 검증**: 추출된 노드/엣지의 품질을 검증하는 시스템
- **사용자 피드백**: 사용자의 피드백을 반영하여 지식 그래프 개선
- **도메인 지식 통합**: 특정 도메인의 전문 지식을 사전에 정의
- **동적 업데이트**: 실시간으로 지식 그래프를 업데이트하는 시스템

#### 5.2.3 사용성 개선
- **직관적 인터페이스**: 사용자가 쉽게 이해할 수 있는 시각화
- **개인화**: 사용자별 맞춤형 지식 그래프 제공
- **협업 기능**: 여러 사용자가 함께 지식 그래프를 구축
- **모바일 지원**: 모바일 환경에서도 사용할 수 있는 인터페이스

### 5.3 향후 연구 방향

#### 5.3.1 학술적 연구
- **지식 그래프 품질 평가**: 객관적인 품질 평가 지표 개발
- **다국어 지식 그래프**: 여러 언어를 지원하는 통합 지식 그래프
- **시맨틱 웹 연동**: 웹 표준과 호환되는 지식 그래프 구축
- **실시간 학습**: 사용자 상호작용을 통한 실시간 학습

#### 5.3.2 산업 적용
- **기업 지식 관리**: 기업 내부 지식을 체계적으로 관리
- **교육 플랫폼**: 교육용 지식 그래프 기반 학습 시스템
- **의료 진단**: 의학 지식을 그래프로 표현한 진단 지원 시스템
- **법률 자문**: 법률 지식을 그래프로 표현한 자문 시스템

</div>
</details>

<br/>
<br/>

## 📖 참고 자료

- **Neo4j Graph Database**: https://neo4j.com/
- **Knowledge Graph Conference**: https://www.knowledgegraph.tech/
- **Google Knowledge Graph**: https://developers.google.com/knowledge-graph
- **Wikipedia Knowledge Graph**: https://www.wikidata.org/
- **DBpedia**: https://dbpedia.org/
- **YAGO**: https://yago-knowledge.org/

## 🔗 관련 링크

- [BrainT 프로젝트 README](./README.md)
- [지식그래프 생성 로직 상세 분석](./KNOWLEDGE_GRAPH_GENERATION.md)
- [AI 모델 통합 가이드](./AI_MODEL_INTEGRATION.md) 