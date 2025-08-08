/**
 * graphApi.js - 그래프 데이터 및 지식 그래프 관리 API
 *
 * 기능:
 * - 그래프 데이터 조회 및 정규화
 * - 노드 및 소스 관련 API
 * - 텍스트 처리 및 AI 관련 API
 * - 데이터 관리 API
 *
 * API 엔드포인트:
 * - GET /brainGraph/getNodeEdge/{brainId} - 그래프 데이터 조회
 * - GET /brainGraph/getNodesBySourceId - 소스별 노드 조회
 * - GET /brainGraph/getSourceIds - 노드별 소스 조회
 * - POST /search/getSimilarSourceIds - 유사 소스 검색
 * - POST /brainGraph/process_text - 텍스트 처리
 * - POST /brainGraph/answer - AI 답변 요청
 * - DELETE /brains/{brainId}/deleteDB/{sourceId} - DB 삭제
 * - GET /brainGraph/getSourceDataMetrics/{brainId} - 소스 메트릭 조회
 * - GET /brainGraph/sourceCount/{brain_id} - 소스 개수 조회
 *
 * 사용법:
 * import { fetchGraphData, getNodesBySourceId, processText } from './services/graphApi';
 *
 * // 그래프 데이터 조회
 * const graphData = await fetchGraphData(brainId);
 *
 * // 소스별 노드 조회
 * const nodes = await getNodesBySourceId(sourceId, brainId);
 */

import { api } from '../config/axiosConfig';

// === 그래프 데이터 관련 API ===

/**
 * 브레인별 그래프 데이터 조회 및 정규화
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Object>} 정규화된 그래프 데이터 { nodes: [...], links: [...] }
 */
export const fetchGraphData = async (brainId) => {
  try {
    const response = await api.get(`/brainGraph/getNodeEdge/${brainId}`);

    // 응답 데이터 정규화
    const normalizedData = normalizeGraphData(response.data);
    return normalizedData;
  } catch (error) {
    console.error('그래프 데이터 가져오기 실패:', error);

    // 더미 데이터로 폴백
    return getDefaultGraphData();
  }
};

/**
 * 그래프 데이터 정규화 함수
 * 다양한 API 응답 구조를 일관된 형태로 변환
 * @param {Object} data - 원본 그래프 데이터
 * @returns {Object} 정규화된 그래프 데이터
 */
function normalizeGraphData(data) {
  if (!data || typeof data !== 'object') {
    console.log('데이터가 없거나, 객체가 아닙니다.');
    return getDefaultGraphData();
  }

  try {
    // 노드와 링크 데이터 추출 (다양한 API 응답 구조 처리)
    let nodes = [];
    let links = [];

    // 다양한 API 응답 구조 처리
    if (Array.isArray(data)) {
      // API가 배열을 반환한 경우 (일부 Neo4j API)
      nodes = data.filter((item) => item.type === 'node' || !item.source);
      links = data.filter(
        (item) => item.type === 'link' || (item.source && item.target)
      );
    } else if (data.nodes || data.vertices) {
      // 일반적인 그래프 형식 (nodes/links 또는 vertices/edges)
      nodes = data.nodes || data.vertices || [];
      links = data.links || data.edges || [];
    } else if (data.results && Array.isArray(data.results)) {
      // Neo4j Cypher 쿼리 결과 형식
      nodes = [];
      links = [];
      data.results.forEach((result) => {
        if (result.nodes) nodes = nodes.concat(result.nodes);
        if (result.relationships) links = links.concat(result.relationships);
      });
    }

    // 노드와 링크 데이터가 있는지 확인
    const hasNodes = Array.isArray(nodes) && nodes.length > 0;

    if (!hasNodes) {
      console.log('노드 데이터가 없거나 배열이 아닙니다.');
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
      const nodeId =
        node.id ||
        node.nodeId ||
        node._id ||
        node.name ||
        node.label ||
        `node-${index}`;
      return {
        ...node,
        id: nodeId,
        name: node.name || node.label || node.title || nodeId,
        group: node.group || node.category || node.type || 1,
      };
    });

    // 링크 데이터 정규화
    let normalizedLinks = [];
    if (Array.isArray(links) && links.length > 0) {
      normalizedLinks = links
        .map((link, index) => {
          // 소스와 타겟 ID 추출
          let source = link.source;
          let target = link.target;

          // 소스가 객체인 경우 ID 추출
          if (typeof source === 'object' && source !== null) {
            source =
              source.id ||
              source._id ||
              source.nodeId ||
              source.name ||
              `source-${index}`;
          }

          // 타겟이 객체인 경우 ID 추출
          if (typeof target === 'object' && target !== null) {
            target =
              target.id ||
              target._id ||
              target.nodeId ||
              target.name ||
              `target-${index}`;
          }

          // 소스와 타겟이 노드 배열에 존재하는지 확인
          const sourceExists = normalizedNodes.some((n) => n.id === source);
          const targetExists = normalizedNodes.some((n) => n.id === target);

          // 존재하지 않는 노드는 사용하지 않음
          if (!sourceExists || !targetExists) {
            console.log(
              `링크 무시: 소스(${source}) 또는 타겟(${target})이 존재하지 않음`
            );
            return null;
          }

          return {
            ...link,
            source,
            target,
            relation:
              link.relation || link.label || link.type || link.name || '연결',
          };
        })
        .filter((link) => link !== null);
    }

    return {
      nodes: normalizedNodes,
      links: normalizedLinks,
    };
  } catch (error) {
    console.error('그래프 데이터 정규화 오류:', error);
    return getDefaultGraphData();
  }
}

/**
 * 기본 그래프 데이터 (API 실패 또는 데이터 없음 시)
 * @returns {Object} 기본 그래프 데이터
 */
function getDefaultGraphData() {
  return {
    nodes: [
      { id: 'main', name: '메인 노드', group: 1 },
      { id: 'node1', name: '노드 1', group: 2 },
      { id: 'node2', name: '노드 2', group: 2 },
    ],
    links: [
      { source: 'main', target: 'node1', relation: '관계 1' },
      { source: 'main', target: 'node2', relation: '관계 2' },
    ],
  };
}

// === 노드 및 소스 관련 API ===

/**
 * 특정 소스 ID로부터 생성된 노드 목록 조회
 * @param {string|number} sourceId - 소스 ID
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Array>} 노드 목록
 */
export const getNodesBySourceId = (sourceId, brainId) =>
  api
    .get(`/brainGraph/getNodesBySourceId`, {
      params: { source_id: sourceId, brain_id: brainId },
    })
    .then((r) => r.data)
    .catch((error) => {
      console.error(
        `소스별 노드 조회 실패 (소스 ID: ${sourceId}, 브레인 ID: ${brainId}):`,
        error
      );
      throw error;
    });

/**
 * 특정 노드 이름과 관련된 소스 ID 목록 조회
 * @param {string} nodeName - 노드 이름
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Array>} 소스 ID 목록
 */
export const getSourceIdsByNodeName = (nodeName, brainId) =>
  api
    .get(`/brainGraph/getSourceIds`, {
      params: { node_name: nodeName, brain_id: brainId },
    })
    .then((r) => r.data)
    .catch((error) => {
      console.error(
        `노드별 소스 조회 실패 (노드: ${nodeName}, 브레인 ID: ${brainId}):`,
        error
      );
      throw error;
    });

/**
 * 유사 설명 기반으로 관련 소스 ID 목록 검색
 * @param {string} query - 검색 쿼리
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Array>} 유사 소스 ID 목록
 */
export const getSimilarSourceIds = (query, brainId) =>
  api
    .post('/search/getSimilarSourceIds', {
      query: query,
      brain_id: String(brainId),
    })
    .then((res) => res.data)
    .catch((error) => {
      console.error(
        `유사 소스 검색 실패 (쿼리: ${query}, 브레인 ID: ${brainId}):`,
        error
      );
      throw error;
    });

// === 텍스트 처리 및 AI 관련 API ===

/**
 * 텍스트 처리 (AI 모델을 통한 분석)
 * @param {string} text - 처리할 텍스트
 * @param {string|number} sourceId - 소스 ID
 * @param {string|number} brainId - 브레인 ID
 * @param {string} model - 사용할 모델 (기본값: "gpt")
 * @returns {Promise<Object>} 처리 결과
 */
export const processText = async (text, sourceId, brainId, model = 'gpt') => {
  try {
    const response = await api.post('/brainGraph/process_text', {
      text,
      source_id: sourceId,
      brain_id: brainId,
      model: model,
    });
    //asdf
    return response.data;
  } catch (error) {
    console.error('텍스트 처리 실패:', error);
    throw error;
  }
};

/**
 * AI 답변 요청
 * @param {string} question - 질문
 * @param {string|number} session_id - 세션 ID
 * @param {string|number} brain_id - 브레인 ID
 * @param {string} model - 사용할 모델
 * @param {string} model_name - 모델 이름
 * @returns {Promise<Object>} AI 답변
 */
export const requestAnswer = async (
  question,
  session_id,
  brain_id,
  model,
  model_name
) => {
  try {
    const response = await api.post(`/brainGraph/answer`, {
      question: question,
      session_id: session_id,
      brain_id: brain_id,
      model: model,
      model_name: model_name,
    });
    return response.data;
  } catch (error) {
    console.error('Answer 요청 중 에러 발생:', error);
    throw error;
  }
};

// === 데이터 관리 API ===

/**
 * 벡터 DB 또는 그래프 DB 삭제
 * @param {string|number} brainId - 브레인 ID
 * @param {string|number} sourceId - 소스 ID
 * @returns {Promise<Object>} 삭제 결과
 */
export const deleteDB = async (brainId, sourceId) => {
  try {
    const response = await api.delete(
      `/brains/${brainId}/deleteDB/${sourceId}`
    );
    return response.data;
  } catch (error) {
    console.error('벡터 DB or 그래프 DB 삭제 실패:', error);
    throw error;
  }
};

/**
 * 소스별 데이터 메트릭 조회
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<Object>} 소스 메트릭 정보
 */
export const getSourceDataMetrics = async (brainId) => {
  try {
    const response = await api.get(
      `/brainGraph/getSourceDataMetrics/${brainId}`
    );
    return response.data;
  } catch (error) {
    console.error('소스 데이터 메트릭 조회 실패:', error);
    throw error;
  }
};

/**
 * 해당 brain의 모든 소스 개수 조회
 * @param {string|number} brain_id - 브레인 ID
 * @returns {Promise<number>} 소스 개수
 */
export const getSourceCountByBrain = (brain_id) =>
  api
    .get(`/brainGraph/sourceCount/${brain_id}`)
    .then((r) => r.data)
    .catch((error) => {
      console.error(`소스 개수 조회 실패 (브레인 ID: ${brain_id}):`, error);
      throw error;
    });
