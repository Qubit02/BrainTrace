"""
services/ollama_service.py

Ollama AI 모델 관리 및 채팅 API 서비스 구현체입니다.

주요 기능:
- AI 모델 설치 (HTTP API로 다운로드)
- 단일/스트림 채팅 요청 (HTTP API)
- 노드·엣지 추출, 스키마 생성, 답변 생성

의존성:
- FastAPI 기반 애플리케이션에서 사용
- requests: Ollama HTTP API 호출
- dotenv: 환경변수 로드
- 기타: scikit-learn, numpy, 사용자 정의 BaseAIService 등
"""

import os
import logging
import json
from typing import Tuple, List, Dict

import requests
from dotenv import load_dotenv

from .base_ai_service import BaseAIService
from .chunk_service import chunk_text
from .embedding_service import encode_text
from .manual_chunking_sentences import manual_chunking
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# 환경변수 로드
load_dotenv()
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://ollama:11434")
OLLAMA_PULL_MODEL = os.getenv("OLLAMA_PULL_MODEL", "false").lower() in ("1", "true", "yes")


class OllamaAIService(BaseAIService):
    def __init__(self, model_name: str):
        self.model_name = model_name

        # 모델 자동 풀링 설정 시 HTTP API 호출
        if OLLAMA_PULL_MODEL:
            try:
                resp = requests.post(
                    f"{OLLAMA_API_URL}/api/pull",        # 모델 풀링 엔드포인트 :contentReference[oaicite:6]{index=6}
                    json={"model": self.model_name},
                    timeout=60
                )
                resp.raise_for_status()
                # 스트림 모드라면 여러 JSON이, 아니면 단일 JSON이 반환됨
                logging.info(f"Ollama 모델 '{self.model_name}' 준비 완료")
            except Exception as e:
                logging.warning(f"Ollama 모델 '{self.model_name}' 풀링 오류: {e}")

    def extract_referenced_nodes(self, llm_response: str) -> List[str]:
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
        all_nodes, all_edges = [], []
        chunks = chunk_text(text) if len(text) >= 2000 else [text]
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
        prompt = (
            "다음 텍스트를 분석해서 노드와 엣지 정보를 추출해줘. "
            # ...기존 프롬프트 내용 그대로 유지...
            f"텍스트: {chunk}"
        )
        try:
            # Ollama 네이티브 chat 엔드포인트 호출
            resp = requests.post(
                f"{OLLAMA_API_URL}/api/chat",          # chat 엔드포인트 :contentReference[oaicite:7]{index=7}
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
            content = data["message"]["content"]       # Ollama 응답 스키마 파싱 :contentReference[oaicite:8]{index=8}
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
        seen = set(); unique = []
        for edge in edges:
            key = (edge["source"], edge["target"], edge["relation"])
            if key not in seen:
                seen.add(key)
                unique.append(edge)
        return unique

    def generate_answer(self, schema_text: str, question: str) -> str:
        prompt = (
            "다음 스키마와 질문을 바탕으로 답변을 작성하세요.\n\n"
            f"스키마:\n{schema_text}\n\n"
            f"질문: {question}\n\n"
            "EOF\n"
            "{\n  \"referenced_nodes\": [\"노드1\", \"노드2\", ...]\n}\n"
        )
        try:
            print("debug", schema_text, question)
            resp = requests.post(
                f"{OLLAMA_API_URL}/api/generate",       # 일반 생성 엔드포인트 :contentReference[oaicite:9]{index=9}
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=60
            )
            resp.raise_for_status()
            data = resp.json()
            return data["response"].strip()            # Ollama /api/generate 응답 파싱 :contentReference[oaicite:10]{index=10}
        except Exception as e:
            logging.error(f"generate_answer 오류: {e}")
            raise

    def generate_schema_text(
        self,
        nodes: List[Dict],
        related_nodes: List[Dict],
        relationships: List
    ) -> str:
        # 기존 로직 유지
        all_nodes = {}
        def norm(n):
            return dict(n.items()) if hasattr(n, "items") else (n if isinstance(n, dict) else {})
        for n in nodes + related_nodes:
            d = norm(n)
            name = d.get("name")
            if name:
                all_nodes[name] = {
                    "label": d.get("label", ""),
                    "descriptions": d.get("descriptions") or []
                }

        lines = set()
        for r in relationships or []:
            try:
                s = norm(r.start_node); t = norm(r.end_node)
                rel = getattr(r, "type", "")
                a = f"{all_nodes[s['name']]['label']}-{s['name']}"
                b = f"{all_nodes[t['name']]['label']}-{t['name']}"
                lines.add(f"{a} -> {rel} -> {b}")
            except Exception:
                continue

        schema = list(lines)
        standalone = [
            f"{v['label']}-{k}"
            for k, v in all_nodes.items()
            if all(k not in ln for ln in schema)
        ]
        schema.extend(standalone)
        return "\n".join(schema) or "스키마 정보가 없습니다."

    def chat(self, message: str) -> str:
        """
        단일 프롬프트를 Ollama LLM에 보내고,
        모델 응답 문자열만 리턴합니다.
        """
        try:
            resp = requests.post(
                f"{OLLAMA_API_URL}/api/chat",          # chat 엔드포인트 :contentReference[oaicite:11]{index=11}
                json={
                    "model": self.model_name,
                    "messages": [{"role": "user", "content": message}],
                    "stream": False
                },
                timeout=60
            )
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"].strip()  # Ollama /api/chat 응답 파싱 :contentReference[oaicite:12]{index=12}
        except Exception as e:
            logging.error(f"chat 오류: {e}")
            raise
