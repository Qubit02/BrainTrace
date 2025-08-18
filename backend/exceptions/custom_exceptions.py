"""
애플리케이션 공통 예외 계층(HTTP 상태/에러 코드 포함)
-------------------------------------------------

이 모듈은 서비스 전반에서 일관된 에러 응답을 만들기 위한 **커스텀 예외 클래스 집합**입니다.
각 예외는 다음 정보를 포함합니다.

- `code`        : 서비스 내부 에러 코드(로깅/모니터링/클라이언트 분기용)
- `message`     : 사용자/개발자용 에러 메시지
- `status_code` : HTTP 상태 코드(예: 400, 404, 500 등)

구성:
- `AppException`            : 모든 도메인 예외의 베이스. `code/message/status_code`를 보관.
- `GraphDataNotFoundException` : 그래프/브레인 리소스 미존재(40401, HTTP 404)
- `Neo4jException`          : Neo4j 연동/쿼리 실패(50001, HTTP 500)
- `QdrantException`         : Qdrant 연동/쿼리 실패(50002, HTTP 500)
- `SQLiteException`         : SQLite I/O/쿼리 실패(50003, HTTP 500)
- `LLMException`            : LLM 호출/응답 생성 실패(50004, HTTP 500)
- `ValidationException`     : 유효성 검증 실패(40001, HTTP 400)

권장 사용 패턴:
- 도메인/인프라 계층에서 **의도적 예외 변환**: 원시 에러를 의미 있는 AppException 하위 클래스로 감싸서 raise
- 웹 프레임워크(FastAPI 등)에서 **전역 핸들러**로 `AppException`을 받아
  `{"code": ..., "message": ...}` 형태로 JSON 응답 + `status_code`로 반환

에러 코드 가이드(예시):
- 4xxxx : 클라이언트 오류(입력/리소스 없음 등) → 400/404 등
- 5xxxx : 서버 오류(외부연동/DB/LLM 등) → 500

주의/안내:
- 베이스 클래스에서 `Exception` 메시지도 초기화하려면 `super().__init__(message)`를 추가할 수 있습니다.
- 외부 라이브러리 예외를 그대로 흘리지 말고, 의미가 드러나는 하위 클래스로 변환해 일관 응답을 유지하세요.
"""

class AppException(Exception):
    def __init__(self, code: int, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
class GraphDataNotFoundException(AppException):
    def __init__(self, brain_id: str):
        super().__init__(
            code=40401,
            message=f"해당 brain_id({brain_id})에 대한 그래프 데이터가 존재하지 않습니다.",
            status_code=404
        )
        
class Neo4jException(AppException):
    def __init__(self, message="Neo4j 관련 에러"):
        super().__init__(code=50001, message=message, status_code=500)

class QdrantException(AppException):
    def __init__(self, message="Qdrant 관련 에러"):
        super().__init__(code=50002, message=message, status_code=500)

class SQLiteException(AppException):
    def __init__(self, message="SQLite 관련 에러"):
        super().__init__(code=50003, message=message, status_code=500)

class LLMException(AppException):
    def __init__(self, message="LLM 응답 생성 중 오류가 발생했습니다."):
        super().__init__(code=50004, message=message, status_code=500)
       
class ValidationException(AppException):
    def __init__(self, message="잘못된 요청"):
        super().__init__(code=40001, message=message, status_code=400)
