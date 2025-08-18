"""
정확도(Accuracy) 산출 유틸리티
------------------------------

본 모듈은 LLM이 생성한 답변의 품질을 간단한 가중합 지표로 산출합니다.

정의:
- Acc = w_Q * Q + w_S * S + w_C * C
  - Q (Retrieval Quality): 검색 품질(이미 상위 레이어에서 계산된 값)
  - S (Semantic Similarity): 답변과 그래프 컨텍스트(Neo4j의 노드 설명 기반) 간 코사인 유사도
  - C (Coverage): 스키마 텍스트(raw_schema_text)에 포함된 노드 이름 대비, 답변이 참고한 노드 이름의 포괄 비율

주의:
- 본 평가지표는 간단한 휴리스틱이며, 실제 서비스 품질 판단을 위한 보조 지표로 사용하세요.
- `encode`는 임베딩 함수로, 백엔드 설정에 따라 구현체가 달라질 수 있습니다.
"""

from typing import List, Dict
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from services.embedding_service import encode
from neo4j_db.Neo4jHandler import Neo4jHandler
import logging

def compute_accuracy(
    answer: str,
    referenced_nodes: List[str],
    brain_id: str,
    Q: float,
    raw_schema_text: str,
    w_Q: float = 0.2,
    w_S: float = 0.7,
    w_C: float = 0.1
) -> float:
    """가중합 정확도(Acc)를 계산합니다.

    파라미터:
        answer: LLM이 생성한 최종 답변 문자열
        referenced_nodes: 답변 내 "[참고된 노드 목록]" 섹션에서 추출된 노드 이름 리스트
        brain_id: Neo4j 파티셔닝 키(브레인 구분자)
        Q: 상위 레이어에서 산출된 Retrieval Quality (0~1)
        raw_schema_text: `generate_schema_text()`가 반환한 스키마 요약 텍스트
        w_Q, w_S, w_C: 각 지표에 대한 가중치 (합 1.0 권장)

    반환:
        float: 소숫점 3자리 반올림된 Acc 값
    """
    # ── S(답변-컨텍스트 유사도) 계산 ────────────────────────────────────────────
    neo4j_handler = Neo4jHandler()

    # 1) 답변 텍스트에서 메타 섹션([참고된 노드 목록]) 제거 후 정제
    answer_clean = answer.split("[참고된 노드 목록]")[0].strip()
    logging.info(f"@@@ referenced_nodes Names: {referenced_nodes}")
    logging.info(f"@@@ raw_schema_text: {raw_schema_text}")

    # 2) 노드 이름 중복 제거 및 정렬 (일관된 컨텍스트 생성 순서를 위해)
    node_names = sorted(set(referenced_nodes))

    # 3) 기초 유효성 검사 (빈 입력일 때의 대비)
    #    주의: 아래의 S 초기화는 이후 단계에서 다시 계산되어 덮어써질 수 있습니다.
    if not answer_clean or not node_names:
        S = 0.0

    # 4) Neo4j에서 각 노드의 설명을 조회하여 컨텍스트 문장 목록 생성
    context_sentences: List[str] = []
    for name in node_names:
        entries = neo4j_handler.get_node_descriptions(name, brain_id)
        for entry in entries:
            desc = entry.get("description")
            if desc:
                # "노드명 : 설명" 형태로 컨텍스트를 구성
                context_sentences.append(f"{name} : {desc}")

    # 5) 컨텍스트 텍스트 병합
    context_text = "\n".join(context_sentences)
    if not context_text:
        S = 0.0

    # 6) 임베딩 계산 (답변 vs 컨텍스트)
    answer_vec = encode(answer_clean)
    context_vec = encode(context_text)

    # 7) 코사인 유사도 → S 점수(0~1)로 사용
    sim = cosine_similarity(
        np.array(answer_vec).reshape(1, -1),
        np.array(context_vec).reshape(1, -1)
    )[0][0]
    S = round(float(sim), 4)

    # ── C(커버리지) 계산 ─────────────────────────────────────────────────────
    # 스키마 텍스트에서 제공된 노드 이름 집합(provided_names)을 추출하고,
    # 답변이 참고한 노드(ref_names)가 얼마나 겹치는지 비율로 측정

    provided_names = set()
    # 스키마 형식 예시를 가정: "Label-Name(...)-> Label-Name(...) -> ..."
    for segment in raw_schema_text.split("->"):
        segment = segment.strip()
        if "(" not in segment:
            continue
        # 괄호 앞까지를 노드 식별 문자열로 간주
        before_paren = segment.split("(", 1)[0].strip()
        if "-" in before_paren:
            # "label-name" 패턴에서 name만 취득
            name = before_paren.split("-", 1)[1].strip()
        else:
            name = before_paren.strip()
        # 공백 제거로 비교 정규화
        name = name.replace(" ", "")
        if name:
            provided_names.add(name)

    # 참고 노드 이름도 동일하게 정규화(공백 제거)
    ref_names = {
        n.replace(" ", "")
        for n in referenced_nodes
        if isinstance(n, str)
    }
    C = len(ref_names & provided_names) / len(provided_names) if provided_names else 0.0
    
    # ── 지표 로깅 및 가중합 산출 ─────────────────────────────────────────────
    logging.info(f"@@@ Provided Node Names: {provided_names}")
    logging.info(f"@@@ Referenced Node Names: {ref_names}")
    intersection = ref_names & provided_names
    logging.info(f"@@@ Intersection (C 관련): {intersection}")
    logging.info(f"@@@ Q, S, C ->>>> Q: {Q:.4f}, S: {S:.4f}, C: {C:.4f}")

    Acc = w_Q * Q + w_S * S + w_C * C
    return round(Acc, 3)
