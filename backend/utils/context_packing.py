# utils/context_packing.py
from __future__ import annotations
import re, json, logging, os
from datetime import datetime
from typing import List, Dict, Tuple, Optional

import requests  # Ollama /api/show 조회용 (localhost:11434)

# =========================
# 기본 유틸
# =========================
def get_ollama_num_ctx(model_name: str, base_url: str = "http://localhost:11434") -> int:
    """
    Ollama /api/show 로 모델 컨텍스트 한계 조회.
    우선순위: Modelfile PARAMETER num_ctx -> model_info.*context_length -> 2048
    """
    try:
        r = requests.post(f"{base_url}/api/show", json={"model": model_name}, timeout=5)
        r.raise_for_status()
        data = r.json() or {}

        # 1) Modelfile의 PARAMETER num_ctx
        mf = data.get("modelfile", "") or ""
        m = re.search(r"PARAMETER\s+num_ctx\s+(\d+)", mf)
        param_ctx = int(m.group(1)) if m else None

        # 2) model_info.*context_length
        model_info = data.get("model_info", {}) or {}
        info_ctx = None
        for k, v in model_info.items():
            if "context_length" in k and isinstance(v, int):
                info_ctx = v
                break

        if param_ctx and info_ctx:
            return min(param_ctx, info_ctx)
        return param_ctx or info_ctx or 2048
    except Exception as e:
        logging.warning("get_ollama_num_ctx failed: %s", e)
        return 2048

def approx_tokens(s: str, chars_per_token: int = 4) -> int:
    """간이 토큰 추정 (영문 4자≈1토큰, 한글은 여유 있게)."""
    return (len(s) + (chars_per_token - 1)) // chars_per_token

class TokenCounter:
    def __init__(self, chars_per_token: int = 4):
        self.cpt = chars_per_token
    def count(self, text: str) -> int:
        return approx_tokens(text, self.cpt)

# =========================
# 블록 생성
# =========================
def _node_block(n: Dict) -> str:
    nid = n.get("id") or n.get("name", "")
    title = n.get("name", "")
    # 원문 문장/설명 일부를 포함 (너무 길지 않게 컷)
    descs = n.get("original_sentences") or n.get("descriptions") or []
    desc_txt = ""
    if isinstance(descs, list) and descs:
        joined = " ".join(str(x) for x in descs[:2])
        desc_txt = "Desc: " + joined.strip().replace("\n", " ")[:300]
    return f"[Node {nid}] {title}\n{desc_txt}\n" if desc_txt else f"[Node {nid}] {title}\n"

def _rel_block(r: Dict) -> str:
    s = r.get("source") or r.get("start") or r.get("from")
    t = r.get("target") or r.get("end") or r.get("to")
    rel = r.get("type") or r.get("relation")
    return f"(Edge) {s} -[{rel}]-> {t}\n"

def build_blocks(
    nodes: List[Dict], related_nodes: List[Dict], relationships: List[Dict],
    cap_related: int = 200, cap_edges: int = 500
) -> List[str]:
    """노드/엣지를 텍스트 블록 리스트로 구성 (중복 제거/캡 적용)."""
    blocks, seen = [], set()
    for n in nodes:
        b = _node_block(n)
        if b not in seen: seen.add(b); blocks.append(b)
    for n in related_nodes[:cap_related]:
        b = _node_block(n)
        if b not in seen: seen.add(b); blocks.append(b)
    for r in relationships[:cap_edges]:
        b = _rel_block(r)
        if b not in seen: seen.add(b); blocks.append(b)
    return blocks

# =========================
# 축약 & 패킹
# =========================
def _shrink_lists(b: str) -> str:
    """설명 라인을 200→120자로 축약."""
    out = []
    for ln in b.splitlines():
        if ln.startswith("Desc:"):
            out.append("Desc: " + ln[5:].strip()[:120])
        else:
            out.append(ln)
    nb = "\n".join(out)
    return nb + ("\n" if not nb.endswith("\n") else "")

def _shrink_oneliner(b: str) -> str:
    head = b.splitlines()[0] if b else ""
    return (head + " — key facts: ...\n") if head else b

def _shrink_header(b: str) -> str:
    head = b.splitlines()[0] if b else ""
    return (head + " (…)\n") if head else b

def _rank_blocks(question: str, blocks: List[str]) -> List[str]:
    """간단 랭킹: 질문 토큰 히트 수 + 짧은 블록 가점 (외부 의존 X)."""
    q_terms = set(question.split())
    def score(b: str):
        words = b.split()
        hits = sum(1 for w in words if w in q_terms)
        return hits + (1.0 / max(10, len(words)))
    return sorted(blocks, key=score, reverse=True)

def pack_to_budget(
    *, blocks: List[str], token_budget: int, question: str, reserve_topk: int = 3,
    header: Optional[str] = None, footer: Optional[str] = None, chars_per_token: int = 4
) -> Tuple[str, Dict]:
    """
    예산 내 패킹: 상위 K 보존 → 초과 블록은 단계적 축약(리스트→한줄→헤더) → 그래도 안 되면 스킵.
    """
    tc = TokenCounter(chars_per_token)
    header = header or "<CONTEXT>\n질문과 직접 관련된 노드/관계를 [Node id], (Edge) 형태로 유지.\n\n"
    footer = footer or "</CONTEXT>\n"
    budget = token_budget - tc.count(header) - tc.count(footer)

    ranked = _rank_blocks(question, blocks)
    out, used = [], 0
    shr = {"lists": 0, "oneliner": 0, "header": 0}
    dropped = 0

    for i, b in enumerate(ranked):
        t = tc.count(b)
        if i < reserve_topk and used + t <= budget:
            out.append(b); used += t; continue
        if used + t <= budget:
            out.append(b); used += t; continue

        b1 = _shrink_lists(b); t1 = tc.count(b1)
        if used + t1 <= budget:
            out.append(b1); used += t1; shr["lists"] += 1; continue

        b2 = _shrink_oneliner(b); t2 = tc.count(b2)
        if used + t2 <= budget:
            out.append(b2); used += t2; shr["oneliner"] += 1; continue

        b3 = _shrink_header(b); t3 = tc.count(b3)
        if used + t3 <= budget:
            out.append(b3); used += t3; shr["header"] += 1; continue

        dropped += 1
        if used >= budget: break

    schema_text = header + "".join(out) + footer
    meta = {
        "packed_tokens": tc.count(schema_text),
        "budget": token_budget,
        "shrunk": shr,
        "dropped": dropped,
        "kept": len(out),
    }
    return schema_text, meta

# =========================
# 엔트리 함수 (answer_endpoint에서 이거 하나만 호출해도 됨)
# =========================
def prepare_schema_text_for_ollama(
    *,
    ai_generate_schema_text_fn,      # ai_service.generate_schema_text
    model_name: str,                 # ai_service.model_name 또는 요청 model_name
    nodes: List[Dict],
    related_nodes: List[Dict],
    relationships: List[Dict],
    question: str,
    prompt_ratio: float = 0.8,
    ollama_base: str = "http://localhost:11434",
    header: Optional[str] = None,
    footer: Optional[str] = None
) -> Tuple[str, int, Dict]:
    """
    1) 원본 schema_text 생성
    2) Ollama /api/show 로 num_ctx 조회 → prompt_budget 계산
    3) 초과 시 블록 빌드 + 패킹, 아니면 원본 유지
    return: (schema_text, num_ctx_limit, meta)
    """
    # 1) 원본 스키마 텍스트
    schema_text = ai_generate_schema_text_fn(nodes, related_nodes, relationships)

    # 2) 컨텍스트 한계/예산
    num_ctx_limit = get_ollama_num_ctx(model_name, base_url=ollama_base)
    prompt_budget = int(num_ctx_limit * prompt_ratio)

    # 3) 초과 여부 판단 (질문 + 템플릿 여유치 포함)
    approx_in = approx_tokens(schema_text) + approx_tokens(question) + 128
    overflow = approx_in > prompt_budget

    meta = {
        "num_ctx": num_ctx_limit,
        "prompt_budget": prompt_budget,
        "approx_in": approx_in,
        "overflow": overflow,
        "mode": "raw",
    }

    if not overflow:
        return schema_text, num_ctx_limit, meta

    try:
        blocks = build_blocks(nodes, related_nodes, relationships)
        packed_schema, pack_meta = pack_to_budget(
            blocks=blocks,
            token_budget=prompt_budget,
            question=question,
            header=header,
            footer=footer
        )
        schema_text = packed_schema
        meta.update({"mode": "packed", "pack_meta": pack_meta})
        logging.warning("Context overflow → packed: %s", pack_meta)
    except Exception as e:
        logging.exception("packing failed, fallback to head-tail trimming")
        # 폴백: head 80% + tail 20%
        budget_chars = prompt_budget * 4
        head = schema_text[: int(budget_chars * 0.8)]
        tail = schema_text[-int(budget_chars * 0.2):]
        schema_text = head + "\n...\n" + tail
        meta.update({"mode": "fallback_head_tail"})

    return schema_text, num_ctx_limit, meta