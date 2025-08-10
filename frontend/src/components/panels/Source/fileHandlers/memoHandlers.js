/**
 * memoHandlers.js
 * 
 * 메모 관련 핸들러들을 관리하는 모듈입니다.
 * 
 * 주요 기능:
 * - 메모 텍스트를 지식 그래프로 변환
 * - 메모 내용의 유효성 검사
 * - 그래프 생성 성공/실패 로깅
 * 
 * 주요 함수:
 * - processMemoTextAsGraph: 메모 텍스트를 그래프로 변환
 * 
 * 처리 과정:
 * 1. 메모 내용 유효성 검사 (빈 내용 체크)
 * 2. processText API 호출하여 그래프 생성
 * 3. 성공/실패 로깅
 */

// memoHandlers.js
import { processText } from '../../../../../api/services/graphApi';

/**
 * 메모 텍스트를 그래프 지식으로 변환하는 함수
 * 
 * 처리 과정:
 * 1. 메모 내용이 비어있는지 확인
 * 2. 비어있으면 경고 로그 출력 후 종료
 * 3. processText API 호출하여 텍스트를 그래프로 변환
 * 4. 성공/실패 로그 출력
 * 
 * @param {string} content - 메모 내용 텍스트
 * @param {string|number} sourceId - 메모의 고유 ID (소스 ID로 사용)
 * @param {string|number} brainId - 브레인 ID
 * @returns {Promise<void>} 그래프 생성 완료 시 resolve
 */
export async function processMemoTextAsGraph(content, sourceId, brainId) {
  // 메모 내용이 비어있는지 확인
  if (!content || content.trim() === "") {
    console.warn("📭 메모 내용이 비어 있어 그래프를 생성하지 않습니다.");
    return;
  }
  
  try {
    // processText API 호출하여 텍스트를 그래프로 변환
    const response = await processText(content, String(sourceId), String(brainId));
    console.log("✅ 그래프 생성 완료:", response);
  } catch (error) {
    console.error("❌ 그래프 생성 실패:", error);
  }
} 