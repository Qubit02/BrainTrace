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
import json
import re

# LangChain imports
try:
    from langchain_core.pydantic_v1 import BaseModel, Field
    from langchain.tools import StructuredTool
    try:
        from langchain_openai import ChatOpenAI
    except ImportError:
        from langchain_community.chat_models import ChatOpenAI
    try:
        from langchain_community.chat_models import ChatOllama
    except ImportError:
        ChatOllama = None
    LANGCHAIN_AVAILABLE = True
except ImportError as e:
    LANGCHAIN_AVAILABLE = False
    logging.warning(f"LangChain이 설치되지 않았거나 일부 모듈을 찾을 수 없습니다. 커스텀 Agent를 사용합니다. 오류: {e}")

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
    
    # 노드 정보를 벡터 DB에 임베딩
    # 컬렉션이 없으면 초기화
    if not embedding_service.is_index_ready(brain_id):
        embedding_service.initialize_collection(brain_id)
    
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


# LangChain Tool 정의 (LangChain이 사용 가능한 경우)
if LANGCHAIN_AVAILABLE:
    # Tool을 위한 Pydantic 모델 정의
    class NodeQualityInput(BaseModel):
        question: str = Field(description="사용자 질문")
        node_names: list = Field(description="검색된 노드 이름 리스트")
        node_scores: list = Field(description="각 노드의 유사도 점수 리스트")
    
    class SchemaSufficiencyInput(BaseModel):
        question: str = Field(description="사용자 질문")
        schema_summary: str = Field(description="스키마 조회 결과 요약")
    
    class SchemaOptimizationInput(BaseModel):
        question: str = Field(description="사용자 질문")
        raw_schema_text: str = Field(description="원본 스키마 텍스트")
    
    def create_langchain_llm(ai_service, model: str, model_name: str):
        """LangChain LLM 인스턴스 생성"""
        if model == "openai":
            return ChatOpenAI(model=model_name, temperature=0)
        elif model == "ollama":
            if ChatOllama is None:
                raise ValueError("ChatOllama를 사용할 수 없습니다. langchain-community가 설치되어 있는지 확인하세요.")
            return ChatOllama(model=model_name, temperature=0)
        else:
            raise ValueError(f"지원하지 않는 모델: {model}")
    
    def create_node_quality_tool(llm):
        """노드 품질 평가 Tool 생성"""
        def evaluate_nodes(question: str, node_names: list, node_scores: list) -> str:
            """검색된 노드들의 품질을 평가하고 필터링"""
            node_info = [f"- {name} (유사도: {score:.2f})" for name, score in zip(node_names, node_scores)]
            nodes_text = "\n".join(node_info)
            
            prompt = (
                f"다음은 사용자 질문과 검색된 노드 목록입니다.\n\n"
                f"사용자 질문: {question}\n\n"
                f"검색된 노드 목록:\n{nodes_text}\n\n"
                f"질문과 직접적으로 관련된 노드만 선택하여 JSON 형식으로 응답해주세요:\n"
                f'{{"filtered_node_names": ["노드명1", "노드명2", ...], "needs_more_search": true/false, "reason": "판단 이유"}}'
            )
            
            try:
                response = llm.invoke(prompt)
                content = response.content if hasattr(response, 'content') else str(response)
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    return json_match.group()
                return json.dumps({"filtered_node_names": node_names, "needs_more_search": False, "reason": "파싱 실패"})
            except Exception as e:
                logging.error(f"노드 품질 평가 Tool 오류: {e}")
                return json.dumps({"filtered_node_names": node_names, "needs_more_search": False, "reason": f"오류: {str(e)}"})
        
        return StructuredTool.from_function(
            func=evaluate_nodes,
            name="evaluate_node_quality",
            description="검색된 노드들의 질문과의 관련성을 평가하고 필터링합니다.",
            args_schema=NodeQualityInput
        )
    
    def create_schema_sufficiency_tool(llm):
        """스키마 충분성 판단 Tool 생성"""
        def evaluate_schema(question: str, schema_summary: str) -> str:
            """스키마 조회 결과의 충분성을 판단"""
            prompt = (
                f"다음은 사용자 질문과 스키마 조회 결과 요약입니다.\n\n"
                f"사용자 질문: {question}\n\n"
                f"스키마 조회 결과: {schema_summary}\n\n"
                f"질문에 답변하기에 충분한 정보가 있는지 판단하여 JSON 형식으로 응답해주세요:\n"
                f'{{"is_sufficient": true/false, "needs_deep_search": true/false, "missing_info": "부족한 정보", "reason": "판단 이유"}}'
            )
            
            try:
                response = llm.invoke(prompt)
                content = response.content if hasattr(response, 'content') else str(response)
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    return json_match.group()
                return json.dumps({"is_sufficient": True, "needs_deep_search": False, "missing_info": "", "reason": "파싱 실패"})
            except Exception as e:
                logging.error(f"스키마 충분성 판단 Tool 오류: {e}")
                return json.dumps({"is_sufficient": True, "needs_deep_search": False, "missing_info": "", "reason": f"오류: {str(e)}"})
        
        return StructuredTool.from_function(
            func=evaluate_schema,
            name="evaluate_schema_sufficiency",
            description="스키마 조회 결과가 질문에 답변하기에 충분한지 판단합니다.",
            args_schema=SchemaSufficiencyInput
        )
    
    def create_schema_optimization_tool(llm):
        """스키마 텍스트 최적화 Tool 생성"""
        def optimize_schema(question: str, raw_schema_text: str) -> str:
            """스키마 텍스트를 질문에 맞게 최적화"""
            if not raw_schema_text or len(raw_schema_text.strip()) == 0:
                return raw_schema_text
            
            prompt = (
                f"다음은 사용자 질문과 스키마 텍스트입니다.\n\n"
                f"사용자 질문: {question}\n\n"
                f"스키마 텍스트:\n{raw_schema_text}\n\n"
                f"질문에 답변하는데 직접적으로 관련된 정보만 남기고 불필요한 정보는 제거하여 최적화된 스키마 텍스트를 생성해주세요.\n"
                f"원본 스키마의 구조와 형식은 유지하되, 질문과 무관한 노드나 관계는 제외해주세요."
            )
            
            try:
                response = llm.invoke(prompt)
                optimized_text = response.content if hasattr(response, 'content') else str(response)
                optimized_text = optimized_text.strip()
                
                if not optimized_text or len(optimized_text) < 10:
                    return raw_schema_text
                
                return optimized_text
            except Exception as e:
                logging.error(f"스키마 최적화 Tool 오류: {e}")
                return raw_schema_text
        
        return StructuredTool.from_function(
            func=optimize_schema,
            name="optimize_schema_text",
            description="스키마 텍스트를 질문에 맞게 최적화하여 관련 정보만 남깁니다.",
            args_schema=SchemaOptimizationInput
        )


# 오류 복구 Agent 함수
def error_recovery_agent(ai_service, error_info: dict, step_name: str, context: dict) -> dict:
    """
    오류 발생 시 원인을 분석하고 해결 방안을 제시하는 AI Agent
    
    Args:
        ai_service: AI 서비스 인스턴스
        error_info: 오류 정보 (error_type, error_message, step, context 등)
        step_name: 오류가 발생한 단계 이름
        context: 현재 컨텍스트 정보
    
    Returns:
        dict: {
            "recovery_action": str,  # 복구 액션 (retry, skip, modify, fallback 등)
            "modification": dict,  # 수정 사항 (있는 경우)
            "reason": str,  # 복구 방안 이유
            "retry_params": dict  # 재시도 시 사용할 파라미터
        }
    """
    error_type = error_info.get("error_type", "Unknown")
    error_message = error_info.get("error_message", "")
    step = error_info.get("step", "")
    
    prompt = (
        f"다음은 질문-답변 파이프라인에서 발생한 오류입니다.\n\n"
        f"오류 발생 단계: {step_name}\n"
        f"오류 유형: {error_type}\n"
        f"오류 메시지: {error_message}\n\n"
        f"현재 컨텍스트:\n"
        f"- 질문: {context.get('question', 'N/A')}\n"
        f"- 검색된 노드 수: {context.get('node_count', 'N/A')}\n"
        f"- 스키마 노드 수: {context.get('schema_node_count', 'N/A')}\n\n"
        f"다음 JSON 형식으로 응답해주세요:\n"
        f'{{"recovery_action": "retry|skip|modify|fallback", "modification": {{"key": "value"}}, "reason": "복구 방안 이유", "retry_params": {{"param": "value"}}}}\n\n'
        f"복구 액션 설명:\n"
        f"- retry: 동일한 파라미터로 재시도\n"
        f"- skip: 현재 단계 건너뛰고 다음 단계 진행\n"
        f"- modify: 파라미터 수정 후 재시도 (retry_params에 수정 사항 포함)\n"
        f"- fallback: 대체 방법 사용 (예: 일반 지식으로 답변)\n\n"
        f"JSON 형식으로만 응답하고 다른 설명은 포함하지 마세요."
    )
    
    try:
        response = ai_service.chat(prompt)
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return {
                "recovery_action": result.get("recovery_action", "skip"),
                "modification": result.get("modification", {}),
                "reason": result.get("reason", ""),
                "retry_params": result.get("retry_params", {})
            }
        else:
            logging.warning("오류 복구 Agent 응답 파싱 실패, 기본값 사용")
            return {
                "recovery_action": "skip",
                "modification": {},
                "reason": "응답 파싱 실패",
                "retry_params": {}
            }
    except Exception as e:
        logging.error(f"오류 복구 Agent 실행 오류: {e}")
        return {
            "recovery_action": "skip",
            "modification": {},
            "reason": f"Agent 오류: {str(e)}",
            "retry_params": {}
        }


def retry_with_recovery(max_retries=3):
    """
    오류 발생 시 자동 복구 및 재시도를 위한 데코레이터
    
    Args:
        max_retries: 최대 재시도 횟수
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            ai_service = kwargs.get('ai_service') or (args[0] if args else None)
            question = kwargs.get('question') or (args[1] if len(args) > 1 else "")
            step_name = kwargs.get('step_name', func.__name__)
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    error_info = {
                        "error_type": type(e).__name__,
                        "error_message": str(e),
                        "step": step_name,
                        "attempt": attempt + 1
                    }
                    
                    context = {
                        "question": question,
                        "node_count": kwargs.get('node_count', 'N/A'),
                        "schema_node_count": kwargs.get('schema_node_count', 'N/A')
                    }
                    
                    logging.warning(f"⚠️  [{step_name}] 오류 발생 (시도 {attempt + 1}/{max_retries}): {str(e)}")
                    
                    if attempt < max_retries - 1 and ai_service:
                        # 오류 복구 Agent 실행
                        logging.info(f"🔧 오류 복구 Agent 실행 중...")
                        recovery_result = error_recovery_agent(ai_service, error_info, step_name, context)
                        
                        recovery_action = recovery_result.get('recovery_action', 'skip')
                        logging.info(f"🔧 복구 방안: {recovery_action} - {recovery_result['reason']}")
                        
                        if recovery_action == "retry":
                            logging.info(f"🔄 재시도 중...")
                            continue
                        elif recovery_action == "modify":
                            # 파라미터 수정 후 재시도
                            retry_params = recovery_result.get("retry_params", {})
                            kwargs.update(retry_params)
                            logging.info(f"🔄 파라미터 수정 후 재시도: {retry_params}")
                            continue
                        elif recovery_action == "skip":
                            logging.info(f"⏭️  현재 단계 건너뛰기")
                            return None
                        elif recovery_action == "fallback":
                            logging.info(f"🔄 대체 방법 사용")
                            # fallback 로직은 각 함수에서 구현
                            return None
                    else:
                        # 최대 재시도 횟수 초과
                        logging.error(f"❌ 최대 재시도 횟수 초과. 오류: {str(e)}")
                        raise
            
            return None
        return wrapper
    return decorator


# AI Agent 함수들 (커스텀 구현 - LangChain이 없을 때 사용)
def evaluate_search_nodes_quality(ai_service, question: str, similar_nodes: list) -> dict:
    """
    검색된 노드들의 품질을 평가하고 최적화하는 AI Agent
    
    Args:
        ai_service: AI 서비스 인스턴스
        question: 사용자 질문
        similar_nodes: 검색된 유사 노드 리스트
    
    Returns:
        dict: {
            "filtered_nodes": list,  # 필터링된 노드 리스트
            "needs_more_search": bool,  # 추가 검색 필요 여부
            "reason": str  # 판단 이유
        }
    """
    if not similar_nodes:
        return {
            "filtered_nodes": [],
            "needs_more_search": False,
            "reason": "검색된 노드가 없습니다."
        }
    
    # 노드 이름과 점수 정보 추출
    node_info = [f"- {node['name']} (유사도: {node['score']:.2f})" for node in similar_nodes]
    nodes_text = "\n".join(node_info)
    
    prompt = (
        f"다음은 사용자 질문과 검색된 노드 목록입니다.\n\n"
        f"사용자 질문: {question}\n\n"
        f"검색된 노드 목록:\n{nodes_text}\n\n"
        f"다음 JSON 형식으로 응답해주세요:\n"
        f'{{"filtered_node_names": ["노드명1", "노드명2", ...], "needs_more_search": true/false, "reason": "판단 이유"}}\n\n'
        f"판단 기준:\n"
        f"1. 질문과 직접적으로 관련된 노드만 포함\n"
        f"2. 관련성이 낮은 노드는 제외\n"
        f"3. 답변에 필요한 정보가 부족하면 needs_more_search를 true로 설정\n"
        f"4. JSON 형식으로만 응답하고 다른 설명은 포함하지 마세요."
    )
    
    try:
        response = ai_service.chat(prompt)
        # JSON 파싱 시도
        # JSON 부분만 추출
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
        else:
            # JSON 파싱 실패 시 원본 노드 반환
            logging.warning("AI Agent 응답 파싱 실패, 원본 노드 사용")
            return {
                "filtered_nodes": similar_nodes,
                "needs_more_search": False,
                "reason": "응답 파싱 실패"
            }
        
        # 필터링된 노드 이름으로 원본 노드 필터링
        filtered_names = result.get("filtered_node_names", [])
        filtered_nodes = [node for node in similar_nodes if node["name"] in filtered_names]
        
        # 필터링 결과가 비어있으면 원본 사용
        if not filtered_nodes:
            filtered_nodes = similar_nodes
        
        return {
            "filtered_nodes": filtered_nodes,
            "needs_more_search": result.get("needs_more_search", False),
            "reason": result.get("reason", "")
        }
    except Exception as e:
        logging.error(f"검색 노드 품질 평가 Agent 오류: {e}")
        # 오류 시 원본 노드 반환
        return {
            "filtered_nodes": similar_nodes,
            "needs_more_search": False,
            "reason": f"Agent 오류: {str(e)}"
        }


def evaluate_schema_sufficiency(ai_service, question: str, schema_summary: str) -> dict:
    """
    스키마 조회 결과의 충분성을 판단하는 AI Agent
    
    Args:
        ai_service: AI 서비스 인스턴스
        question: 사용자 질문
        schema_summary: 스키마 요약 정보 (노드 개수, 관계 개수 등)
    
    Returns:
        dict: {
            "is_sufficient": bool,  # 충분한지 여부
            "needs_deep_search": bool,  # 깊은 탐색 필요 여부
            "missing_info": str,  # 부족한 정보 설명
            "reason": str  # 판단 이유
        }
    """
    prompt = (
        f"다음은 사용자 질문과 스키마 조회 결과 요약입니다.\n\n"
        f"사용자 질문: {question}\n\n"
        f"스키마 조회 결과: {schema_summary}\n\n"
        f"다음 JSON 형식으로 응답해주세요:\n"
        f'{{"is_sufficient": true/false, "needs_deep_search": true/false, "missing_info": "부족한 정보", "reason": "판단 이유"}}\n\n'
        f"판단 기준:\n"
        f"1. 질문에 답변하기에 충분한 정보가 있는지 판단\n"
        f"2. 부족하면 needs_deep_search를 true로 설정\n"
        f"3. JSON 형식으로만 응답하고 다른 설명은 포함하지 마세요."
    )
    
    try:
        response = ai_service.chat(prompt)
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
        else:
            logging.warning("AI Agent 응답 파싱 실패, 기본값 사용")
            return {
                "is_sufficient": True,
                "needs_deep_search": False,
                "missing_info": "",
                "reason": "응답 파싱 실패"
            }
        
        return {
            "is_sufficient": result.get("is_sufficient", True),
            "needs_deep_search": result.get("needs_deep_search", False),
            "missing_info": result.get("missing_info", ""),
            "reason": result.get("reason", "")
        }
    except Exception as e:
        logging.error(f"스키마 충분성 판단 Agent 오류: {e}")
        return {
            "is_sufficient": True,
            "needs_deep_search": False,
            "missing_info": "",
            "reason": f"Agent 오류: {str(e)}"
        }


def optimize_schema_text(ai_service, question: str, raw_schema_text: str) -> str:
    """
    스키마 텍스트를 질문에 맞게 최적화하는 AI Agent
    
    Args:
        ai_service: AI 서비스 인스턴스
        question: 사용자 질문
        raw_schema_text: 원본 스키마 텍스트
    
    Returns:
        str: 최적화된 스키마 텍스트
    """
    if not raw_schema_text or len(raw_schema_text.strip()) == 0:
        return raw_schema_text
    
    prompt = (
        f"다음은 사용자 질문과 스키마 텍스트입니다.\n\n"
        f"사용자 질문: {question}\n\n"
        f"스키마 텍스트:\n{raw_schema_text}\n\n"
        f"질문에 답변하는데 직접적으로 관련된 정보만 남기고 불필요한 정보는 제거하여 최적화된 스키마 텍스트를 생성해주세요.\n"
        f"원본 스키마의 구조와 형식은 유지하되, 질문과 무관한 노드나 관계는 제외해주세요.\n"
        f"최적화된 스키마 텍스트만 응답하고 다른 설명은 포함하지 마세요."
    )
    
    try:
        optimized_text = ai_service.chat(prompt)
        optimized_text = optimized_text.strip()
        
        # 최적화 결과가 비어있거나 너무 짧으면 원본 사용
        if not optimized_text or len(optimized_text) < 10:
            logging.warning("최적화된 텍스트가 비어있어 원본 사용")
            return raw_schema_text
        
        return optimized_text
    except Exception as e:
        logging.error(f"스키마 텍스트 최적화 Agent 오류: {e}")
        return raw_schema_text


@router.post("/answer",
    summary="질문에 대한 답변 생성",
    description="""
    사용자 질문을 받아 임베딩을 통해 유사한 노드를 찾고, 
    해당 노드들의 2단계 깊이 스키마를 추출 후 LLM을 이용해 최종 답변 생성
    <br> Ollama 사용 → (model: "ollama")  
    <br> GPT 사용 → (model: "gpt")
    <br> 딥서치 사용 → (use_deep_search : true) 디폴트 값 false로 설정
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
    use_deep_search = request_data.use_deep_search
    if not question:
        raise HTTPException(status_code=400, detail="question 파라미터가 필요합니다.")
    if not brain_id:
        raise HTTPException(status_code=400, detail="brain_id 파라미터가 필요합니다.")
    
    # 선택된 모델에 따라 AI 서비스 인스턴스를 주입
    if model == "openai":
        ai_service = get_ai_service_GPT(model_name)
        logging.info("📋 [1] 질문 수신 | 모델: %s (%s)", model_name, model)
    elif model == "ollama":
        ai_service = get_ai_service_Ollama(model_name)
        logging.info("📋 [1] 질문 수신 | 모델: %s (%s)", model_name, model)
    else:
        logging.error("지원하지 않는 모델: %s", model)
        raise HTTPException(status_code=400, detail=f"지원하지 않는 모델: {model}")
    
    logging.info("💬 질문: %s", question[:100] + "..." if len(question) > 100 else question)
    
    try:
        # SQLite 핸들러: 소스 메타데이터(title 등) 조회와 채팅 로그 저장에 사용
        db_handler = SQLiteHandler()
        
        # Step 1: 컬렉션이 없으면 초기화
        if not embedding_service.is_index_ready(brain_id):
            embedding_service.initialize_collection(brain_id)
        
        # Step 2: 질문 임베딩 계산
        question_embedding = embedding_service.encode_text(question)
        
        # Step 3: 임베딩을 통해 유사한 노드 검색
        logging.info("🔍 [2] 유사 노드 검색 중...")
        similar_nodes,Q = embedding_service.search_similar_nodes(embedding=question_embedding, brain_id=brain_id)
        if not similar_nodes:
            # 관련 노드가 없을 때 일반 지식으로 답변 생성
            logging.info("⚠️  [3] 관련 노드 없음 → 일반 지식으로 답변 생성")
            general_prompt = (
                f"다음 질문에 대해 일반적인 지식을 바탕으로 친절하고 상세하게 답변해주세요. "
                f"업로드된 소스 파일을 참고하지 말고, 당신이 알고 있는 일반적인 지식으로만 답변해주세요.\n\n"
                f"질문: {question}\n\n"
                f"답변:"
            )
            final_answer = ai_service.chat(general_prompt)
            final_answer = final_answer.strip()
            
            # 일반 지식 답변 저장
            chat_id = db_handler.save_chat(session_id, True, final_answer, [], 0.0)
            logging.info("✅ [4] 완료 | 일반 지식 답변 생성 완료")
            
            return {
                "answer": final_answer,
                "referenced_nodes": [],
                "chat_id": chat_id,
                "accuracy": 0.0
            }
        
        # Step 3-1: [AI Agent] 검색된 노드 품질 평가 및 최적화
        initial_node_count = len(similar_nodes)
        logging.info("🤖 [3] AI Agent: 노드 품질 평가 중... (검색된 노드: %d개)", initial_node_count)
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                if LANGCHAIN_AVAILABLE:
                    try:
                        llm = create_langchain_llm(ai_service, model, model_name)
                        node_quality_tool = create_node_quality_tool(llm)
                        node_names = [node["name"] for node in similar_nodes]
                        node_scores = [node["score"] for node in similar_nodes]
                        result_json = node_quality_tool.invoke({
                            "question": question,
                            "node_names": node_names,
                            "node_scores": node_scores
                        })
                        result = json.loads(result_json)
                        filtered_names = result.get("filtered_node_names", [])
                        filtered_nodes = [node for node in similar_nodes if node["name"] in filtered_names]
                        if not filtered_nodes:
                            filtered_nodes = similar_nodes
                        similar_nodes = filtered_nodes
                    except Exception as e:
                        node_quality_result = evaluate_search_nodes_quality(ai_service, question, similar_nodes)
                        similar_nodes = node_quality_result["filtered_nodes"]
                else:
                    node_quality_result = evaluate_search_nodes_quality(ai_service, question, similar_nodes)
                    similar_nodes = node_quality_result["filtered_nodes"]
                break  # 성공 시 루프 종료
            except Exception as e:
                error_info = {
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "step": "노드 품질 평가",
                    "attempt": attempt + 1
                }
                context = {
                    "question": question,
                    "node_count": len(similar_nodes),
                    "schema_node_count": "N/A"
                }
                
                logging.warning(f"⚠️  [노드 품질 평가] 오류 발생 (시도 {attempt + 1}/{max_retries}): {str(e)}")
                
                if attempt < max_retries - 1:
                    logging.info("🔧 오류 복구 Agent 실행 중...")
                    recovery_result = error_recovery_agent(ai_service, error_info, "노드 품질 평가", context)
                    recovery_action = recovery_result.get('recovery_action', 'skip')
                    logging.info(f"🔧 복구 방안: {recovery_action} - {recovery_result['reason']}")
                    
                    if recovery_action == "retry":
                        logging.info("🔄 재시도 중...")
                        continue
                    elif recovery_action == "skip":
                        logging.info("⏭️  현재 단계 건너뛰기 (원본 노드 사용)")
                        break
                    elif recovery_action == "fallback":
                        logging.info("🔄 대체 방법 사용 (원본 노드 사용)")
                        break
                else:
                    logging.error(f"❌ 최대 재시도 횟수 초과. 원본 노드 사용")
                    break
        
        filtered_node_count = len(similar_nodes)
        if initial_node_count != filtered_node_count:
            logging.info("✓ 최적화 완료: %d개 → %d개 (관련성 낮은 노드 %d개 제거)", 
                        initial_node_count, filtered_node_count, initial_node_count - filtered_node_count)
        else:
            logging.info("✓ 최적화 완료: 모든 노드 유지 (%d개)", filtered_node_count)
        similar_node_names = [node["name"] for node in similar_nodes]
        
        # Step 4: 유사한 노드들의 스키마 조회
        logging.info("🗺️  [4] 스키마 조회 중...")
        neo4j_handler = Neo4jHandler()
        
        max_retries = 3
        result = None
        for attempt in range(max_retries):
            try:
                if(use_deep_search):
                    result = neo4j_handler.query_schema_by_node_names_deepSearch(similar_node_names, brain_id)
                else:
                    result = neo4j_handler.query_schema_by_node_names(similar_node_names, brain_id)
                break  # 성공 시 루프 종료
            except Exception as e:
                error_info = {
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "step": "스키마 조회",
                    "attempt": attempt + 1
                }
                context = {
                    "question": question,
                    "node_count": len(similar_nodes),
                    "schema_node_count": "N/A"
                }
                
                logging.warning(f"⚠️  [스키마 조회] 오류 발생 (시도 {attempt + 1}/{max_retries}): {str(e)}")
                
                if attempt < max_retries - 1:
                    logging.info("🔧 오류 복구 Agent 실행 중...")
                    recovery_result = error_recovery_agent(ai_service, error_info, "스키마 조회", context)
                    recovery_action = recovery_result.get('recovery_action', 'fallback')
                    logging.info(f"🔧 복구 방안: {recovery_action} - {recovery_result['reason']}")
                    
                    if recovery_action == "retry":
                        logging.info("🔄 재시도 중...")
                        continue
                    elif recovery_action == "modify":
                        # 파라미터 수정 (예: deep_search 토글)
                        retry_params = recovery_result.get("retry_params", {})
                        if retry_params.get("use_deep_search") is not None:
                            use_deep_search = retry_params["use_deep_search"]
                            logging.info(f"🔄 파라미터 수정: use_deep_search={use_deep_search}")
                        continue
                    elif recovery_action == "fallback":
                        logging.info("🔄 대체 방법 사용 (일반 지식으로 답변)")
                        result = None
                        break
                else:
                    logging.error(f"❌ 최대 재시도 횟수 초과. 일반 지식으로 답변 생성")
                    result = None
                    break

        if not result:
            logging.info("⚠️  [5] 스키마 조회 결과 없음 → 일반 지식으로 답변 생성")
            general_prompt = (
                f"다음 질문에 대해 일반적인 지식을 바탕으로 친절하고 상세하게 답변해주세요. "
                f"업로드된 소스 파일을 참고하지 말고, 당신이 알고 있는 일반적인 지식으로만 답변해주세요.\n\n"
                f"질문: {question}\n\n"
                f"답변:"
            )
            final_answer = ai_service.chat(general_prompt)
            final_answer = final_answer.strip()
            
            # 일반 지식 답변 저장
            chat_id = db_handler.save_chat(session_id, True, final_answer, [], 0.0)
            logging.info("✅ [6] 완료 | 일반 지식 답변 생성 완료")
            
            return {
                "answer": final_answer,
                "referenced_nodes": [],
                "chat_id": chat_id,
                "accuracy": 0.0
            }
            
        # 결과를 즉시 처리
        nodes_result = result.get("nodes", [])
        related_nodes_result = result.get("relatedNodes", [])
        relationships_result = result.get("relationships", [])
        
        logging.info("✓ 스키마 조회 완료: 노드 %d개, 관계 %d개", len(nodes_result), len(relationships_result))
        
        # Step 4-1: [AI Agent] 스키마 충분성 판단
        initial_nodes_count = len(nodes_result)
        initial_relationships_count = len(relationships_result)
        schema_summary = f"노드 {len(nodes_result)}개, 관련 노드 {len(related_nodes_result)}개, 관계 {len(relationships_result)}개"
        logging.info("🤖 [5] AI Agent: 스키마 충분성 판단 중... (현재: 노드 %d개, 관계 %d개)", 
                    initial_nodes_count, initial_relationships_count)
        
        max_retries = 3
        schema_sufficiency_result = {"is_sufficient": True, "needs_deep_search": False}
        for attempt in range(max_retries):
            try:
                if LANGCHAIN_AVAILABLE:
                    try:
                        llm = create_langchain_llm(ai_service, model, model_name)
                        schema_sufficiency_tool = create_schema_sufficiency_tool(llm)
                        result_json = schema_sufficiency_tool.invoke({
                            "question": question,
                            "schema_summary": schema_summary
                        })
                        schema_sufficiency_result = json.loads(result_json)
                    except Exception as e:
                        schema_sufficiency_result = evaluate_schema_sufficiency(ai_service, question, schema_summary)
                else:
                    schema_sufficiency_result = evaluate_schema_sufficiency(ai_service, question, schema_summary)
                break  # 성공 시 루프 종료
            except Exception as e:
                error_info = {
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "step": "스키마 충분성 판단",
                    "attempt": attempt + 1
                }
                context = {
                    "question": question,
                    "node_count": len(similar_nodes),
                    "schema_node_count": len(nodes_result)
                }
                
                logging.warning(f"⚠️  [스키마 충분성 판단] 오류 발생 (시도 {attempt + 1}/{max_retries}): {str(e)}")
                
                if attempt < max_retries - 1:
                    logging.info("🔧 오류 복구 Agent 실행 중...")
                    recovery_result = error_recovery_agent(ai_service, error_info, "스키마 충분성 판단", context)
                    recovery_action = recovery_result.get('recovery_action', 'skip')
                    logging.info(f"🔧 복구 방안: {recovery_action} - {recovery_result['reason']}")
                    
                    if recovery_action == "retry":
                        logging.info("🔄 재시도 중...")
                        continue
                    elif recovery_action == "skip":
                        logging.info("⏭️  현재 단계 건너뛰기 (기본값 사용)")
                        schema_sufficiency_result = {"is_sufficient": True, "needs_deep_search": False}
                        break
                else:
                    logging.error(f"❌ 최대 재시도 횟수 초과. 기본값 사용")
                    schema_sufficiency_result = {"is_sufficient": True, "needs_deep_search": False}
                    break
        
        # 충분하지 않고 깊은 탐색이 필요하다고 판단되면 deep search 시도
        if not schema_sufficiency_result.get("is_sufficient", True) and schema_sufficiency_result.get("needs_deep_search", False) and not use_deep_search:
            logging.info("🔍 정보 부족 감지 → 깊은 탐색 실행...")
            result = neo4j_handler.query_schema_by_node_names_deepSearch(similar_node_names, brain_id)
            if result:
                nodes_result = result.get("nodes", [])
                related_nodes_result = result.get("relatedNodes", [])
                relationships_result = result.get("relationships", [])
                final_nodes_count = len(nodes_result)
                final_relationships_count = len(relationships_result)
                logging.info("✓ 깊은 탐색 완료: 노드 %d개 → %d개 (+%d개), 관계 %d개 → %d개 (+%d개)", 
                            initial_nodes_count, final_nodes_count, final_nodes_count - initial_nodes_count,
                            initial_relationships_count, final_relationships_count, final_relationships_count - initial_relationships_count)
            else:
                logging.info("✓ 깊은 탐색 완료: 추가 정보 없음")
        else:
            if schema_sufficiency_result.get("is_sufficient", True):
                logging.info("✓ 충분성 판단: 현재 스키마로 답변 가능")
            else:
                logging.info("✓ 충분성 판단: 현재 스키마로 진행 (깊은 탐색 불필요)")
        
        # Step 5: 스키마 간결화 및 텍스트 구성
        logging.info("📝 [6] 스키마 텍스트 생성 중...")
        raw_schema_text = ai_service.generate_schema_text(nodes_result, related_nodes_result, relationships_result)
        initial_schema_length = len(raw_schema_text)
        logging.info("  → 원본 스키마 텍스트: %d자", initial_schema_length)
        
        # Step 5-1: [AI Agent] 스키마 텍스트 최적화
        logging.info("🤖 [7] AI Agent: 스키마 텍스트 최적화 중...")
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                if LANGCHAIN_AVAILABLE:
                    try:
                        llm = create_langchain_llm(ai_service, model, model_name)
                        schema_optimization_tool = create_schema_optimization_tool(llm)
                        optimized_schema_text = schema_optimization_tool.invoke({
                            "question": question,
                            "raw_schema_text": raw_schema_text
                        })
                        if optimized_schema_text != raw_schema_text:
                            raw_schema_text = optimized_schema_text
                            optimized_length = len(raw_schema_text)
                            reduction = initial_schema_length - optimized_length
                            reduction_rate = (reduction / initial_schema_length * 100) if initial_schema_length > 0 else 0
                            logging.info("✓ 최적화 완료: %d자 → %d자 (불필요한 정보 %d자 제거, %.1f%% 감소)", 
                                        initial_schema_length, optimized_length, reduction, reduction_rate)
                        else:
                            logging.info("✓ 최적화 완료: 변경 없음 (이미 최적화된 상태)")
                    except Exception as e:
                        optimized_schema_text = optimize_schema_text(ai_service, question, raw_schema_text)
                        if optimized_schema_text != raw_schema_text:
                            raw_schema_text = optimized_schema_text
                            optimized_length = len(raw_schema_text)
                            reduction = initial_schema_length - optimized_length
                            reduction_rate = (reduction / initial_schema_length * 100) if initial_schema_length > 0 else 0
                            logging.info("✓ 최적화 완료: %d자 → %d자 (불필요한 정보 %d자 제거, %.1f%% 감소)", 
                                        initial_schema_length, optimized_length, reduction, reduction_rate)
                        else:
                            logging.info("✓ 최적화 완료: 변경 없음")
                else:
                    optimized_schema_text = optimize_schema_text(ai_service, question, raw_schema_text)
                    if optimized_schema_text != raw_schema_text:
                        raw_schema_text = optimized_schema_text
                        optimized_length = len(raw_schema_text)
                        reduction = initial_schema_length - optimized_length
                        reduction_rate = (reduction / initial_schema_length * 100) if initial_schema_length > 0 else 0
                        logging.info("✓ 최적화 완료: %d자 → %d자 (불필요한 정보 %d자 제거, %.1f%% 감소)", 
                                    initial_schema_length, optimized_length, reduction, reduction_rate)
                    else:
                        logging.info("✓ 최적화 완료: 변경 없음")
                break  # 성공 시 루프 종료
            except Exception as e:
                error_info = {
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "step": "스키마 텍스트 최적화",
                    "attempt": attempt + 1
                }
                context = {
                    "question": question,
                    "node_count": len(similar_nodes),
                    "schema_node_count": len(nodes_result)
                }
                
                logging.warning(f"⚠️  [스키마 텍스트 최적화] 오류 발생 (시도 {attempt + 1}/{max_retries}): {str(e)}")
                
                if attempt < max_retries - 1:
                    logging.info("🔧 오류 복구 Agent 실행 중...")
                    recovery_result = error_recovery_agent(ai_service, error_info, "스키마 텍스트 최적화", context)
                    recovery_action = recovery_result.get('recovery_action', 'skip')
                    logging.info(f"🔧 복구 방안: {recovery_action} - {recovery_result['reason']}")
                    
                    if recovery_action == "retry":
                        logging.info("🔄 재시도 중...")
                        continue
                    elif recovery_action == "skip":
                        logging.info("⏭️  현재 단계 건너뛰기 (원본 스키마 텍스트 사용)")
                        break
                else:
                    logging.error(f"❌ 최대 재시도 횟수 초과. 원본 스키마 텍스트 사용")
                    break
        
        # Step 6: LLM을 사용해 최종 답변 생성
        logging.info("💡 [8] LLM 답변 생성 중...")
        
        max_retries = 3
        final_answer = None
        for attempt in range(max_retries):
            try:
                final_answer = ai_service.generate_answer(raw_schema_text, question)
                final_answer = final_answer.strip()
                break  # 성공 시 루프 종료
            except Exception as e:
                error_info = {
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "step": "LLM 답변 생성",
                    "attempt": attempt + 1
                }
                context = {
                    "question": question,
                    "node_count": len(similar_nodes),
                    "schema_node_count": len(nodes_result)
                }
                
                logging.warning(f"⚠️  [LLM 답변 생성] 오류 발생 (시도 {attempt + 1}/{max_retries}): {str(e)}")
                
                if attempt < max_retries - 1:
                    logging.info("🔧 오류 복구 Agent 실행 중...")
                    recovery_result = error_recovery_agent(ai_service, error_info, "LLM 답변 생성", context)
                    recovery_action = recovery_result.get('recovery_action', 'fallback')
                    logging.info(f"🔧 복구 방안: {recovery_action} - {recovery_result['reason']}")
                    
                    if recovery_action == "retry":
                        logging.info("🔄 재시도 중...")
                        continue
                    elif recovery_action == "modify":
                        # 파라미터 수정 (예: 스키마 텍스트 단순화)
                        retry_params = recovery_result.get("retry_params", {})
                        if retry_params.get("simplify_schema"):
                            # 스키마 텍스트를 단순화
                            raw_schema_text = raw_schema_text[:1000] + "..." if len(raw_schema_text) > 1000 else raw_schema_text
                            logging.info("🔄 스키마 텍스트 단순화 후 재시도")
                        continue
                    elif recovery_action == "fallback":
                        logging.info("🔄 대체 방법 사용 (일반 지식으로 답변)")
                        final_answer = None
                        break
                else:
                    logging.error(f"❌ 최대 재시도 횟수 초과. 일반 지식으로 답변 생성")
                    final_answer = None
                    break
        
        # 일반 지식 답변 여부 플래그
        is_general_knowledge_answer = False
        
        # 답변 생성 실패 또는 "지식그래프에 해당 정보가 없습니다"가 포함되어 있는지 확인
        if not final_answer or "지식그래프에 해당 정보가 없습니다" in final_answer or "지식그래프에 해당 정보가 없습니다." in final_answer:
            logging.info("⚠️  지식그래프 정보 없음 → 일반 지식으로 재생성")
            general_prompt = (
                f"다음 질문에 대해 일반적인 지식을 바탕으로 친절하고 상세하게 답변해주세요. "
                f"업로드된 소스 파일을 참고하지 말고, 당신이 알고 있는 일반적인 지식으로만 답변해주세요.\n\n"
                f"질문: {question}\n\n"
                f"답변:"
            )
            final_answer = ai_service.chat(general_prompt)
            final_answer = final_answer.strip()
            referenced_nodes = []
            Q = 0.0
            is_general_knowledge_answer = True
        else:
            # referenced_nodes = ai_service.extract_referenced_nodes(final_answer)
            referenced_nodes = ai_service.generate_referenced_nodes(final_answer,brain_id) #출처 노드 반환 함수
        
        # referenced_nodes 내용을 텍스트로 final_answer 뒤에 추가
        if referenced_nodes:
            nodes_text = "\n\n[참고된 노드 목록]\n" + "\n".join(f"- {node}" for node in referenced_nodes)
            final_answer += nodes_text
        
        # 일반 지식 답변인지 확인
        if is_general_knowledge_answer:
            # 일반 지식 답변인 경우 후처리 생략
            enriched = []
            accuracy = 0.0
            logging.info("✅ [9] 완료 | 일반 지식 답변 생성")
        else:
            # 간단 정확도 산출: 답변/참고노드/브레인/스키마 텍스트 기반 지표
            logging.info("📊 [9] 후처리: 참조 노드 추출 및 정확도 계산 중...")
            accuracy = compute_accuracy(final_answer,referenced_nodes,brain_id,Q,raw_schema_text)
            # node의 출처 소스 id들 가져오기
            node_to_ids = neo4j_handler.get_descriptions_bulk(referenced_nodes, brain_id)
            # 모든 source_id 집합 수집
            all_ids = sorted({sid for ids in node_to_ids.values() for sid in ids})
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
        
        logging.info("✅ [10] 완료 | 답변 생성 완료 (정확도: %.2f)", accuracy)

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
@router.get("/getNodeDescriptions",
    summary="노드의 descriptions 조회",
    description="특정 노드의 descriptions 배열을 조회하여 반환합니다.",
    response_description="노드의 descriptions 배열을 반환합니다.",
    responses={
        404: {
            "description": "노드를 찾을 수 없음",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "노드를 찾을 수 없습니다."
                    }
                }
            }
        },
        500: ErrorExamples[50002]
    }
)
async def get_node_descriptions_endpoint(node_name: str, brain_id: str):
    """
    특정 노드의 descriptions 배열을 조회합니다.
    
    Args:
        node_name (str): 조회할 노드의 이름
        brain_id (str): 브레인 ID
    
    Returns:
        dict: descriptions 정보
            - node_name: 노드 이름
            - brain_id: 브레인 ID
            - descriptions: description 객체들의 배열
                - 각 객체는 description, source_id 등을 포함
            - descriptions_count: descriptions 배열의 길이
    
    Example Response:
        {
            "node_name": "인공지능",
            "brain_id": "brain123",
            "descriptions": [
                {
                    "description": "컴퓨터가 인간의 지능을 모방하는 기술",
                    "source_id": "101"
                },
                {
                    "description": "기계학습과 딥러닝을 포함하는 광범위한 분야",
                    "source_id": "102"
                }
            ],
            "descriptions_count": 2
        }
    """
    logging.info(f"getNodeDescriptions 엔드포인트 호출됨 - node_name: {node_name}, brain_id: {brain_id}")
    
    # 파라미터 검증
    if not node_name:
        raise HTTPException(status_code=400, detail="node_name 파라미터가 필요합니다.")
    if not brain_id:
        raise HTTPException(status_code=400, detail="brain_id 파라미터가 필요합니다.")
    
    try:
        # Neo4j 핸들러 생성
        neo4j_handler = Neo4jHandler()
        logging.info("Neo4j 핸들러 생성됨")
        
        # Neo4j에서 노드의 descriptions 배열 조회
        descriptions = neo4j_handler.get_node_descriptions(node_name, brain_id)
        
        # 노드가 존재하지 않거나 descriptions가 없는 경우
        if descriptions is None:
            logging.warning(f"노드 '{node_name}'를 찾을 수 없습니다. (brain_id: {brain_id})")
            raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")
        
        # descriptions가 빈 배열인 경우도 정상 응답으로 처리
        logging.info(f"조회된 descriptions 개수: {len(descriptions)}")
        
        # 응답 데이터 구성
        response_data = {
            "node_name": node_name,
            "brain_id": brain_id,
            "descriptions": descriptions,
            "descriptions_count": len(descriptions)
        }
        
        # 각 description의 source_id 목록도 추가 (선택적)
        source_ids = list(set(desc.get("source_id") for desc in descriptions if "source_id" in desc))
        if source_ids:
            response_data["unique_source_ids"] = source_ids
            response_data["unique_source_count"] = len(source_ids)
        
        return response_data
        
    except HTTPException:
        # HTTP 예외는 그대로 전달
        raise
    except Exception as e:
        logging.error("descriptions 조회 오류: %s", str(e))
        raise HTTPException(status_code=500, detail=f"descriptions 조회 중 오류가 발생했습니다: {str(e)}")
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