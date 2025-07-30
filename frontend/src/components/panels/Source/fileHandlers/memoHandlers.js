// memoHandlers.js
import { processText } from '../../../../../api/graphApi';

/**
 * 메모 텍스트를 그래프 지식으로 변환하는 함수
 * @param {string} content - 메모 내용
 * @param {string|number} sourceId - 메모 ID
 * @param {string|number} brainId - 브레인 ID
 */
export async function processMemoTextAsGraph(content, sourceId, brainId) {
  if (!content || content.trim() === "") {
    console.warn("📭 메모 내용이 비어 있어 그래프를 생성하지 않습니다.");
    return;
  }
  try {
    const response = await processText(content, String(sourceId), String(brainId));
    console.log("✅ 그래프 생성 완료:", response);
  } catch (error) {
    console.error("❌ 그래프 생성 실패:", error);
  }
} 