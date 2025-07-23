import { api } from './api';

// 특정 소스 ID로부터 생성된 노드 목록 조회
export const getNodesBySourceId = (sourceId, brainId) =>
    api.get(`/brainGraph/getNodesBySourceId`, {
        params: { source_id: sourceId, brain_id: brainId }
    }).then(r => r.data);

// 특정 노드 이름과 관련된 소스 ID 목록 조회
export const getSourceIdsByNodeName = (nodeName, brainId) =>
    api.get(`/brainGraph/getSourceIds`, {
        params: { node_name: nodeName, brain_id: brainId }
    }).then(r => r.data);

// 유사 설명 기반으로 관련 소스 ID 목록 검색
export const getSimilarSourceIds = (query, brainId) =>
    api.post('/search/getSimilarSourceIds', {
        query: query,
        brain_id: String(brainId)
    }).then(res => res.data); 