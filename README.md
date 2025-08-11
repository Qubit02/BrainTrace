# 지식 그래프 기반 AI 챗봇 시스템 <br/> (BrainT, Brain Trace System)

<br/>

> Brain Trace System (이하 BrainT)는 문서를 업로드하면 자동으로 지식 그래프를 구축하고 <br/>
> 이를 기반으로 정확한 답변을 생성하는 AI 챗봇 시스템이다.

<br/>
<br/>

## 📋 목차

<details>
<summary><b>1. 개발배경 및 목적</b></summary>
<div markdown="1">

### 1.1 개발 배경

&nbsp;&nbsp; 디지털 시대의 도래와 함께 문서와 지식의 양이 기하급수적으로 증가하면서, 사용자들은 방대한 정보 속에서 원하는 답변을 찾는 데 어려움을 겪고 있다. 기존의 검색 시스템은 단순한 키워드 매칭에 의존하여 정확도가 떨어지고, 사용자가 원하는 맥락적 정보를 제공하지 못하는 한계가 있다.

&nbsp;&nbsp; 또한, 기업이나 교육기관에서 보유한 문서들을 체계적으로 관리하고 활용하는 시스템의 필요성이 증가하고 있다. 단순한 파일 저장소를 넘어서 문서 간의 관계를 파악하고, 지식을 구조화하여 효율적으로 활용할 수 있는 시스템이 요구되고 있다.
  
&nbsp;&nbsp; 본 팀은 이러한 문제를 개선하기 위해 문서를 자동으로 분석하여 지식 그래프를 구축하고, 이를 기반으로 정확한 답변을 생성하는 AI 챗봇 시스템인 Brain Trace System, BrainT를 제안한다.

### 1.2 개발 목적

1. **지식 그래프 자동 구축**: 사용자가 문서를 입력 받아 지식 그래프 구축에 필요한 풍부한 메타데이터를 자동으로 생성하는 웹 시스템 개발
2. **정확한 AI 답변 생성**: 구축된 지식 그래프를 바탕으로 사용자의 의도에 맞는 정보를 찾기 위해 정확도 높은 답변을 생성하는 AI 모델 개발
3. **시각적 지식 표현**: 문서 내에서 지식 그래프의 구조를 직접 보여줄 수 있는 기능 구축
4. **통합 웹 인터페이스**: 사용자가 원하는 정보를 단번에 찾아내고, 관련 소스를 확인할 수 있는 웹 인터페이스 제공
5. **모니터링 시스템**: 문서 당 메타데이터의 정보와 비율, 성능, 검색어 빈도수 등을 파악할 수 있는 모니터링 시스템 구축

</div>
</details>

<details>
<summary><b>2. 개발환경(언어, Tool, 시스템 등)</b></summary>
<div markdown="1">

### 2.1 핵심 기술 스택

#### 백엔드 기술
- **FastAPI**: Python 기반 고성능 웹 프레임워크
- **Neo4j**: 그래프 데이터베이스 (지식 그래프 저장)
- **Qdrant**: 벡터 데이터베이스 (임베딩 저장)
- **SQLite**: 관계형 데이터베이스 (메타데이터 및 모니터링 데이터)
- **OpenAI GPT**: AI 모델 (노드/엣지 추출, 답변 생성)
- **Ollama**: 로컬 AI 모델 (대안 AI 서비스)

#### 프론트엔드 기술
- **React**: JavaScript 라이브러리 (사용자 인터페이스)
- **HTML/CSS**: 웹 페이지 구조 및 스타일링
- **JavaScript**: 클라이언트 사이드 로직

#### 자연어 처리 기술
- **KoNLPy**: 한국어 자연어 처리 라이브러리
- **Okt**: 한국어 형태소 분석기
- **Sentence Transformers**: 텍스트 임베딩 생성

### 2.2 개발 환경

![Windows 10](https://img.shields.io/badge/Windows%2010-%234D4D4D.svg?style=for-the-badge&logo=windows-terminal&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)

### 2.3 개발 도구

![Visual Studio Code](https://img.shields.io/badge/Visual%20Studio%20Code-0078d7.svg?style=for-the-badge&logo=visual-studio-code&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Neo4j](https://img.shields.io/badge/Neo4j-018bff?style=for-the-badge&logo=neo4j&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)
![Qdrant](https://img.shields.io/badge/Qdrant-FF6B4A?style=for-the-badge&logo=qdrant&logoColor=white)

### 2.4 개발 언어

![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![html](https://img.shields.io/badge/HTML-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-1572B6?style=for-the-badge&logo=css3&logoColor=white)

</div>
</details>

<details>
<summary><b>3. 시스템 구성 및 아키텍처</b></summary>
<div markdown="1">

### 3.1 BrainT 시스템 전체 구성

BrainT는 사용자가 정확도 높은 답변을 받고 지식 그래프를 확인할 수 있는 웹 서비스로 구현되었다. React 기반의 프론트엔드와 FastAPI 기반의 백엔드로 구성되어 있고, 모든 웹 서버 애플리케이션은 파이썬으로 작성되었다.

<p align="center"><img src=./report/img/brainTArch1.jpg alt="brainTArch1" width="800"/></p>

### 3.2 웹 서버 애플리케이션 구조

웹 서버 애플리케이션은 크게 3가지의 모듈들로 구성되어 있고, 웹 프레임워크가 받은 request에 따라 모듈들이 동작한다.

<p align="center"><img src=./report/img/brainTArch2.jpg alt="brainTArch2" width="600"/></p>

#### 3.2.1 지식 그래프 생성 모듈
문서를 업로드하는 사용자인 관리자 브라우저에서 문서를 업로드하면 FastAPI 내의 지식 그래프 생성 모듈이 데이터를 받아 문서의 메타데이터를 자동으로 처리한다. 문서를 분석하고 지식 그래프 생성하는 스레드들이 비동기적으로 처리하고 인터넷을 통해 AI 모델과 데이터를 주고받는다.

#### 3.2.2 AI 답변 생성 모듈
AI 답변 생성 모듈은 사용자가 질문을 입력하면 시스템 내의 AI 모델을 이용하여 정확한 답변을 생성한다. 데이터베이스에 저장된 지식 그래프는 JSON 트리 형태로 서버에 반환된다.

#### 3.2.3 모니터링 모듈
문서 당 메타데이터의 정보와 비율, 성능, 그리고 검색어의 빈도수와 같은 데이터들의 상태를 확인하는 관리자 브라우저에서 데이터베이스에 저장된 모니터링 데이터를 받는다.

### 3.3 웹 클라이언트 애플리케이션 구조

웹 클라이언트 애플리케이션은 크게 4가지의 모듈들로 구성되어 있다. 모듈들은 React 컴포넌트들로 동작한다.

<p align="center"><img src=./report/img/brainTArch3.jpg alt="brainTArch3" width = "500"/></p>

#### 3.3.1 지식 그래프 시각화 모듈
사용자가 문서의 구조를 확인할 때 데이터베이스에서 반환 받은 노드와 관계 정보를 3D 그래프로 시각화한다. 노드와 엣지를 인터랙티브하게 조작할 수 있고, 참조된 노드들을 하이라이팅하여 보여준다.

#### 3.3.2 채팅 인터페이스 모듈
사용자가 질문을 입력하고 AI 답변을 받을 수 있도록 하는 기능을 한다. 답변과 함께 참조된 소스 정보와 정확도 점수를 표시한다.

#### 3.3.3 소스 관리 모듈
업로드된 문서들을 관리하고, 원문을 확인할 수 있으며, 문서 간의 관계를 파악할 수 있도록 한다.

#### 3.3.4 모니터링 로그 기록 모듈
사용자가 질문을 하고 답변을 받았을 때의 시간과 질문 내용, 참조된 노드들을 로그 파일에 기록한다.

</div>
</details>

<details>
<summary><b>4. 프로젝트 주요기능 및 구조도</b></summary>
<div markdown="1">

### 4.1 기능 및 특징 (프로젝트의 주요 기능과 특장점)

#### 4.1.1 지식 그래프 자동 생성

**지식그래프란 무엇인가?**

지식그래프는 문서에서 추출된 핵심 개념들을 **노드(개체)**와 **엣지(관계)**로 구조화하여 정보 간의 의미적 연결을 표현하는 기술입니다. BrainT는 이 지식그래프를 통해 단순한 키워드 검색을 넘어서 사용자의 의도를 정확히 파악하고, 관련된 모든 정보를 연결하여 정확한 답변을 생성합니다.

**지식그래프를 사용하는 이유:**
- **의미적 이해**: 문서의 맥락과 관계를 이해하여 정확한 정보 검색
- **추론 가능**: 직접 언급되지 않은 정보도 관계를 통해 추론
- **시각적 표현**: 복잡한 정보를 직관적인 그래프로 표현
- **확장성**: 새로운 정보 추가 시 기존 지식과 자동 연결

📖 **지식그래프에 대한 상세한 설명은 [여기](./KNOWLEDGE_GRAPH.md)를 참고하세요.**

**주요 기능:**

###### AI 기반 노드/엣지 추출
BrainT는 두 가지 방식으로 지식 그래프를 생성합니다:

1. **AI 모델 기반 추출** (GPT/Ollama)
```python
# backend/routers/brain_graph.py - 실제 프로젝트 코드
async def process_text_endpoint(request_data: ProcessTextRequest):
    # AI 모델 선택 (GPT 또는 Ollama)
    if model == "gpt":
        ai_service = get_ai_service_GPT()
    elif model == "ollama":
        ai_service = get_ai_service_Ollama()
    else:
        ai_service = None  # 수동 청킹 사용 (manual_chunking_sentences)
    
    # 텍스트에서 노드/엣지 추출
    if ai_service is None:
        nodes, edges = manual_chunking_sentences.extract_graph_components(text, source_id)
    else:
        nodes, edges = ai_service.extract_graph_components(text, source_id)
    
    # Neo4j에 그래프 데이터 저장
    neo4j_handler = Neo4jHandler()
    neo4j_handler.insert_nodes_and_edges(nodes, edges, brain_id)
    
    # 벡터 데이터베이스에 임베딩 저장
    embedding_service.update_index_and_get_embeddings(nodes, brain_id)
```

2. **수동 청킹 기반 추출** (LDA + TF-IDF)
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
    
    # 각 청크에서 노드/엣지 추출
    for chunk in chunks:
        relevant_sentences = [sentences[idx] for idx in chunk["chunks"]]
        nodes, edges, already_made = _extract_from_chunk(
            relevant_sentences, source_id, chunk["keyword"], already_made
        )
```

###### 다중 포맷 지원
- **PDF**: PyPDF2를 통한 텍스트 추출
- **TXT**: 직접 텍스트 처리
- **MD**: 마크다운 파싱 및 텍스트 추출
- **DOCX**: python-docx를 통한 구조화된 텍스트 추출

###### 실시간 처리
```python
# backend/services/chunk_service.py - 실제 프로젝트 코드
def chunk_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    return text_splitter.split_text(text)
```

###### 중복 제거 및 통합
```python
# backend/neo4j_db/Neo4jHandler.py - 실제 프로젝트 코드
def insert_nodes_and_edges(self, nodes, edges, brain_id):
    with self.driver.session() as session:
        # MERGE를 사용한 중복 노드 처리 및 original_sentences 관리
        for node in nodes:
            session.run("""
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
            """, name=node["name"], brain_id=brain_id, 
                 label=node["label"], new_descriptions=new_descriptions, new_originals=new_originals)
```

#### 4.1.2 정확한 AI 답변 생성
- **컨텍스트 기반 검색**: 벡터 데이터베이스를 통한 의미적 검색
- **출처 추적**: 답변의 근거가 되는 원문 문장 자동 추출
- **정확도 점수**: 답변의 신뢰도를 수치화하여 제공
- **다중 모델 지원**: GPT, Ollama 등 다양한 AI 모델 선택 가능
- **참조 노드 추출**: 답변에서 언급된 노드들을 자동으로 식별
- **소스 매핑**: 노드와 원본 소스 파일 간의 관계 추적

**답변 생성 프로세스:**
```python
# backend/routers/brain_graph.py - 실제 프로젝트 코드
async def answer_endpoint(request_data: AnswerRequest):
    # 1. 벡터 검색으로 관련 노드 찾기
    similar_nodes, Q = embedding_service.search_similar_nodes(
        question, brain_id, top_k=5
    )
    
    # 2. Neo4j에서 1단계 깊이 스키마 추출
    graph_schema = neo4j_handler.query_schema_by_node_names(
        [node["name"] for node in similar_nodes], brain_id
    )
    
    # 3. AI 모델로 답변 생성
    if model == "openai":
        ai_service = get_ai_service_GPT()
    elif model == "ollama":
        ai_service = get_ai_service_Ollama(model_name)
    else:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 모델: {model}")
    
    # 4. 스키마 텍스트 생성 및 답변 생성
    raw_schema_text = ai_service.generate_schema_text(nodes_result, related_nodes_result, relationships_result)
    final_answer = ai_service.generate_answer(raw_schema_text, question)
    
    # 5. 참조 노드 추출 및 정확도 점수 계산
    referenced_nodes = ai_service.extract_referenced_nodes(final_answer)
    final_answer = final_answer.split("EOF")[0].strip()
    accuracy = compute_accuracy(final_answer, referenced_nodes, brain_id, Q, raw_schema_text)
    
    # 6. 소스 ID와 제목 매핑
    node_to_ids = neo4j_handler.get_descriptions_bulk(referenced_nodes, brain_id)
    all_ids = sorted({sid for ids in node_to_ids.values() for sid in ids})
    id_to_title = db_handler.get_titles_by_ids(all_ids)
    
    # 7. 최종 구조화된 답변 반환
    enriched = []
    for node in referenced_nodes:
        unique_sids = list(dict.fromkeys(node_to_ids.get(node, [])))
        sources = []
        for sid in unique_sids:
            if sid not in id_to_title:
                continue
            orig_sents = neo4j_handler.get_original_sentences(node, sid, brain_id)
            sources.append({
                "id": str(sid),
                "title": id_to_title[sid],
                "original_sentences": orig_sents
            })
        enriched.append({
            "name": node,
            "source_ids": sources
        })
    
    # 8. AI 답변 저장 및 최종 반환
    chat_id = db_handler.save_chat(session_id, True, final_answer, enriched, accuracy)
    
    return {
        "answer": final_answer,
        "referenced_nodes": enriched,
        "chat_id": chat_id,
        "accuracy": accuracy
    }
```

#### 4.1.3 인터랙티브 시각화
- **3D 그래프 뷰**: 노드와 엣지를 직관적으로 표현
- **실시간 하이라이팅**: 채팅 답변과 연동된 노드 강조 표시
- **전체화면 모드**: 집중된 그래프 탐색 환경 제공
- **애니메이션 효과**: 타임랩스 뷰를 통한 생성 과정 시각화
- **노드 검색**: 그래프 내 특정 노드 검색 기능

**그래프 데이터 조회:**
```python
# backend/neo4j_db/Neo4jHandler.py - 실제 프로젝트 코드
def get_brain_graph(self, brain_id: str) -> Dict[str, List]:
    with self.driver.session() as session:
        # 노드 조회
        nodes_result = session.run("""
            MATCH (n)
            WHERE n.brain_id = $brain_id
            RETURN DISTINCT n.name as name
        """, brain_id=brain_id)
        
        nodes = [{"name": record["name"]} for record in nodes_result]
        
        # 엣지(관계) 조회
        edges_result = session.run("""
            MATCH (source)-[r]->(target)
            WHERE source.brain_id = $brain_id AND target.brain_id = $brain_id
            RETURN DISTINCT source.name as source, target.name as target, r.relation as relation
        """, brain_id=brain_id)
        
        links = [
            {
                "source": record["source"],
                "target": record["target"],
                "relation": record["relation"]
            }
            for record in edges_result
        ]
        
        return {"nodes": nodes, "links": links}
```

#### 4.1.4 통합 관리 시스템
- **프로젝트 관리**: 브레인(프로젝트) 단위의 체계적 관리
- **소스 관리**: 문서 업로드, 검색, 삭제 기능
- **메모 시스템**: 텍스트 및 음성 메모 작성 및 관리
- **모니터링 대시보드**: 성능 지표 및 사용 통계 실시간 확인
- **채팅 세션 관리**: 대화 기록 저장 및 관리
- **정확도 추적**: 답변별 정확도 점수 기록 및 분석

**브레인 생성 및 관리:**
```python
# backend/sqlite_db/brain_handler.py - 실제 프로젝트 코드
def create_brain(self, brain_name: str, created_at: str | None = None) -> dict:
    conn = sqlite3.connect(self.db_path)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO Brain (brain_name, created_at)
        VALUES (?, ?)
    """, (brain_name, created_at or datetime.date.today().isoformat()))
    
    brain_id = cur.lastrowid
    conn.commit()
    conn.close()
    
    return {
        "brain_id": brain_id,
        "brain_name": brain_name,
        "created_at": created_at,
    }
```

### 4.2 개발과정 (주요 단계와 방법)

#### 4.2.1 1단계: 시스템 설계 및 아키텍처 구축
- **요구사항 분석**: 사용자 니즈 및 기술적 요구사항 정의
- **데이터베이스 설계**: Neo4j 그래프 DB, Qdrant 벡터 DB, SQLite 관계형 DB 설계
- **API 설계**: RESTful API 엔드포인트 설계 및 문서화
- **프론트엔드 설계**: React 컴포넌트 구조 및 상태 관리 설계

#### 4.2.2 2단계: 백엔드 핵심 기능 구현
- **텍스트 처리 파이프라인**: 청킹, 토큰화, 임베딩 생성
- **AI 모델 통합**: OpenAI GPT 및 Ollama 모델 연동
- **지식 그래프 생성**: 노드/엣지 추출 및 데이터베이스 저장
- **벡터 검색 시스템**: 임베딩 기반 유사도 검색 구현

#### 4.2.3 3단계: 프론트엔드 사용자 인터페이스 구현
- **반응형 레이아웃**: 패널 기반의 유연한 UI 구성
- **그래프 시각화**: 3D 그래프 렌더링 및 인터랙션
- **채팅 인터페이스**: 실시간 질의응답 UI 구현
- **파일 관리**: 드래그 앤 드롭 파일 업로드 시스템

#### 4.2.4 4단계: 고급 기능 및 최적화
- **모니터링 시스템**: 성능 지표 및 사용 통계 수집
- **성능 최적화**: 병렬 처리 및 메모리 최적화
- **에러 처리**: 예외 상황 처리 및 복구 메커니즘
- **테스트 및 검증**: 단위 테스트 및 통합 테스트 수행

### 4.3 결과물 (결과물에 대한 설명 및 사진, 프로젝트 실행 및 테스트 방법)

#### 4.3.1 작품 사진 및 주요 기능 설명

본 시스템은 사용자 중심의 직관적인 인터페이스를 기반으로, 브레인(프로젝트) 생성부터 소스 추가, 챗봇 질의응답, 지식그래프 시각화, 메모 작성까지 학습 전반을 통합 관리할 수 있도록 설계되었습니다.

##### 패널 공통 기능
- **접기/펼치기**: 각 패널은 필요 시 접고 펼 수 있어 작업 집중도 향상
- **리사이즈**: 마우스를 이용한 패널 간 크기 조절 가능

##### 1. 프로젝트 패널 (메인 화면)
- **새 브레인 생성**: 홈 화면에서 신규 프로젝트 생성
- **브레인 관리**: 기존 브레인 리스트 확인 및 설정 변경
- **홈 이동 버튼**: 홈 화면으로 빠르게 복귀

<img src=./report/img/executeScreenshot1.jpg alt="executeScreenshot1" width = "1000" />

##### 2. 소스 패널 (문서 업로드 화면)
**소스 추가**
- 드래그 앤 드롭으로 다양한 파일 업로드 (PDF, TXT, MD, DOCX 등)
- 로컬 탐색기를 통한 파일 선택

**탐색 기능**
- 텍스트 기반 키워드 검색으로 관련 소스 자동 추천

**소스파일 기능**
- 클릭 시 원문 확인 및 텍스트 하이라이팅 가능
- "노드 보기"로 해당 소스로 생성된 지식 노드 확인

**지식 평가**
- 브레인(프로젝트) 전체에 대한 노드/엣지 밀도 및 연결도 기반의 지식 점수 제공

**소스 삭제**
- 연관 노드 확인 후 Neo4j에서 source_id 기반으로 안전 삭제

<img src=./report/img/executeScreenshot2.jpg alt="executeScreenshot2" width = "1000" />

##### 3. 채팅 패널 (채팅 인터페이스 화면)
**채팅 세션 관리**
- 채팅 생성, 이름 변경, 삭제 기능 제공

**모델 설정**
- GPT / Ollama 등 다양한 모델 선택 및 다운로드

**답변 생성 기능**
- 소스 기반 질의응답
- 정확도 점수 및 참고 노드 목록 출력
- 출처(원문 링크) 제공
- 답변 내 노드 클릭 시 참조 문장의 원문 하이라이팅
- 복사 버튼으로 답변 텍스트 복사 가능

**하이라이팅 연동**
- 답변에 사용된 노드를 그래프에서 자동 하이라이팅

<img src=./report/img/executeScreenshot3.jpg alt="executeScreenshot3" width = "1000" />

##### 4. 인사이트 패널

###### 4.1 그래프 뷰 (지식 그래프 시각화 화면)
**노드 조작**
- 마우스로 잡아 끌어당기는 인터랙션 지원

**호버 기능**
- 노드/엣지 위에 마우스를 올리면 정보 표시 (노드 이름, 관계, 소스/타겟 등)

**하이라이팅**
- 채팅에서 참조된 노드 및 소스 추가로 생성된 노드 자동 하이라이팅

**툴 아이콘**
- 전체화면 모드 전환
- 노드 검색 기능
- 생성 애니메이션(타임랩스 뷰) 지원

<img src=./report/img/executeScreenshot4.jpg alt="executeScreenshot4" height = "300" />

###### 4.2 전체화면 모드
- **테마 전환**: 다크모드 / 라이트모드 지원
- **설정 기능**: 그래프 커스터마이징 설정 제공 (개선 예정)
- **초기화**: 새로고침으로 그래프 상태 리셋
- **패널 연동**: 타 패널의 하이라이팅 효과 연동 지원

###### 4.3 메모 패널
**메모 작성**
- 새 메모 생성 및 편집
- 메모를 드래그하여 소스로 변환 가능

**음성 메모 기능**
- 마이크를 통한 음성 녹음 → 텍스트 변환 저장

**휴지통 관리**
- 삭제된 메모 복원 / 완전 삭제 / 전체 비우기

##### 5. 모니터링 시스템

###### 5.1 전체 모니터링 페이지 (Data Overview)
문서 당 메타데이터의 정보와 비율, 성능, 그리고 검색어의 빈도수와 같은 데이터들의 상태를 확인하는 관리자 브라우저에서 데이터베이스에 저장된 모니터링 데이터를 받습니다. 관리자는 브라우저에서 모니터링 관련 데이터들을 확인할 수 있습니다.

<img src=./report/img/executeScreenshot5.jpg alt="executeScreenshot5" width = "1000" />

###### 5.2 상세 모니터링 페이지 (Document Details)
각 문서별 상세한 분석 정보와 성능 지표를 제공하여 문서의 품질과 시스템 성능을 모니터링할 수 있습니다.

<img src=./report/img/executeScreenshot6.jpg alt="executeScreenshot6" width = "1000" />

#### 4.3.2 프로젝트 실행 및 테스트 방법

##### 설치 및 실행 방법
1. **백엔드 실행**
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```

2. **프론트엔드 실행**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **데이터베이스 설정**
   - Neo4j 데이터베이스 실행
   - Qdrant 벡터 데이터베이스 실행
   - SQLite 데이터베이스 자동 생성

##### 테스트 방법
1. **단위 테스트**: `backend/tests/` 디렉토리의 테스트 파일들 실행
2. **통합 테스트**: 전체 시스템 연동 테스트
3. **사용자 테스트**: 실제 문서 업로드 및 질의응답 테스트

</div>
</details>



<br/>
<br/>

## 🔑 GUIDES

BrainT 실행을 위한 모든 사항은 아래 문서를 참고해주세요.

<h4>License : <a href="LICENSE">MIT License</a> / <a href="LICENSE_3rd.md">Third Party</a> </h4>
<h4>Install : <a href="INSTALL_KO.md">KO</a> / <a href="INSTALL_EN.md">EN</a> </h4>
<h4>Contribute : <a href="CONTRIBUTE.md">How to Contribute</a>
<h4>Related Article : <a href="#">Knowledge Graph-based AI Chatbot System</a>

<br/>
<br/>

## 📷 시연 영상

하단 이미지를 클릭하시면 영상을 시청하실 수 있습니다. (youtube)

[<img src="https://user-images.githubusercontent.com/example/brainT-demo.png" alt="BrainT"/>](https://www.youtube.com/watch?v=example)

<br/>
<br/>

## 📖 참고자료

- 지식 그래프 기술 : Neo4j. 2024. Neo4j Graph Database. https://neo4j.com/ (2024)
- AI 모델 (GPT) : OpenAI. 2024. OpenAI API. https://openai.com/api/ (2024)
- 한국어 언어처리 : KoNLPy. 2024. KoNLPy. https://github.com/konlpy/konlpy (2024)
- 벡터 데이터베이스 : Qdrant. 2024. Qdrant Vector Database. https://qdrant.tech/ (2024)
- 웹 프레임워크 : FastAPI. 2024. FastAPI. https://fastapi.tiangolo.com/ (2024)
- 프론트엔드 프레임워크 : React. 2024. React. https://react.dev/ (2024) 
