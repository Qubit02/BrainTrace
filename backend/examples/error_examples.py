from schemas.error_response import ErrorResponse

ErrorExamples = {
    
    40401: {
        "model": ErrorResponse,
        "description": "그래프 데이터가 존재하지 않음 (GraphDataNotFoundException)",
        "content": {
            "application/json": {
                "example": {
                    "code": 40401,
                    "message": "해당 brain_id(123)에 대한 그래프 데이터가 존재하지 않습니다.",
                    "detail": ""
                }
            }
        }
    },
    50001: {
        "model": ErrorResponse,
        "description": "Neo4j 처리 중 오류 발생 (Neo4jException)",
        "content": {
            "application/json": {
                "example": {
                    "code": 50001,
                    "message": "Neo4j 관련 에러",
                    "detail": ""
                }
            }
        }
    },
    50002: {
        "model": ErrorResponse,
        "description": "Qdrant 관련 오류 (QdrantException)",
        "content": {
            "application/json": {
                "example": {
                    "code": 50002,
                    "message": "Qdrant 관련 에러",
                    "detail": ""
                }
            }
        }
    },
    50003: {
        "model": ErrorResponse,
        "description": "SQLite 관련 오류 (SQLiteException)",
        "content": {
            "application/json": {
                "example": {
                    "code": 50003,
                    "message": "SQLite 관련 에러",
                    "detail": ""
                }
            }
        }
    },
    50004: {
        "model": ErrorResponse,
        "description": "LLM 응답 생성 실패 (LLMException)",
        "content": {
            "application/json": {
                "example": {
                    "code": 50004,
                    "message": "LLM 응답 생성 중 오류가 발생했습니다.",
                    "detail": ""
                }
            }
        }
    },
}
