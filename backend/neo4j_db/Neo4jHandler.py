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
                # descriptions를 JSON 문자열로 변환
                new_descriptions = []
                for desc in node.get("descriptions", []):
                    if isinstance(desc, dict):
                        new_descriptions.append(json.dumps(desc, ensure_ascii=False))

                # original_sentences를 JSON 문자열로 변환
                new_originals = []
                for orig in node.get("original_sentences", []):
                    if isinstance(orig, dict):
                        new_originals.append(json.dumps(orig, ensure_ascii=False))

                tx.run(
                    """
                    MERGE (n:Node {name: $name, brain_id: $brain_id})
                    ON CREATE SET
                        n.label = $label,
                        n.brain_id = $brain_id,
                        n.descriptions = $new_descriptions,
                        n.original_sentences = $new_originals
                    ON MATCH SET 
                        n.label = $label, 
                        n.brain_id = $brain_id,
                        n.descriptions = CASE 
                            WHEN n.descriptions IS NULL THEN $new_descriptions 
                            ELSE n.descriptions + [item IN $new_descriptions WHERE NOT item IN n.descriptions] 
                        END,
                        n.original_sentences = CASE
                            WHEN n.original_sentences IS NULL THEN $new_originals
                            ELSE n.original_sentences + [item IN $new_originals WHERE NOT item IN n.original_sentences]
                        END
                    """,
                    name=node["name"],
                    label=node["label"],
                    new_descriptions=new_descriptions,
                    new_originals=new_originals,
                    brain_id=brain_id
                )

            # 엣지 저장
            for edge in edges:
                tx.run(
                    """
                    MATCH (a:Node {name: $source, brain_id: $brain_id})
                    MATCH (b:Node {name: $target, brain_id: $brain_id})
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
        입력된 노드 이름들을 기준으로 주변 노드 및 관계를 조회합니다.
        description이 빈 노드는 건너뛰고 실제 내용이 있는 노드까지 탐색합니다.
        """
        if not node_names or not isinstance(node_names, list):
            logging.error("유효하지 않은 node_names: %s", node_names)
            return None
        
        logging.info("Neo4j 스키마 조회 시작 (노드 이름 목록: %s, brain_id: %s)", node_names, brain_id)
        
        try:
            with self.driver.session() as session:
                # 먼저 해당 brain_id의 모든 노드를 확인 (디버깅용)
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
                
                # 최적화된 단일 쿼리 - description이 있는 노드까지 smart 탐색
                optimized_query = optimized_query = optimized_query = optimized_query = '''
                // 시작 노드들 찾기
                MATCH (start:Node)
                WHERE start.name IN $names AND start.brain_id = $brain_id

                // 각 시작 노드에 대해 처리
                WITH start

                // CASE 1: 시작 노드 자체에 유효한 description이 있는 경우
                // descriptions의 각 요소를 문자열로 변환하여 체크
                WITH start,
                    CASE 
                        WHEN ANY(d IN start.descriptions 
                                WHERE toString(d) CONTAINS '"description"' 
                                AND NOT toString(d) CONTAINS '"description": ""'
                                AND NOT toString(d) CONTAINS '"description":""')
                        THEN start
                        ELSE null
                    END as startWithDesc

                // CASE 2: 시작 노드에 description이 없으면 연결된 노드 탐색
                OPTIONAL MATCH path = (start)-[*1..5]-(target:Node)
                WHERE target.brain_id = $brain_id
                AND ANY(d IN target.descriptions 
                        WHERE toString(d) CONTAINS '"description"' 
                        AND NOT toString(d) CONTAINS '"description": ""'
                        AND NOT toString(d) CONTAINS '"description":""')
                AND startWithDesc IS NULL

                // 모든 경로 수집
                WITH start, startWithDesc, 
                    collect(path) as allPaths

                // 경로에서 노드와 관계 추출
                UNWIND CASE 
                        WHEN startWithDesc IS NOT NULL THEN [null]
                        WHEN size(allPaths) > 0 THEN allPaths
                        ELSE [null]
                    END as p

                WITH start,
                    startWithDesc,
                    CASE 
                        WHEN startWithDesc IS NOT NULL THEN [startWithDesc]
                        WHEN p IS NOT NULL THEN nodes(p)
                        ELSE []
                    END as pathNodes,
                    CASE 
                        WHEN p IS NOT NULL THEN relationships(p)
                        ELSE []
                    END as pathRels

                // 직접 연결된 이웃 노드도 포함
                OPTIONAL MATCH (start)-[directRel]-(neighbor:Node)
                WHERE neighbor.brain_id = $brain_id
                AND neighbor <> start

                // 결과 집계
                WITH 
                    collect(DISTINCT start) as allStartNodes,
                    reduce(nodes = [], n IN collect(pathNodes) | nodes + n) as allPathNodes,
                    reduce(rels = [], r IN collect(pathRels) | rels + r) as allPathRels,
                    collect(DISTINCT neighbor) as allNeighbors,
                    collect(DISTINCT directRel) as allDirectRels

                // 최종 결과
                RETURN 
                    allStartNodes as startNodes,
                    allStartNodes + 
                    [n IN allPathNodes WHERE NOT n IN allStartNodes] + 
                    [n IN allNeighbors WHERE NOT n IN allStartNodes] as allRelatedNodes,
                    allPathRels + allDirectRels as allRelationships,
                    size([n IN allStartNodes WHERE ANY(d IN n.descriptions WHERE toString(d) CONTAINS '"description"' AND NOT toString(d) CONTAINS '"description": ""')]) as startNodesWithDescCount,
                    size(allPathNodes) as pathNodeCount,
                    size(allNeighbors) as neighborCount
                '''
                
                # 쿼리 실행
                result = session.run(optimized_query, names=existing_nodes, brain_id=brain_id)
                record = result.single()
                
                if not record:
                    logging.warning("Neo4j 조회 결과가 없습니다.")
                    return {
                        "nodes": [],
                        "relatedNodes": [],
                        "relationships": []
                    }
                
                # 결과 추출
                start_nodes = record.get("startNodes", [])
                all_related_nodes = record.get("allRelatedNodes", [])
                all_relationships = record.get("allRelationships", [])
                
                # 통계 로깅
                stats = {
                    "startNodesWithDesc": record.get("startNodesWithDescCount", 0),
                    "pathNodes": record.get("pathNodeCount", 0),
                    "neighbors": record.get("neighborCount", 0)
                }
                logging.info(f"조회 통계: {stats}")
                
                # 중복 제거 (set 사용)
                unique_related = []
                seen_ids = set()
                
                for node in all_related_nodes:
                    if node and hasattr(node, 'id') and node.id not in seen_ids:
                        seen_ids.add(node.id)
                        unique_related.append(node)
                    elif node and not hasattr(node, 'id'):
                        # id가 없는 경우 name으로 중복 체크
                        node_name = node.get('name') if isinstance(node, dict) else getattr(node, 'name', None)
                        if node_name and node_name not in [n.get('name') if isinstance(n, dict) else getattr(n, 'name', None) for n in unique_related]:
                            unique_related.append(node)
                
                # start_nodes에서 related_nodes 제외
                start_node_names = set()
                for node in start_nodes:
                    if isinstance(node, dict):
                        start_node_names.add(node.get('name'))
                    elif hasattr(node, 'name'):
                        start_node_names.add(node.name)
                
                final_related = []
                for node in unique_related:
                    node_name = node.get('name') if isinstance(node, dict) else getattr(node, 'name', None)
                    if node_name not in start_node_names:
                        final_related.append(node)
                
                # 관계 중복 제거
                unique_relationships = []
                seen_rels = set()
                
                for rel in all_relationships:
                    if rel:
                        # 관계의 고유 식별자 생성
                        if hasattr(rel, 'id'):
                            rel_id = rel.id
                        elif hasattr(rel, 'start_node') and hasattr(rel, 'end_node'):
                            rel_id = f"{rel.start_node.id}-{rel.type}-{rel.end_node.id}"
                        else:
                            continue
                        
                        if rel_id not in seen_rels:
                            seen_rels.add(rel_id)
                            unique_relationships.append(rel)
                
                # 결과 로깅
                logging.info("Neo4j 스키마 조회 결과: 시작노드=%d개, 관련노드=%d개, 관계=%d개", 
                            len(start_nodes), len(final_related), len(unique_relationships))
                
                # description 정보 로깅 (디버깅용)
                for node in start_nodes[:3]:  # 처음 3개만 샘플로
                    node_name = node.get('name') if isinstance(node, dict) else getattr(node, 'name', None)
                    descriptions = node.get('descriptions', []) if isinstance(node, dict) else getattr(node, 'descriptions', [])
                    valid_descs = [d for d in descriptions if d.get('description') and d['description'].strip()]
                    logging.debug(f"노드 '{node_name}': descriptions={len(descriptions)}개, 유효={len(valid_descs)}개")
                
                return {
                    "nodes": start_nodes,
                    "relatedNodes": final_related,
                    "relationships": unique_relationships
                }
                
        except Exception as e:
            logging.error("❌ Neo4j 스키마 조회 오류: %s", str(e))
            import traceback
            logging.error("스택 트레이스: %s", traceback.format_exc())
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
            source_id: 찾을 source_id (파일 ID)
            brain_id: 브레인 ID
            
        Returns:
            List[str]: 해당 source_id를 가진 노드들의 이름 목록
        """
        try:
            # 1단계: 특정 brain_id의 모든 노드를 Neo4j에서 조회
            # Neo4j의 CONTAINS 연산자는 JSON 문자열 내부 검색에 한계가 있어서
            # 모든 노드를 가져온 후 Python에서 JSON 파싱으로 필터링하는 방식 사용
            query = """
            MATCH (n:Node {brain_id: $brain_id})
            RETURN n.name as name, n.descriptions as descriptions
            """
            result = self._execute_with_retry(query, {"brain_id": brain_id})
            
            # 2단계: Python에서 각 노드의 descriptions를 검사하여 source_id 매칭
            node_names = []
            for record in result:
                node_name = record["name"]
                descriptions = record["descriptions"]
                
                # descriptions가 비어있으면 건너뛰기
                if not descriptions:
                    continue
                    
                # 3단계: 각 description을 JSON으로 파싱하여 source_id 확인
                for desc in descriptions:
                    try:
                        # description이 문자열인 경우 JSON 파싱, 이미 객체인 경우 그대로 사용
                        if isinstance(desc, str):
                            desc_obj = json.loads(desc)
                        else:
                            desc_obj = desc
                            
                        # 4단계: source_id가 일치하는지 확인
                        # 정확한 매칭을 위해 타입 변환 없이 직접 비교
                        if desc_obj.get("source_id") == source_id:
                            node_names.append(node_name)
                            break  # 이 노드에서 source_id를 찾았으므로 다음 노드로 이동
                            
                    except (json.JSONDecodeError, TypeError):
                        # 5단계: JSON 파싱 실패 시 대안으로 문자열 검색 사용
                        # Neo4j에 저장된 데이터 형식이 예상과 다를 경우를 대비
                        if str(source_id) in str(desc):
                            node_names.append(node_name)
                            break
                            
            return node_names
            
        except Exception as e:
            logging.error(f"source_id로 노드 조회 실패: {str(e)}")
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

    def get_node_descriptions(self, node_name: str, brain_id: str) -> List[Dict]:
        """
        특정 노드의 descriptions 필드를 조회해서 JSON 파싱 후 반환.
        Returns: [{ 'description': str, 'source_id': int }, ...]
        """
        query = """
        MATCH (n:Node {name: $node_name, brain_id: $brain_id})
        RETURN n.descriptions AS descriptions
        """
        rows = self._execute_with_retry(query, {"node_name": node_name, "brain_id": brain_id})
        if not rows or not rows[0].get("descriptions"):
            return []

        descriptions = []
        for raw in rows[0]["descriptions"]:
            try:
                desc = json.loads(raw) if isinstance(raw, str) else raw
            except json.JSONDecodeError:
                logging.warning(f"[Neo4j] JSON decode error for desc: {raw}")
                continue
            descriptions.append(desc)
        return descriptions
       
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
    
    def get_original_sentences(
    self,
        node_name: str,
        source_id: str,
        brain_id: str
    ) -> List[Dict]:
        """
        특정 노드의 original_sentences 배열을 조회하고,
        source_id가 일치하는 항목들만 파싱해서 반환합니다.
        중복 문장과 score 필드는 제거됩니다.
        """
        try:
            query = """
            MATCH (n:Node {name: $node_name, brain_id: $brain_id})
            RETURN n.original_sentences AS originals
            """
            rows = self._execute_with_retry(
                query,
                {"node_name": node_name, "brain_id": brain_id}
            )
            if not rows or not rows[0].get("originals"):
                return []

            raw_list = rows[0]["originals"]
            results: List[Dict] = []
            seen = set()

            for raw in raw_list:
                # JSON 문자열이면 파싱
                try:
                    item = json.loads(raw) if isinstance(raw, str) else raw
                except json.JSONDecodeError:
                    logging.warning(f"[Neo4j] original_sentences JSON 파싱 실패: {raw}")
                    continue

                # source_id 필터링
                if str(item.get("source_id")) != str(source_id):
                    continue

                # 중복 제거
                orig = item.get("original_sentence")
                if orig in seen:
                    continue
                seen.add(orig)

                # score 제거
                item.pop("score", None)

                results.append(item)

            return results

        except Exception as e:
            logging.error(f"❌ original_sentences 조회 실패: {e}")
            raise Neo4jException(f"original_sentences 조회 실패: {e}")
    def __del__(self):
        self.close()