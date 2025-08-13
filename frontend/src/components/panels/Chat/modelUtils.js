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

// ===== 모델 타입 분류 상수 =====
export const MODEL_TYPES = {
  OLLAMA: 'ollama',      // Ollama 로컬 모델
  OPENAI: 'openai',      // OpenAI API 모델
  CUSTOM: 'custom'       // 기타 커스텀 모델
};

// ===== 모델 정보 데이터 =====
// 각 모델의 상세 정보를 담고 있는 객체
// name: 표시될 모델 이름
// description: 모델 설명
// usage: 사용법 (현재 미사용)
// buttonText: 버튼 텍스트 (현재 미사용)
// size: 모델 크기
// type: 모델 타입 (오픈소스/API)
// provider: 모델 제공업체
// modelType: 실제 분류 타입 (OLLAMA/OPENAI/CUSTOM)
export const modelInfo = {
  'gemma3:4b': {
    name: 'Gemma 3 4B',
    description: 'Google의 경량화된 오픈소스 언어 모델로 빠르고 효율적인 응답',
    usage: '',
    buttonText: '',
    size: '4B',
    type: '오픈소스',
    provider: 'Google',
    modelType: MODEL_TYPES.OLLAMA
  },
  'phi4-mini:3.8b': {
    name: 'Phi-4 Mini 3.8B',
    description: 'Microsoft의 컴팩트한 언어 모델로 빠른 추론과 효율적인 메모리 사용',
    usage: '',
    buttonText: '',
    size: '3.8B',
    type: '오픈소스',
    provider: 'Microsoft',
    modelType: MODEL_TYPES.OLLAMA
  },
  'exaone3.5:2.4b': {
    name: 'ExaOne 3.5 2.4B',
    description: '한국어에 특화된 경량 언어 모델로 빠른 한국어 처리',
    usage: '',
    buttonText: '',
    size: '2.4B',
    type: '오픈소스',
    provider: 'ExaOne',
    modelType: MODEL_TYPES.OLLAMA
  },
  'mistral:7b': {
    name: 'Mistral 7B',
    description: '고성능 오픈소스 언어 모델로 정확하고 창의적인 응답',
    usage: '',
    buttonText: '',
    size: '7B',
    type: '오픈소스',
    provider: 'Mistral AI',
    modelType: MODEL_TYPES.OLLAMA
  },
  'qwen3:4b': {
    name: 'Qwen 3 4B',
    description: 'Alibaba의 다국어 지원 언어 모델로 다양한 언어 처리',
    usage: '',
    buttonText: '',
    size: '4B',
    type: '오픈소스',
    provider: 'Alibaba',
    modelType: MODEL_TYPES.OLLAMA
  },
  'deepseek-r1:7b': {
    name: 'DeepSeek R1 7B',
    description: 'DeepSeek의 고성능 오픈소스 언어 모델로 정확하고 창의적인 응답',
    usage: '',
    buttonText: '',
    size: '7B',
    type: '오픈소스',
    provider: 'DeepSeek',
    modelType: MODEL_TYPES.OLLAMA
  },
  'gpt-oss:20b': {
    name: 'GPT-OSS 20B',
    description: '오픈소스 GPT 스타일의 20B 파라미터 언어 모델로 고품질 텍스트 생성',
    usage: '',
    buttonText: '',
    size: '20B',
    type: '오픈소스',
    provider: 'Open Source',
    modelType: MODEL_TYPES.OLLAMA
  },
  // OpenAI 모델들 (클라우드 모드에서 사용)
  'gpt-4o': {
    name: 'GPT-4o',
    description: '가장 최신의 OpenAI 모델로 빠르고 정확한 응답',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    description: '빠르고 효율적인 대화형 AI 모델',
    usage: '',
    buttonText: '',
    size: 'Small',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    description: '고성능 멀티모달 AI 모델로 복잡한 작업 처리에 최적화',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-4': {
    name: 'GPT-4',
    description: 'OpenAI의 고급 언어 모델로 창의적이고 정확한 응답',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-4-32k': {
    name: 'GPT-4 32K',
    description: '긴 컨텍스트를 처리할 수 있는 고급 언어 모델',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    description: '빠르고 효율적인 대화형 AI 모델',
    usage: '',
    buttonText: '',
    size: 'Medium',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-3.5-turbo-16k': {
    name: 'GPT-3.5 Turbo 16K',
    description: '긴 컨텍스트를 지원하는 GPT-3.5 모델',
    usage: '',
    buttonText: '',
    size: 'Medium',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-3.5-turbo-instruct': {
    name: 'GPT-3.5 Turbo Instruct',
    description: '명령어 기반 작업에 최적화된 GPT-3.5 모델',
    usage: '',
    buttonText: '',
    size: 'Medium',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-3.5-turbo-0125': {
    name: 'GPT-3.5 Turbo 0125',
    description: '2025년 1월 25일 업데이트된 GPT-3.5 모델',
    usage: '',
    buttonText: '',
    size: 'Medium',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-3.5-turbo-1106': {
    name: 'GPT-3.5 Turbo 1106',
    description: '2023년 11월 6일 업데이트된 GPT-3.5 모델',
    usage: '',
    buttonText: '',
    size: 'Medium',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-3.5-turbo-0613': {
    name: 'GPT-3.5 Turbo 0613',
    description: '2023년 6월 13일 업데이트된 GPT-3.5 모델',
    usage: '',
    buttonText: '',
    size: 'Medium',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-3.5-turbo-0301': {
    name: 'GPT-3.5 Turbo 0301',
    description: '2023년 3월 1일 업데이트된 GPT-3.5 모델',
    usage: '',
    buttonText: '',
    size: 'Medium',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-4-0125-preview': {
    name: 'GPT-4 0125 Preview',
    description: '2025년 1월 25일 프리뷰 버전의 GPT-4 모델',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-4-1106-preview': {
    name: 'GPT-4 1106 Preview',
    description: '2023년 11월 6일 프리뷰 버전의 GPT-4 모델',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-4-vision-preview': {
    name: 'GPT-4 Vision Preview',
    description: '이미지와 텍스트를 모두 처리할 수 있는 멀티모달 GPT-4 모델',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-4-1106-vision-preview': {
    name: 'GPT-4 1106 Vision Preview',
    description: '2023년 11월 6일 업데이트된 비전 지원 GPT-4 모델',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-4-all': {
    name: 'GPT-4 All Tools',
    description: '모든 도구를 사용할 수 있는 완전한 GPT-4 모델',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-4-base': {
    name: 'GPT-4 Base',
    description: '기본 기능을 제공하는 GPT-4 모델',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  // GPT-5 모델들 (2025년 8월 7일 공식 출시)
  'gpt-5': {
    name: 'GPT-5',
    description: 'OpenAI의 최신 GPT-5 모델로 혁신적인 AI 성능과 깊은 추론 능력',
    usage: '',
    buttonText: '',
    size: 'Large',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-5-mini': {
    name: 'GPT-5 Mini',
    description: '빠르고 효율적인 GPT-5 경량 버전으로 일상적인 작업에 최적화',
    usage: '',
    buttonText: '',
    size: 'Medium',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
  },
  'gpt-5-nano': {
    name: 'GPT-5 Nano',
    description: '초경량 GPT-5 모델로 빠른 응답과 효율적인 리소스 사용',
    usage: '',
    buttonText: '',
    size: 'Small',
    type: 'API',
    provider: 'OpenAI',
    modelType: MODEL_TYPES.OPENAI
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
    provider: '',
    modelType: MODEL_TYPES.CUSTOM
  };
};

/**
 * 백엔드에서 받아온 모델 목록에 주요 OpenAI 모델들을 추가하고,
 * Ollama 모델들의 실제 설치 상태를 반영
 * 
 * @param {Array} models - 백엔드에서 받아온 모델 목록 (listModels API 결과)
 * @param {Object} installedModelsInfo - 실제 설치된 모델 정보 (getInstalledModels API 결과)
 * @returns {Array} OpenAI 모델들과 실제 설치 상태가 반영된 Ollama 모델 목록
 */
export const addGpt4oToModels = (models, installedModelsInfo = null) => {
  // OpenAI 모델들은 항상 설치된 상태로 설정 (API 기반이므로)
  const defaultOpenAIModels = [
    { name: 'gpt-5', installed: true },
    { name: 'gpt-5-mini', installed: true },
    { name: 'gpt-5-nano', installed: true },
    { name: 'gpt-4o', installed: true },
    { name: 'gpt-4o-mini', installed: true },
    { name: 'gpt-4-turbo', installed: true },
    { name: 'gpt-4', installed: true },
    { name: 'gpt-3.5-turbo', installed: true },
    { name: 'gpt-3.5-turbo-16k', installed: true }
  ];
  
  // 모델 타입에 따라 분류
  const ollamaModels = models.filter(model => {
    const modelData = getModelData(model.name);
    return modelData.modelType === MODEL_TYPES.OLLAMA;
  });
  
  if (installedModelsInfo && installedModelsInfo.models) {
    // 실제 설치된 모델 이름 목록
    const installedModelNames = installedModelsInfo.models.map(model => model.name);
    
    // Ollama 모델들의 설치 상태를 실제 정보로 업데이트
    const updatedOllamaModels = ollamaModels.map(model => ({
      ...model,
      installed: installedModelNames.includes(model.name)
    }));
    
    return [...defaultOpenAIModels, ...updatedOllamaModels];
  }
  
  return [...defaultOpenAIModels, ...ollamaModels];
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

/**
 * 모델을 타입별로 분류
 * @param {Array} models - 전체 모델 목록
 * @returns {object} { ollama: Ollama 모델 배열, openai: OpenAI 모델 배열, custom: 커스텀 모델 배열 }
 */
export const categorizeModelsByType = (models) => {
  const categorized = {
    ollama: [],
    openai: [],
    custom: []
  };
  
  models.forEach(model => {
    const modelData = getModelData(model.name);
    switch (modelData.modelType) {
      case MODEL_TYPES.OLLAMA:
        categorized.ollama.push(model);
        break;
      case MODEL_TYPES.OPENAI:
        categorized.openai.push(model);
        break;
      default:
        categorized.custom.push(model);
    }
  });
  
  return categorized;
};

/**
 * 특정 타입의 모델만 필터링
 * @param {Array} models - 전체 모델 목록
 * @param {string} modelType - 필터링할 모델 타입 (MODEL_TYPES.OLLAMA, MODEL_TYPES.OPENAI 등)
 * @returns {Array} 필터링된 모델 목록
 */
export const filterModelsByType = (models, modelType) => {
  return models.filter(model => {
    const modelData = getModelData(model.name);
    return modelData.modelType === modelType;
  });
};