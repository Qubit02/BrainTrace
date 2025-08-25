"""
요청/응답 바디 스키마 정의 모듈
--------------------------------

FastAPI 엔드포인트에서 사용하는 요청(request)과 응답(response) 페이로드의
Pydantic 모델을 정의합니다. 각 필드는 `Field` 메타데이터를 통해 설명과 예시를 제공합니다.

가이드라인:
- 외부 API 스펙에 해당하므로, 필드명/타입 변경 시 프런트엔드 및 외부 연동 코드에 파급이 큽니다.
- 예시는 실제 데이터와 유사하게 유지하여 문서화(UI 스웨거) 가독성을 보장합니다.
"""

from pydantic import BaseModel, Field
from typing import List
# Pydantic은 FastAPI가 사용하는 데이터 검증 및 직렬화 라이브러리


class NodeModel(BaseModel):
    """그래프 노드 스키마.

    Attributes:
        name: 노드의 고유 이름. 그래프 상에서 식별자로 사용됩니다.
    """

    name: str = Field(..., description="노드의 이름", example="양자 역학")

class LinkModel(BaseModel):
    """그래프 엣지(관계) 스키마.

    Attributes:
        source: 엣지의 출발 노드 이름
        target: 엣지의 도착 노드 이름
        relation: 두 노드 간 관계 라벨/유형
    """

    source: str = Field(..., description="시작 노드의 이름", example="양자 역학")
    target: str = Field(..., description="도착 노드의 이름", example="물리학")
    relation: str = Field(..., description="노드 간의 관계", example="분야")

class GraphResponse(BaseModel):
    """그래프 조회 응답 스키마.

    Attributes:
        nodes: 그래프에 포함된 노드 목록
        links: 노드 간 관계 목록
    """

    nodes: List[NodeModel] = Field(..., description="그래프의 노드 목록")
    links: List[LinkModel] = Field(..., description="그래프의 엣지(관계) 목록")
    
    class Config:
        # OpenAPI 문서화를 위한 예시 페이로드 제공
        json_schema_extra = {
            "example": {
                "nodes": [
                    {"name": "양자 역학"},
                    {"name": "물리학"}
                ],
                "links": [
                    {
                        "source": "양자 역학",
                        "target": "물리학",
                        "relation": "분야"
                    }
                ]
            }
        }

class ProcessTextRequest(BaseModel):
    """원문 텍스트 처리 요청 스키마.

    텍스트를 받아 브레인/소스 컨텍스트 하에서 처리(임베딩, 노드/엣지 생성 등)할 때 사용합니다.
    """

    text: str
    brain_id: str = Field(..., description="브레인 ID (문자열)")
    source_id: str = Field(..., description="소스 ID (문자열)")
    model: str = Field("gpt", description="사용할 모델 (gpt 또는 ollama)")

class AnswerRequest(BaseModel):
    """질의응답(챗) 요청 스키마.

    대화 컨텍스트(세션)와 브레인 컨텍스트 내에서 질문을 전달하며,
    백엔드가 설정된 모델/프레임워크로 답변을 생성합니다.
    """

    question: str
    session_id: int = Field(..., description="채팅 세션 ID")
    brain_id: int = Field(..., description="브레인 ID")
    model: str = Field("ollama", description="사용할 프레임워크 (openai 또는 ollama)")
    model_name:str = Field("gemma3:4b", description="사용할 모델명 (ollama: gemma3:4b, openai: gpt-5, gpt-4o 등)")
