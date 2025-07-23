# services/ollama_service.py

import os
from dotenv import load_dotenv

import logging
import json
from typing import Tuple, List, Dict
from ollama import chat, pull  # Python Ollama SDK
from .ai_service import BaseAIService
from .chunk_service import chunk_text

MODEL_NAME = "exaone3.5:2.4b"
pull(MODEL_NAME)

class OllamaAIService(BaseAIService):
    def __init__(self):
        # 최초에 모델이 로컬에 없으면 내려받습니다. location : C:\Users\<username>\.ollama\models
        try:
            pull(MODEL_NAME)
            logging.info(f"Ollama 모델 '{MODEL_NAME}' 준비 완료")
        except Exception as e:
            logging.warning(f"Ollama 모델 '{MODEL_NAME}' 풀링 오류: {e}")

    def extract_referenced_nodes(self, llm_response: str) -> List[str]:
        parts = llm_response.split("EOF")
        if len(parts) < 2:
            return []
        try:
            payload = json.loads(parts[-1].strip())
            raw_nodes = payload.get("referenced_nodes", [])
            return [
                nd.split("-",1)[1] if "-" in nd else nd
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
            "다음 텍스트에서 노드와 엣지를 추출해 JSON으로 출력해 주세요.\n"
            "{\n"
            '  "nodes": [ { "label": "...", "name": "...", "description": "..." }, ... ],\n'
            '  "edges": [ { "source": "...", "target": "...", "relation": "..." }, ... ]\n'
            "}\n\n"
            f"텍스트: {chunk}"
        )
        try:
            resp = chat(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": "당신은 노드/엣지 추출 전문가입니다."},
                    {"role": "user",   "content": prompt}
                ],
                stream=False
            )
            content = resp["message"]["content"]
            data = json.loads(content)
        except Exception as e:
            logging.error(f"_extract_from_chunk 오류: {e}")
            return [], []

        # 노드 검증
        valid_nodes = []
        for node in data.get("nodes", []):
            if not all(k in node for k in ("label", "name")):
                logging.warning("잘못된 노드: %s", node)
                continue
            node.setdefault("descriptions", [])
            node["source_id"] = source_id
            if desc := node.pop("description", None):
                node["descriptions"].append({"description": desc, "source_id": source_id})
            valid_nodes.append(node)

        # 엣지 검증
        node_names = {n["name"] for n in valid_nodes}
        valid_edges = []
        for edge in data.get("edges", []):
            if all(k in edge for k in ("source", "target", "relation")):
                if edge["source"] in node_names and edge["target"] in node_names:
                    valid_edges.append(edge)
                else:
                    logging.warning("잘못된 엣지 참조: %s", edge)
            else:
                logging.warning("스키마 누락 엣지: %s", edge)

        return valid_nodes, valid_edges

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
            resp = chat(
                model=MODEL_NAME,
                messages=[{"role": "user", "content": prompt}],
                stream=False
            )
            return resp["message"]["content"].strip()
        except Exception as e:
            logging.error(f"generate_answer 오류: {e}")
            raise

    def generate_schema_text(
        self,
        nodes: List[Dict],
        related_nodes: List[Dict],
        relationships: List
    ) -> str:
        # 노드 정보 집계
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

        # 관계 텍스트
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

        # 연결 없는 노드
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
            resp = chat(
                model=MODEL_NAME,
                messages=[{"role": "user", "content": message}],
                stream=False
            )
            return resp["message"]["content"].strip()
        except Exception as e:
            logging.error(f"chat 오류: {e}")
            raise