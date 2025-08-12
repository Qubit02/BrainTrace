## 1. 일반 환경 실행

1. 저장소 클론  
   ```bash
   git clone https://github.com/OSSBrainTrace/BrainTrace.git
   
   cd BrainTrace
   ```
2. 터미널 두 개 실행

   터미널1
   ```bash
   cd backend
   
   py -m venv venv
   
   source venv/bin/activate      # macOS/Linux
   
   venv\Scripts\activate         # Windows
   
   pip install -r requirements.txt
   
   py main.py
   ```
   터미널2
   ```bash
   cd frontend
   
   npm install
   
   npm run dev
   
  >포트 정보
  
    프론트엔드: http://localhost:5173
    Swagger: http://localhost:8000/docs

## 2. 도커 실행 환경
  주의: 이미지 및 모델 다운로드로 인해 디스크 용량이 많이 필요합니다.

```bash
docker-compose up
```
도커 사용 시 브라우저로 테스트 가능합니다.
http://localhost:5173
