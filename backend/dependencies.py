# backend/dependencies.py

from fastapi import Depends
from services.ai_service import BaseAIService
from services.ollama_service import OllamaAIService
from services.embedding_service import EmbeddingService
from neo4j_db.Neo4jHandler import Neo4jHandler
from sqlite_db.sqlite_handler import SQLiteHandler

def get_ai_service() -> BaseAIService:
    return OllamaAIService()
