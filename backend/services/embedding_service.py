from qdrant_client import QdrantClient
from qdrant_client.http import models
import torch
from transformers import AutoTokenizer, AutoModel
import numpy as np
import logging
import os
import uuid
from typing import List, Dict, Optional

# ================================================
# Qdrant 및 KoE5 임베딩 모델 초기화
# ================================================

# 디스크 기반 Qdrant 저장 경로 설정
QDRANT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "qdrant")
os.makedirs(QDRANT_PATH, exist_ok=True)

# Qdrant 클라이언트 생성 (로컬 디스크 모드)
client = QdrantClient(path=QDRANT_PATH)

# KoE5 임베딩 모델 로드
MODEL_NAME = "nlpai-lab/KoE5"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModel.from_pretrained(MODEL_NAME)
# 모델의 hidden size를 벡터 차원으로 사용
EMBED_DIM = model.config.hidden_size  # 예: 1024


def get_collection_name(brain_id: str) -> str:
    """
    주어진 brain_id로부터 Qdrant 컬렉션 이름을 생성합니다.
    Args:
        brain_id: 브레인 고유 식별자
    Returns:
        'brain_{brain_id}' 형식의 컬렉션 이름
    """
    return f"brain_{brain_id}"


def initialize_collection(brain_id: str) -> None:
    """
    Qdrant에서 기존 컬렉션을 삭제하고 새로 생성합니다.
    - 기존 컬렉션이 있으면 삭제
    - EMBED_DIM 크기, 코사인 거리 기준으로 새 컬렉션 생성
    Args:
        brain_id: 브레인 고유 식별자
    Raises:
        RuntimeError: 생성 실패 시
    """
    collection_name = get_collection_name(brain_id)
    # 기존 컬렉션 삭제 시도
    try:
        client.delete_collection(collection_name)
        logging.info("기존 컬렉션 삭제 완료: %s", collection_name)
    except Exception as e:
        logging.warning("컬렉션 %s가 존재하지 않거나 삭제 실패: %s", collection_name, str(e))
    # 새 컬렉션 생성
    try:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=EMBED_DIM,
                distance=models.Distance.COSINE
            ),
        )
        logging.info("새 컬렉션 생성 완료: %s", collection_name)
    except Exception as e:
        logging.error("컬렉션 %s 생성 실패: %s", collection_name, str(e))
        raise RuntimeError(f"컬렉션 생성 실패: {str(e)}")


def encode_text(text: str) -> List[float]:
    """
    주어진 텍스트를 KoE5 모델로 임베딩하여 벡터 반환
    - 토크나이저로 입력 전처리
    - CLS 토큰 임베딩 추출
    Args:
        text: 입력 텍스트
    Returns:
        EMBED_DIM 차원의 벡터 리스트
    Raises:
        RuntimeError: 임베딩 실패 시
    """
    try:
        inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
        with torch.no_grad():
            outputs = model(**inputs)
        # CLS 토큰 인덱스(0) 임베딩 반환
        return outputs.last_hidden_state[:, 0].squeeze().tolist()
    except Exception as e:
        logging.error("텍스트 임베딩 생성 실패: %s", str(e))
        raise RuntimeError(f"텍스트 임베딩 생성 실패: {str(e)}")


def update_index_and_get_embeddings(nodes: List[Dict], brain_id: str) -> Dict[str, List[List[float]]]:
    """
    노드 목록을 여러 표현 포맷으로 임베딩하고 Qdrant에 저장

    처리 순서:
    1. 필수 필드 검증(source_id, name, label, descriptions)
    2. 여러 포맷으로 텍스트 생성
    3. encode_text로 임베딩
    4. uuid5로 point_id 생성
    5. Qdrant upsert로 벡터 및 payload 저장

    Args:
        nodes: {source_id, name, label, descriptions} 포함 노드 리스트
        brain_id: 브레인 고유 식별자
    Returns:
        source_id별 생성된 벡터 리스트 딕셔너리
    """
    collection_name = get_collection_name(brain_id)
    all_embeddings: Dict[str, List[List[float]]] = {}

    # 사용할 표현 포맷 정의
    formats = [
        "{name}는 {label}이다. {description}",
        "{name} ({label}): {description}",
        "{label}인 {name}에 대한 설명: {description}",
        "{description}"
    ]

    for node in nodes:
        # 필수 키 확인
        if not all(k in node for k in ["source_id", "name", "label", "descriptions"]):
            logging.warning("필수 필드 누락된 노드: %s", node)
            continue

        source_id = str(node["source_id"])
        name = node["name"]
        label = node["label"]
        embeddings_for_node: List[List[float]] = []

        # 각 description마다 포맷별 벡터 생성
        for desc in node["descriptions"]:
            description = desc.get("description")
            if not description:
                logging.warning("빈 description 스킵: %s", desc)
                continue

            for idx, fmt in enumerate(formats):
                # 텍스트 생성
                text = fmt.format(name=name, label=label, description=description)
                logging.info("[임베딩 텍스트] %s", text)

                # 임베딩 생성
                emb = encode_text(text)
                embeddings_for_node.append(emb)

                # 고유 point_id 생성(source_id + idx + description)
                pid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{source_id}_{idx}_{description}"))

                # Qdrant에 upsert: 벡터 및 payload 포함
                client.upsert(
                    collection_name=collection_name,
                    points=[
                        models.PointStruct(
                            id=pid,
                            vector=emb,
                            payload={
                                "source_id": source_id,
                                "name": name,
                                "label": label,
                                "description": description,
                                "point_id": pid
                            }
                        )
                    ]
                )
                logging.info("노드 %s descriptor %d 저장 완료(UUID: %s)", source_id, idx, pid)

        all_embeddings[source_id] = embeddings_for_node

    logging.info("컬렉션 %s에 %d개의 노드 임베딩 저장 완료", collection_name, len(all_embeddings))
    return all_embeddings


def search_similar_nodes(
    embedding: List[float],
    brain_id: str,
    limit: int = 5,
    threshold: float = 0.5,
    high_score_threshold: float = 0.8
) -> List[Dict]:
    """
    Qdrant에서 유사 벡터 검색 후 source_id별 필터링

    로직:
    1. 검색 결과에서 threshold 미만 제거
    2. high_score_threshold 이상은 모두 high_scores에 저장
    3. 나머지는 source_id별 최고 점수로 그룹핑
    4. 그룹핑 결과 상위 limit개 선택
    5. high_scores + 상위 limit 반환

    Args:
        embedding: 검색할 임베딩 벡터
        brain_id: 브레인 고유 식별자
        limit: 소규모 그룹핑 결과 개수 제한
        threshold: 최소 유사도 필터
        high_score_threshold: 이 이상은 무제한 포함
    Returns:
        유사 노드 리스트
    """
    collection_name = get_collection_name(brain_id)

    try:
        # 검색: 충분히 많은 후보 요청 (limit * 10)
        #   Qdrant에 query_vector와 유사도가 높은 순으로 상위 limit*10개 만큼 요청
        #   예: limit=10 -> 상위 100개(0.8 이상이든 0.5~0.8 사이든 무조건 top100 가져옴)
        #   이후 threshold 필터링 및 source_id 그룹핑 수행
        search_results = client.search(
            collection_name=collection_name,
            query_vector=embedding,
            limit=limit * 10
        )

        high_score_group: Dict[str, Dict] = {}
        grouped_by_name: Dict[str, Dict] = {}

        for result in search_results:
            score = result.score
            if score < threshold:
                # 임계값 미만 결과 스킵
                continue

            payload = result.payload or {}
            sid = payload.get("source_id", "")
            name = payload.get("name", "")

            entry = {
                "source_id": sid,
                "point_id": payload.get("point_id", ""),
                "name": payload.get("name", ""),
                "label": payload.get("label", ""),
                "description": payload.get("description", ""),
                "score": score
            }

            if score >= high_score_threshold:
                # 고유사도 항목은 모두 무제한 수집
                if name not in high_score_group or score > high_score_group[name]["score"]:
                    high_score_group[name] = entry
            else:
                if name not in grouped_by_name or score > grouped_by_name[name]["score"]:
                    grouped_by_name[name] = entry

        
        # high_score_group은 무조건 포함, grouped는 limit 만큼 점수 내림차순으로
        high_scores = list(high_score_group.values())
        grouped = sorted(grouped_by_name.values(), key=lambda x: -x["score"])

         # 중복 제거: high_scores에 있는 name은 grouped에서 제외
        high_score_names = {entry["name"] for entry in high_scores}
        filtered_grouped = [entry for entry in grouped if entry["name"] not in high_score_names]

        # limit 만큼 제한
        top_grouped = filtered_grouped[:limit]

        # 최종 반환: 고유사도(high_scores) + 그룹핑된 상위 결과
        return high_scores + top_grouped

    except Exception as e:
        logging.error("유사 노드 검색 실패: %s", str(e))
        raise RuntimeError(f"유사 노드 검색 실패: {str(e)}")


def is_index_ready(brain_id: str) -> bool:
    """브레인에 대한 인덱스가 준비되었는지 확인합니다.
    Args:
        brain_id: 브레인의 고유 식별자
    Returns:
        bool: 컬렉션이 존재하면 True, 아니면 False
    """
    collection_name = get_collection_name(brain_id)
    try:
        collections = client.get_collections()
        return any(collection.name == collection_name for collection in collections.collections)
    except Exception as e:
        logging.error("인덱스 준비 상태 확인 실패: %s", str(e))
        return False


def delete_node(source_id: str, brain_id: str) -> None:
    """벡터 데이터베이스에서 노드를 삭제합니다.
    Args:
        source_id: 노드의 고유 식별자
        brain_id: 브레인의 고유 식별자
    Raises:
        RuntimeError: 삭제 실패 시
    """
    collection_name = get_collection_name(brain_id)
    try:
        # source_id를 payload 필터로 사용하여 모든 관련 벡터 삭제
        client.delete(
            collection_name=collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="source_id",
                            match=models.MatchValue(value=source_id)
                        )
                    ]
                )
            )
        )
        logging.info("컬렉션 %s에서 source_id %s의 모든 벡터 삭제 완료", collection_name, source_id)
    except Exception as e:
        logging.error("노드 %s 삭제 실패: %s", source_id, str(e))
        raise RuntimeError(f"노드 삭제 실패: {str(e)}")


def delete_collection(brain_id: str) -> None:
    """벡터 데이터베이스에서 컬렉션을 삭제합니다.
    Args:
        brain_id: 브레인의 고유 식별자
    """
    collection_name = get_collection_name(brain_id)
    try:
        client.delete_collection(collection_name)
        logging.info("컬렉션 삭제 완료: %s", collection_name)
    except Exception as e:
        logging.warning("컬렉션 %s가 존재하지 않을 수 있습니다: %s", collection_name, str(e))


def search_similar_descriptions(
    embedding: List[float],
    brain_id: str,
    limit: int = 10,
    threshold: float = 0.5
) -> List[Dict[str, str]]:
    """
    입력된 임베딩과 유사한 문장들을 검색합니다.
    
    Args:
        embedding: 검색할 임베딩 벡터
        brain_id: 브레인 ID
        limit: 반환할 최대 결과 수
        threshold: 최소 유사도 임계값
        
    Returns:
        List[Dict[str, str]]: 유사한 문장들의 목록 (각 항목은 source_id와 description 포함)
    """
    collection_name = get_collection_name(brain_id)
    
    try:
        # 검색 실행
        search_results = client.search(
            collection_name=collection_name,
            query_vector=embedding,
            limit=limit * 5  # 중복 제거를 위해 더 많은 결과를 가져옴
        )
        
        # 결과 처리
        seen_source_ids = set()
        results = []
        
        for result in search_results:
            if result.score < threshold:
                continue
                
            payload = result.payload or {}
            source_id = payload.get("source_id", "")
            description = payload.get("description", "")
            
            # 이미 처리한 source_id는 스킵
            if source_id in seen_source_ids:
                continue
                
            seen_source_ids.add(source_id)
            results.append({
                "source_id": source_id,
                "description": description,
                "score": result.score
            })
            
            # 유사도 점수 로깅
            logging.info(f"유사 문장 발견 - ID: {source_id}, 유사도: {result.score:.4f}, 내용: {description[:100]}...")
            
            if len(results) >= limit:
                break
                
        return results
        
    except Exception as e:
        logging.error("유사 문장 검색 실패: %s", str(e))
        raise RuntimeError(f"유사 문장 검색 실패: {str(e)}")

# 예시: 서버 시작 시 특정 brain_id에 대해 컬렉션 초기화
if __name__ == "__main__":
    test_brain_id = "1"
    initialize_collection(test_brain_id)
