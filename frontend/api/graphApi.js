// src/api/graphApi.js
import { api } from '../api/api';

export const fetchGraphData = async (brainId) => {
  try {
    const response = await api.get(`/brainGraph/getNodeEdge/${brainId}`);

    // API 응답 데이터 로깅
    console.log('API 응답 데이터:', response.data);

    // 응답 데이터 정규화
    const normalizedData = normalizeGraphData(response.data);
    return normalizedData;
  } catch (error) {
    console.error('그래프 데이터 가져오기 실패:', error);

    // 더미 데이터로 폴백
    return getDefaultGraphData();
  }
};

// 그래프 데이터 정규화 함수
function normalizeGraphData(data) {
  if (!data || typeof data !== 'object') {
    console.log("데이터가 없거나, 객체가 아닙니다.");
    return getDefaultGraphData();
  }

  try {
    // 노드와 링크 데이터 추출 (다양한 API 응답 구조 처리)
    let nodes = [];
    let links = [];

    // 다양한 API 응답 구조 처리
    if (Array.isArray(data)) {
      // API가 배열을 반환한 경우 (일부 Neo4j API)
      nodes = data.filter(item => item.type === 'node' || !item.source);
      links = data.filter(item => item.type === 'link' || (item.source && item.target));
    } else if (data.nodes || data.vertices) {
      // 일반적인 그래프 형식 (nodes/links 또는 vertices/edges)
      nodes = data.nodes || data.vertices || [];
      links = data.links || data.edges || [];
    } else if (data.results && Array.isArray(data.results)) {
      // Neo4j Cypher 쿼리 결과 형식
      nodes = [];
      links = [];
      data.results.forEach(result => {
        if (result.nodes) nodes = nodes.concat(result.nodes);
        if (result.relationships) links = links.concat(result.relationships);
      });
    }

    // 노드와 링크 데이터가 있는지 확인
    const hasNodes = Array.isArray(nodes) && nodes.length > 0;

    if (!hasNodes) {
      console.log("노드 데이터가 없거나 배열이 아닙니다.");
      return getDefaultGraphData();
    }

    // 노드 데이터 정규화
    const normalizedNodes = nodes.map((node, index) => {
      // 문자열이나 객체가 아닌 경우 처리
      if (typeof node !== 'object' && typeof node !== 'string') {
        return { id: `node-${index}`, name: `노드 ${index}` };
      }

      // 문자열인 경우 (노드 ID만 제공된 경우)
      if (typeof node === 'string') {
        return { id: node, name: node };
      }

      // id가 없는 경우 생성
      const nodeId = node.id || node.nodeId || node._id || node.name || node.label || `node-${index}`;
      return {
        ...node,
        id: nodeId,
        name: node.name || node.label || node.title || nodeId,
        group: node.group || node.category || node.type || 1
      };
    });

    // 링크 데이터 정규화
    let normalizedLinks = [];
    if (Array.isArray(links) && links.length > 0) {
      normalizedLinks = links.map((link, index) => {
        // 소스와 타겟 ID 추출
        let source = link.source;
        let target = link.target;

        // 소스가 객체인 경우 ID 추출
        if (typeof source === 'object' && source !== null) {
          source = source.id || source._id || source.nodeId || source.name || `source-${index}`;
        }

        // 타겟이 객체인 경우 ID 추출
        if (typeof target === 'object' && target !== null) {
          target = target.id || target._id || target.nodeId || target.name || `target-${index}`;
        }

        // 소스와 타겟이 노드 배열에 존재하는지 확인
        const sourceExists = normalizedNodes.some(n => n.id === source);
        const targetExists = normalizedNodes.some(n => n.id === target);

        // 존재하지 않는 노드는 사용하지 않음
        if (!sourceExists || !targetExists) {
          console.log(`링크 무시: 소스(${source}) 또는 타겟(${target})이 존재하지 않음`);
          return null;
        }

        return {
          ...link,
          source,
          target,
          relation: link.relation || link.label || link.type || link.name || '연결'
        };
      }).filter(link => link !== null);
    }

    return {
      nodes: normalizedNodes,
      links: normalizedLinks
    };
  } catch (error) {
    console.error("그래프 데이터 정규화 오류:", error);
    return getDefaultGraphData();
  }
}

// 기본 그래프 데이터 (API 실패 또는 데이터 없음 시)
function getDefaultGraphData() {
  return {
    nodes: [
      { id: 'main', name: '메인 노드', group: 1 },
      { id: 'node1', name: '노드 1', group: 2 },
      { id: 'node2', name: '노드 2', group: 2 }
    ],
    links: [
      { source: 'main', target: 'node1', relation: '관계 1' },
      { source: 'main', target: 'node2', relation: '관계 2' }
    ]
  };
}

export const processText = async (text, sourceId, brainId) => {
  try {
    const response = await api.post(
      '/brainGraph/process_text',
      {
        text,
        source_id: sourceId,
        brain_id: brainId
      }
    );
    return response.data;
  } catch (error) {
    console.error('텍스트 처리 실패:', error);
    throw error;
  }
};

export const getAnswer = async (question, brainId) => {
  try {
    const response = await api.post('/brainGraph/answer', {
      question,
      brain_id: brainId
    });
    return response.data;
  } catch (error) {
    console.error('질문 답변 실패:', error);
    throw error;
  }
};

export const deleteDB = async (brainId, sourceId) => {
  try {
    const response = await api.delete(`/brains/${brainId}/deleteDB/${sourceId}`);
    return response.data;
  } catch (error) {
    console.error('벡터 DB or 그래프 DB 삭제 실패:', error);
    throw error;
  }
};