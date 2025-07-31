
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
    raise ValueError("❌ OpenAI API Key가 설정되지 않았습니다. .env 파일을 확인하세요.")

# ✅ OpenAI 클라이언트 설정 (노드/엣지 추출에 활용)
# client = OpenAI(api_key=openai_api_key)
client = OpenAI(api_key=openai_api_key)


class OpenAIService(BaseAIService) :
    def __init__(self):
        # 인스턴스 속성으로 클라이언트 할당
        self.client = OpenAI(api_key=openai_api_key)
    def extract_referenced_nodes(self,llm_response: str) -> List[str]:
        """
        LLM 응답 문자열에서 EOF 뒤의 JSON을 파싱해
        referenced_nodes만 추출한 뒤,
        '레이블-노드' 형식일 경우 레이블과 '-'을 제거하고
        노드 이름만 반환합니다.
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
            chunks = chunk_text(text)
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
        """개별 청크에서 노드와 엣지 정보를 추출합니다."""
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
            completion = client.chat.completions.create(
                model="gpt-4o",
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
        """중복된 노드를 제거합니다."""
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
        """중복된 엣지를 제거합니다."""
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
        스키마 텍스트와 질문을 기반으로 AI를 호출하여 최종 답변을 생성합니다.
        """
        prompt = (
        "다음 스키마와 질문을 바탕으로, 스키마에 명시된 정보나 연결된 관계를 통해 추론 가능한 범위 내에서만 자연어로 답변해줘. "
        "정보가 일부라도 있다면 해당 범위 내에서 최대한 설명하고, 스키마와 완전히 무관한 경우에만 '지식그래프에 해당 정보가 없습니다.'라고 출력해. "
        "스키마:\n" + schema_text + "\n\n"
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
                model="gpt-4o",
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
        Neo4j에서 가져온 노드, 인접 노드, 관계 데이터를 받아
        노드-관계-노드 형식의 스키마 텍스트를 생성합니다.
        """
        try:
            logging.info("generating schema text: %d개 노드, %d개 관련 노드, %d개 관계",
                        len(nodes) if isinstance(nodes, list) else 0,
                        len(related_nodes) if isinstance(related_nodes, list) else 0,
                        len(relationships) if isinstance(relationships, list) else 0)

            def filter_node(node):
                try:
                    if node is None:
                        return {"name": "알 수 없음", "label": "알 수 없음", "descriptions": []}
                        
                    # Neo4j 노드 객체의 경우 properties 추출 (items() 사용)
                    if hasattr(node, "items"):
                        d = dict(node.items())
                    elif isinstance(node, dict):
                        d = node
                    else:
                        d = {}
                    
                    name = d.get("name", "알 수 없음")
                    label = d.get("label", "알 수 없음")
                    descriptions = d.get("descriptions", [])
                    if descriptions is None:
                        descriptions = []
                    
                    # descriptions가 문자열인 경우 JSON 파싱 시도
                    parsed_descriptions = []
                    if descriptions:
                        if isinstance(descriptions, str):
                            try:
                                descriptions = [json.loads(descriptions)]
                            except json.JSONDecodeError as err:
                                logging.error("descriptions JSON 파싱 오류: %s - 원본: %s", str(err), descriptions)
                                descriptions = []
                        
                        for desc_item in descriptions:
                            if isinstance(desc_item, str):
                                try:
                                    desc_obj = json.loads(desc_item)
                                    if isinstance(desc_obj, dict):
                                        parsed_descriptions.append(desc_obj)
                                except json.JSONDecodeError:
                                    continue
                            elif isinstance(desc_item, dict):
                                parsed_descriptions.append(desc_item)
                    
                    return {
                        "name": name,
                        "label": label,
                        "descriptions": parsed_descriptions
                    }
                except Exception as e:
                    logging.error("노드 필터링 오류: %s", str(e))
                    return {"name": "알 수 없음", "label": "알 수 없음", "descriptions": []}

            # 노드 처리: nodes와 related_nodes를 하나의 딕셔너리(all_nodes)로 모읍니다.
            all_nodes = {}
            if isinstance(nodes, list):
                for node in nodes:
                    if node is not None:
                        node_data = filter_node(node)
                        all_nodes[node_data["name"]] = node_data
            
            if isinstance(related_nodes, list):
                for node in related_nodes:
                    if node is not None:
                        node_data = filter_node(node)
                        if node_data["name"] not in all_nodes:
                            all_nodes[node_data["name"]] = node_data

            # 관계 처리 (각 관계를 "노드-관계-노드" 형식으로 생성)
            simplified_relationships = []
            
            if not relationships:
                logging.warning("관계 데이터가 비어 있습니다.")
            elif isinstance(relationships, str):
                logging.warning("관계 데이터가 문자열입니다: %s", relationships)
            else:
                for rel in relationships:
                    try:
                        if rel is None:
                            continue
                            
                        if not hasattr(rel, 'start_node') or not hasattr(rel, 'end_node'):
                            logging.warning("유효하지 않은 관계 객체: %s", str(rel))
                            continue
                        
                        # 시작/종료 노드 객체 추출 및 변환
                        try:
                            start_node_obj = rel.start_node
                            end_node_obj = rel.end_node
                            
                            if hasattr(start_node_obj, "items"):
                                start_node_dict = dict(start_node_obj.items())
                            elif isinstance(start_node_obj, dict):
                                start_node_dict = start_node_obj
                            else:
                                start_node_dict = {}
                                
                            if hasattr(end_node_obj, "items"):
                                end_node_dict = dict(end_node_obj.items())
                            elif isinstance(end_node_obj, dict):
                                end_node_dict = end_node_obj
                            else:
                                end_node_dict = {}
                            
                            start_node_name = start_node_dict.get("name", "알 수 없음")
                            end_node_name = end_node_dict.get("name", "알 수 없음")
                            
                            # 관계 유형 및 라벨 추출
                            relation_type = getattr(rel, "type", "관계")
                            relation_props = dict(rel) if hasattr(rel, '__iter__') else {}
                            relation_label = relation_props.get("relation", relation_type)
                            
                            # 노드 정보 (all_nodes 에서 미리 처리된 데이터 사용)
                            start_node = all_nodes.get(start_node_name, {"name": start_node_name, "label": "알 수 없음", "descriptions": []})
                            end_node   = all_nodes.get(end_node_name,   {"name": end_node_name, "label": "알 수 없음", "descriptions": []})
                            
                            # descriptions에서 'description' 텍스트만 추출
                            def extract_desc(node_data):
                                desc_list = []
                                for desc in node_data.get("descriptions", []):
                                    if isinstance(desc, dict) and "description" in desc:
                                        desc_text = desc.get("description", "")
                                        if desc_text:
                                            desc_list.append(desc_text)
                                return ", ".join(desc_list) if desc_list else ""
                            
                            start_desc_str = extract_desc(start_node)
                            end_desc_str = extract_desc(end_node)
                            
                            start_label = start_node.get("label", "")
                            end_label = end_node.get("label", "")
                            
                            # 노드-관계-노드 형식 구성
                            relationship_str = f"{start_label}-{start_node_name}({start_desc_str}) -> {relation_label} -> {end_label}-{end_node_name}({end_desc_str})"
                            simplified_relationships.append(relationship_str)
                        except Exception as e:
                            logging.error("관계 정보 추출 오류: %s", str(e))
                            continue
                    except Exception as e:
                        logging.error("관계 처리 오류: %s", str(e))
                        continue
            
            # 중복 제거
            simplified_relationships = list(set(simplified_relationships))
            
            # 노드 정보 생성 (참고용으로 활용)
            node_info_list = []
            for node in all_nodes.values():
                try:
                    node_descs = []
                    for desc in node.get("descriptions", []):
                        if isinstance(desc, dict) and "description" in desc:
                            desc_text = desc.get("description", "")
                            if desc_text:
                                node_descs.append(desc_text)
                    desc_str = ", ".join(node_descs) if node_descs else ""
                    node_label = node.get("label", "")
                    node_info = f"{node_label}-{node.get('name', '알 수 없음')}({desc_str})"
                    node_info_list.append(node_info)
                except Exception as e:
                    logging.error("노드 정보 생성 오류: %s", str(e))
                    continue

            # ✅ 관계에 등장한 노드 이름 수집
            connected_node_names = set()
            if isinstance(relationships, list):
                for rel in relationships:
                    try:
                        if rel is None: continue
                        start_name = dict(rel.start_node.items()).get("name", "")
                        end_name = dict(rel.end_node.items()).get("name", "")
                        connected_node_names.update([start_name, end_name])
                    except Exception:
                        continue

            # ✅ 관계에 등장하지 않은 노드만 따로 분리
            standalone_node_info_list = [
                n for n in node_info_list
                if all(name not in n for name in connected_node_names)
            ]

            relationship_text = "\n".join(simplified_relationships) if simplified_relationships else ""
            standalone_node_text = "\n".join(standalone_node_info_list) if standalone_node_info_list else ""

            if relationship_text and standalone_node_text:
                raw_schema_text = relationship_text + "\n" + standalone_node_text
            elif relationship_text:
                raw_schema_text = relationship_text
            elif node_info_list:
                raw_schema_text = "\n".join(node_info_list)
            else:
                raw_schema_text = "스키마 정보를 찾을 수 없습니다."

            logging.info("스키마 텍스트 생성 완료 (%d자)\n%s", len(raw_schema_text), raw_schema_text)
            return raw_schema_text
            
            
        except Exception as e:
            logging.error("스키마 생성 오류: %s", str(e))
            return "스키마 생성 실패"

    def chat(self, message: str) -> str:
        """
        단일 프롬프트를 Ollama LLM에 보내고,
        모델 응답 문자열만 리턴합니다.
        """
        try:
            resp = self.client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": message}],
                stream=False
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logging.error(f"chat 오류: {e}")
            raise