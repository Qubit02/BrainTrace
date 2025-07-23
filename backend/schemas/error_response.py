from pydantic import BaseModel

class ErrorResponse(BaseModel):
    code: int       # 내부 에러 코드 (예: 50001)
    message: str    # 에러 메시지 (예: "Neo4j 관련 에러")
    detail: str     # 에러가 발생한 위치 or 경로 (예: /api/brainGraph/getNodeEdge)
