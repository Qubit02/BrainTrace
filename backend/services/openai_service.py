"""
OpenAI 기반 그래프 추출/질의응답 서비스
-------------------------------------

이 모듈은 OpenAI API를 활용해 텍스트로부터 노드/엣지(그래프 구성요소)를 추출하고,
그래프 컨텍스트(스키마 텍스트)와 질문을 기반으로 답변을 생성하는 기능을 제공합니다.

핵심 기능:
- 긴 텍스트(≥2000자) 청킹 처리 후 각 청크에서 노드/엣지 추출
- 추출된 노드의 description과 문장 임베딩 간 유사도 기반으로 original_sentences 산출
- 스키마 텍스트를 생성하여 LLM 질의응답에 활용
- 답변의 맨 끝(JSON 영역)에서 referenced_nodes를 파싱하여 노드 참조 목록을 추출

환경 변수:
- OPENAI_API_KEY: OpenAI API 호출에 사용 (dotenv를 통해 로드)

주의:
- 본 모듈은 외부 API 호출을 포함하므로, 장애/요금/레이트 리밋 고려가 필요합니다.
- 임베딩/유사도 계산(threshold)은 휴리스틱으로, 도메인에 맞게 조정하세요.
"""


import logging
from openai import OpenAI           # OpenAI 클라이언트 임포트
import json
from .chunk_service import chunk_text
from .base_ai_service import BaseAIService
from typing import List
from .manual_chunking_sentences import manual_chunking
import numpy as np
import os
from dotenv import load_dotenv  # dotenv 추가
from .embedding_service import encode_text
from sklearn.metrics.pairwise import cosine_similarity



# ✅ .env 파일에서 환경 변수 로드
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")

if not openai_api_key:
    raise ValueError("❌ OpenAI API Key가 설정되지 않았습니다. generate_answerㅎ.env 파일을 확인하세요.")

# ✅ OpenAI 클라이언트 설정 (노드/엣지 추출에 활용)
# client = OpenAI(api_key=openai_api_key)
client = OpenAI(api_key=openai_api_key)


class OpenAIService(BaseAIService) :
    """OpenAI API를 사용해 그래프 추출/QA를 수행하는 서비스 구현체."""
    def __init__(self, model_name="gpt-4o"):
        # 인스턴스 속성으로 클라이언트 할당
        self.client = OpenAI(api_key=openai_api_key)
        self.model_name = model_name  # 모델명 저장
    def extract_referenced_nodes(self,llm_response: str) -> List[str]:
        """
        LLM 응답 문자열에서 EOF 뒤의 JSON을 파싱하여 referenced_nodes만 추출합니다.

        - '레이블-노드' 형식일 경우 레이블과 '-'을 제거하고 노드 이름만 반환
        - EOF 이후 JSON이 없거나 파싱 실패 시 빈 리스트 반환
        """
        parts = llm_response.split("EOF")
        if len(parts) < 2:
            return []

        json_part = parts[-1].strip()
        try:
            payload = json.loads(json_part)
            # payload가 리스트인 경우 빈 리스트 반환
            if isinstance(payload, list):
                return []
            # payload가 딕셔너리인 경우에만 get() 호출
            raw_nodes = payload.get("referenced_nodes", [])
            cleaned = [
                node.split("-", 1)[1] if "-" in node else node
                for node in raw_nodes
            ]
            return cleaned
        except json.JSONDecodeError:
            return []

    def extract_graph_components(self,text: str, source_id: str):
        """
        입력 텍스트에서 LLM을 활용해 노드와 엣지 정보를 추출합니다.
        텍스트가 2000자 이상인 경우 청킹하여 처리합니다.
        반환 형식: (nodes: list, edges: list)
        """
        # 모든 노드와 엣지를 저장할 리스트
        all_nodes = []
        all_edges = []
        
        # 텍스트가 2000자 이상이면 청킹
        if len(text) >= 2000:
            # 규칙 기반 수동 청킹(문장 단위)을 사용
            chunks = manual_chunking(text)
            logging.info(f"✅ 텍스트가 {len(chunks)}개의 청크로 분할되어 처리됩니다.")
            
            # 각 청크별로 노드와 엣지 추출
            for i, chunk in enumerate(chunks, 1):
                logging.info(f"청크 {i}/{len(chunks)} 처리 중...")
                nodes, edges = self._extract_from_chunk(chunk, source_id)
                all_nodes.extend(nodes)
                all_edges.extend(edges)
        else:
            # 2000자 미만이면 직접 처리
            all_nodes, all_edges = self._extract_from_chunk(text, source_id)
        
        # 중복 제거
        all_nodes = self._remove_duplicate_nodes(all_nodes)
        all_edges = self._remove_duplicate_edges(all_edges)
        
        logging.info(f"✅ 총 {len(all_nodes)}개의 노드와 {len(all_edges)}개의 엣지가 추출되었습니다.")
        return all_nodes, all_edges

    def _extract_from_chunk(self, chunk: str, source_id: str):
        """개별 청크에서 노드/엣지 정보를 추출하고 보강(original_sentences)합니다.

        처리 단계:
          1) 프롬프트 구성 → OpenAI 호출(응답을 JSON으로 강제)
          2) 노드 필수 필드 검증/정규화 + description → descriptions로 이동, source_id 주입
          3) 엣지의 source/target 검증(노드 name 참조)
          4) 문장 단위 청킹 후 임베딩 계산, description과의 유사도로 original_sentences 구성
        """
        prompt = (
        "다음 텍스트를 분석해서 노드와 엣지 정보를 추출해줘. "
        "노드는 { \"label\": string, \"name\": string, \"description\": string } 형식의 객체 배열, "
        "엣지는 { \"source\": string, \"target\": string, \"relation\": string } 형식의 객체 배열로 출력해줘. "
        "여기서 source와 target은 노드의 name을 참조해야 하고, source_id는 사용하면 안 돼. "
        "출력 결과는 반드시 아래 JSON 형식을 준수해야 해:\n"
        "{\n"
        '  "nodes": [ ... ],\n'
        '  "edges": [ ... ]\n'
        "}\n"
        "문장에 있는 모든 개념을 노드로 만들어줘"
        "각 노드의 description은 해당 노드를 간단히 설명하는 문장이어야 해. "
        "만약 텍스트 내에 하나의 긴 description에 여러 개념이 섞여 있다면, 반드시 개념 단위로 나누어 여러 노드를 생성해줘. "
        "description은 하나의 개념에 대한 설명만 들어가야 해"
        "노드의 label과 name은 한글로 표현하고, 불필요한 내용이나 텍스트에 없는 정보는 추가하지 말아줘. "
        "노드와 엣지 정보가 추출되지 않으면 빈 배열을 출력해줘.\n\n"
        "json 형식 외에는 출력 금지"
        f"텍스트: {chunk}"
        )
        try:
            # 응답 포맷을 JSON으로 강제하여 파싱 안정성 확보
            completion = client.chat.completions.create(
                model=self.model_name,  # 동적 모델 선택
                messages=[
                    {"role": "system", "content": "너는 텍스트에서 구조화된 노드와 엣지를 추출하는 전문가야. 엣지의 source와 target은 반드시 노드의 name을 참조해야 해."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=5000,
                temperature=0.3,
                # JSON만 돌려주도록 강제
                response_format={"type": "json_object"}
            )

            # print("response: ", response)
            # data = json.loads(response)
            # print("data: ", data)
            # ⬇️  문자열만 추출!
            content = completion.choices[0].message.content.strip()
            data = json.loads(content)
                
                
            # 각 노드에 source_id 추가 및 구조 검증
            valid_nodes = []
            for node in data.get("nodes", []):
                # 필수 필드 검증
                if not all(key in node for key in ["label", "name"]):
                    logging.warning("필수 필드가 누락된 노드: %s", node)
                    continue

                # descriptions 필드 초기화
                if "descriptions" not in node:
                    node["descriptions"] = []
                    
                # source_id 추가
                node["source_id"] = source_id
                
                # description 처리
                if "description" in node:
                    node["descriptions"].append({
                        "description": node["description"],
                        "source_id": source_id  # 각 description에도 source_id 추가
                    })
                    del node["description"]
                    
                valid_nodes.append(node)
            
            # 엣지의 source와 target이 노드의 name을 참조하는지 검증
            valid_edges = []
            node_names = {node["name"] for node in valid_nodes}
            for edge in data.get("edges", []):
                if "source" in edge and "target" in edge and "relation" in edge:
                    if edge["source"] in node_names and edge["target"] in node_names:
                        valid_edges.append(edge)
                    else:
                        logging.warning("잘못된 엣지 참조: %s", edge)
                else:
                    logging.warning("필수 필드가 누락된 엣지: %s", edge)

             # 1) 문장 단위 분리(의미에 따라서 여러문장일 수도 있음)
            sentences = manual_chunking(chunk)   # List[str]
            logging.warning("청킹된 문장: %s", sentences)
            if not sentences:
                # 빈 sentences인 경우에도 original_sentences 필드 추가
                for node in valid_nodes:
                    node["original_sentences"] = []
                return valid_nodes, valid_edges

            # 2) 모든 문장 임베딩 (한 번만)
            sentence_embeds = np.vstack([encode_text(s) for s in sentences])  # (num_sentences, dim)

            # 3) 노드별로 original_sentences 계산
            threshold = 0.8
        
            for node in valid_nodes:
                # node["descriptions"] 에는 반드시 1개의 딕셔너리가 들어있다고 가정
                desc_obj = node["descriptions"][0]
                desc_text = desc_obj["description"]
                desc_src  = desc_obj["source_id"]
                desc_text_full = f"{node['name']} - {desc_text}"
                # 3-1) name-description 형태로 임베딩
                desc_vec = np.array(encode_text(desc_text)).reshape(1, -1)  # (1, dim)

                # 3-2) 문장 × 설명 유사도 계산
                sim_scores = cosine_similarity(sentence_embeds, desc_vec).flatten()  # (num_sentences,)
                # 0.75 이상 문장 인덱스·점수 모으기
                above = [(i, score) for i, score in enumerate(sim_scores) if score >= threshold]
                # 3-3) threshold 이상인 문장만 모아서 original_sentences 에 저장
                node_originals = []
                
                if above:
                    # 0.8 이상인 모든 문장 추가
                    for i, score in above:
                        node_originals.append({
                            "original_sentence": sentences[i],
                            "source_id":        desc_src,
                            "score":            round(float(score), 4)
                        })
                else:
                    # 0.8 미만 중 최고점 문장 하나만 추가
                    best_i = int(np.argmax(sim_scores))
                    node_originals.append({
                        "original_sentence": sentences[best_i],
                        "source_id":        desc_src,
                        "score":            round(float(sim_scores[best_i]), 4)
                    })


                # 3-4) 각 node에 필드로 추가
                node["original_sentences"] = node_originals

            return valid_nodes, valid_edges 
        except Exception as e:
            logging.error(f"청크 처리 중 오류 발생: {str(e)}")
            return [], []

    def _remove_duplicate_nodes(self, nodes: list) -> list:
        """중복된 노드를 제거합니다.

        - 동일 (name, label) 조합을 하나로 합치고, descriptions는 병합합니다.
        """
        seen = set()
        unique_nodes = []
        for node in nodes:
            node_key = (node["name"], node["label"])
            if node_key not in seen:
                seen.add(node_key)
                unique_nodes.append(node)
            else:
                # 같은 이름의 노드가 있으면 descriptions만 추가
                for existing_node in unique_nodes:
                    if existing_node["name"] == node["name"] and existing_node["label"] == node["label"]:
                        existing_node["descriptions"].extend(node["descriptions"])
        return unique_nodes

    def _remove_duplicate_edges(self, edges: list) -> list:
        """중복된 엣지를 제거합니다. (source, target, relation) 동일 시 하나만 유지"""
        seen = set()
        unique_edges = []
        for edge in edges:
            edge_key = (edge["source"], edge["target"], edge["relation"])
            if edge_key not in seen:
                seen.add(edge_key)
                unique_edges.append(edge)
        return unique_edges

    def generate_answer(self, schema_text: str, question: str) -> str:
        """
        지식그래프 컨텍스트와 질문을 기반으로 AI를 호출하여 최종 답변을 생성합니다.
        """
        logging.info("🚀 OpenAI API 호출 - 모델: %s", self.model_name)
        
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
        
            response = client.chat.completions.create(
                model=self.model_name,  # 동적 모델 선택
                messages=[{"role": "user", "content": prompt}]
            )
            response = response.choices[0].message.content

            print("response: ", response)
            final_answer = response
            return final_answer
        except Exception as e:
            logging.error("GPT 응답 오류: %s", str(e))
            raise RuntimeError("GPT 응답 생성 중 오류 발생")
    

    def generate_schema_text(self, nodes, related_nodes, relationships) -> str:
        """
        위: start_name -> relation_label -> end_name (한 줄씩, 중복 제거)
        아래: 모든 노드(관계 있든 없든) 중복 없이
            {node_name}: {desc_str}
        desc_str는 original_sentences[].original_sentence를 모아 공백 정리 및 중복 제거
        """


        def to_dict(obj):
            """입력 객체를 dict로 관용적으로 변환(Neo4j 레코드/객체 호환용)."""
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
            """연속 공백을 단일 공백으로 정규화."""
            return " ".join(str(s).split())

        def filter_node(node_obj):
            """노드 레코드/객체에서 name/label/original_sentences만 추출/정규화."""
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
            resp = self.client.chat.completions.create(
                model=self.model_name,  # 동적 모델 선택
                messages=[{"role": "user", "content": message}],
                stream=False
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logging.error(f"chat 오류: {e}")
            raise
