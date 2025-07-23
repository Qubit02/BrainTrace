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
