
"""
Neo4j 결과 → ForceGraph 포맷 변환 유틸
-----------------------------------

이 함수는 Neo4j 질의 결과(dict 형식)를 **ForceGraph(d3-force-graph 등)** 시각화 라이브러리가
바로 사용할 수 있는 `{"nodes": [...], "links": [...]}` 구조로 변환합니다.

입력(neo4j_result) 기대 구조:
- neo4j_result["nodes"]:        메인 노드 리스트 (각 원소는 dict-유사 객체, `.items()`로 속성 접근)
- neo4j_result["relatedNodes"]: 연관 노드 리스트 (선택)
- neo4j_result["relationships"]: 관계 리스트
  - 각 관계 `rel`은 다음을 가정
    - `rel.start_node.items()` → 소스 노드 속성 dict (여기서 `"name"`을 사용)
    - `rel.end_node.items()`   → 타겟 노드 속성 dict (여기서 `"name"`을 사용)
    - 관계 라벨은 `dict(rel).get("relation")` 또는 `getattr(rel, "type", "관계")`로 추출

출력(ForceGraph 포맷):
{
  "nodes": [
    {"id": "<name>", "label": "<label>", "group": "<label>"},
    ...
  ],
  "links": [
    {"source": "<source_name>", "target": "<target_name>", "label": "<relation>"},
    ...
  ]
}

처리 규칙:
- 노드:
  - `nodes` + `relatedNodes` 를 합쳐 순회.
  - 각 노드의 속성에서 `"name"`(필수), `"label"`을 추출.
  - ForceGraph 노드의 `id` = `name`, `group` = `label`.
  - 동일한 `name`이 여러 번 나오면 **마지막 항목으로 덮어씀**(중복 제거 용도).
- 링크:
  - `start_node.name` → `source`, `end_node.name` → `target`.
  - 관계 라벨은 `relation` 속성(있으면) 또는 관계 타입명 사용.

복잡도:
- 시간: O(N + E) (N=노드 수, E=관계 수)
- 공간: O(N + E)

주의/안내:
- **고유 식별자**로 `name`을 사용하므로, 서로 다른 노드가 같은 name을 가지면 덮어쓰여 의도치 않게 합쳐질 수 있음.
  - 실무에서는 DB의 내부 ID(예: Neo4j 내부 id)나 명시적 UUID를 `id`로 사용하는 것을 권장.
- 입력 노드에 `"name"`이 없으면 빈 문자열로 처리되어 시각화에서 충돌 가능.
- 관계에서 `dict(rel)` 변환이 라이브러리/버전에 따라 동작하지 않을 수 있음(py2neo/neo4j-driver 차이).
  - 안전성을 높이려면 관계 라벨 추출을 드라이버별로 분기 처리하는 것이 좋음.
- 링크/노드의 추가 메타데이터(payload)가 필요하면, 이 함수에서 필드를 확장해 전달하세요.

개선 팁(선택):
- `id`를 `name` 대신 내부 ID/UUID로 사용하고, `name`은 별도 필드로 보관.
- 노드/링크에 weight, count 등 시각화용 수치 속성 추가.
- `None`/결측 필드 방어 로직 강화 및 로깅 체계화.
"""

def convert_neo4j_to_forcegraph(neo4j_result: dict) -> dict:
    """Neo4j 결과를 ForceGraph 시각화용 { nodes, links } 형식으로 변환"""
    # 노드 추출
    all_nodes = neo4j_result.get("nodes", []) + neo4j_result.get("relatedNodes", [])
    node_map = {}

    for node in all_nodes:
        if node is None:
            continue
        props = dict(node.items())
        name = props.get("name", "")
        label = props.get("label", "")
        node_map[name] = {
            "id": name,
            "label": label,
            "group": label
        }

    # 링크 추출
    relationships = neo4j_result.get("relationships", [])
    links = []
    for rel in relationships:
        try:
            source = dict(rel.start_node.items()).get("name", "")
            target = dict(rel.end_node.items()).get("name", "")
            relation = dict(rel).get("relation", getattr(rel, "type", "관계"))
            links.append({
                "source": source,
                "target": target,
                "label": relation
            })
        except Exception as e:
            print(f"❌ 관계 처리 오류: {e}")

    return {
        "nodes": list(node_map.values()),
        "links": links
    }
