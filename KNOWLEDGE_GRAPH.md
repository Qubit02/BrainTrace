# BrainTrace 지식그래프(Knowledge Graph) 상세 설명

> **BrainTrace**는 문서를 업로드하면 자동으로 지식 그래프를 구축하고, 이를 기반으로 정확한 답변을 생성하는 AI 챗봇 시스템입니다. 이 시스템은 문서 간의 분산된 개념과 관계를 하나의 네트워크로 연결하여 문서 간 맥락을 재구성하고, 그래프 기반의 통찰력 발견과 증거 중심의 인용을 지원합니다.

---

## 목차

1. [지식그래프란 무엇인가?](#지식그래프란-무엇인가)
2. [GraphRAG 방식의 필요성과 장점](#GraphRAG-방식의-필요성과-장점)
3. [지식그래프 생성 과정](#지식그래프-생성-과정)
4. [지식그래프 활용 사례](#지식그래프-활용-사례)

---

## 1. 지식그래프란 무엇인가?

### 1.1 지식그래프의 정의

지식 그래프는 관련 있는 정보를 서로 연결된 그래프 형태로 표현하는 기술입니다. 데이터를 통합하고 연결해 사용자에 대한 이해를 높이며, 빠른 정보 검색과 추론을 지원합니다. 이는 개인화된 인공지능(AI)을 구현하는 핵심 기술 중 하나로, 정보를 **노드(개체)**와 **엣지(관계)**로 구조화하여 데이터 간의 관계와 맥락을 이해하고 새로운 지식을 추론하는 데 사용됩니다.

### 1.2 지식그래프의 구성 요소

#### 노드(Node)

- **정의**: 문서에서 추출된 핵심 개념이나 개체를 나타냅니다.
- **BrainT에서의 역할**: AI 모델이나 수동 청킹을 통해 텍스트에서 중요한 개념들을 노드로 추출합니다.
- **속성**: `name`(개체명), `label`(분류), `description`(설명) 등.

#### 엣지(Edge)

- **정의**: 노드 간의 의미적 관계를 나타냅니다.
- **BrainT에서의 역할**: "포함하다", "관련되다", "영향을 주다" 등의 관계를 엣지로 표현합니다.
- **속성**: `source`(시작 노드), `target`(도착 노드), `relation`(관계 유형).

#### 속성(Properties)

- **정의**: 노드와 엣지에 추가되는 메타데이터입니다.
- **BrainT에서의 역할**: `source_id`(출처 문서), `original_sentences`(원문 문장), `descriptions`(다중 설명) 등의 속성을 관리합니다.

### 1.3 지식그래프의 장점

#### 1.3.1 의미적 데이터 통합

- 다양한 출처의 데이터를 통합하고, 의미적으로 연결할 수 있습니다.
- 예: 여러 데이터베이스에서 "Apple"이라는 단어가 있을 때, 지식 그래프는 문맥에 따라 "사과"와 "애플사"를 구분할 수 있습니다.

#### 1.3.2 강력한 검색 및 질의

- 복잡한 질문에 대한 답변을 제공할 수 있습니다.
- 예: "셰익스피어의 작품 중 영화로 제작된 것은?" 같은 질문에 대해 지식 그래프는 관련된 정보를 연결하여 답변할 수 있습니다.

#### 1.3.3 추론과 발견

- 데이터를 단순히 저장하는 것뿐만 아니라, 데이터 간의 관계를 통해 새로운 지식을 추론할 수 있습니다.
- 예: 새로운 학술 논문이 추가되면, 기존 연구와의 연관성을 통해 새로운 연구 방향을 제안할 수 있습니다.

#### 1.3.4 데이터의 재사용과 상호 운용성

- 데이터 모델이 유연하고 확장 가능하여 다양한 도메인에서 쉽게 재사용될 수 있습니다.
- 예: 건강, 금융, 교육 등 여러 도메인에서 동일한 지식 그래프 구조를 사용할 수 있습니다.

---

## 2. GraphRAG 방식의 필요성과 장점

### 2.1 기존 RAG 방식의 한계

#### 2.1.1 단순 RAG의 구조적 한계

- **청크 기반 분할**: 문서를 일정 크기의 청크로 분할하여 벡터 검색에 활용합니다.
- **벡터 유사도 의존**: 질문과 유사한 정보를 찾기 위해 벡터 검색에만 의존합니다.
- **구조적 관계 부족**: 청크 간의 구조적 관계나 전체 맥락을 충분히 반영하지 못합니다.

#### 2.1.2 기존 RAG의 문제점

- **전역 정보 연결성 부족**: 단순한 의미적 유사성에 의존하여 전반적인 정보의 연결성 파악이 어렵습니다.
- **컨텍스트 중복**: 프롬프트에 청크를 결합하는 과정에서 중복된 내용이 포함되어 컨텍스트가 불필요하게 길어집니다.
- **관계 추론 한계**: 개념 간 의미적 관계를 탐색하고 추론하는 능력이 제한적입니다.
- **복합 질의 처리 부족**: 다중 경로를 거치는 관계 추론이나 복합 조건 질의 처리에 한계가 있습니다.

### 2.2 GraphRAG 방식의 장점

#### 2.2.1 구조적 정보 활용

- **노드-엣지 구조**: 정보를 노드(개체)와 엣지(관계)로 구조화하여 의미적 관계를 명확히 표현합니다.
- **전역 맥락 파악**: 문서 청크 수준이 아닌 문서 전체와 개념 간의 구조적 연결 정보를 활용합니다.
- **개념 간 관계 탐색**: 단순 텍스트 유사도 검색을 넘어 개념 간 의미적 관계를 탐색하고 추론합니다.

#### 2.2.2 고차원적 추론 능력

- **다중 경로 추론**: 여러 경로를 거치는 관계 추론을 통해 복잡한 질문에 대한 답변을 생성합니다.
- **맥락적 개념 연결**: 관련된 개념들을 맥락적으로 연결하여 더 정확한 정보를 제공합니다.
- **복합 조건 처리**: 기존 RAG 방식으로는 한계가 있었던 복합 조건 질의 처리가 가능합니다.

#### 2.2.3 새로운 지식 발견

- **속성 기반 추론**: 각 노드가 보유한 속성(property) 정보를 통해 명시적으로 주어지지 않은 정보도 추론합니다.
- **잠재적 연결 발견**: 새로운 데이터와 기존 정보 간의 밀접한 연관성을 발견하여 새로운 지식을 제안합니다.
- **지식 확장**: 기존 RAG 방식의 한계를 극복하고 지식 추론과 발견의 새로운 가능성을 제시합니다.

---

## 3. 지식그래프 생성 과정

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

---

## 4. 지식그래프 활용 사례

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

#### 4.1.3 정확도 계산

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

---

### 4.2 시각화 및 탐색

#### 4.2.1 3D 그래프 시각화

- **노드 표현**: 각 노드를 3D 공간의 점으로 표현
- **엣지 표현**: 노드 간의 관계를 선으로 표현
- **인터랙션**: 마우스로 노드를 드래그하여 위치 조정 가능

#### 4.2.2 하이라이팅 기능

- **검색 결과 하이라이팅**: 검색된 노드들을 특별한 색상으로 표시
- **관계 하이라이팅**: 선택된 노드와 연결된 엣지들을 강조 표시
- **경로 하이라이팅**: 두 노드 간의 최단 경로를 시각적으로 표시

---

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

---

### 4.4 지식 확장 및 연결

#### 4.4.1 새로운 문서 통합

- **기존 노드와의 매칭**: 새로운 문서의 노드들을 기존 노드와 매칭
- **새로운 노드 추가**: 매칭되지 않은 노드들을 새로운 노드로 추가
- **관계 업데이트**: 기존 노드와 새로운 노드 간의 관계 생성

#### 4.4.2 외부 지식 연결

- **위키피디아 연동**: 노드와 위키피디아 페이지 연결
- **학술 데이터베이스 연동**: 연구 논문과 학술 데이터베이스 연결
- **뉴스 데이터 연동**: 실시간 뉴스 데이터와 연결

---
