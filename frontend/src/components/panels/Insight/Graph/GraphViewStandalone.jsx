/*
 GraphViewStandalone.jsx

 독립 실행(Standalone) 전체화면 그래프 보기 페이지 컴포넌트

 주요 기능:
 1. URL 쿼리 파라미터를 통해 초기 하이라이트 노드 지정
 2. 메인 창과 localStorage 및 postMessage로 상태 동기화
 3. 새로고침/하이라이트 해제 액션을 양방향으로 브로드캐스트
 4. 그래프 통계 변화(노드/링크 수)를 메인 창에 신호로 전달

 상호작용:
 - localStorage 키(graphStateSync, standaloneGraphUpdate)를 통해 메시지 교환
 - postMessage(백업 채널)로 상태 업데이트 수신
 - 창 종료 시 정리 작업 수행(beforeunload)
*/
import React, { useState, useCallback, useEffect } from "react";
import GraphViewForFullscreen from "./GraphViewForFullscreen";
import SpaceBackground from "./SpaceBackground";
import "./SpaceBackground.css";

// ===== 상수 정의 =====

/**
 * LocalStorage 키 상수
 */
const STORAGE_KEYS = {
  GRAPH_STATE_SYNC: "graphStateSync",
  STANDALONE_GRAPH_UPDATE: "standaloneGraphUpdate",
};

/**
 * URL 쿼리 파라미터 키
 */
const URL_PARAMS = {
  BRAIN_ID: "brainId",
  REFERENCED_NODES: "referencedNodes",
};

/**
 * 그래프 상태 동기화 액션 타입
 */
const SYNC_ACTIONS = {
  REFRESH: "refresh",
  REFRESH_FROM_STANDALONE: "refresh_from_standalone",
  MEMO_UPDATE: "memo_update",
  SOURCE_ADDED: "source_added",
  CLEAR_HIGHLIGHTS: "clear_highlights",
  CLEAR_HIGHLIGHTS_FROM_STANDALONE: "clear_highlights_from_standalone",
};

/**
 * PostMessage 메시지 타입
 */
const MESSAGE_TYPES = {
  GRAPH_STATE_UPDATE: "GRAPH_STATE_UPDATE",
};

/**
 * 기본값 상수
 */
const DEFAULTS = {
  BRAIN_ID: "default-brain-id",
};

// ===== 유틸리티 함수 =====

/**
 * localStorage에 JSON 데이터를 안전하게 저장
 *
 * @param {string} key - localStorage 키
 * @param {any} value - 저장할 값 (자동으로 JSON 직렬화됨)
 * @returns {boolean} 성공 여부
 */
const setStorageItem = (key, value) => {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error(`❌ localStorage 저장 실패 (${key}):`, error);
    return false;
  }
};

/**
 * localStorage에서 JSON 데이터를 안전하게 읽기
 *
 * @param {string} key - localStorage 키
 * @returns {any|null} 파싱된 값 (실패 시 null)
 */
const getStorageItem = (key) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`❌ localStorage 읽기 실패 (${key}):`, error);
    return null;
  }
};

/**
 * localStorage에서 항목을 안전하게 제거
 *
 * @param {string} key - localStorage 키
 * @returns {boolean} 성공 여부
 */
const removeStorageItem = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`❌ localStorage 삭제 실패 (${key}):`, error);
    return false;
  }
};

/**
 * 그래프 상태 동기화 메시지를 메인 창에 전송
 *
 * @param {string} brainId - 브레인 ID
 * @param {string} action - 동기화 액션 (SYNC_ACTIONS 상수 사용)
 * @param {Object} additionalData - 추가 데이터 (선택사항)
 */
const sendSyncMessage = (brainId, action, additionalData = {}) => {
  const message = {
    brainId,
    timestamp: Date.now(),
    action,
    ...additionalData,
  };
  return setStorageItem(STORAGE_KEYS.GRAPH_STATE_SYNC, message);
};

/**
 * 그래프 업데이트 통계를 메인 창에 전송
 *
 * @param {string} brainId - 브레인 ID
 * @param {number} nodeCount - 노드 개수
 * @param {number} linkCount - 링크 개수
 */
const sendGraphUpdate = (brainId, nodeCount, linkCount) => {
  const update = {
    brainId,
    nodeCount,
    linkCount,
    timestamp: Date.now(),
  };
  return setStorageItem(STORAGE_KEYS.STANDALONE_GRAPH_UPDATE, update);
};

/**
 * URL 쿼리 파라미터를 안전하게 파싱
 *
 * @param {URLSearchParams} searchParams - URL 검색 파라미터 객체
 * @param {string} key - 파라미터 키
 * @param {any} defaultValue - 기본값 (파싱 실패 시)
 * @returns {any} 파싱된 값 또는 기본값
 */
const parseUrlParam = (searchParams, key, defaultValue = null) => {
  const param = searchParams.get(key);
  if (!param) return defaultValue;

  try {
    // URL 디코딩 후 JSON 파싱 시도
    const decoded = decodeURIComponent(param);
    return JSON.parse(decoded);
  } catch (error) {
    console.warn(`⚠️ URL 파라미터 파싱 실패 (${key}):`, error);
    return defaultValue;
  }
};

/**
 * URL에서 브레인 ID를 안전하게 추출
 *
 * @param {URLSearchParams} searchParams - URL 검색 파라미터 객체
 * @returns {string} 브레인 ID (없으면 기본값)
 */
const getBrainIdFromUrl = (searchParams) => {
  const brainId = searchParams.get(URL_PARAMS.BRAIN_ID);
  return brainId && brainId.trim() ? brainId.trim() : DEFAULTS.BRAIN_ID;
};

/**
 * URL에서 참조된 노드 배열을 안전하게 추출
 *
 * @param {URLSearchParams} searchParams - URL 검색 파라미터 객체
 * @returns {string[]} 노드 이름 배열 (파싱 실패 시 빈 배열)
 */
const getReferencedNodesFromUrl = (searchParams) => {
  const nodes = parseUrlParam(searchParams, URL_PARAMS.REFERENCED_NODES, []);

  // 배열이 아니면 빈 배열 반환
  if (!Array.isArray(nodes)) {
    console.warn("⚠️ referencedNodes가 배열이 아닙니다:", nodes);
    return [];
  }

  // 문자열 배열인지 검증
  const validNodes = nodes.filter((node) => typeof node === "string");
  if (validNodes.length !== nodes.length) {
    console.warn("⚠️ 일부 노드가 문자열이 아닙니다. 필터링됨");
  }

  return validNodes;
};

/**
 * Standalone 전체화면 그래프 뷰
 *
 * 특징:
 * - 메인 앱 외부에서 독립 실행되어 그래프를 전체화면으로 표시
 * - 메인 창과 동기화하여 하이라이트/포커스/새로고침 등을 반영
 *
 * 반환:
 * - 전체화면 컨테이너 내부에 `GraphViewForFullscreen`을 포함
 */
function GraphViewStandalone() {
  const searchParams = new URLSearchParams(window.location.search);
  const brainId = getBrainIdFromUrl(searchParams);

  // ===== 상태 관리 =====
  // MainLayout과 동일한 상태 구조 유지
  const [referencedNodes, setReferencedNodes] = useState([]);
  const [focusNodeNames, setFocusNodeNames] = useState([]);
  const [graphRefreshTrigger, setGraphRefreshTrigger] = useState(0);

  // ===== 핸들러/콜백 =====
  /**
   * 그래프 데이터 업데이트 처리
   *
   * @param {Object} graphData - 그래프 데이터
   * @param {Array} graphData.nodes - 노드 배열
   * @param {Array} graphData.links - 링크 배열
   *
   * 동작:
   * - 스탠드얼론 창에서 그래프 통계를 메인 창으로 브로드캐스트
   */
  const handleGraphDataUpdate = useCallback(
    (graphData) => {
      console.log("📊 Standalone Graph data updated:", graphData);

      // 메인 창에 그래프 업데이트 알림
      sendGraphUpdate(
        brainId,
        graphData?.nodes?.length || 0,
        graphData?.links?.length || 0
      );
    },
    [brainId]
  );

  /**
   * 그래프 새로고침
   *
   * 동작:
   * - 내부 트리거 증가로 GraphView에 새로고침 유도
   * - 메인 창에 새로고침 요청 신호를 브로드캐스트
   */
  const handleRefresh = useCallback(() => {
    console.log("🔄 Standalone에서 새로고침 실행");
    setGraphRefreshTrigger((prev) => prev + 1);

    // 메인 창에 새로고침 알림
    sendSyncMessage(brainId, SYNC_ACTIONS.REFRESH_FROM_STANDALONE);
  }, [brainId]);

  /**
   * 하이라이트/포커스 해제
   *
   * 동작:
   * - 로컬 상태 초기화
   * - 메인 창에 하이라이트 해제 신호 브로드캐스트
   */
  const handleClearHighlights = useCallback(() => {
    console.log("🧹 Standalone에서 하이라이트 해제");
    setReferencedNodes([]);
    setFocusNodeNames([]);

    // 메인 창에 해제 알림
    sendSyncMessage(brainId, SYNC_ACTIONS.CLEAR_HIGHLIGHTS_FROM_STANDALONE);
  }, [brainId]);

  // ===== 이펙트 =====
  // 컴포넌트 마운트 시 URL에서 참고된 노드 정보 읽기
  useEffect(() => {
    const urlReferencedNodes = getReferencedNodesFromUrl(searchParams);
    if (urlReferencedNodes.length > 0) {
      console.log("🎯 URL에서 참고된 노드 로드:", urlReferencedNodes);
      setReferencedNodes(urlReferencedNodes);
    }
  }, []);

  // 메인 창과의 실시간 동기화를 위한 localStorage 이벤트 리스너
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEYS.GRAPH_STATE_SYNC && e.newValue) {
        const data = getStorageItem(STORAGE_KEYS.GRAPH_STATE_SYNC);
        if (data && data.brainId === brainId) {
          console.log("📡 메인 창에서 상태 변화 감지:", data);

          // 참고된 노드 업데이트 (채팅에서)
          if (data.referencedNodes && Array.isArray(data.referencedNodes)) {
            console.log(
              "💬 채팅에서 참고된 노드 업데이트:",
              data.referencedNodes
            );
            setReferencedNodes(data.referencedNodes);
            setFocusNodeNames([]); // 포커스 노드 초기화
          }

          // 포커스 노드 업데이트 (소스패널 노드보기에서)
          if (data.focusNodeNames && Array.isArray(data.focusNodeNames)) {
            console.log(
              "📂 소스패널에서 포커스 노드 업데이트:",
              data.focusNodeNames
            );
            setFocusNodeNames(data.focusNodeNames);
            setReferencedNodes(data.focusNodeNames); // 포커스된 노드를 하이라이트로도 표시
            // setGraphRefreshTrigger(prev => prev + 1); //추가?
          }

          // 그래프 새로고침 (소스 추가/메모 업데이트 등)
          if (data.action === SYNC_ACTIONS.REFRESH) {
            console.log("🔄 메인 창에서 그래프 새로고침 요청");
            setGraphRefreshTrigger((prev) => prev + 1);
          }

          // 메모 추가/업데이트 감지
          if (data.action === SYNC_ACTIONS.MEMO_UPDATE) {
            console.log("📝 메모 업데이트로 인한 그래프 새로고침");
            setGraphRefreshTrigger((prev) => prev + 1);
          }

          // 소스 파일 추가 감지
          if (data.action === SYNC_ACTIONS.SOURCE_ADDED) {
            console.log("📄 소스 파일 추가로 인한 그래프 새로고침");
            setGraphRefreshTrigger((prev) => prev + 1);
          }

          // 하이라이트 해제
          if (data.action === SYNC_ACTIONS.CLEAR_HIGHLIGHTS) {
            console.log("🧹 하이라이트 해제");
            setReferencedNodes([]);
            setFocusNodeNames([]);
          }
        }
      }
    };

    console.log("👂 Storage 이벤트 리스너 등록");
    window.addEventListener("storage", handleStorageChange);

    return () => {
      console.log("🔇 Storage 이벤트 리스너 해제");
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [brainId]);

  // PostMessage 통신 (백업용)
  useEffect(() => {
    const handleMessage = (event) => {
      // 메인 창에서 보낸 메시지만 처리
      if (event.origin !== window.location.origin) return;

      if (event.data.type === MESSAGE_TYPES.GRAPH_STATE_UPDATE) {
        const data = event.data;
        console.log("📬 PostMessage로 상태 업데이트 받음:", data);

        if (data.referencedNodes) {
          setReferencedNodes(data.referencedNodes);
        }

        if (data.focusNodeNames) {
          setFocusNodeNames(data.focusNodeNames);
          setReferencedNodes(data.focusNodeNames);
        }

        if (data.graphRefresh) {
          setGraphRefreshTrigger((prev) => prev + 1);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // 창이 닫힐 때 정리
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log("🚪 Standalone 창 종료");
      removeStorageItem(STORAGE_KEYS.STANDALONE_GRAPH_UPDATE);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // 개발용 디버그 정보
  useEffect(() => {
    console.log("🎯 Current state:", {
      brainId,
      referencedNodes,
      focusNodeNames,
      graphRefreshTrigger,
    });
  }, [brainId, referencedNodes, focusNodeNames, graphRefreshTrigger]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 우주 배경 - Standalone에서는 항상 표시 */}
      <SpaceBackground isVisible={true} />
      {/* 새로운 GraphViewForFullscreen 사용 */}
      <GraphViewForFullscreen
        brainId={brainId}
        height="100%"
        referencedNodes={referencedNodes}
        focusNodeNames={focusNodeNames}
        graphRefreshTrigger={graphRefreshTrigger}
        onGraphDataUpdate={handleGraphDataUpdate}
        onRefresh={handleRefresh}
        onClearHighlights={handleClearHighlights}
        onClose={() => window.close()}
        // GraphView에 전달할 추가 props
        isFullscreen={true}
      />
    </div>
  );
}

export default GraphViewStandalone;
