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
    """
    Args:
      answer: LLM이 생성한 텍스트
      referenced_nodes: LLM이 “[참고된 노드 목록]”으로 뱉은 노드 dict 리스트
      brain_id: 브레인 ID
      Q: 이미 계산된 Retrieval Quality
      raw_schema_text: generate_schema_text()가 반환한 스키마 문자열
        Returns:
      가중합 정확도 = w_Q*Q + w_S*S + w_C*C
    """
    # S 구하기 
    neo4j_handler = Neo4jHandler()
    # 1. 메타 텍스트 제거
    answer_clean = answer.split("[참고된 노드 목록]")[0].strip()
    logging.info(f"@@@ referenced_nodes Names: {referenced_nodes}")
    logging.info(f"@@@ raw_schema_text: {raw_schema_text}")
    # 2. 노드 이름만 추출하여 중복 제거 및 정렬
    node_names = sorted(set(referenced_nodes))

    # 3. 유효성 검사
    if not answer_clean or not node_names:
        S = 0.0

    # 4. Neo4j에서 각 노드 설명 조회 및 문장화
    context_sentences: List[str] = []
    for name in node_names:
        entries = neo4j_handler.get_node_descriptions(name, brain_id)
        for entry in entries:
            desc = entry.get("description")
            if desc:
                context_sentences.append(f"{name} : {desc}")

    # 5. context_text 생성
    context_text = "\n".join(context_sentences)
    if not context_text:
        S = 0.0

    # 6. 임베딩
    answer_vec = encode(answer_clean)
    context_vec = encode(context_text)

    # 7. cosine similarity 계산
    sim = cosine_similarity(
        np.array(answer_vec).reshape(1, -1),
        np.array(context_vec).reshape(1, -1)
    )[0][0]
    S = round(float(sim), 4)

    # C구하기
    # C 계산: raw_schema_text에서 제공된 노드 이름 모두 추출

    # raw_schema_text에서 제공된 노드 이름(name) 추출
    provided_names = set()
    for segment in raw_schema_text.split("->"):
        segment = segment.strip()
        if "(" not in segment:
            continue
        before_paren = segment.split("(", 1)[0].strip()
        if "-" in before_paren:
            name = before_paren.split("-", 1)[1].strip()  # label-name → name
        else:
            name = before_paren.strip()
        name = name.replace(" ", "")
        provided_names.add(name)

    # referenced_nodes는 이미 name 리스트니까 strip, 공백 제거만
    ref_names = {
        n.replace(" ", "")
        for n in referenced_nodes
        if isinstance(n, str)
    }
    C = len(ref_names & provided_names) / len(provided_names) if provided_names else 0.0
    
    logging.info(f"@@@ Provided Node Names: {provided_names}")
    logging.info(f"@@@ Referenced Node Names: {ref_names}")
    intersection = ref_names & provided_names
    logging.info(f"@@@ Intersection (C 관련): {intersection}")
    logging.info(f"@@@ Q, S, C ->>>> Q: {Q:.4f}, S: {S:.4f}, C: {C:.4f}")
    Acc = w_Q * Q + w_S * S + w_C * C
    return round(Acc, 3)
