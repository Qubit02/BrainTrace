from pydantic import BaseModel, Field
from typing import List
# Pydantic은 FastAPI가 사용하는 데이터 검증 및 직렬화 라이브러리


class NodeModel(BaseModel):
    name: str = Field(..., description="노드의 이름", example="양자 역학")

class LinkModel(BaseModel):
    source: str = Field(..., description="시작 노드의 이름", example="양자 역학")
    target: str = Field(..., description="도착 노드의 이름", example="물리학")
    relation: str = Field(..., description="노드 간의 관계", example="분야")

class GraphResponse(BaseModel):
    nodes: List[NodeModel] = Field(..., description="그래프의 노드 목록")
    links: List[LinkModel] = Field(..., description="그래프의 엣지(관계) 목록")
    
    class Config:
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
    text: str
    brain_id: str = Field(..., description="브레인 ID (문자열)")
    source_id: str = Field(..., description="소스 ID (문자열)")
    model: str = Field("ollama", description="사용할 모델 (gpt 또는 ollama)")

class AnswerRequest(BaseModel):
    question: str
    brain_id: str = Field(..., description="브레인 ID (문자열)")
    model: str = Field("ollama", description="사용할 모델 (gpt 또는 ollama)")
