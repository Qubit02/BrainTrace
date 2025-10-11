"""
임베딩/검색 서비스
------------------

이 모듈은 KoE5 임베딩 모델을 사용해 텍스트를 벡터화하고, 로컬 디스크 모드의 Qdrant를 통해
다음 기능을 제공합니다.

- 임베딩 생성(`encode_text`, `encode`)
- 벡터 컬렉션 초기화/삭제(`initialize_collection`, `delete_collection`)
- 노드(설명 기반) 임베딩 생성 및 업서트(`update_index_and_get_embeddings`)
- 유사 노드/문장 검색(`search_similar_nodes`, `search_similar_descriptions`)
- 인덱스 준비 상태 확인(`is_index_ready`)

설계 노트:
- Qdrant는 프로젝트 `backend/data/qdrant` 하위에 디스크 기반으로 저장됩니다.
- 컬렉션 이름은 브레인 ID를 접두어로 구분합니다: `brain_{brain_id}`.
- KoE5 모델은 첫 토큰([CLS]) 임베딩을 사용합니다.
- 임베딩 저장 시, Qdrant `payload`에 `source_id`, `name`, `description`, `format_index`, `point_id` 등을 포함합니다.
"""
import torch
from qdrant_client import QdrantClient
from qdrant_client.http import models
import torch
from transformers import AutoTokenizer, AutoModel
from sentence_transformers import SentenceTransformer
import numpy as np
import logging
import os
from typing import List, Dict, Optional
import langid
import uuid

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

# 영어 임베딩 모델
model.eval()
eng_model = SentenceTransformer("all-MiniLM-L6-v2")  

# 모델의 hidden size를 벡터 차원으로 사용
EMBED_DIM = model.config.hidden_size  # 예: 1024


def get_collection_name(brain_id: str) -> str:
    """
    주어진 brain_id로부터 Qdrant 컬렉션 이름을 생성합니다.
    Args:
        brain_id: 브레인 고유 식별자
    Returns:
        'brain_{brain_id}' 형식의 컬렉션 이름
    Notes:
        - 동일 Qdrant 인스턴스에서 다수 브레인을 구분하기 위한 네임스페이스 역할을 합니다.
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
    Notes:
        - 안전을 위해 항상 새로 생성합니다. 기존 인덱스 유지가 필요하면 호출 전 존재 여부를 확인하세요.
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
    Notes:
        - 입력이 매우 길 경우 모델의 최대 토큰 길이에 맞춰 트렁케이션됩니다.
        - 배치 추론을 고려하면 처리량이 증가하지만, 여기서는 단일 텍스트 기준으로 구현되어 있습니다.
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


def get_embeddings_batch(texts: List[str], lang:str) -> np.ndarray:
    """
    주어진 텍스트 리스트를 언어에 맞는 모델로 임베딩 후 numpy 배열로 반환.
    항상 shape이 (N, D)인 2D numpy 배열을 반환하도록 보정함.
    """
    lang="ko"

    # ---- 한국어 임베딩 ----
    if lang == "ko":
        inputs = tokenizer(
            texts, return_tensors="pt", padding=True, truncation=True, max_length=512
        )
        with torch.no_grad():
            outputs = model(**inputs)
        cls_embeddings = outputs.last_hidden_state[:, 0, :]  # [CLS] 토큰
        embeddings = cls_embeddings.cpu().numpy()

    # ---- 영어 임베딩 ----
    elif lang == "en":
        embeddings = eng_model.encode(
            texts, convert_to_numpy=True, normalize_embeddings=True
        )

    else:
        raise ValueError(f"지원하지 않는 언어 코드: {lang}")

    # ---- shape 강제 보정 ----
    embeddings = np.atleast_2d(embeddings)  # 항상 2D로 유지
    return embeddings


def store_embeddings(node:dict, brain_id:str, embeddings:list):

    lang="ko"
    collection_name = get_collection_name(brain_id)

    for idx, desc in enumerate(node["descriptions"]):
        description=desc["description"]
        source_id=node["source_id"]
        phrase=node["name"]

        if description == "":
            try:
                print("case: 1")
                description = node["name"]
                emb = get_embeddings_batch([description], lang)
                if emb is None or emb.size == 0:
                    logging.warning("임베딩 생성 실패: %s", description)
                    continue
                emb = emb[0] if emb.ndim > 1 else emb
            except Exception as e:
                logging.error("임베딩 생성 중 오류: %s - %s", description, str(e))
                continue
        else:
            if embeddings is None or embeddings.size == 0:  # 빈 리스트 체크
                print("case: 2")
                highlighted_description = description.replace(phrase, f"[{phrase}]")
                emb = get_embeddings_batch([highlighted_description], lang)
                emb = emb[0] if emb.ndim > 1 else emb
            else:
                print("case: 3")
                emb = np.array(embeddings[idx])
                if emb.ndim > 1:
                    emb = emb[0]
        
        desc_hash = str(hash(description)) if description else "empty"
        pid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{source_id}_{desc_hash}"))
        
        # Qdrant에 upsert (예외 처리)
        try:
            vector_as_list = emb.tolist()
            client.upsert(
                collection_name=collection_name,
                points=[
                    models.PointStruct(
                        id=pid,
                        vector=vector_as_list,
                        payload={
                            "source_id": source_id,
                            "name": phrase,
                            "description": description,
                            "point_id": pid
                        }
                    )
                ]
            )
            logging.info("노드 %s descriptor %d 저장 완료(UUID: %s)", source_id, idx, pid)
        except Exception as e:
            logging.error("Qdrant upsert 실패 (node: %s, idx: %d): %s", source_id, idx, str(e))
    

def update_index_and_get_embeddings(nodes: List[Dict], brain_id: str) -> Dict[str, List[List[float]]]:
    """
    노드 목록을 여러 표현 포맷으로 임베딩하고 Qdrant에 저장

    처리 순서:
    1. 필수 필드 검증(source_id, name, descriptions)
    2. description 유무에 따른 조건부 포맷 적용
    3. encode_text로 임베딩
    4. uuid5로 point_id 생성
    5. Qdrant upsert로 벡터 및 payload 저장

    Args:
        nodes: {source_id, name, descriptions} 포함 노드 리스트
        brain_id: 브레인 고유 식별자
    Returns:
        source_id별 생성된 벡터 리스트 딕셔너리
    Notes:
        - description이 비어있으면 name만으로 임베딩을 생성합니다.
        - 동일 노드에서 포맷별로 다수 벡터가 생성될 수 있습니다.
        - 예외 내구성을 높이기 위해 내부 단계를 try/except로 감싸고 로깅합니다.
    """
    collection_name = get_collection_name(brain_id)
    all_embeddings: Dict[str, List[List[float]]] = {}

    # 사용할 표현 포맷 정의
    formats = [
        "{name} {description}",
        "{description}"
    ]

    for node in nodes:
        try:
            # 필수 키 확인
            if not all(k in node for k in ["source_id", "name", "descriptions"]):
                logging.warning("필수 필드 누락된 노드: %s", node)
                continue

            source_id = str(node["source_id"])
            name = str(node.get("name", "")).strip()
            
            # 빈 이름 체크
            if not name:
                logging.warning("빈 이름 필드: %s", source_id)
                continue

            embeddings_for_node: List[List[float]] = []

            # 각 description마다 포맷별 벡터 생성
            for desc in node["descriptions"]:
                try:
                    # description 추출
                    if isinstance(desc, dict):
                        description = (desc.get("description") or "").strip()
                    else:
                        description = str(desc).strip()

                    # description 유무에 따른 포맷 선택
                    if description:
                        # description이 있으면 두 포맷 모두 사용
                        active_formats = formats
                    else:
                        # description이 없으면 첫 번째 포맷만 사용 (실제로는 name만)
                        active_formats = [formats[0]]  # "{name} {description}"

                    for idx, fmt in enumerate(active_formats):
                        try:
                            # 텍스트 생성
                            if description:
                                text = fmt.format(name=name, description=description).strip()
                            else:
                                # description이 없으면 name만 사용
                                text = name.strip()
                            
                            # 최소 길이 체크
                            if len(text) < 1:
                                logging.debug("빈 텍스트 건너뛰기: %s", text)
                                continue
                                
                            logging.info("[임베딩 텍스트] %s", text)

                            # 임베딩 생성 (예외 처리)
                            try:
                                emb = encode_text(text)
                                if not emb or len(emb) == 0:
                                    logging.warning("임베딩 생성 실패: %s", text)
                                    continue
                            except Exception as e:
                                logging.error("임베딩 생성 중 오류: %s - %s", text, str(e))
                                continue

                            embeddings_for_node.append(emb)

                            # 고유 point_id 생성 (해시 사용으로 길이 제한)
                            desc_hash = str(hash(description)) if description else "empty"
                            pid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{source_id}_{idx}_{desc_hash}"))

                            # Qdrant에 upsert (예외 처리)
                            try:
                                client.upsert(
                                    collection_name=collection_name,
                                    points=[
                                        models.PointStruct(
                                            id=pid,
                                            vector=emb,
                                            payload={
                                                "source_id": source_id,
                                                "name": name,
                                                "description": description,
                                                "format_index": idx,
                                                "point_id": pid
                                            }
                                        )
                                    ]
                                )
                                logging.info("노드 %s descriptor %d 저장 완료(UUID: %s)", source_id, idx, pid)
                            except Exception as e:
                                logging.error("Qdrant upsert 실패 (node: %s, idx: %d): %s", source_id, idx, str(e))
                                continue

                        except Exception as e:
                            logging.error("포맷 %d 처리 중 오류 (node: %s): %s", idx, source_id, str(e))
                            continue
                            
                except Exception as e:
                    logging.error("Description 처리 중 오류 (node: %s): %s", source_id, str(e))
                    continue

            if embeddings_for_node:
                all_embeddings[source_id] = embeddings_for_node
            else:
                logging.warning("노드 %s에 대한 임베딩이 생성되지 않음", source_id)
                
        except Exception as e:
            logging.error("노드 %s 전체 처리 중 오류: %s", node.get("source_id", "unknown"), str(e))
            continue

    logging.info("컬렉션 %s에 %d개의 노드 임베딩 저장 완료", collection_name, len(all_embeddings))
    return all_embeddings


def search_similar_nodes(
    embedding: List[float],
    brain_id: str,
    limit: int = 3,
    threshold: float = 0.55,
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
        Tuple[List[Dict], float]: (유사 노드 리스트, Q 평균 유사도)
    Notes:
        - 시그니처의 타입힌트는 List[Dict]이나, 실제 반환은 (results, Q) 튜플입니다.
          상위 호출부(`similar_nodes, Q = ...`) 사용과 일치합니다.
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

        final_nodes = high_scores + top_grouped

        # Q = avg(r_i) over final_nodes
        if final_nodes:
            Q = sum(node["score"] for node in final_nodes) / len(final_nodes)
        else:
            Q = 0.0

        # 최종 반환: 고유사도(high_scores) + 그룹핑된 상위 결과 , Q(질문과 노드의 유사도 평균)
        return final_nodes, round(Q, 4)

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


def encode(text: str) -> List[float]:
        """
        KoE5 모델을 이용해 텍스트를 임베딩합니다.
        Returns: EMBED_DIM 차원의 float 리스트
        """
        return encode_text(text)

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
