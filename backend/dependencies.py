# backend/dependencies.py
# Spring의 Appconfig 비슷한역할. 여기서 각 인터페이스에 대해 의존성 주입할 클래스 변경하면 됩니다.

from fastapi import Depends
from services.base_ai_service import BaseAIService
from services.ollama_service import OllamaAIService
from services.openai_service import OpenAIService
# from services.embedding_service import EmbeddingService
from neo4j_db.Neo4jHandler import Neo4jHandler
from sqlite_db.sqlite_handler import SQLiteHandler

def get_ai_service_GPT() -> BaseAIService:
    return OpenAIService()

def get_ai_service_Ollama() -> BaseAIService:
    return OllamaAIService()

# 나중에 임베딩 서비스 쪽도 OCP 만족하도록 수정해야할듯
# def get_embedding_service() -> EmbeddingService:
#     return EmbeddingService()

def get_neo4j_handler() -> Neo4jHandler:
    return Neo4jHandler()

def get_sqlite_handler() -> SQLiteHandler:
    return SQLiteHandler()
