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
    
    // 각 원본 문장에 대해 소스 텍스트에서 매칭되는 부분 찾기
    targetSource.original_sentences.forEach((sent, index) => {
      const originalText = sent.original_sentence.trim();
      if (originalText.length === 0) return;
      
      const sourceText = sourceData.content;
      
      // 원본 문장 전체를 하나의 범위로 찾기 (여러 문장일 경우 모두 포함)
      // 1단계: 정확한 매칭 시도
      let foundMatch = false;
      
      const exactIndex = sourceText.indexOf(originalText);
      if (exactIndex !== -1) {
        highlightingInfo.highlightedRanges.push({
          start: exactIndex,
          end: exactIndex + originalText.length,
          text: originalText,
          type: 'exact'
        });
        foundMatch = true;
      }
      
      // 2단계: 특수문자 처리 후 전체 텍스트 검색
      if (!foundMatch) {
        // 시작 부분의 특수문자 제거 (대시, 하이픈 등)
        const cleanOriginal = originalText.replace(/^[-–—•]\s*/, '').trim();
        
        if (cleanOriginal.length > 0) {
          // 원본 텍스트에서도 특수문자 제거하여 검색
          const lines = sourceText.split('\n');
          let currentPos = 0;
          
          for (const line of lines) {
            const cleanLine = line.replace(/^[-–—•]\s*/, '');
            
            // 정규화된 텍스트끼리 비교 (공백도 정규화)
            const normalizedCleanOriginal = cleanOriginal.replace(/\s+/g, ' ').trim();
            const normalizedCleanLine = cleanLine.replace(/\s+/g, ' ').trim();
            
            if (normalizedCleanLine.toLowerCase().includes(normalizedCleanOriginal.toLowerCase())) {
              // 라인 내에서 위치 찾기
              const lineIndex = cleanLine.toLowerCase().indexOf(cleanOriginal.toLowerCase());
              
              if (lineIndex !== -1 || normalizedCleanLine.toLowerCase().startsWith(normalizedCleanOriginal.toLowerCase())) {
                const actualStart = currentPos + (lineIndex >= 0 ? lineIndex : 0);
                const actualEnd = actualStart + cleanOriginal.length;
                
                highlightingInfo.highlightedRanges.push({
                  start: actualStart,
                  end: actualEnd,
                  text: sourceText.substring(actualStart, Math.min(actualEnd, sourceText.length)),
                  type: 'cleaned'
                });
                foundMatch = true;
                break;
              }
            }
            
            currentPos += line.length + 1;
          }
        }
      }
      
      // 3단계: 특수문자 제거 후 첫 두 단어로 시작 위치 찾고 원본 길이만큼 하이라이트
      if (!foundMatch) {
        // 특수문자 제거 후 단어 분리
        const cleanText = originalText.replace(/^[-–—•]\s*/, '').trim();
        const words = cleanText.split(/\s+/).filter(w => w.length > 0);
        
        if (words.length >= 2) {
          // 특수문자를 제거한 첫 두 단어 찾기
          const firstWord = words[0];
          const secondWord = words[1];
          
          // 두 단어를 함께 찾기
          const combinedPhrase = firstWord + ' ' + secondWord;
          let combinedIndex = sourceText.indexOf(combinedPhrase);
          
          // 정확한 매칭 실패 시 공백 정리된 버전으로도 시도
          if (combinedIndex === -1) {
            const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();
            const normalizedPhrase = normalizeText(combinedPhrase);
            const normalizedSource = normalizeText(sourceText);
            const normalizedIndex = normalizedSource.indexOf(normalizedPhrase);
            
            if (normalizedIndex !== -1) {
              // 정규화된 인덱스를 실제 인덱스로 대략 변환
              combinedIndex = Math.floor(normalizedIndex * (sourceText.length / normalizedSource.length));
            }
          }
          
          if (combinedIndex !== -1) {
            // 원본 텍스트의 길이를 기준으로 하이라이트 (특수문자 포함)
            const estimatedStart = combinedIndex;
            const estimatedEnd = combinedIndex + originalText.length;
            const actualText = sourceText.substring(estimatedStart, Math.min(estimatedEnd, sourceText.length));
            
            highlightingInfo.highlightedRanges.push({
              start: estimatedStart,
              end: estimatedEnd,
              text: actualText,
              type: 'full-length'
            });
            foundMatch = true;
          }
        }
      }
      
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