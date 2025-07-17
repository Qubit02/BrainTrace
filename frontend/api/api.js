// src/services/api.js
import axios from 'axios';

export const api = axios.create({
    baseURL: 'http://localhost:8000', // ▶︎ 필요하면 환경변수로
    headers: { 'Content-Type': 'application/json' },
});
