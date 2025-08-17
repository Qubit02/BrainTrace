
"""
표준 오류 응답 모델 (Pydantic)
-----------------------------

이 모듈은 API에서 일관된 에러 바디를 반환하기 위한 **Pydantic 모델** 정의를 제공합니다.
컨트롤러/핸들러에서 예외를 잡아 이 모델로 직렬화해 클라이언트에 전달합니다.

필드:
- code (int)    : 서비스 내부 에러 코드 (예: 50001)
- message (str) : 사용자/개발자용 에러 메시지 (예: "Neo4j 관련 에러")
- detail (str)  : 에러가 발생한 위치나 엔드포인트 경로 (예: "/api/brainGraph/getNodeEdge")

사용 예:
- FastAPI 전역 예외 핸들러에서 AppException → ErrorResponse로 변환 후 반환
- 로깅/모니터링 시스템에서 code/detail 기반으로 빠른 원인 추적

주의/안내:
- detail이 없을 수 있는 상황을 고려한다면 Optional[str]로 변경하고 기본값 None을 줄 수 있습니다.
"""

from pydantic import BaseModel

class ErrorResponse(BaseModel):
    code: int       # 내부 에러 코드 (예: 50001)
    message: str    # 에러 메시지 (예: "Neo4j 관련 에러")
    detail: str     # 에러가 발생한 위치 or 경로 (예: /api/brainGraph/getNodeEdge)
