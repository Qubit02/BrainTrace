# BrainTrace 실행 가이드

> **BrainTrace**는 지식 그래프 기반 AI 챗봇 시스템으로, 문서를 업로드하면 자동으로 지식 그래프를 구축하고 정확한 답변을 생성합니다.

## 목차

- [시스템 요구사항](#시스템-요구사항)
- [빠른 시작](#빠른-시작)
- [상세 설치 가이드](#상세-설치-가이드)
- [도커 실행](#도커-실행)
- [접속 정보](#접속-정보)
- [추가 리소스](#추가-리소스)

## 시스템 요구사항

### 기본 요구사항

- **운영체제**: Windows 10/11
- **Python**: 3.12
- **Node.js**: 20.19.0 이상
- **Neo4j**: 하단 참조
- **Ollama**: 하단 참조

### 하드웨어 요구사항

#### 프로파일 A: 외부 LLM 사용 / 로컬 LLM 미사용

| 프로파일                                  | CPU     | RAM                       | 디스크                |
| ----------------------------------------- | ------- | ------------------------- | --------------------- |
| **A) 외부 LLM 사용 / 로컬 LLM 미사용**    | 2–4코어 | **≥ 8GB**                 | 10–20GB (이미지/로그) |
| **B) 로컬 LLM (Ollama 7B, Q4 기준) 사용** | 4–8코어 | **최소 12GB (권장 16GB)** | 30–50GB+ (모델/캐시)  |

**권장 사양**

- CPU: 8코어
- 메모리: 16GB RAM
- 저장공간: 50GB+ 여유 공간 (AI 모델 및 데이터베이스용)


## 상세 설치 가이드

### 1. 도커로 실행

```bash
# 저장소 클론
git clone https://github.com/OSSBrainTrace/BrainTrace.git
cd BrainTrace

# 도커 컴포즈로 실행
docker-compose up -d

# 브라우저에서 접속
# 프론트엔드: http://localhost:5173
# 백엔드 API: http://localhost:8000
# Neo4j: http:
//localhost:7474
```

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


### 2. 일반 환경 실행

```bash
git clone https://github.com/OSSBrainTrace/BrainTrace.git
cd BrainTrace
```

### 2.1 백엔드 설정

#### 2.1.1 Python 가상환경 생성 및 활성화

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

#### 2.1.2 의존성 설치

```bash
pip install -r requirements.txt
```

#### 2.1.3 환경 변수 설정

```bash
# .env 파일 생성 -> backend/.env

# API 키 및 입력
# OPENAI_API_KEY=your_api_key_here
```

#### 2.1.4 백엔드 실행

```bash
python main.py
```

### 2.2 프론트엔드 설정

#### 2.2.1 의존성 설치

```bash
cd frontend
npm install
```

#### 2.2.2 프론트엔드 실행

```bash
npm run dev
```

### 2.3 데이터베이스 설정

#### 2.3.1 Neo4j 설정

**PowerShell 실행 (저장소 루트에서)**

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --- 0) 버전 설정 -------------------------------------------------------------
# 'latest' 또는 '2025.08.0' 같은 고정 버전 지정 가능
$Version = 'latest'

# TLS1.2 강제 (구형 PowerShell 호환용)
if (-not ([Net.ServicePointManager]::SecurityProtocol -band [Net.SecurityProtocolType]::Tls12)) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}

$ROOT    = (Get-Location).Path
$STAGE   = Join-Path $ROOT "neo4j_stage"   # 임시 폴더
$BACKEND = Join-Path $ROOT "backend"
$TARGET  = Join-Path $BACKEND "neo4j"      # 최종 목적지

# --- 1) 최신 버전 자동 탐지 --------------------------------------------------
function Get-LatestNeo4jVersion {
  $pages = @(
    'https://neo4j.com/graph-data-science-software/',
    'https://neo4j.com/deployment-center/'
  )

  foreach ($u in $pages) {
    try { $resp = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 30 } catch { continue }

    # 링크 목록이 없을 수 있으니 null-safe
    $links = @()
    if ($resp.Links) { $links = $resp.Links }

    # 조건을 파이프라인으로 나눠서 필터링 (줄 앞에 -and 시작 안 함)
    $href = $links `
      | Where-Object { $_.href -match 'download-thanks\.html' } `
      | Where-Object { $_.href -match 'edition=community' } `
      | Where-Object { ($_.href -match 'winzip') -or ($_.href -match 'packaging=zip') } `
      | Where-Object { $_.href -match 'release=' } `
      | Select-Object -First 1 -ExpandProperty href

    if ($href) {
      # 쿼리 파라미터에서 release 값 추출
      $q = ([uri]"https://dummy.local/?$([uri]$href).Query").Query.TrimStart('?')
      $pairs = @{}
      foreach ($kv in $q -split '&') {
        $k,$v = $kv -split '=',2
        if ($k) { $pairs[$k] = [uri]::UnescapeDataString($v) }
      }
      if ($pairs['release']) { return $pairs['release'] }
    }

    # 페이지 본문에서 “Neo4j Community Edition <ver>” 패턴 탐색 (보조 수단)
    $m = [regex]::Match($resp.Content, 'Neo4j Community Edition\s+(?<v>(2025\.\d{2}\.\d+|\d+\.\d+\.\d+))')
    if ($m.Success) { return $m.Groups['v'].Value }
  }

  throw "최신 버전을 찾지 못했습니다. 직접 `$Version 변수에 버전을 지정하세요."
}

if ($Version -eq 'latest') {
  $Version = Get-LatestNeo4jVersion
}
Write-Host "Using Neo4j Community version: $Version"

# --- 2) 다운로드 --------------------------------------------------------------
$zipFileName = "neo4j-community-$Version-windows.zip"
$ZIPPATH     = Join-Path $STAGE $zipFileName

$urls = @(
  "https://go.neo4j.com/download-thanks.html?edition=community&flavour=winzip&release=$Version",
  "https://neo4j.com/download-thanks/?edition=community&packaging=zip&architecture=x64&release=$Version",
  "https://neo4j.com/artifact.php?name=$zipFileName",
  "https://dist.neo4j.org/$zipFileName"
)

if (Test-Path $STAGE) { Remove-Item $STAGE -Recurse -Force }
New-Item -ItemType Directory -Path $STAGE | Out-Null
if (-not (Test-Path $BACKEND)) { New-Item -ItemType Directory -Path $BACKEND | Out-Null }

function Try-Download($url) {
  try {
    Invoke-WebRequest -Uri $url -OutFile $ZIPPATH -TimeoutSec 1200 -UseBasicParsing
    if ((Get-Item $ZIPPATH).Length -gt 10MB) { return $true }
    else { Remove-Item $ZIPPATH -Force }
  } catch { return $false }
  return $false
}

$ok = $false
foreach ($u in $urls) {
  Write-Host "Trying: $u"
  if (Try-Download $u) { $ok = $true; break }
}
if (-not $ok) { throw "Neo4j ZIP 다운로드 실패" }

# --- 3) 압축 해제 & 폴더명 정리 ---------------------------------------------
Expand-Archive -Path $ZIPPATH -DestinationPath $STAGE -Force

$extracted = Get-ChildItem -Path $STAGE -Directory `
  | Where-Object { $_.Name -like "neo4j-community-*" } `
  | Select-Object -First 1
if (-not $extracted) { throw "압축 해제 후 폴더를 찾을 수 없음" }

$prepared = Join-Path $STAGE "neo4j"
if (Test-Path $prepared) { Remove-Item $prepared -Recurse -Force }
Rename-Item -Path $extracted.FullName -NewName "neo4j"

# --- 4) conf 수정 ------------------------------------------------------------
$CONF = Join-Path $prepared "conf\neo4j.conf"
if (-not (Test-Path $CONF)) { throw "neo4j.conf not found: $CONF" }

$content = Get-Content $CONF
$changed = $false
$new = $content -replace '^\s*#\s*(dbms\.security\.auth_enabled\s*=\s*false)\s*$', '$1'
if ($new -ne $content) { $changed = $true; $content = $new }
if (-not ($content -match '^\s*dbms\.security\.auth_enabled\s*=')) {
  $content += 'dbms.security.auth_enabled=false'
  $changed = $true
}
if ($changed) { $content | Set-Content $CONF -Encoding UTF8 }

# --- 5) backend/neo4j 로 이동 ------------------------------------------------
if (Test-Path $TARGET) { Remove-Item $TARGET -Recurse -Force }
Move-Item -LiteralPath $prepared -Destination $TARGET -Force

Remove-Item $STAGE -Recurse -Force
Write-Host "Prepared and moved to: $TARGET"
Write-Host "Edited: $CONF"

```

**Git Bash 실행 (저장소 루트에서)**

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

echo "Prepared and moved to: $TARGET"
echo "Edited: $CONF"
```

#### 2.3.2 Ollama 설정 (로컬 AI 모델)

[Ollama 다운로드](https://ollama.com/download)


## 접속 정보

| 서비스             | URL                        | 설명                     |
| ------------------ | -------------------------- | ------------------------ |
| **프론트엔드**     | http://localhost:5173      | 메인 웹 애플리케이션     |
| **백엔드 API**     | http://localhost:8000      | REST API 서버            |
| **Swagger 문서**   | http://localhost:8000/docs | API 문서 및 테스트       |
| **Neo4j 브라우저** | http://localhost:7474      | 그래프 데이터베이스 관리 |
| **Ollama API**     | http://localhost:11434     | 로컬 AI 모델 API         |

## 추가 리소스

- [프로젝트 README](./README.md)
- [지식 그래프 문서](./KNOWLEDGE_GRAPH.md)
- [API 문서](http://localhost:8000/docs)
- [Neo4j 문서](https://neo4j.com/docs/)
- [FastAPI 문서](https://fastapi.tiangolo.com/)

## 기여하기

프로젝트에 기여하고 싶으시다면:

1. 이슈를 생성하여 버그나 기능 요청을 제안
2. Fork 후 Pull Request 제출
3. 코드 리뷰 및 테스트 참여

## 지원

문제가 발생하거나 도움이 필요하시면:

- [GitHub Issues](https://github.com/OSSBrainTrace/BrainTrace/issues) 생성
- 프로젝트 문서 참조
- 커뮤니티 포럼 활용

---

**주의사항**: AI 모델 다운로드로 인해 디스크 용량이 많이 필요할 수 있습니다. 모델 파일당 최대 10GB까지 여유공간이 필요할 수 있습니다.
