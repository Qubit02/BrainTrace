"""
Ollama LLM 서비스 구현체
-----------------------

Ollama HTTP API를 사용하여 모델 준비(옵션), 채팅/생성 호출, 텍스트에서 그래프 구성요소 추출,
스키마 텍스트 생성, 질의응답 등을 수행합니다.

핵심 기능:
- 모델 자동 풀링(환경변수에 따라) 및 API URL 환경별 결정
- 긴 텍스트 청킹 후 각 청크에서 노드/엣지 추출 → 중복 정리
- description과 문장 임베딩 간 유사도로 `original_sentences` 산출
- 스키마 텍스트를 만들고, 이를 기반으로 답변 생성

의존성:
- requests: Ollama HTTP API 호출
- dotenv: 환경 변수 로딩
- scikit-learn / numpy: 코사인 유사도 및 배열 연산
- 프로젝트 서비스: `BaseAIService`, `chunk_text`, `manual_chunking`, `encode_text`

주의:
- 외부 HTTP 호출이 포함되므로 타임아웃/네트워크 오류를 고려하고 로깅합니다.
- Ollama API의 응답 스키마(`api/chat`, `api/generate`) 차이를 반영하여 파싱합니다.
"""

import os
import logging
import json
from typing import Tuple, List, Dict

import requests
from dotenv import load_dotenv

from .base_ai_service import BaseAIService
from .embedding_service import encode_text
from .manual_chunking_sentences import manual_chunking
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# 환경변수 로드
load_dotenv()

# ───────── Ollama 서버 URL 환경별 설정 ───────── #
def get_ollama_api_url() -> str:
    """
    실행 환경에 따라 Ollama API URL을 결정합니다.
    
    - Docker 환경: ollama:11434 (서비스명으로 접근)
    - 로컬 환경: localhost:11434
    
    Returns:
        str: Ollama API 기본 URL
    """
    # 환경변수로 명시적 설정이 있으면 우선 사용
    if os.getenv("OLLAMA_API_URL"):
        return os.getenv("OLLAMA_API_URL")
    
    # 도커 환경 감지
    if os.getenv("IN_DOCKER") == "true":
        return "http://ollama:11434"
    else:
        return "http://localhost:11434"

OLLAMA_API_URL = get_ollama_api_url()
OLLAMA_PULL_MODEL = os.getenv("OLLAMA_PULL_MODEL", "false").lower() in ("1", "true", "yes")


class OllamaAIService(BaseAIService):
    """Ollama HTTP API를 사용하는 그래프/QA 서비스 구현체.

    Args:
        model_name: 사용할 Ollama 모델 이름(예: "gemma3:4b")
    """
    def __init__(self, model_name: str):
        self.model_name = model_name

        # 모델 자동 풀링 설정 시 HTTP API 호출
        if OLLAMA_PULL_MODEL:
            try:
                resp = requests.post(
                    f"{OLLAMA_API_URL}/api/pull",        # 모델 풀링 엔드포인트
                    json={"model": self.model_name},
                    timeout=60
                )
                resp.raise_for_status()
                # 스트림 모드라면 여러 JSON이, 아니면 단일 JSON이 반환됨
                logging.info(f"Ollama 모델 '{self.model_name}' 준비 완료")
            except Exception as e:
                logging.warning(f"Ollama 모델 '{self.model_name}' 풀링 오류: {e}")

    def extract_referenced_nodes(self, llm_response: str) -> List[str]:
        """응답 텍스트의 EOF 이후 JSON에서 `referenced_nodes`만 추출.

        - "레이블-노드" 형식이면 '-' 기준으로 레이블 제거 후 노드명만 반환
        - JSON 파싱 실패 시 빈 리스트 반환
        """
        parts = llm_response.split("EOF")
        if len(parts) < 2:
            return []
        try:
            payload = json.loads(parts[-1].strip())
            raw_nodes = payload.get("referenced_nodes", [])
            return [
                nd.split("-", 1)[1] if "-" in nd else nd
                for nd in raw_nodes
            ]
        except json.JSONDecodeError:
            logging.warning("extract_referenced_nodes: JSON 파싱 실패")
            return []

    def extract_graph_components(
        self, text: str, source_id: str
    ) -> Tuple[List[Dict], List[Dict]]:
        """텍스트에서 노드/엣지 추출.

        처리 흐름:
          - 길이≥2000이면 청킹(`chunk_text`), 아니면 원문 단일 청크 처리
          - 청크별 `_extract_from_chunk` 호출
          - 노드/엣지 중복 제거 후 반환
        """
        all_nodes, all_edges = [], []
        chunks = manual_chunking(text) if len(text) >= 2000 else [text]
        logging.info(f"총 {len(chunks)}개 청크로 분할")
        for idx, chunk in enumerate(chunks, 1):
            logging.info(f"청크 {idx}/{len(chunks)} 처리")
            nodes, edges = self._extract_from_chunk(chunk, source_id)
            all_nodes.extend(nodes)
            all_edges.extend(edges)

        return (
            self._remove_duplicate_nodes(all_nodes),
            self._remove_duplicate_edges(all_edges)
        )

    def _extract_from_chunk(
        self, chunk: str, source_id: str
    ) -> Tuple[List[Dict], List[Dict]]:
        """단일 청크에서 노드/엣지 및 `original_sentences` 계산.

        단계:
          1) 프롬프트 구성 → Ollama `/api/chat` 호출(비스트리밍)
          2) 결과 JSON 파싱 및 노드/엣지 검증/정규화
          3) 문장 청킹(`manual_chunking`)과 임베딩으로 original_sentences 구성
        """
        prompt = (
            "다음 텍스트를 분석해서 노드와 엣지 정보를 추출해줘. "
            # ...기존 프롬프트 내용 그대로 유지...
            f"텍스트: {chunk}"
        )
        try:
            # Ollama 네이티브 chat 엔드포인트 호출
            resp = requests.post(
                f"{OLLAMA_API_URL}/api/chat",          # chat 엔드포인트
                json={
                    "model": self.model_name,
                    "messages": [
                        {"role": "system", "content": "당신은 노드/엣지 추출 전문가입니다."},
                        {"role": "user",   "content": prompt}
                    ],
                    "stream": False
                },
                timeout=60
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["message"]["content"]       # Ollama 응답 스키마 파싱
            parsed = json.loads(content)
        except Exception as e:
            logging.error(f"_extract_from_chunk 오류: {e}")
            return [], []

        # 노드 검증 (기존 로직 그대로 유지)
        valid_nodes = []
        for node in parsed.get("nodes", []):
            if not all(k in node for k in ("label", "name")):
                logging.warning("잘못된 노드: %s", node)
                continue
            node.setdefault("descriptions", [])
            node["source_id"] = source_id
            if desc := node.pop("description", None):
                node["descriptions"].append({"description": desc, "source_id": source_id})
            valid_nodes.append(node)

        # 엣지 검증 (기존 로직 그대로 유지)
        node_names = {n["name"] for n in valid_nodes}
        valid_edges = []
        for edge in parsed.get("edges", []):
            if all(k in edge for k in ("source", "target", "relation")):
                if edge["source"] in node_names and edge["target"] in node_names:
                    valid_edges.append(edge)
                else:
                    logging.warning("잘못된 엣지 참조: %s", edge)
            else:
                logging.warning("스키마 누락 엣지: %s", edge)

        # original_sentences 계산 로직 (기존과 동일)
        sentences = manual_chunking(chunk)
        if not sentences:
            for node in valid_nodes:
                node["original_sentences"] = []
            return valid_nodes, valid_edges

        # 모든 문장 임베딩 한 번에 계산(성능 최적화)
        sentence_embeds = np.vstack([encode_text(s) for s in sentences])
        threshold = 0.8
        for node in valid_nodes:
            if not node["descriptions"]:
                node["original_sentences"] = []
                continue
            desc_obj = node["descriptions"][0]
            desc_vec = np.array(encode_text(desc_obj["description"])).reshape(1, -1)
            sim_scores = cosine_similarity(sentence_embeds, desc_vec).flatten()
            above = [(i, score) for i, score in enumerate(sim_scores) if score >= threshold]
            node_originals = []
            if above:
                for i, score in above:
                    node_originals.append({
                        "original_sentence": sentences[i],
                        "source_id": desc_obj["source_id"],
                        "score": round(float(score), 4)
                    })
            else:
                best_i = int(np.argmax(sim_scores))
                node_originals.append({
                    "original_sentence": sentences[best_i],
                    "source_id": desc_obj["source_id"],
                    "score": round(float(sim_scores[best_i]), 4)
                })
            node["original_sentences"] = node_originals

        return valid_nodes, valid_edges

    # 중복 제거 유틸리티 (기존 로직 유지)
    def _remove_duplicate_nodes(self, nodes: List[Dict]) -> List[Dict]:
        """동일 (name, label) 노드 병합. `descriptions`는 합칩니다."""
        seen = set(); unique = []
        for node in nodes:
            key = (node["name"], node["label"])
            if key in seen:
                for u in unique:
                    if (u["name"], u["label"]) == key:
                        u["descriptions"].extend(node["descriptions"])
                        break
            else:
                seen.add(key)
                unique.append(node)
        return unique

    def _remove_duplicate_edges(self, edges: List[Dict]) -> List[Dict]:
        """동일 (source, target, relation) 엣지는 하나만 유지합니다."""
        seen = set(); unique = []
        for edge in edges:
            key = (edge["source"], edge["target"], edge["relation"])
            if key not in seen:
                seen.add(key)
                unique.append(edge)
        return unique

    def generate_answer(self, schema_text: str, question: str) -> str:
        """스키마 텍스트와 질문으로 Ollama `/api/generate` 호출.

        - 출력 마지막에 EOF와 JSON(referenced_nodes)을 포함하도록 프롬프트 유도
        - 스트리밍 비활성화, 타임아웃 지정
        """
        prompt = (
            "다음 지식그래프 컨텍스트와 질문을 바탕으로, 컨텍스트에 명시된 정보나 연결된 관계를 통해 추론 가능한 범위 내에서만 자연어로 답변해줘. "
            "정보가 일부라도 있다면 해당 범위 내에서 최대한 설명하고, 컨텍스트와 완전히 무관한 경우에만 '지식그래프에 해당 정보가 없습니다.'라고 출력해. "
            "지식그래프 컨텍스트 형식:\n"
            "1. [관계 목록] start_name -> relation_label -> end_name\n (모든 노드가 관계를 가지고 있는 것은 아님)"
            "2. [노드 목록] NODE: {node_name} | DESCRIPTION: {desc_str}\n"
            "지식그래프 컨텍스트:\n" + schema_text + "\n\n"
            "질문: " + question + "\n\n"
            "출력 형식:\n"
            "[여기에 질문에 대한 상세 답변 작성 또는 '지식그래프에 해당 정보가 없습니다.' 출력]\n\n"
            "EOF\n"
            "{\n"
            '  "referenced_nodes": ["노드 이름1", "노드 이름2", ...]\n'
            "}\n"
            "※ 'referenced_nodes'에는 참고한 노드 이름만 정확히 JSON 배열로 나열하고, 도메인 정보, 노드 간 관계, 설명은 포함하지 마."
            "※ 반드시 EOF를 출력해"
        )
        try:
            print("debug", schema_text, question)
            resp = requests.post(
                f"{OLLAMA_API_URL}/api/generate",       # 일반 생성 엔드포인트
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=60
            )
            resp.raise_for_status()
            data = resp.json()
            return data["response"].strip()            # Ollama /api/generate 응답 파싱
        except Exception as e:
            logging.error(f"generate_answer 오류: {e}")
            raise

    def generate_schema_text(self, nodes, related_nodes, relationships) -> str:
        """
        위: start_name -> relation_label -> end_name (한 줄씩, 중복 제거)
        아래: 모든 노드(관계 있든 없든) 중복 없이
            {node_name}: {desc_str}
        desc_str는 original_sentences[].original_sentence를 모아 공백 정리 및 중복 제거
        """

        def to_dict(obj):
            """객체/레코드를 dict로 관용 변환(Neo4j 드라이버 호환)."""
            try:
                if obj is None:
                    return {}
                if hasattr(obj, "items"):
                    return dict(obj.items())
                if isinstance(obj, dict):
                    return obj
            except Exception:
                pass
            return {}

        def normalize_space(s: str) -> str:
            """여러 공백을 하나로 통일."""
            return " ".join(str(s).split())

        def filter_node(node_obj):
            """name/label/original_sentences만 추출해 정규화."""
            d = to_dict(node_obj)
            name = normalize_space(d.get("name", "알 수 없음") or "")
            label = normalize_space(d.get("label", "알 수 없음") or "")
            original_sentences = d.get("original_sentences", []) or []
            parsed = []
            # 문자열이면 JSON 파싱 시도
            if isinstance(original_sentences, str):
                try:
                    original_sentences = [json.loads(original_sentences)]
                except Exception:
                    original_sentences = []
            # 리스트 요소들 정규화
            for item in original_sentences:
                if isinstance(item, str):
                    try:
                        obj = json.loads(item)
                        if isinstance(obj, dict):
                            parsed.append(obj)
                    except Exception:
                        continue
                elif isinstance(item, dict):
                    parsed.append(item)
            return {"name": name, "label": label, "original_sentences": parsed}

        logging.info(
            "generating schema text: %d개 노드, %d개 관련 노드, %d개 관계",
            len(nodes) if isinstance(nodes, list) else 0,
            len(related_nodes) if isinstance(related_nodes, list) else 0,
            len(relationships) if isinstance(relationships, list) else 0,
        )

        # 1) 모든 노드 수집 (name 키로 합치기)
        all_nodes = {}
        if isinstance(nodes, list):
            for n in nodes or []:
                if n is None: continue
                nd = filter_node(n)
                if nd["name"]:
                    all_nodes[nd["name"]] = nd
        if isinstance(related_nodes, list):
            for n in related_nodes or []:
                if n is None: continue
                nd = filter_node(n)
                if nd["name"] and nd["name"] not in all_nodes:
                    all_nodes[nd["name"]] = nd

        # 2) 관계 줄 만들기: "start -> relation -> end"
        relation_lines = []
        connected_names = set()
        if isinstance(relationships, list):
            for rel in relationships:
                try:
                    if rel is None:
                        continue
                    start_d = to_dict(getattr(rel, "start_node", {}))
                    end_d   = to_dict(getattr(rel, "end_node", {}))
                    start_name = normalize_space(start_d.get("name", "") or "알 수 없음")
                    end_name   = normalize_space(end_d.get("name", "") or "알 수 없음")

                    # relation label: props.relation 우선, 없으면 type, 없으면 "관계"
                    try:
                        rel_props = dict(rel)
                    except Exception:
                        rel_props = {}
                    relation_type = getattr(rel, "type", None)
                    relation_label = rel_props.get("relation") or relation_type or "관계"
                    relation_label = normalize_space(relation_label)

                    relation_lines.append(f"{start_name} -> {relation_label} -> {end_name}")
                    connected_names.update([start_name, end_name])
                except Exception as e:
                    logging.exception("관계 처리 오류: %s", e)
                    continue

        # 관계 중복 제거 + 정렬
        relation_lines = sorted(set(relation_lines))

        # 3) 노드 설명 만들기: 모든 노드(관계 여부 무관)
        def extract_desc_str(node_data):
            # original_sentences[].original_sentence 모아 공백 정리 + 중복 제거
            seen = set()
            pieces = []
            for d in node_data.get("original_sentences", []):
                if isinstance(d, dict):
                    t = normalize_space(d.get("original_sentence", "") or "")
                    if t and t not in seen:
                        seen.add(t)
                        pieces.append(t)
            if not pieces:
                return ""
            s = " ".join(pieces)
            
            return s

        node_lines = []
        for name in sorted(all_nodes.keys()):  # ✅ 관계 없어도 모든 노드 출력
            nd = all_nodes.get(name) or {}
            desc = extract_desc_str(nd)
            if desc:
                node_lines.append(f"{name}: {desc}")
            else:
                node_lines.append(f"{name}:")  # 설명이 비면 콜론만

        # 4) 최종 출력: 위엔 관계들, 아래엔 노드들
        top = "\n".join(relation_lines)
        bottom = "\n".join(node_lines)

        if top and bottom:
            raw_schema_text = f"{top}\n\n{bottom}"
        elif top:
            raw_schema_text = top
        elif bottom:
            raw_schema_text = bottom
        else:
            raw_schema_text = "컨텍스트에서 해당 정보를 찾을 수 없습니다."

        logging.info("컨텍스트 텍스트 생성 완료 (%d자)", len(raw_schema_text))
        return raw_schema_text


    def chat(self, message: str) -> str:
        """
        단일 프롬프트를 Ollama LLM에 보내고,
        모델 응답 문자열만 리턴합니다.
        """
        try:
            resp = requests.post(
                f"{OLLAMA_API_URL}/api/chat",          # chat 엔드포인트
                json={
                    "model": self.model_name,
                    "messages": [{"role": "user", "content": message}],
                    "stream": False
                },
                timeout=60
            )
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"].strip()  # Ollama /api/chat 응답 파싱
        except Exception as e:
            logging.error(f"chat 오류: {e}")
            raise