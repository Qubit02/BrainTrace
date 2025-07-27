from neo4j import GraphDatabase
import logging
from typing import List, Dict
import json
from exceptions.custom_exceptions import Neo4jException
from collections import defaultdict

NEO4J_URI = "bolt://localhost:7687"
NEO4J_AUTH = ("neo4j", "YOUR_PASSWORD")  # 실제 비밀번호로 교체
from exceptions.custom_exceptions import Neo4jException
class Neo4jHandler:
    def __init__(self):
        self.driver = GraphDatabase.driver(NEO4J_URI, auth=NEO4J_AUTH)

    def close(self):
        self.driver.close()


    def insert_nodes_and_edges(self, nodes, edges, brain_id):
        """
        노드와 엣지를 Neo4j에 저장합니다.
        쓰기 트랜잭션은 session.write_transaction()을 사용하여 한 번에 처리합니다.
        """
        def _insert(tx, nodes, edges, brain_id):
            # 노드 저장
            for node in nodes:
                # descriptions를 JSON 문자열로 변환 (한글 깨짐 방지를 위해 ensure_ascii=False)
                # source_id를 descriptions에 포함하여 저장
                new_descriptions = []
                for desc in node.get("descriptions", []):
                    # 이미 source_id가 포함되어 있지 않으면 추가
                    if isinstance(desc, dict) and "source_id" not in desc and "description" in desc:
                        desc["source_id"] = node.get("source_id", "")
                    new_descriptions.append(json.dumps(desc, ensure_ascii=False))
                
                tx.run(
                    """
                    MERGE (n:Node {name: $name, brain_id: $brain_id})
                    ON CREATE SET 
                        n.label = $label, 
                        n.descriptions = $new_descriptions,
                        n.source_id = $source_id,
                        n.brain_id = $brain_id
                    ON MATCH SET 
                        n.label = $label, 
                        n.source_id = $source_id,
                        n.brain_id = $brain_id,
                        n.descriptions = CASE 
                            WHEN n.descriptions IS NULL THEN $new_descriptions 
                            ELSE n.descriptions + [item IN $new_descriptions WHERE NOT item IN n.descriptions] 
                        END
                    """,
                    name=node["name"],
                    label=node["label"],
                    source_id=node.get("source_id", ""),
                    new_descriptions=new_descriptions,
                    brain_id=brain_id
                )
            # 엣지 저장
            for edge in edges:
                tx.run(
                    """
                    MATCH (a:Node {name: $source, brain_id: $brain_id}), (b:Node {name: $target, brain_id: $brain_id})
                    MERGE (a)-[r:REL {relation: $relation, brain_id: $brain_id}]->(b)
                    """,
                    source=edge["source"],
                    target=edge["target"],
                    relation=edge["relation"],
                    brain_id=brain_id
                )

        try:
            with self.driver.session() as session:
                session.execute_write(_insert, nodes, edges, brain_id)
                logging.info("✅ Neo4j 노드와 엣지 삽입 및 트랜잭션 커밋 완료")
        except Exception as e:
            logging.error(f"❌ Neo4j 쓰기 트랜잭션 오류: {str(e)}")
            raise Neo4jException(message=f"Neo4j 쓰기 트랜잭션 오류: {str(e)}")

    def fetch_all_nodes(self):
        """
        모든 노드를 읽어와 JSON 형식의 리스트로 반환합니다.
        읽기 쿼리는 session.run()을 사용하여 처리합니다.
        """
        nodes = []
        try:
            with self.driver.session() as session:
                result = session.run("MATCH (n:Node) RETURN n.label AS label, n.name AS name, n.descriptions AS descriptions")
                for record in result:
                    raw = record["descriptions"]
                    descriptions = [json.loads(desc) for desc in raw] if raw is not None else []
                    nodes.append({
                        "label": record["label"],
                        "name": record["name"],
                        "descriptions": descriptions
                    })
        except Exception as e:
            raise Neo4jException(f"❌ Neo4j 읽기 오류: {str(e)}")
        return nodes

    def query_schema_by_node_names(self, node_names, brain_id):
        """
        입력된 노드 이름들을 기준으로 주변 노드 및 관계(최대 2단계 깊이)를 조회합니다.
        """
        if not node_names or not isinstance(node_names, list):
            logging.error("유효하지 않은 node_names: %s", node_names)
            return None
        
        logging.info("Neo4j 스키마 조회 시작 (노드 이름 목록: %s, brain_id: %s)", node_names, brain_id)
        
        try:
            # 먼저 해당 brain_id의 모든 노드를 확인
            with self.driver.session() as session:
                debug_query = "MATCH (n:Node) WHERE n.brain_id = $brain_id RETURN n.name as name"
                debug_result = session.run(debug_query, brain_id=brain_id)
                all_nodes = [record["name"] for record in debug_result]
                logging.info("Neo4j에 저장된 모든 노드 (brain_id=%s): %s", brain_id, all_nodes)
                
                # 검색하려는 노드들이 실제로 존재하는지 확인
                existing_nodes = [name for name in node_names if name in all_nodes]
                missing_nodes = [name for name in node_names if name not in all_nodes]
                logging.info("존재하는 노드: %s", existing_nodes)
                logging.info("존재하지 않는 노드: %s", missing_nodes)
                
                if not existing_nodes:
                    logging.warning("검색하려는 노드들이 모두 존재하지 않습니다.")
                    return {
                        "nodes": [],
                        "relatedNodes": [],
                        "relationships": []
                    }
                
                # 1단계: 직접 연결된 노드 및 관계
                query1 = '''
                MATCH (n:Node)
                WHERE n.name IN $names AND n.brain_id = $brain_id
                OPTIONAL MATCH (n)-[r]-(m:Node)
                WHERE m.brain_id = $brain_id
                RETURN 
                collect(DISTINCT n) AS start_nodes,
                collect(DISTINCT m) AS direct_nodes,
                collect(DISTINCT r) AS direct_relationships
                '''
                    
                # 2단계: 중간 노드(m)와 간접 연결된 노드(p) 및 관계(r2)
                # query2 = '''
                # MATCH (n:Node)-[r1]-(m:Node)-[r2]-(p:Node)
                # WHERE n.name IN $names 
                # AND n.brain_id = $brain_id 
                # AND m.brain_id = $brain_id 
                # AND p.brain_id = $brain_id 
                # AND p <> n
                # RETURN 
                # collect(DISTINCT m) AS intermediate_nodes,
                # collect(DISTINCT p) AS indirect_nodes,
                # collect(DISTINCT r2) AS indirect_relationships
                # '''
                
                # 쿼리 실행
                result1 = session.run(query1, names=node_names, brain_id=brain_id)
                record1 = result1.single()
                
                # result2 = session.run(query2, names=node_names, brain_id=brain_id)
                # record2 = result2.single()
                
                if not record1:
                    logging.warning("Neo4j 조회 결과가 없습니다.")
                    return None
                
                # 결과 취합
                nodes = record1.get("start_nodes", [])
                related_nodes = record1.get("direct_nodes", [])
                relationships = record1.get("direct_relationships", [])
                
                # 2단계 결과 추가
                # if record2:
                #     # 중간 노드(m)도 related_nodes에 추가
                #     intermediate = record2.get("intermediate_nodes", []) or []
                #     for node in intermediate:
                #         if node is not None:
                #             related_nodes.append(node)

                #     # 간접 노드(p) 추가
                #     indirect = record2.get("indirect_nodes", []) or []
                #     for node in indirect:
                #         if node is not None:
                #             related_nodes.append(node)

                #     # 간접 관계(r2) 추가
                #     rels2 = record2.get("indirect_relationships", []) or []
                #     for rel in rels2:
                #         if rel is not None:
                #             relationships.append(rel)
                
                # 중복 제거는 Neo4j 쿼리 내에서 DISTINCT로 처리되었으므로 여기서는 생략
                logging.info("Neo4j 스키마 조회 결과: 노드=%d개, 관련 노드=%d개, 관계=%d개", 
                           len(nodes), len(related_nodes), len(relationships))
                
                # 결과 반환
                return {
                    "nodes": nodes,
                    "relatedNodes": related_nodes,
                    "relationships": relationships
                }
        except Exception as e:
            logging.error("❌ Neo4j 스키마 조회 오류: %s", str(e))
            raise Neo4jException(f"Neo4j 스키마 조회 오류: {str(e)}")

    def _execute_with_retry(self, query: str, parameters: dict, retries: int = 3):
        """
        간단한 재시도 로직: 지정된 쿼리를 여러 번 시도하여 실행
        """
        for attempt in range(retries):
            try:
                with self.driver.session() as session:
                    result = session.run(query, parameters)
                    return [record.data() for record in result]
            except Exception as e:
                logging.warning(f"재시도 {attempt+1}회 실패: {e}")
                if attempt == retries - 1:
                    raise Neo4jException((f"재시도 {attempt+1}회 실패: {e}"))
        return []

    def fetch_all_edges(self, brain_id: str) -> List[Dict]:
        try:
            query = """
            MATCH (source:Node {brain_id: $brain_id})-[r:RELATES_TO {brain_id: $brain_id}]->(target:Node {brain_id: $brain_id})
            RETURN source.name AS source, target.name AS target, r.type AS type
            """
            return self._execute_with_retry(query, {"brain_id": brain_id})
        except Exception as e:
            logging.error(f"❌ Neo4j 엣지 조회 실패: {str(e)}")
            raise Neo4jException(f"Neo4j 엣지 조회 실패: {str(e)}")

    def get_brain_graph(self, brain_id: str) -> Dict[str, List]:
        """특정 브레인의 노드와 엣지 정보 조회"""
        logging.info(f"Neo4j get_brain_graph 시작 - brain_id: {brain_id}")
        try:
            with self.driver.session() as session:
                # 노드 조회
                logging.info("노드 조회 쿼리 실행")
                nodes_result = session.run("""
                    MATCH (n)
                    WHERE n.brain_id = $brain_id
                    RETURN DISTINCT n.name as name
                    """, brain_id=brain_id)
                
                nodes = [{"name": record["name"]} for record in nodes_result]
                logging.info(f"조회된 노드 수: {len(nodes)}")

                # 엣지(관계) 조회
                logging.info("엣지 조회 쿼리 실행")
                edges_result = session.run("""
                    MATCH (source)-[r]->(target)
                    WHERE source.brain_id = $brain_id AND target.brain_id = $brain_id
                    RETURN DISTINCT source.name as source, target.name as target, r.relation as relation
                    """, brain_id=brain_id)
                
                links = [
                    {
                        "source": record["source"],
                        "target": record["target"],
                        "relation": record["relation"]
                    }
                    for record in edges_result
                ]
                logging.info(f"조회된 엣지 수: {len(links)}")

                result = {
                    "nodes": nodes,
                    "links": links
                }
                logging.info(f"반환할 데이터: {result}")
                return result
        except Exception as e:
            logging.error("Neo4j 그래프 조회 오류: %s", str(e))
            raise Neo4jException(f"그래프 조회 오류: {str(e)}") 
        
    def delete_brain(self, brain_id: str) -> None:
        try:
            query = """
            MATCH (n:Node {brain_id: $brain_id})
            DETACH DELETE n
            """
            self._execute_with_retry(query, {"brain_id": brain_id})
            logging.info(f"✅ brain_id {brain_id}의 모든 데이터 삭제 완료")
        except Exception as e:
            logging.error(f"❌ Neo4j 데이터 삭제 실패: {str(e)}")
            raise Neo4jException(f"Neo4j 데이터 삭제 실패: {str(e)}")

    def delete_descriptions_by_source_id(self, source_id: str, brain_id: str) -> None:
        """
        특정 source_id를 가진 description들을 삭제하고, description이 비어있는 노드는 삭제합니다.
        Args:
            source_id: 삭제할 description의 source_id
            brain_id: 브레인 ID
        """
        try:
            # 1. description 삭제
            query1 = """
            MATCH (n:Node {brain_id: $brain_id})
            WITH n, [d in n.descriptions WHERE NOT (d CONTAINS $source_id)] as filtered_descriptions
            SET n.descriptions = filtered_descriptions
            """
            self._execute_with_retry(query1, {"source_id": source_id, "brain_id": brain_id})
            
            # 2. description이 비어있는 노드 삭제
            query2 = """
            MATCH (n:Node {brain_id: $brain_id})
            WHERE size(n.descriptions) = 0
            DETACH DELETE n
            """
            self._execute_with_retry(query2, {"brain_id": brain_id})
            
            logging.info(f"✅ source_id {source_id}의 descriptions 삭제 완료")
        except Exception as e:
            logging.error(f"❌ descriptions 삭제 실패: {str(e)}")
            raise Neo4jException(f"descriptions 삭제 실패: {str(e)}")

    def delete_descriptions_by_brain_id(self, brain_id: str) -> None:
        """
        특정 brain_id를 가진 모든 노드와 관계를 삭제합니다.
        Args:
            brain_id: 삭제할 브레인의 ID
        """
        try:
            query = """
            MATCH (n:Node {brain_id: $brain_id})
            DETACH DELETE n
            """
            self._execute_with_retry(query, {"brain_id": brain_id})
            logging.info(f"✅ brain_id {brain_id}의 모든 데이터 삭제 완료")
        except Exception as e:
            logging.error(f"❌ Neo4j 데이터 삭제 실패: {str(e)}")
            raise Neo4jException(f"Neo4j 데이터 삭제 실패: {str(e)}")

    def get_node_descriptions(self, node_name: str, brain_id: str) -> List[Dict]:
        """
        특정 노드의 descriptions 배열을 조회합니다.
        
        Args:
            node_name: 조회할 노드의 이름
            brain_id: 브레인 ID
            
        Returns:
            List[Dict]: descriptions 배열 (각 항목은 description과 source_id를 포함)
        """
        try:
            query = """
            MATCH (n:Node {name: $node_name, brain_id: $brain_id})
            RETURN n.descriptions as descriptions
            """
            result = self._execute_with_retry(query, {"node_name": node_name, "brain_id": brain_id})
            
            if not result or not result[0].get("descriptions"):
                return []
                
            # descriptions 배열의 각 항목을 JSON으로 파싱
            descriptions = []
            for desc in result[0]["descriptions"]:
                if isinstance(desc, str):
                    try:
                        descriptions.append(json.loads(desc))
                    except json.JSONDecodeError:
                        logging.warning(f"JSON 파싱 실패: {desc}")
                else:
                    descriptions.append(desc)
                    
            return descriptions
            
        except Exception as e:
            logging.error(f"❌ 노드 descriptions 조회 실패: {str(e)}")
            raise Neo4jException(f"노드 descriptions 조회 실패: {str(e)}")

    def get_nodes_by_source_id(self, source_id: str, brain_id: str) -> List[str]:
        """
        특정 source_id가 descriptions에 포함된 모든 노드의 이름을 반환합니다.
        
        Args:
            source_id: 찾을 source_id
            brain_id: 브레인 ID
            
        Returns:
            List[str]: 노드 이름 목록
        """
        try:
            query = """
            MATCH (n:Node {brain_id: $brain_id})
            WHERE ANY(desc IN n.descriptions WHERE desc CONTAINS $source_id)
            RETURN n.name as name
            """
            result = self._execute_with_retry(query, {"source_id": source_id, "brain_id": brain_id})
            return [record["name"] for record in result]
            
        except Exception as e:
            logging.error(f"❌ source_id로 노드 조회 실패: {str(e)}")
            raise Neo4jException(f"source_id로 노드 조회 실패: {str(e)}")

    def get_edges_by_source_id(self, source_id: str, brain_id: str) -> List[Dict]:
        """
        특정 source_id가 descriptions에 포함된 노드들 간의 엣지를 반환합니다.
        
        Args:
            source_id: 찾을 source_id
            brain_id: 브레인 ID
            
        Returns:
            List[Dict]: 엣지 목록 (source, target, relation 포함)
        """
        try:
            query = """
            MATCH (source:Node {brain_id: $brain_id})-[r:REL {brain_id: $brain_id}]->(target:Node {brain_id: $brain_id})
            WHERE ANY(desc IN source.descriptions WHERE desc CONTAINS $source_id)
               OR ANY(desc IN target.descriptions WHERE desc CONTAINS $source_id)
            RETURN source.name as source, target.name as target, r.relation as relation
            """
            result = self._execute_with_retry(query, {"source_id": source_id, "brain_id": brain_id})
            return [
                {
                    "source": record["source"],
                    "target": record["target"],
                    "relation": record["relation"]
                }
                for record in result
            ]
            
        except Exception as e:
            logging.error(f"❌ source_id로 엣지 조회 실패: {str(e)}")
            raise Neo4jException(f"source_id로 엣지 조회 실패: {str(e)}")
        
    def get_descriptions_bulk(self, node_names: List[str], brain_id: str) -> Dict[str, List[int]]:
        """
        여러 노드 이름에 대해 descriptions 필드(문자열 리스트)를 한 번에 조회하고,
        Python에서 JSON 문자열을 파싱하여 source_id 리스트를 추출합니다.
        반환: { node_name: [source_id, ...], ... }
        """
        logging.info(f"get_descriptions_bulk 호출: node_names={node_names}, brain_id={brain_id}")
        
        # Cypher: descriptions 문자열 리스트만 조회
        query = '''
        MATCH (n:Node)
        WHERE n.brain_id = $brain_id AND n.name IN $names
        RETURN n.name AS name, n.descriptions AS descriptions
        '''
        rows = self._execute_with_retry(query, {"names": node_names, "brain_id": brain_id})
        
        logging.info(f"get_descriptions_bulk 쿼리 결과: {rows}")

        result: Dict[str, List[int]] = defaultdict(list)
        for rec in rows:
            # rec이 dict 형태인지 튜플 형태인지 처리
            name = rec.get('name') if isinstance(rec, dict) else rec[0]
            desc_list = rec.get('descriptions') if isinstance(rec, dict) else rec[1]
            if not desc_list:
                continue
            for raw in desc_list:
                # JSON 문자열이면 loads, dict면 그대로
                try:
                    desc = json.loads(raw) if isinstance(raw, str) else raw
                except (TypeError, json.JSONDecodeError):
                    continue
                sid = desc.get('source_id')
                if sid is not None:
                    try:
                        result[name].append(int(sid))
                    except ValueError:
                        continue
        return result

    def __del__(self):
        self.close()