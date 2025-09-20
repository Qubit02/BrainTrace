"""
brain_graph.py

브레인 그래프 관련 API 엔드포인트를 관리하는 라우터 모듈입니다.

주요 기능:
- 브레인 그래프 데이터 조회 및 관리
- 텍스트 처리 및 그래프 생성
- 질문-답변 시스템
- 소스 데이터 메트릭 및 통계
- 노드-소스 관계 관리

지원하는 엔드포인트:
- GET /brainGraph/getNodeEdge/{brain_id} : 브레인의 그래프 데이터 조회
- POST /brainGraph/process_text : 텍스트 처리 및 그래프 생성
- POST /brainGraph/answer : 질문에 대한 답변 생성
- GET /brainGraph/getSourceIds : 노드의 모든 source_id와 제목 조회
- GET /brainGraph/getNodesBySourceId : source_id로 노드 조회
- GET /brainGraph/getSourceDataMetrics/{brain_id} : 브레인의 소스별 데이터 메트릭 조회
- GET /brainGraph/sourceCount/{brain_id} : 브레인별 전체 소스 개수 조회
- GET /brainGraph/getSourceContent : 소스 파일의 텍스트 내용 조회

그래프 처리:
- Neo4j: 그래프 데이터베이스 (노드, 엣지, 관계)
- Qdrant: 벡터 데이터베이스 (임베딩 검색)
- AI 모델: GPT/Ollama를 사용한 텍스트 처리

데이터베이스:
- Neo4j: 그래프 데이터 저장 및 조회
- Qdrant: 벡터 임베딩 저장 및 유사도 검색
- SQLite: 소스 파일 정보 및 메타데이터

의존성:
- FastAPI: 웹 프레임워크
- Neo4jHandler: Neo4j 그래프 데이터베이스 작업
- embedding_service: 벡터 임베딩 및 검색
- AI 서비스: GPT/Ollama 모델 연동
- SQLiteHandler: SQLite 데이터베이스 작업

작성자: BrainT 개발팀
최종 수정일: 2024년
"""

from fastapi import APIRouter, HTTPException
from models.request_models import ProcessTextRequest, AnswerRequest, GraphResponse
from services import embedding_service
from neo4j_db.Neo4jHandler import Neo4jHandler
import logging
from sqlite_db import SQLiteHandler
from exceptions.custom_exceptions import Neo4jException,AppException, QdrantException
from examples.error_examples import ErrorExamples
from dependencies import get_ai_service_GPT
from dependencies import get_ai_service_Ollama
from services.accuracy_service import compute_accuracy
from services import manual_chunking_sentences
import time

# ───────── FastAPI 라우터 설정 ───────── #
router = APIRouter(
    prefix="/brainGraph",
    tags=["brainGraph"],
    responses={404: {"description": "Not found"}}
)

# ───────── API 엔드포인트 ───────── #

@router.get(
    "/getNodeEdge/{brain_id}",
    response_model=GraphResponse,
    summary="브레인의 그래프 데이터 조회",
    description="특정 브레인의 모든 노드와 엣지(관계) 정보를 반환합니다.",
     responses={
        404: ErrorExamples[40401],
        500: ErrorExamples[50001]
    }
    
)
async def get_brain_graph(brain_id: str):
    """
    특정 브레인의 그래프 데이터를 반환합니다.
    
    처리 과정:
    1. brain_id로 Neo4j에서 그래프 데이터 조회
    2. 노드와 엣지 정보를 구조화하여 반환
    3. 데이터가 없는 경우 빈 그래프 반환
    
    Args:
        brain_id (str): 그래프를 조회할 브레인 ID
    
    Returns:
        GraphResponse: 그래프 데이터
            - nodes: 노드 목록 (각 노드는 name 속성을 가짐)
            - links: 엣지 목록 (각 엣지는 source, target, relation 속성을 가짐)
    
    Raises:
        Neo4jException: Neo4j 데이터베이스 오류
    """
    # 요청 수신 로깅: 관측/디버깅을 위해 주요 파라미터를 기록
    logging.info(f"getNodeEdge 엔드포인트 호출됨 - brain_id: {brain_id}")
    try:
        # 그래프 DB 핸들러 생성 (각 요청마다 독립 생성하여 세션 수명 관리)
        neo4j_handler = Neo4jHandler()
        logging.info("Neo4j 핸들러 생성됨")
        
        # Neo4j에서 브레인 전체 그래프 조회
        graph_data = neo4j_handler.get_brain_graph(brain_id)
        logging.info(f"Neo4j에서 받은 데이터: nodes={len(graph_data['nodes'])}, links={len(graph_data['links'])}")
        
        # if not graph_data['nodes'] and not graph_data['links']:
        #     logging.warning(f"brain_id {brain_id}에 대한 데이터가 없습니다")
        #     raise GraphDataNotFoundException(brain_id)
        
        if not graph_data['nodes'] and not graph_data['links']:
            logging.warning(f"brain_id {brain_id}에 대한 데이터가 없습니다")

        return graph_data
    except AppException as ae:
            raise ae
    except Exception as e:
        logging.error("그래프 데이터 조회 오류: %s", str(e))
        raise Neo4jException(message=str(e))
        

@router.post("/process_text", 
    summary="텍스트 처리 및 그래프 생성",
    description= """
    텍스트를 받아 노드/엣지 추출, Neo4j 저장, 벡터 DB 임베딩까지 전체 파이프라인 실행
    <br> Ollama 사용 → (model: "ollama")  
    <br> GPT 사용 → (model: "gpt")
    """,
    response_description="처리된 노드와 엣지 정보를 반환합니다.",
    responses={
        500: ErrorExamples[50001]
    }
    )
async def process_text_endpoint(request_data: ProcessTextRequest):
    """
    텍스트를 받아 노드/엣지 추출, Neo4j 저장, 벡터 DB 임베딩까지 전체 파이프라인 실행
    
    처리 과정:
    1. 텍스트 입력 검증
    2. AI 모델 선택 (GPT 또는 Ollama)
    3. 텍스트에서 노드와 엣지 추출
    4. Neo4j에 그래프 데이터 저장
    5. 벡터 데이터베이스에 임베딩 저장
    6. 처리 결과 반환
    
    Args:
        request_data (ProcessTextRequest): 텍스트 처리 요청
            - text: 처리할 텍스트
            - source_id: 소스 ID
            - brain_id: 브레인 ID
            - model: 사용할 모델 ("gpt" 또는 "ollama")
    
    Returns:
        dict: 처리된 노드와 엣지 정보
    
    Raises:
        HTTPException: 
            - 400: 필수 파라미터 누락
            - 500: 처리 중 오류 발생
    """
    # 요청 본문 파라미터 언패킹
    text = request_data.text
    source_id = request_data.source_id
    brain_id = request_data.brain_id
    model = None
    t0 = time.perf_counter()
    # 로깅은 포맷 문자열을 사용하는 방식이 권장됩니다 (여기선 기존 스타일 유지)
    logging.info('model : %s', model)
    if not text:
        raise HTTPException(status_code=400, detail="text 파라미터가 필요합니다.")
    if not source_id:
        raise HTTPException(status_code=400, detail="source_id 파라미터가 필요합니다.")
    if not brain_id:
        raise HTTPException(status_code=400, detail="brain_id 파라미터가 필요합니다.")
    
    # 보안/프라이버시 고려: 실제 서비스에서는 원문 전체를 로그에 남기지 않는 것이 안전합니다.
    logging.info("사용자 입력 텍스트: %s, source_id: %s, brain_id: %s", text, source_id, brain_id)
    
    # 선택된 모델에 따라 AI 서비스 인스턴스를 주입
    if model == "gpt":
        ai_service = get_ai_service_GPT()
    elif model == "ollama":
        ai_service = get_ai_service_Ollama()
    else:
        ai_service=None

    # Step 1: 텍스트에서 노드/엣지 추출 (AI 서비스)
    if ai_service==None:
        # 기본 수동 청크 처리: 모델 미선택 시 규칙 기반으로 노드/엣지 추출
        nodes, edges=manual_chunking_sentences.extract_graph_components(text, (brain_id, source_id))
    else:
        # 선택된 AI 서비스가 제공하는 추출 로직 호출
        nodes, edges = ai_service.extract_graph_components(text, source_id)
    logging.info("추출된 노드: %s", nodes)
    logging.info("추출된 엣지: %s", edges)

    # Step 2: Neo4j에 노드와 엣지 저장 
    neo4j_handler = Neo4jHandler()
    neo4j_handler.insert_nodes_and_edges(nodes, edges, brain_id)
    logging.info("Neo4j에 노드와 엣지 삽입 완료")

    # Step 3: 노드 정보를 벡터 DB에 임베딩
    # 컬렉션이 없으면 초기화
    if not embedding_service.is_index_ready(brain_id):
        embedding_service.initialize_collection(brain_id)
    
    # 노드 정보 임베딩 및 저장
    # - 각 노드 텍스트를 임베딩하여 Qdrant에 upsert
    # embedding_service.update_index_and_get_embeddings(nodes, brain_id)
    # logging.info("벡터 DB에 노드 임베딩 저장 완료")
    dur_ms = (time.perf_counter() - t0) * 1000
    logging.info("시간@@@@@@ %.3f s @@@@@@", dur_ms / 1000)

    return {
        "message": "텍스트 처리 완료, 그래프(노드와 엣지)가 생성되었고 벡터 DB에 임베딩되었습니다.",
        "nodes": nodes,
        "edges": edges
    }


@router.post("/answer",
    summary="질문에 대한 답변 생성",
    description="""
    사용자 질문을 받아 임베딩을 통해 유사한 노드를 찾고, 
    해당 노드들의 2단계 깊이 스키마를 추출 후 LLM을 이용해 최종 답변 생성
    <br> Ollama 사용 → (model: "ollama")  
    <br> GPT 사용 → (model: "gpt")
    """,
    response_description="생성된 답변을 반환합니다.",
    responses={
    500: {
        "description": "서버 내부 오류 (50001, 50002 등)",
        "content": {
            "application/json": {
                "examples": {
                    "50001": ErrorExamples[50001]["content"]["application/json"],
                    "50002": ErrorExamples[50002]["content"]["application/json"]
                }
            }
        }
    }
}
)
async def answer_endpoint(request_data: AnswerRequest):
    """
    사용자 질문을 받아 임베딩을 통해 유사한 노드를 찾고, 
    해당 노드들의 2단계 깊이 스키마를 추출 후 LLM을 이용해 최종 답변 생성
    <br> Ollama 사용 → (model: "ollama")  
    <br> GPT 사용 → (model: "gpt")
    """
    # 요청 파라미터 언패킹 및 기본 검증
    question = request_data.question
    session_id = request_data.session_id
    brain_id = str(request_data.brain_id)  # 문자열로 변환
    model = request_data.model
    model_name = request_data.model_name
    if not question:
        raise HTTPException(status_code=400, detail="question 파라미터가 필요합니다.")
    if not brain_id:
        raise HTTPException(status_code=400, detail="brain_id 파라미터가 필요합니다.")
    
     # 선택된 모델에 따라 AI 서비스 인스턴스를 주입
    if model == "openai":
        logging.info("🚀 OpenAI 서비스 선택됨 - model_name: %s", model_name)
        ai_service = get_ai_service_GPT(model_name)  # model_name 전달
        logging.info("🚀 OpenAI 서비스 생성 완료")
    elif model == "ollama":
        logging.info("🚀 Ollama 서비스 선택됨 - model_name: %s", model_name)
        ai_service = get_ai_service_Ollama(model_name)
        logging.info("🚀 Ollama 서비스 생성 완료")
    else:
        logging.error("🚀 지원하지 않는 모델: %s", model)
        raise HTTPException(status_code=400, detail=f"지원하지 않는 모델: {model}")
    
    # 🚀 핵심 디버깅: 모델 정보 확인
    logging.info("🚀 === 모델 정보 ===")
    logging.info("🚀 요청된 model: %s, model_name: %s", model, model_name)
    logging.info("🚀 AI 서비스 타입: %s", type(ai_service).__name__)
    if hasattr(ai_service, 'model_name'):
        logging.info("🚀 실제 사용할 모델: %s", ai_service.model_name)
    
    try:
        # SQLite 핸들러: 소스 메타데이터(title 등) 조회와 채팅 로그 저장에 사용
        db_handler = SQLiteHandler()
        
        # Step 1: 컬렉션이 없으면 초기화
        if not embedding_service.is_index_ready(brain_id):
            embedding_service.initialize_collection(brain_id)
            logging.info("Qdrant 컬렉션 초기화 완료: %s", brain_id)
        
        # Step 2: 질문 임베딩 계산
        question_embedding = embedding_service.encode_text(question)
        
        # Step 3: 임베딩을 통해 유사한 노드 검색, Q는 검색된 노드와 질문의 유사도 평균으로 정확도 계산에 쓰임
        similar_nodes,Q = embedding_service.search_similar_nodes(embedding=question_embedding, brain_id=brain_id)
        if not similar_nodes:
            raise QdrantException("질문과 유사한 노드를 찾지 못했습니다.")
        
        # 노드 이름만 추출
        similar_node_names = [node["name"] for node in similar_nodes]
        logging.info("sim node name: %s", similar_node_names)
        logging.info("sim node score: %s", [f"{node['name']}:{node['score']:.2f}" for node in similar_nodes])
        
        # Step 4: 유사한 노드들의 1*단계 깊이 스키마 조회
        neo4j_handler = Neo4jHandler()
        result = neo4j_handler.query_schema_by_node_names(similar_node_names, brain_id)
        if not result:
            raise Neo4jException("스키마 조회 결과가 없습니다.")
            
        logging.info("### Neo4j 조회 결과 전체: %s", result)
        
        # 결과를 즉시 처리
        nodes_result = result.get("nodes", [])
        related_nodes_result = result.get("relatedNodes", [])
        relationships_result = result.get("relationships", [])
        
        logging.info("Neo4j search result: nodes=%d, related_nodes=%d, relationships=%d", 
                   len(nodes_result), len(related_nodes_result), len(relationships_result))
        
        # Step 5: 스키마 간결화 및 텍스트 구성
        # - 모델이 이해하기 쉽게 스키마를 텍스트로 요약/정리
        raw_schema_text = ai_service.generate_schema_text(nodes_result, related_nodes_result, relationships_result)
        
        # Step 6: LLM을을 사용해 최종 답변 생성
        logging.info("🚀 답변 생성 시작 - 모델: %s", ai_service.model_name if hasattr(ai_service, 'model_name') else '알 수 없음')
        final_answer = ai_service.generate_answer(raw_schema_text, question)
        referenced_nodes = ai_service.extract_referenced_nodes(final_answer)
        final_answer = final_answer.split("EOF")[0].strip()
        
        # referenced_nodes 내용을 텍스트로 final_answer 뒤에 추가
        if referenced_nodes:
            nodes_text = "\n\n[참고된 노드 목록]\n" + "\n".join(f"- {node}" for node in referenced_nodes)
            final_answer += nodes_text
        # 간단 정확도 산출: 답변/참고노드/브레인/스키마 텍스트 기반 지표
        accuracy = compute_accuracy(final_answer,referenced_nodes,brain_id,Q,raw_schema_text)
        logging.info(f"정확도 : {accuracy}")
        # node의 출처 소스 id들 가져오기
        node_to_ids = neo4j_handler.get_descriptions_bulk(referenced_nodes, brain_id)
        logging.info(f"node_to_ids: {node_to_ids}")
        # 모든 source_id 집합 수집
        all_ids = sorted({sid for ids in node_to_ids.values() for sid in ids})
        logging.info(f"all_ids: {all_ids}")
        # SQLite batch 조회로 id→title 매핑
        id_to_title = db_handler.get_titles_by_ids(all_ids)
               
        # 최종 구조화
        enriched = []
        for node in referenced_nodes:
            # 중복 제거된 source_id 리스트
            unique_sids = list(dict.fromkeys(node_to_ids.get(node, [])))
            sources = []
            for sid in unique_sids:
                if sid not in id_to_title:
                    continue
                # Neo4j 에서 이 (node, sid) 조합의 original_sentences 가져오기
                orig_sents = neo4j_handler.get_original_sentences(node, sid, brain_id)

                sources.append({
                    "id": str(sid),
                    "title": id_to_title[sid],
                    "original_sentences": orig_sents  # 여기에 리스트 형태로 들어감
                })

            enriched.append({
                    "name": node,
                    "source_ids": sources
            })

        # AI 답변 저장 및 chat_id 획득
        chat_id = db_handler.save_chat(session_id, True, final_answer, enriched, accuracy)

        return {
            "answer": final_answer,
            "referenced_nodes": enriched,
            "chat_id": chat_id,
            "accuracy": accuracy
        }
    except Exception as e:
        logging.error("answer 오류: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/getSourceIds",
    summary="노드의 모든 source_id와 제목을 조회",
    description="특정 노드의 descriptions 배열에서 모든 source_id를 추출하여 반환합니다.",
    response_description="source_id와 title을 포함하는 객체 리스트를 반환합니다.",
    responses={
    500: ErrorExamples[50002]
    }
)
async def get_source_ids(node_name: str, brain_id: str):
    """
    노드의 모든 source_id와 제목을 반환합니다:
    
    - **node_name**: 조회할 노드의 이름
    - **brain_id**: 브레인 ID
    
    반환값:
    - **sources**: source_id와 title을 포함하는 객체 리스트
    """
    # 파라미터 기록: 운영 디버깅 시 활용
    logging.info(f"getSourceIds 엔드포인트 호출됨 - node_name: {node_name}, brain_id: {brain_id}")
    try:
        neo4j_handler = Neo4jHandler()
        db = SQLiteHandler()
        logging.info("Neo4j 핸들러 생성됨")
        
        # Neo4j에서 노드의 descriptions 배열 조회
        descriptions = neo4j_handler.get_node_descriptions(node_name, brain_id)
        if not descriptions:
            return {"sources": []}
            
        # descriptions 배열에서 모든 source_id 추출
        # - JSON 항목 간 중복 제거를 위해 set 사용
        seen_ids = set()
        sources = []
        
        for desc in descriptions:
            if "source_id" in desc:
                source_id = desc["source_id"]
                if source_id not in seen_ids:
                    seen_ids.add(source_id)
                    
                    # PDF와 TextFile 테이블에서 모두 조회
                    pdf = db.get_pdf(int(source_id))
                    textfile = db.get_textfile(int(source_id))
                    memo = db.get_memo(int(source_id))
                    md = db.get_mdfile(int(source_id))
                    
                    title = None
                    if pdf:
                        title = pdf['pdf_title']
                    elif textfile:
                        title = textfile['txt_title']
                    elif memo:
                        title = memo['memo_title']
                    elif md:
                        title = md['md_title']
                    
                    if title:
                        sources.append({
                            "id": source_id,
                            "title": title
                        })
        
        logging.info(f"추출된 sources: {sources}")
        return {"sources": sources}
        
    except Exception as e:
        logging.error("source_id 조회 오류: %s", str(e))
        raise HTTPException(status_code=500, detail=f"source_id 조회 중 오류가 발생했습니다: {str(e)}")

@router.get("/getNodesBySourceId",
    summary="source_id로 노드 조회",
    description="특정 source_id가 descriptions에 포함된 모든 노드의 이름을 반환합니다.",
    response_description="노드 이름 목록을 반환합니다.")
async def get_nodes_by_source_id(source_id: str, brain_id: str):
    """
    source_id로 노드를 조회합니다:
    
    - **source_id**: 찾을 source_id
    - **brain_id**: 브레인 ID
    
    반환값:
    - **nodes**: 노드 이름 목록
    """
    logging.info(f"getNodesBySourceId 엔드포인트 호출됨 - source_id: {source_id}, brain_id: {brain_id}")
    try:
        # 그래프 DB에서 source_id가 포함된 노드 조회
        neo4j_handler = Neo4jHandler()
        logging.info("Neo4j 핸들러 생성됨")
        
        # Neo4j에서 source_id로 노드 조회
        node_names = neo4j_handler.get_nodes_by_source_id(source_id, brain_id)
        logging.info(f"조회된 노드 이름: {node_names}")
        
        return {"nodes": node_names}
        
    except Exception as e:
        logging.error("노드 조회 오류: %s", str(e))
        raise HTTPException(status_code=500, detail=f"노드 조회 중 오류가 발생했습니다: {str(e)}")

@router.get("/getSourceDataMetrics/{brain_id}",
    summary="브레인의 소스별 데이터 메트릭 조회",
    description="특정 브레인의 모든 소스에 대한 텍스트 양과 그래프 데이터 양을 계산하여 반환합니다.",
    response_description="소스별 텍스트 양과 그래프 데이터 양 정보를 반환합니다.",
    responses={
        404: ErrorExamples[40401],
        500: ErrorExamples[50001]
    }
)
async def get_source_data_metrics(brain_id: str):
    """
    특정 브레인의 모든 소스에 대한 데이터 메트릭을 반환합니다:
    
    - **brain_id**: 메트릭을 조회할 브레인 ID
    
    반환값:
    - **total_text_length**: 전체 텍스트 길이
    - **total_nodes**: 전체 노드 수
    - **total_edges**: 전체 엣지 수
    - **source_metrics**: 소스별 상세 메트릭
    """
    logging.info(f"getSourceDataMetrics 엔드포인트 호출됨 - brain_id: {brain_id}")
    try:
        neo4j_handler = Neo4jHandler()
        db_handler = SQLiteHandler()
        
        # 1. Neo4j에서 그래프 데이터 조회
        graph_data = neo4j_handler.get_brain_graph(brain_id)
        total_nodes = len(graph_data.get('nodes', []))
        total_edges = len(graph_data.get('links', []))
        
        # 2. SQLite에서 소스별 텍스트 길이 계산
        source_metrics = []
        total_text_length = 0
        
        # PDF 소스들 조회
        pdfs = db_handler.get_pdfs_by_brain(brain_id)
        for pdf in pdfs:
            try:
                # PDF 파일에서 텍스트 추출 (간단한 추정)
                # 실제로는 PDF 파싱이 필요하지만, 여기서는 파일 크기로 추정
                import os
                if os.path.exists(pdf['pdf_path']):
                    file_size = os.path.getsize(pdf['pdf_path'])
                    # PDF 파일 크기를 텍스트 길이로 추정 (대략적인 계산)
                    estimated_text_length = int(file_size * 0.1)  # PDF의 약 10%가 텍스트라고 가정
                else:
                    estimated_text_length = 0
                
                # 이 PDF에서 생성된 노드 수 계산
                pdf_nodes = neo4j_handler.get_nodes_by_source_id(pdf['pdf_id'], brain_id)
                pdf_edges = neo4j_handler.get_edges_by_source_id(pdf['pdf_id'], brain_id)
                
                source_metrics.append({
                    "source_id": pdf['pdf_id'],
                    "source_type": "pdf",
                    "title": pdf['pdf_title'],
                    "text_length": estimated_text_length,
                    "nodes_count": len(pdf_nodes),
                    "edges_count": len(pdf_edges)
                })
                
                total_text_length += estimated_text_length
                
            except Exception as e:
                logging.error(f"PDF 메트릭 계산 오류 (ID: {pdf['pdf_id']}): {str(e)}")
        
        # TXT 소스들 조회
        txts = db_handler.get_textfiles_by_brain(brain_id)
        for txt in txts:
            try:
                # TXT 파일에서 실제 텍스트 길이 계산
                import os
                if os.path.exists(txt['txt_path']):
                    with open(txt['txt_path'], 'r', encoding='utf-8') as f:
                        text_content = f.read()
                        text_length = len(text_content)
                else:
                    text_length = 0
                
                # 이 TXT에서 생성된 노드 수 계산
                txt_nodes = neo4j_handler.get_nodes_by_source_id(txt['txt_id'], brain_id)
                txt_edges = neo4j_handler.get_edges_by_source_id(txt['txt_id'], brain_id)
                
                source_metrics.append({
                    "source_id": txt['txt_id'],
                    "source_type": "txt",
                    "title": txt['txt_title'],
                    "text_length": text_length,
                    "nodes_count": len(txt_nodes),
                    "edges_count": len(txt_edges)
                })
                
                total_text_length += text_length
                
            except Exception as e:
                logging.error(f"TXT 메트릭 계산 오류 (ID: {txt['txt_id']}): {str(e)}")
        
        # MEMO 소스들 조회
        memos = db_handler.get_memos_by_brain(brain_id, is_source=True)
        for memo in memos:
            try:
                # 메모 텍스트 길이 계산
                text_length = len(memo['memo_text'] or '')
                
                # 이 메모에서 생성된 노드 수 계산
                memo_nodes = neo4j_handler.get_nodes_by_source_id(memo['memo_id'], brain_id)
                memo_edges = neo4j_handler.get_edges_by_source_id(memo['memo_id'], brain_id)
                
                source_metrics.append({
                    "source_id": memo['memo_id'],
                    "source_type": "memo",
                    "title": memo['memo_title'],
                    "text_length": text_length,
                    "nodes_count": len(memo_nodes),
                    "edges_count": len(memo_edges)
                })
                
                total_text_length += text_length
                
            except Exception as e:
                logging.error(f"MEMO 메트릭 계산 오류 (ID: {memo['memo_id']}): {str(e)}")
        
        return {
            "total_text_length": total_text_length,
            "total_nodes": total_nodes,
            "total_edges": total_edges,
            "source_metrics": source_metrics
        }
        
    except AppException as ae:
        raise ae
    except Exception as e:
        logging.error("소스 데이터 메트릭 조회 오류: %s", str(e))
        raise Neo4jException(message=str(e))

@router.get("/sourceCount/{brain_id}", summary="브레인별 전체 소스 개수 조회", description="특정 브레인에 속한 PDF, TXT, MD, MEMO 소스의 개수를 반환합니다.")
async def get_source_count(brain_id: int):
    """
    해당 brain_id에 속한 모든 소스(PDF, TXT, MD, MEMO) 개수를 반환합니다.
    is_source가 true인 메모만 소스로 계산합니다.
    """
    db = SQLiteHandler()
    try:
        pdfs = db.get_pdfs_by_brain(brain_id)
        txts = db.get_textfiles_by_brain(brain_id)
        mds = db.get_mds_by_brain(brain_id)
        memos = db.get_memos_by_brain(brain_id, is_source=True)  # is_source가 True인 메모만 조회
        total_count = len(pdfs) + len(txts) + len(mds) + len(memos)
        return {
            "pdf_count": len(pdfs),
            "txt_count": len(txts),
            "md_count": len(mds),
            "memo_count": len(memos),
            "total_count": total_count
        }
    except Exception as e:
        raise HTTPException(500, f"소스 개수 조회 중 오류: {str(e)}")

@router.get("/getSourceContent",
    summary="소스 파일의 텍스트 내용 조회",
    description="특정 source_id의 파일 타입에 따라 텍스트 내용을 반환합니다.",
    response_description="소스 파일의 텍스트 내용을 반환합니다.",
    responses={
        404: ErrorExamples[40401],
        500: ErrorExamples[50001]
    }
)
async def get_source_content(source_id: str, brain_id: str):
    """
    소스 파일의 텍스트 내용을 조회합니다:
    
    - **source_id**: 조회할 소스 ID
    - **brain_id**: 브레인 ID
    
    반환값:
    - **content**: 소스 파일의 텍스트 내용
    - **title**: 소스 파일의 제목
    - **type**: 파일 타입 (pdf, textfile, memo, md, docx)
    """
    logging.info(f"getSourceContent 엔드포인트 호출됨 - source_id: {source_id}, brain_id: {brain_id}")
    try:
        db = SQLiteHandler()
        
        # PDF와 TextFile, Memo, MD, DocsFile 테이블에서 모두 조회
        pdf = db.get_pdf(int(source_id))
        textfile = db.get_textfile(int(source_id))
        memo = db.get_memo(int(source_id))
        md = db.get_mdfile(int(source_id))
        docx = db.get_docxfile(int(source_id))
        
        content = None
        title = None
        file_type = None
        
        if pdf:
            content = pdf.get('pdf_text', '')
            title = pdf.get('pdf_title', '')
            file_type = 'pdf'
        elif textfile:
            content = textfile.get('txt_text', '')
            title = textfile.get('txt_title', '')
            file_type = 'textfile'
        elif memo:
            content = memo.get('memo_text', '')
            title = memo.get('memo_title', '')
            file_type = 'memo'
        elif md:
            content = md.get('md_text', '')
            title = md.get('md_title', '')
            file_type = 'md'
        elif docx:
            content = docx.get('docx_text', '')
            title = docx.get('docx_title', '')
            file_type = 'docx'
        
        if content is None:
            raise HTTPException(status_code=404, detail="해당 source_id의 파일을 찾을 수 없습니다.")
        
        return {
            "content": content,
            "title": title,
            "type": file_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error("소스 내용 조회 오류: %s", str(e))
        raise HTTPException(status_code=500, detail=f"소스 내용 조회 중 오류가 발생했습니다: {str(e)}")