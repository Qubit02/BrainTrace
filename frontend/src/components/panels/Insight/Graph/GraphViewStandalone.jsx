// src/components/GraphViewStandalone.jsx
import React, { useState, useCallback, useEffect } from "react";
import GraphViewForFullscreen from "./GraphViewForFullscreen";
import SpaceBackground from "./SpaceBackground";
import "./SpaceBackground.css";

function GraphViewStandalone() {
  const searchParams = new URLSearchParams(window.location.search);
  const brainId = searchParams.get("brainId") || "default-brain-id";

  // MainLayout과 동일한 상태 구조 유지
  const [referencedNodes, setReferencedNodes] = useState([]);
  const [focusNodeNames, setFocusNodeNames] = useState([]);
  const [graphRefreshTrigger, setGraphRefreshTrigger] = useState(0);

  // GraphView에서 그래프 데이터가 업데이트될 때 처리
  const handleGraphDataUpdate = useCallback(
    (graphData) => {
      console.log("📊 Standalone Graph data updated:", graphData);

      // 메인 창에 그래프 업데이트 알림
      localStorage.setItem(
        "standaloneGraphUpdate",
        JSON.stringify({
          brainId,
          nodeCount: graphData?.nodes?.length || 0,
          linkCount: graphData?.links?.length || 0,
          timestamp: Date.now(),
        })
      );
    },
    [brainId]
  );

  // 새로고침 함수
  const handleRefresh = useCallback(() => {
    console.log("🔄 Standalone에서 새로고침 실행");
    setGraphRefreshTrigger((prev) => prev + 1);

    // 메인 창에 새로고침 알림
    localStorage.setItem(
      "graphStateSync",
      JSON.stringify({
        brainId,
        timestamp: Date.now(),
        action: "refresh_from_standalone",
      })
    );
  }, [brainId]);

  // 하이라이트 해제 함수
  const handleClearHighlights = useCallback(() => {
    console.log("🧹 Standalone에서 하이라이트 해제");
    setReferencedNodes([]);
    setFocusNodeNames([]);

    // 메인 창에 해제 알림
    localStorage.setItem(
      "graphStateSync",
      JSON.stringify({
        brainId,
        timestamp: Date.now(),
        action: "clear_highlights_from_standalone",
      })
    );
  }, [brainId]);

  // URL 파라미터에서 참고된 노드 읽기
  const getReferencedNodesFromUrl = () => {
    const referencedParam = searchParams.get("referencedNodes");
    if (referencedParam) {
      try {
        return JSON.parse(decodeURIComponent(referencedParam));
      } catch (e) {
        console.warn("Invalid referencedNodes parameter:", e);
        return [];
      }
    }
    return [];
  };

  // 컴포넌트 마운트 시 URL에서 참고된 노드 정보 읽기
  useEffect(() => {
    const urlReferencedNodes = getReferencedNodesFromUrl();
    if (urlReferencedNodes.length > 0) {
      console.log("🎯 URL에서 참고된 노드 로드:", urlReferencedNodes);
      setReferencedNodes(urlReferencedNodes);
    }
  }, []);

  // 메인 창과의 실시간 동기화를 위한 localStorage 이벤트 리스너
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "graphStateSync" && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.brainId === brainId) {
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
            if (data.action === "refresh") {
              console.log("🔄 메인 창에서 그래프 새로고침 요청");
              setGraphRefreshTrigger((prev) => prev + 1);
            }

            // 메모 추가/업데이트 감지
            if (data.action === "memo_update") {
              console.log("📝 메모 업데이트로 인한 그래프 새로고침");
              setGraphRefreshTrigger((prev) => prev + 1);
            }

            // 소스 파일 추가 감지
            if (data.action === "source_added") {
              console.log("📄 소스 파일 추가로 인한 그래프 새로고침");
              setGraphRefreshTrigger((prev) => prev + 1);
            }

            // 하이라이트 해제
            if (data.action === "clear_highlights") {
              console.log("🧹 하이라이트 해제");
              setReferencedNodes([]);
              setFocusNodeNames([]);
            }
          }
        } catch (err) {
          console.error("❌ Storage sync error:", err);
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

      if (event.data.type === "GRAPH_STATE_UPDATE") {
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
      localStorage.removeItem("standaloneGraphUpdate");
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
