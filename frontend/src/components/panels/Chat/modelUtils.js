/**
 * modelUtils.js
 * 
 * 모델 관련 유틸리티 함수들을 관리하는 파일
 * 
 * 주요 기능:
 * 1. 모델 정보 데이터 관리 (modelInfo)
 * 2. 모델 데이터 조회 및 가공 함수들
 * 3. 모델 목록 정렬 및 필터링 함수들
 * 4. 설치된 모델과 설치 가능한 모델 분리 로직
 * 
 * 사용처: ChatPanel.jsx의 ModelDropdown 컴포넌트
 */

// ===== 모델 정보 데이터 =====
// 각 모델의 상세 정보를 담고 있는 객체
// name: 표시될 모델 이름
// description: 모델 설명
// usage: 사용법 (현재 미사용)
// buttonText: 버튼 텍스트 (현재 미사용)
// size: 모델 크기
// type: 모델 타입 (오픈소스/API)
// provider: 모델 제공업체
export const modelInfo = {
  'gemma3:4b': {
    name: 'Gemma 3 4B',
    description: 'Google의 경량화된 오픈소스 언어 모델로 빠르고 효율적인 응답',
    usage: '',
    buttonText: '',
    size: '4B',
    type: '오픈소스',
    provider: 'Google'
  },
  'phi4-mini:3.8b': {
    name: 'Phi-4 Mini 3.8B',
    description: 'Microsoft의 컴팩트한 언어 모델로 빠른 추론과 효율적인 메모리 사용',
    usage: '',
    buttonText: '',
    size: '3.8B',
    type: '오픈소스',
    provider: 'Microsoft'
  },
  'exaone3.5:2.4b': {
    name: 'ExaOne 3.5 2.4B',
    description: '한국어에 특화된 경량 언어 모델로 빠른 한국어 처리',
    usage: '',
    buttonText: '',
    size: '2.4B',
    type: '오픈소스',
    provider: 'ExaOne'
  },
  'mistral:7b': {
    name: 'Mistral 7B',
    description: '고성능 오픈소스 언어 모델로 정확하고 창의적인 응답',
    usage: '',
    buttonText: '',
    size: '7B',
    type: '오픈소스',
    provider: 'Mistral AI'
  },
  'qwen3:4b': {
    name: 'Qwen 3 4B',
    description: 'Alibaba의 다국어 지원 언어 모델로 다양한 언어 처리',
    usage: '',
    buttonText: '',
    size: '4B',
    type: '오픈소스',
    provider: 'Alibaba'
  },
  'deepseek-r1:7b': {
    name: 'DeepSeek R1 7B',
    description: 'DeepSeek의 고성능 오픈소스 언어 모델로 정확하고 창의적인 응답',
    usage: '',
    buttonText: '',
    size: '7B',
    type: '오픈소스',
    provider: 'DeepSeek'
  },
  'gpt-4o': {
    name: 'GPT-4o',
    description: '가장 최신의 OpenAI 모델로 빠르고 정확한 응답',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI'
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    description: '빠르고 효율적인 대화형 AI 모델',
    usage: '',
    buttonText: '',
    size: 'Small',
    type: 'API',
    provider: 'OpenAI'
  }
};

/**
 * 모델 이름을 받아서 해당 모델의 상세 정보를 반환
 * @param {string} modelName - 모델 이름 (예: 'gpt-4o', 'gemma3:4b')
 * @returns {object} 모델 정보 객체 (name, description, size, type, provider 등)
 */
export const getModelData = (modelName) => {
  return modelInfo[modelName] || { 
    name: modelName, 
    description: '', 
    usage: '', 
    buttonText: '', 
    size: '', 
    type: '', 
    provider: '' 
  };
};

/**
 * 백엔드에서 받아온 모델 목록에 gpt-4o를 추가
 * gpt-4o는 항상 설치된 상태로 간주하여 상단에 배치
 * @param {Array} models - 백엔드에서 받아온 모델 목록
 * @returns {Array} gpt-4o가 추가된 모델 목록
 */
export const addGpt4oToModels = (models) => {
  const gpt4oModel = { name: 'gpt-4o', installed: true };
  return [gpt4oModel, ...models];
};

/**
 * 모델 목록을 설치된 모델과 설치 가능한 모델로 분리
 * @param {Array} models - 전체 모델 목록
 * @returns {object} { installed: 설치된 모델 배열, available: 설치 가능한 모델 배열 }
 */
export const separateInstalledAndAvailableModels = (models) => {
  const installed = models.filter(model => model.installed);
  const available = models.filter(model => !model.installed);
  return { installed, available };
};

/**
 * 선택된 모델을 맨 위로 정렬
 * 드롭다운에서 현재 선택된 모델이 항상 상단에 표시되도록 함
 * @param {Array} models - 정렬할 모델 목록
 * @param {string} selectedModel - 현재 선택된 모델 이름
 * @returns {Array} 선택된 모델이 맨 위로 정렬된 모델 목록
 */
export const sortModelsWithSelectedFirst = (models, selectedModel) => {
  return models.sort((a, b) => {
    if (a.name === selectedModel) return -1;
    if (b.name === selectedModel) return 1;
    return 0;
  });
}; 