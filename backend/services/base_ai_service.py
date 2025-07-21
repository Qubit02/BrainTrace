"""
base_ai_service.py

LLMService 구현체에 대한 인터페이스입니다.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Tuple

#BaseLLMService : AIService 클래스들의 기능을 모아놓은 추상 클래스입니다.
class BaseLLMService(ABC):
    @abstractmethod
    def extract_graph_components(self, text: str, source_id: str) -> Tuple[List[Dict], List[Dict]]:
        """텍스트 → (nodes, edges)"""

    @abstractmethod
    def generate_answer(self, schema_text: str, question: str) -> str:
        """스키마+질문 → 답변"""

    @abstractmethod
    def generate_schema_text(
        self, nodes: List[Dict], related_nodes: List[Dict], relationships: List
    ) -> str:
        """Neo4j 데이터 → 텍스트 스키마"""

    @abstractmethod
    def chat(self, message: str) -> str:
        """단일 사용자 메시지를 보내고, LLM 응답 문자열을 반환"""