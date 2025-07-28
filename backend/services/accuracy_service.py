from typing import List, Dict
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from services.embedding_service import encode
from neo4j_db.Neo4jHandler import Neo4jHandler


def compute_accuracy(
    answer: str,
    referenced_nodes: List[Dict],
    brain_id: str
) -> float:
    """
    LLM 답변과 참고된 노드들의 내용을 임베딩하여 정확도를 계산합니다.

    Args:
        answer: LLM이 생성한 전체 응답 텍스트 ("[참고된 노드 목록]" 포함 가능)
        referenced_nodes: LLM이 참고했다고 밝힌 노드 리스트
                          (예: [{"name": "강아지", ...}, ...])
        brain_id: 브레인 고유 식별자

    Returns:
        float: 0.0~1.0 사이의 cosine similarity 값, 정확도 지표
    """
    neo4j_handler = Neo4jHandler()
    # 1. 메타 텍스트 제거
    answer_clean = answer.split("[참고된 노드 목록]")[0].strip()

    # 2. 노드 이름만 추출하여 중복 제거 및 정렬
    node_names = sorted(set(referenced_nodes))

    # 3. 유효성 검사
    if not answer_clean or not node_names:
        return 0.0

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
        return 0.0

    # 6. 임베딩
    answer_vec = encode(answer_clean)
    context_vec = encode(context_text)

    # 7. cosine similarity 계산
    sim = cosine_similarity(
        np.array(answer_vec).reshape(1, -1),
        np.array(context_vec).reshape(1, -1)
    )[0][0]

    return round(float(sim), 4)
