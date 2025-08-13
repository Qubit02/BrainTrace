# 🚀 BrainTrace 실행 가이드

> **BrainTrace**는 지식 그래프 기반 AI 챗봇 시스템으로, 문서를 업로드하면 자동으로 지식 그래프를 구축하고 정확한 답변을 생성합니다.

## 📋 목차

- [시스템 요구사항](#-시스템-요구사항)
- [빠른 시작](#-빠른-시작)
- [상세 설치 가이드](#-상세-설치-가이드)
- [도커 실행](#-도커-실행)

## 🔧 시스템 요구사항

- **운영체제**: Windows 10/11
- **Python**: 3.12 이상
- **Node.js**: 20.19.0 이상

### 최소 요구사항

| 프로파일 | CPU | RAM | 디스크 |
|---|---|---|---|
| **A) 외부 LLM 사용 / 로컬 LLM 미사용** | 2–4코어 | **≥ 8GB** | 10–20GB (이미지/로그) |
| **B) 로컬 LLM (Ollama 7B, Q4 기준) 사용** | 4–8코어 | **최소 12GB (권장 16GB)** | 30–50GB+ (모델/캐시) |

> **공통 가이드**  
> • 권장 메모리: **16GB+**  
> • 최소 여유 디스크: **10GB+** (로컬 LLM 사용 시 모델 크기만큼 추가 필요)


### 권장 사양
- **CPU**: 8코어
- **메모리**: 16GB RAM
- **저장공간**: 50GB+ 여유 공간 (AI 모델 및 데이터베이스용)

## ⚡ 빠른 시작

### 도커로 실행

```bash
# 저장소 클론
git clone https://github.com/OSSBrainTrace/BrainTrace.git
cd BrainTrace

# 도커 컴포즈로 실행
docker-compose up -d

# 브라우저에서 접속
# 프론트엔드: http://localhost:5173
# 백엔드 API: http://localhost:8000
# Neo4j: http://localhost:7474
```

## 📖 상세 설치 가이드

### 1. 저장소 클론

```bash
git clone https://github.com/OSSBrainTrace/BrainTrace.git
cd BrainTrace
```

### 2. 백엔드 설정

#### 2.1 Python 가상환경 생성 및 활성화

```bash
cd backend

# 가상환경 생성
python -m venv venv

# 가상환경 활성화
# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

#### 2.2 의존성 설치

```bash
pip install -r requirements.txt
```

#### 2.3 환경 변수 설정

```bash
# .env 파일 생성 (backend 디렉토리에)
cp .env.example .env

# 필요한 API 키 및 설정값 입력
# OPENAI_API_KEY=your_api_key_here
# NEO4J_URI=bolt://localhost:7687
# OLLAMA_API_URL=http://localhost:11434
```

#### 2.4 백엔드 실행

```bash
python main.py
```

### 3. 프론트엔드 설정

#### 3.1 의존성 설치

```bash
cd frontend
npm install
```

#### 3.2 프론트엔드 실행

```bash
npm run dev
```

### 4. 데이터베이스 설정

#### 4.1 Neo4j 설정 - 루트에서 바로 실행

<details>
  <summary><b>PowerShell</b></summary>

```powershell
# Run from REPO ROOT (PowerShell)
$ErrorActionPreference = 'Stop'

# 0) 버전/경로
$VER      = '2025.07.1'
$ZIP_NAME = "neo4j-community-$VER-windows.zip"
$ZIP_URL  = "https://neo4j.com/artifact.php?name=$ZIP_NAME"

$ROOT    = (Get-Location).Path
$STAGE   = Join-Path $ROOT "neo4j"       # 1차 작업용(stage)
$BACKEND = Join-Path $ROOT "backend"
$TARGET  = Join-Path $BACKEND "neo4j"    # 최종 목적지: backend/neo4j

# 1) stage 준비
if (Test-Path $STAGE) { Remove-Item $STAGE -Recurse -Force }
New-Item -ItemType Directory -Path $STAGE | Out-Null
if (-not (Test-Path $BACKEND)) { New-Item -ItemType Directory -Path $BACKEND | Out-Null }

# 2) ZIP 다운로드 → stage에 저장
$ZIPPATH = Join-Path $STAGE $ZIP_NAME
Invoke-WebRequest -Uri $ZIP_URL -OutFile $ZIPPATH

# (선택) 무결성 확인 - SHA256 해시 비교
# Get-FileHash $ZIPPATH -Algorithm SHA256 | Format-List

# 3) 압축 해제(같은 stage 안에 풀림)
Expand-Archive -Path $ZIPPATH -DestinationPath $STAGE -Force

# 4) 추출된 "neo4j-community-*" 폴더를 'neo4j'로 리네임
$extracted = Get-ChildItem -Path $STAGE -Directory |
  Where-Object { $_.Name -like "neo4j-community-*" } | Select-Object -First 1
if (-not $extracted) { throw "Neo4j folder not found under $STAGE" }

$prepared = Join-Path $STAGE "neo4j"
if (Test-Path $prepared) { Remove-Item $prepared -Recurse -Force }
Rename-Item -Path $extracted.FullName -NewName "neo4j"

# 5) neo4j.conf에서 '#dbms.security.auth_enabled=false' 주석 해제
$CONF = Join-Path $prepared "conf\neo4j.conf"
if (-not (Test-Path $CONF)) { throw "neo4j.conf not found: $CONF" }

$content = Get-Content $CONF
$changed = $false

# a) 정확히 주석 처리된 줄이면 주석만 제거
$new = $content -replace '^\s*#\s*(dbms\.security\.auth_enabled\s*=\s*false)\s*$', '$1'
if ($new -ne $content) { $changed = $true; $content = $new }

# b) 해당 키가 없으면 줄 추가(개발 편의용)
if (-not ($content -match '^\s*dbms\.security\.auth_enabled\s*=')) {
  $content += 'dbms.security.auth_enabled=false'
  $changed = $true
}

if ($changed) { $content | Set-Content $CONF -Encoding UTF8 }

# 6) stage/neo4j -> backend/neo4j 이동
if (Test-Path $TARGET) { Remove-Item $TARGET -Recurse -Force }
Move-Item -LiteralPath $prepared -Destination $TARGET -Force

# (선택) stage 정리
Remove-Item $STAGE -Recurse -Force

Write-Host "✔ Prepared and moved to: $TARGET"
Write-Host "✔ Edited: $CONF"
```
</details>

<details>
   <summary><b>Git Bash</b></summary>

```bash
set -euo pipefail

VER=2025.07.1
ZIP_NAME="neo4j-community-$VER-windows.zip"
ZIP_URL="https://neo4j.com/artifact.php?name=$ZIP_NAME"

ROOT="$PWD"
STAGE="$ROOT/neo4j"          # stage에서 폴더 구조 먼저 완성
BACKEND="$ROOT/backend"
TARGET="$BACKEND/neo4j"

rm -rf "$STAGE"
mkdir -p "$STAGE" "$BACKEND"

# 1) 다운로드 (리다이렉트 따라가기)
curl -L -o "$STAGE/$ZIP_NAME" "$ZIP_URL"

# 2) 압축 해제
if command -v unzip >/dev/null 2>&1; then
  unzip -q "$STAGE/$ZIP_NAME" -d "$STAGE"
else
  tar -xf "$STAGE/$ZIP_NAME" -C "$STAGE"
fi

# 3) 추출된 폴더를 'neo4j'로 정규화
extracted="$(find "$STAGE" -maxdepth 1 -type d -name 'neo4j-community-*' | head -n1)"
[ -n "$extracted" ] || { echo "Neo4j folder not found under $STAGE"; exit 1; }
rm -rf "$STAGE/neo4j"
mv "$extracted" "$STAGE/neo4j"

# 4) neo4j.conf 주석 해제 또는 추가
CONF="$STAGE/neo4j/conf/neo4j.conf"
if grep -Eq '^\s*#\s*dbms\.security\.auth_enabled\s*=\s*false\s*$' "$CONF"; then
  sed -i -E 's/^\s*#\s*(dbms\.security\.auth_enabled\s*=\s*false)\s*$/\1/' "$CONF"
elif ! grep -Eq '^\s*dbms\.security\.auth_enabled\s*=' "$CONF"; then
  printf '\n%s\n' 'dbms.security.auth_enabled=false' >> "$CONF"
fi

# 5) stage/neo4j -> backend/neo4j 이동
rm -rf "$TARGET"
mv "$STAGE/neo4j" "$TARGET"
rm -rf "$STAGE"

echo "✔ Prepared and moved to: $TARGET"
echo "✔ Edited: $CONF"
```
</details>

#### 4.2 Ollama 설정 (로컬 AI 모델)

<a href="https://ollama.com/download"
   rel="noopener noreferrer">Ollama 다운로드</a>

## 🐳 도커 실행

### 전체 스택 실행

```bash
# 모든 서비스 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 특정 서비스만 실행
docker-compose up backend frontend
```

### 개별 서비스 실행

```bash
# 백엔드만 실행
docker-compose up backend

# 프론트엔드만 실행
docker-compose up frontend

# 데이터베이스만 실행
docker-compose up neo4j ollama
```

### 서비스 중지 및 정리

```bash
# 서비스 중지
docker-compose down

# 볼륨까지 삭제
docker-compose down -v

# 이미지 재빌드
docker-compose build --no-cache
```

## 🌐 접속 정보

| 서비스             | URL                        | 설명                     |
| ------------------ | -------------------------- | ------------------------ |
| **프론트엔드**     | http://localhost:5173      | 메인 웹 애플리케이션     |
| **백엔드 API**     | http://localhost:8000      | REST API 서버            |
| **Swagger 문서**   | http://localhost:8000/docs | API 문서 및 테스트       |
| **Neo4j 브라우저** | http://localhost:7474      | 그래프 데이터베이스 관리 |
| **Ollama API**     | http://localhost:11434     | 로컬 AI 모델 API         |

## 📚 추가 리소스

- [프로젝트 README](./README.md)
- [지식 그래프 문서](./KNOWLEDGE_GRAPH.md)
- [API 문서](http://localhost:8000/docs)
- [Neo4j 문서](https://neo4j.com/docs/)
- [FastAPI 문서](https://fastapi.tiangolo.com/)

## 🤝 기여하기

프로젝트에 기여하고 싶으시다면:

1. 이슈를 생성하여 버그나 기능 요청을 제안
2. Fork 후 Pull Request 제출
3. 코드 리뷰 및 테스트 참여

## 📞 지원

문제가 발생하거나 도움이 필요하시면:

- [GitHub Issues](https://github.com/OSSBrainTrace/BrainTrace/issues) 생성
- 프로젝트 문서 참조
- 커뮤니티 포럼 활용

---

**⚠️ 주의사항**: AI 모델 다운로드로 인해 디스크 용량이 많이 필요할 수 있습니다. 모델 파일당 최대 10GB까지 여유공간이 필요할 수 있습니다.
