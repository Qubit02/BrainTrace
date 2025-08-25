"""
Base AI Service Interface
-------------------------

LLM 기반 서비스 구현체(OpenAI, Ollama 등)가 공통으로 따라야 할 인터페이스를 정의합니다.

역할:
- 텍스트로부터 그래프 구성요소(노드/엣지)를 추출
- 그래프 스키마 텍스트 생성(LLM 입력용)
- 스키마+질문을 이용해 답변 생성
- 단일 메시지 챗 인터페이스 제공

구현 가이드:
- 본 인터페이스는 I/O 포맷의 계약(Contract)을 문서화합니다. 실제 동작은 각 구현체에서 책임집니다.
- 반환 포맷은 라우터/서비스/정확도 계산 로직과 호환되어야 합니다.
- 예외는 상위 레이어에서 처리하므로, 구현체는 의미 있는 메시지로 예외를 발생시키는 것이 좋습니다.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Tuple

class BaseAIService(ABC):
    """AIService 구현체들의 공통 추상 클래스.

    구현체 예시:
        - OpenAIService
        - OllamaService
    """
    @abstractmethod
    def extract_graph_components(self, text: str, source_id: str) -> Tuple[List[Dict], List[Dict]]:
        """텍스트에서 그래프 구성요소(노드/엣지)를 추출합니다.

        파라미터:
            text: 원문 텍스트
            source_id: 이 텍스트의 출처 식별자(후속 추적/메타데이터 연결에 사용)

        반환:
            (nodes, edges) 튜플
                - nodes: List[Dict]
                    각 노드는 아래 키를 권장합니다.
                    - 'name': str (노드 고유명)
                    - 'label': str (유형/분류 라벨)
                    - 'descriptions': List[Dict or str] (JSON 문자열 또는 dict; 저장 시 문자열 리스트로 직렬화됨)
                    - 'original_sentences': List[Dict or str] (원문 문장/점수/출처 등)
                - edges: List[Dict]
                    각 엣지는 아래 키를 권장합니다.
                    - 'source': str (출발 노드명)
                    - 'target': str (도착 노드명)
                    - 'relation': str (관계 라벨/유형)
        """

    @abstractmethod
    def generate_answer(self, schema_text: str, question: str) -> str:
        """스키마 텍스트와 사용자의 질문을 바탕으로 최종 답변을 생성합니다.

        파라미터:
            schema_text: 그래프에서 추출/요약된 스키마 텍스트
            question: 사용자의 자연어 질문

        반환:
            답변 문자열. 필요 시 아래 포맷을 답변 말미에 포함할 수 있습니다.
            - "[참고된 노드 목록]\n- <노드명1>\n- <노드명2> ..."
            이 포맷은 정확도 계산 로직에서 참고 노드 추출에 활용될 수 있습니다.
        """

    @abstractmethod
    def generate_schema_text(
        self, nodes: List[Dict], related_nodes: List[Dict], relationships: List
    ) -> str:
        """그래프(노드/관계)를 LLM 입력에 적합한 스키마 텍스트로 변환합니다.

        파라미터:
            nodes: 시작 노드 목록 또는 핵심 노드 목록
            related_nodes: 주변/연관 노드 목록
            relationships: 노드 간 관계 목록

        반환:
            스키마 요약 텍스트. 필요 시 아래 예시와 유사한 형식을 유지하면
            후속 커버리지 계산(C)에서 노드명 파싱에 유리합니다.
            예) "Label-Name(attr1=..., ...) -> Label-Name(...) -> ..."
        """

    @abstractmethod
    def chat(self, message: str) -> str:
        """단일 턴 메시지를 전송하고, LLM의 응답 문자열을 반환합니다.

        파라미터:
            message: 사용자 입력 메시지

        반환:
            LLM 응답 문자열. 스트리밍이 필요한 경우 구현체에서 별도 API를 제공할 수 있습니다.
        """