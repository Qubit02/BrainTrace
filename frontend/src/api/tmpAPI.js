//진짜 임시 API 파일입니다. 나중에 삭제해주세요

import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000'; // Python 백엔드 서버 주소

export const postText = async (text, source_id, brain_id) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/brainGraph/process_text`,
      {
        text: text,
        source_id: source_id,
        brain_id: brain_id,
      }
    );
    return response.data;
  } catch (error) {
    console.error('LLM 요청 중 에러 발생:', error);
    throw error;
  }
};

export const requestBasicChat = async (text) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/brainGraph/basic_chat`, {
      question: text,
    });
    return response.data;
  } catch (error) {
    console.error('Basic Chat 요청 중 에러 발생:', error);
    throw error;
  }
};

export const requestAnswer = async (question, brain_id) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/chat`, // 변경된 엔드포인트
      { question } // 백엔드에서는 brain_id 필요 없으면 제거
    );
    // { answer } 형태로 반환된다고 가정
    return {
      answer: response.data.answer,
      chat_id: response.data.chat_id, // chat_id 필요하면
      referenced_nodes: response.data.nodes, // referenced_nodes 필요하면
    };
  } catch (error) {
    console.error('Answer 요청 중 에러 발생:', error);
    throw error;
  }
};
