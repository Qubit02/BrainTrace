
 <div><img src="https://capsule-render.vercel.app/api?type=waving&height=200&color=0:1FA9DC,100:543fd6&text=BrainTrace&descAlignY=100&descAlign=62&textBg=false&fontColor=FFFFFF&fontSize=70&animation=fadeIn&rotate=0&strokeWidth=0&descSize=20" /></div>


### 👋 Introduce team member

| name                                        | major        | role | Email                |
| -------------------------------------------- | -------------- | ------ | -------------------- |
| [Yechan An](https://github.com/yes6686) | Computer Science | FE | email |
| [Donghyck Kim](https://github.com/kimdonghyuk0) | Computer Science | BE | email |
| [JeongGyun Yu](https://github.com/Mieulchi) | Computer Science | DevOps | sangsangujk@hansung.ac.kr |
| [Serin Jang](https://github.com) | Computer Science | AI | email |


</br>
</br>

# about BrainTrace
<p align="left">
  <!-- 필요 시 SDG 아이콘 이미지를 교체하세요 -->
</p>

**BrainTrace**는 사용자의 문서를 **지식 그래프**로 변환하고, 그래프에 근거한 **정확한 Q&A**를 제공하여 고급 지식 접근성을 민주화합니다.  
PDF/노트를 업로드하면 → 엔티티/관계를 추출·중복 제거 → Neo4j·Qdrant에 저장 → 출처가 연결된 답변을 제공합니다.

이는 프롬프트 엔지니어링 지식 없이도 LLM을 활용할 수 있게 하여, 전문가/비전문가 간 정보 격차를 줄이고 고품질 학습 자원에 대한 접근을 높입니다.

- **SDG 4 – 양질의 교육:** 사용 자료에서 구조화된 지식과 출처가 명확한 답변 제공
- **SDG 10 – 불평등 감소:** 가이드형 UI와 자동 파이프라인으로 기술 장벽을 낮춤

---

## Project Introduction

**핵심 기능**
- **자동 그래프화:** 문서 수집 → 노드/엣지 추출 → 중복 정리 → Neo4j/Qdrant 영속화  
- **그래프 기반 챗:** 사실 기반 응답, 답변마다 관련 출처 문장 제공  
- **시각적 탐색:** React Force Graph + D3로 인터랙티브 그래프 뷰  
- **로컬/클라우드 LLM:** OpenAI 또는 로컬 Ollama(환경 변수로 전환)

---

## Project Sample
<p align="center">
 <img src="https://github.com/user-attachments/assets/dd41e574-109d-4268-8cf9-a9fca43a2c86" width="49%" align="left">
 <img src="https://github.com/user-attachments/assets/a45f8b4e-883c-4a66-8b09-1bfda87417e4" width="49%" align="right">
</p>
<p align="center">

</p>

> 문서를 업로드하면 BrainTrace가 자동으로 그래프를 구축합니다. 엔티티/관계를 탐색하고 추출된 스키마를 미리 볼 수 있습니다.

<br><br>

<p align="center">

</p>

> **그래프 기반 컨텍스트**로 질문하세요. 응답에는 관련 출처와 그래프 경로가 함께 제공됩니다.

---

## Architecture

**스택 개요**
- **Frontend:** React + Vite + Electron, D3.js, React-Force-Graph  
- **Backend:** FastAPI (Python)  
- **Datastores:** Neo4j(그래프 DB), Qdrant(벡터), SQLite(메타데이터)  
- **LLM:** OpenAI API 또는 로컬 Ollama(ENV 전환)  
- **DevOps:** Docker, GitHub Actions

---

# ✨ Demo

## ⬇️ 영상 보러 가기

---

## Our Service
**BrainTrace (로컬 앱)** – Electron/Vite 기반 개발 환경  
- `docker compose up` **또는** 프런트엔드 `npm run dev` + 백엔드 `uvicorn main:app --reload`  
- App(개발): http://localhost:5173 • API: http://localhost:8000

---

## 🎯 Commit Convention

- **feat:** 새로운 기능 추가  
- **fix:** 버그 수정  
- **style:** 포맷팅 등 비기능 변경  
- **refactor:** 리팩터링(동작 변화 없음)

---

## 💡 PR 컨벤션

| 아이콘 | 코드        | 설명                               |
|-------|-------------|------------------------------------|
| 🎨    | :art        | 코드 구조/포맷 개선                |
| ⚡️   | :zap        | 성능 개선                          |
| 🔥    | :fire       | 코드/파일 삭제                     |
| 🐛    | :bug        | 버그 수정                          |
| 🚑    | :ambulance  | 긴급 수정                          |
| ✨    | :sparkles   | 신규 기능                          |
| 💄    | :lipstick   | UI/스타일 파일 추가·수정           |

---

### 🛠️ Tech
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9)
![FastAPI](https://img.shields.io/badge/FastAPI-109989?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Neo4j](https://img.shields.io/badge/Neo4j-018BFF?style=for-the-badge&logo=neo4j&logoColor=white)
![Qdrant](https://img.shields.io/badge/Qdrant-FF4F00?style=for-the-badge&logo=qdrant&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![D3.js](https://img.shields.io/badge/D3.js-F9A03C?style=for-the-badge&logo=d3dotjs&logoColor=white)
![React Force Graph](https://img.shields.io/badge/React%20Force%20Graph-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![KoNLPy](https://img.shields.io/badge/KoNLPy-20B2AA?style=for-the-badge)
![KoE5](https://img.shields.io/badge/KoE5-Embeddings-1F6FEB?style=for-the-badge)

---

## ☁️ 오픈소스 구성
- **Backend/Infra:** FastAPI, Docker, GitHub Actions  
- **Databases:** Neo4j, Qdrant, SQLite  
- **Frontend:** React, Vite, Electron, D3.js, React-Force-Graph  
- **AI:** OpenAI API, Ollama, KoNLPy, KoE5(임베딩), NumPy/Scikit-learn

---

## 🕸️ 생성형 AI
- **LLM 제공자:** OpenAI(클라우드) / Ollama(로컬)  
- **그라운딩:** Neo4j 그래프 + Qdrant 벡터 검색  
- **임베딩:** KoE5를 활용한 한국어/다국어 검색

---

## 참고 자료
- [OpenAI 프롬프트 가이드](https://platform.openai.com/docs/guides/prompt-engineering)  
- [Anthropic 프롬프트 가이드](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)  
- [FastAPI 문서](https://fastapi.tiangolo.com) • [React 문서](https://react.dev)  
- [Neo4j GraphAcademy](https://graphacademy.neo4j.com) • [Qdrant 문서](https://qdrant.tech/documentation)
