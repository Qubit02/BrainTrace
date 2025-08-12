/**
 * sourceViewUtils.js
 * 
 * 출처보기 관련 유틸리티 함수들
 * 
 * 주요 기능:
 * 1. 원본 문장과 소스 텍스트 비교
 * 2. 하이라이팅 정보 생성
 * 3. 텍스트 매칭 알고리즘
 * 4. 호버 툴팁용 원본 문장 추출
 */

import { getSourceContent } from '../../../../api/services/chatApi';

/**
 * 원본 문장과 소스 텍스트를 비교하여 하이라이팅 정보를 생성합니다.
 * 
 * @param {Object} item - 소스 아이템 정보
 * @param {Object} message - 채팅 메시지 정보
 * @param {string} nodeName - 노드 이름
 * @param {string} selectedBrainId - 선택된 브레인 ID
 * @returns {Promise<Object>} 하이라이팅 정보
 */
export const generateHighlightingInfo = async (item, message, nodeName, selectedBrainId) => {
  try {
    // message.referenced_nodes에서 해당 노드 찾기
    const targetNode = message.referenced_nodes?.find(node => 
      node.name === nodeName
    );
    
    if (!targetNode?.source_ids) {
      return createDefaultHighlightingInfo(item);
    }
    
    // 해당 소스 ID의 원본 문장 찾기
    const targetSource = targetNode.source_ids.find(source => 
      source.id === item.id
    );
    
    if (!targetSource?.original_sentences) {
      return createDefaultHighlightingInfo(item);
    }
    
    if (targetSource.original_sentences.length === 0) {
      return createDefaultHighlightingInfo(item);
    }
    
    // 소스 텍스트 가져오기
    const sourceData = await getSourceContent(item.id, selectedBrainId);
    
    // 원본 문장과 소스 텍스트 비교하여 하이라이팅 정보 생성
    const highlightingInfo = {
      sourceId: item.id,
      sourceTitle: item.title,
      sourceContent: sourceData.content,
      originalSentences: targetSource.original_sentences.map(sent => sent.original_sentence),
      highlightedRanges: []
    };
    
    // 각 원본 문장에 대해 소스 텍스트에서 매칭되는 부분 찾기
    targetSource.original_sentences.forEach((sent, index) => {
      const originalText = sent.original_sentence;
      const sourceText = sourceData.content;
      
      // 원본 문장을 개별 문장으로 분리 (마침표, 느낌표, 물음표로 구분)
      const sentences = originalText.split(/[.!?]/).filter(s => s.trim().length > 0);
      
      // 각 분리된 문장에 대해 매칭 시도
      sentences.forEach((sentence, sentenceIndex) => {
        const trimmedSentence = sentence.trim();
        if (trimmedSentence.length === 0) return;
        
        // 모든 매칭을 찾는 함수
        const findAllMatches = (text, searchText) => {
          const matches = [];
          let startIndex = 0;
          while (true) {
            const index = text.indexOf(searchText, startIndex);
            if (index === -1) break;
            matches.push({
              start: index,
              end: index + searchText.length,
              text: searchText
            });
            startIndex = index + 1;
          }
          return matches;
        };
        
        // 정확한 매칭 찾기 (모든 매칭)
        const exactMatches = findAllMatches(sourceText, trimmedSentence);
        if (exactMatches.length > 0) {
          exactMatches.forEach(match => {
            highlightingInfo.highlightedRanges.push({
              ...match,
              type: 'exact'
            });
          });
        } else {
          // 1단계: 공백 정리 후 매칭
          const cleanOriginal = trimmedSentence.replace(/\s+/g, ' ').trim();
          const cleanSource = sourceText.replace(/\s+/g, ' ').trim();
          
          const partialMatches = findAllMatches(cleanSource, cleanOriginal);
          
          if (partialMatches.length > 0) {
            // 원본 텍스트에서 해당 부분들 찾기
            partialMatches.forEach(match => {
              const originalIndex = sourceText.indexOf(cleanOriginal, match.start);
              if (originalIndex !== -1) {
                highlightingInfo.highlightedRanges.push({
                  start: originalIndex,
                  end: originalIndex + cleanOriginal.length,
                  text: cleanOriginal,
                  type: 'partial'
                });
              }
            });
          } else {
            // 2단계: 더 유연한 매칭 (특수문자 제거, 대소문자 무시)
            const flexibleOriginal = trimmedSentence
              .replace(/[^\w\s가-힣]/g, '') // 특수문자 제거
              .replace(/\s+/g, ' ') // 연속 공백을 하나로
              .trim()
              .toLowerCase();
            
            const flexibleSource = sourceText
              .replace(/[^\w\s가-힣]/g, '') // 특수문자 제거
              .replace(/\s+/g, ' ') // 연속 공백을 하나로
              .trim()
              .toLowerCase();
            
            const flexibleMatches = findAllMatches(flexibleSource, flexibleOriginal);
            
            if (flexibleMatches.length > 0) {
              // 원본 텍스트에서 해당 부분들 찾기
              flexibleMatches.forEach(match => {
                const estimatedStart = Math.max(0, match.start - 10);
                const estimatedEnd = Math.min(sourceText.length, match.start + flexibleOriginal.length + 10);
                const searchRange = sourceText.substring(estimatedStart, estimatedEnd);
                
                // 가장 유사한 부분 찾기
                for (let i = 0; i <= searchRange.length - flexibleOriginal.length; i++) {
                  const candidate = searchRange.substring(i, i + flexibleOriginal.length);
                  const candidateClean = candidate
                    .replace(/[^\w\s가-힣]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase();
                  
                  if (candidateClean === flexibleOriginal) {
                    const actualStart = estimatedStart + i;
                    const actualEnd = actualStart + flexibleOriginal.length;
                    
                    highlightingInfo.highlightedRanges.push({
                      start: actualStart,
                      end: actualEnd,
                      text: sourceText.substring(actualStart, actualEnd),
                      type: 'flexible'
                    });
                    break;
                  }
                }
              });
            }
          }
        }
      });
    });
    
    // 중복된 범위 제거 및 정렬
    const uniqueRanges = [];
    const seenRanges = new Set();
    
    highlightingInfo.highlightedRanges.forEach(range => {
      const key = `${range.start}-${range.end}`;
      if (!seenRanges.has(key)) {
        seenRanges.add(key);
        uniqueRanges.push(range);
      }
    });
    
    // 시작 위치로 정렬
    uniqueRanges.sort((a, b) => a.start - b.start);
    
    highlightingInfo.highlightedRanges = uniqueRanges;
    
    return highlightingInfo;
    
  } catch (error) {
    console.error('하이라이팅 정보 생성 실패:', error);
    return createDefaultHighlightingInfo(item);
  }
};

/**
 * 기본 하이라이팅 정보를 생성합니다.
 * 
 * @param {Object} item - 소스 아이템 정보
 * @returns {Object} 기본 하이라이팅 정보
 */
const createDefaultHighlightingInfo = (item) => {
  return {
    sourceId: item.id,
    sourceTitle: item.title,
    sourceContent: '',
    originalSentences: [],
    highlightedRanges: []
  };
};

/**
 * 출처보기 클릭 핸들러를 생성합니다.
 * 
 * @param {Object} item - 소스 아이템 정보
 * @param {Object} message - 채팅 메시지 정보
 * @param {string} nodeName - 노드 이름
 * @param {string} selectedBrainId - 선택된 브레인 ID
 * @param {Function} onOpenSource - 소스 열기 콜백 함수
 * @returns {Function} 클릭 핸들러 함수
 */
/**
 * 호버 툴팁용 원본 문장을 추출합니다.
 * 
 * @param {Object} item - 소스 아이템 정보
 * @param {Object} message - 채팅 메시지 정보
 * @param {string} nodeName - 노드 이름
 * @returns {Array} 원본 문장 배열
 */
export const extractOriginalSentencesForHover = (item, message, nodeName) => {
  try {
    // message.referenced_nodes에서 해당 노드 찾기
    const targetNode = message.referenced_nodes?.find(node => 
      node.name === nodeName
    );
    
    if (!targetNode?.source_ids) {
      return [];
    }
    
    // 해당 소스 ID의 원본 문장 찾기
    const targetSource = targetNode.source_ids.find(source => 
      source.id === item.id
    );
    
    if (!targetSource?.original_sentences) {
      return [];
    }
    
    // 원본 문장 배열 반환
    return targetSource.original_sentences.map(sent => sent.original_sentence);
    
  } catch (error) {
    console.error('원본 문장 추출 실패:', error);
    return [];
  }
};

export const createSourceViewClickHandler = (item, message, nodeName, selectedBrainId, onOpenSource) => {
  return async () => {
    if (!item.id || !message.referenced_nodes) {
      const highlightingInfo = createDefaultHighlightingInfo(item);
      if (onOpenSource) {
        onOpenSource(item.id, highlightingInfo);
      }
      return;
    }
    
    try {
      const highlightingInfo = await generateHighlightingInfo(item, message, nodeName, selectedBrainId);
      if (onOpenSource) {
        onOpenSource(item.id, highlightingInfo);
      }
    } catch (error) {
      console.error('출처보기 처리 실패:', error);
      const highlightingInfo = createDefaultHighlightingInfo(item);
      if (onOpenSource) {
        onOpenSource(item.id, highlightingInfo);
      }
    }
  };
}; 