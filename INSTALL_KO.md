# BrainTrace 실행 가이드

> **BrainTrace**는 지식 그래프 기반 AI 챗봇 시스템으로, 문서를 업로드하면 자동으로 지식 그래프를 구축하고 정확한 답변을 생성합니다.

## 목차

- [시스템 요구사항](#시스템-요구사항)
- [상세 설치 가이드](#상세-설치-가이드)
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
| **A) 외부 LLM 사용 / 로컬 LLM 미사용**    | 2–4코어 | **≥ 8GB**                 | 10–20GB |
| **B) 로컬 LLM (Ollama 7B, Q4 기준) 사용** | 4–8코어 | **최소 12GB (권장 16GB)** | 30–50GB+ (모델/캐시)  |

**권장 사양**

- CPU: 6코어
- 메모리: 16GB RAM
- 저장공간: 50GB+ 여유 공간 (AI 모델 및 데이터베이스용)


## 상세 설치 가이드 (일반 환경 실행, docker 실행 中 택 1) <a id="상세-설치-가이드"></a>
### 1. 일반 환경 실행

```bash
git clone https://github.com/Qubit02/BrainTrace.git
cd BrainTrace
```

### 1.1 백엔드 설정

#### 1.1.1 Python 가상환경 생성 및 활성화(BrainTrace/ 에서 시작)

```bash
cd backend

# 가상환경 생성
python -m venv venv
```

#### 가상환경 활성화

```
# Windows
venv\Scripts\activate
```

```
# macOS/Linux
source venv/bin/activate
```

#### 1.1.2 의존성 설치

```bash
pip install -r requirements.txt
```

#### 1.1.3 환경 변수 설정

```bash
# .env 파일 생성 -> backend/.env

#Ollama 사용 시 모델 설치 위치 변수 추가
OLLAMA_MODELS=./models/ollama

# API 키 입력
# OPENAI_API_KEY=your_api_key_here
```

### 1.2 데이터베이스 설정

#### 1.2.1 Neo4j 설치

> 아래에서 사용하는 스크립트는 실행 위치를 자동 감지합니다. 터미널에서 **저장소 루트(BrainTrace/)** 또는 **backend/** 에 아래의 코드 중 하나를 붙여넣으세요.

#### 윈도우 설치(Powershell, Git Bash 본인이 사용할 터미널의 코드를 복사)

<details>
<summary><strong>PowerShell (Windows)</strong></summary>
  
```powershell
# Neo4j Community 자동 설치 (Windows PowerShell 5.1+ / PowerShell 7+)
# - backend/ 또는 루트(backend 폴더가 보이는 위치)에서 실행
# - 최신 버전 자동 탐지 / HttpClient 고속 다운로드 / conf 안전 수정

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --- 0) 설정 & 경로 규칙 -----------------------------------------------------
if (-not $Version) { $Version = 'latest' }   # 필요시 -Version '5.26.12' 로 덮어쓰기

$CWD = (Get-Location).Path
$HereIsBackend = ((Split-Path -Leaf $CWD) -eq 'backend')
$HereHasBackendChild = Test-Path (Join-Path $CWD 'backend')

if ($HereIsBackend) {
  # backend/ 에서 실행 → ./neo4j
  $ROOT    = Split-Path $CWD -Parent
  $BACKEND = $CWD
  $TARGET  = Join-Path $CWD 'neo4j'
}
elseif ($HereHasBackendChild) {
  # 루트에서 실행 → backend/neo4j
  $ROOT    = $CWD
  $BACKEND = Join-Path $ROOT 'backend'
  $TARGET  = Join-Path $BACKEND 'neo4j'
}
else {
  throw "여기서는 실행하지 마세요. 루트(backend 폴더가 보이는 곳) 또는 backend 폴더에서 실행하세요."
}

$STAGE  = Join-Path $ROOT 'neo4j_stage'

# TLS 1.2 강제 (구형 환경 호환)
if (-not ([Net.ServicePointManager]::SecurityProtocol -band [Net.SecurityProtocolType]::Tls12)) {
  [Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}

# --- 1) 최신 버전 자동 탐지 ---------------------------------------------------
function Get-LatestNeo4jVersion {
  $pages = @(
    'https://neo4j.com/graph-data-science-software/',
    'https://neo4j.com/deployment-center/'
  )

  foreach ($u in $pages) {
    try { $resp = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 30 } catch { continue }

    $links = @()
    if ($resp.Links) { $links = $resp.Links }

    $href = $links `
      | Where-Object { $_.href -match 'download-thanks\.html' } `
      | Where-Object { $_.href -match 'edition=community' } `
      | Where-Object { ($_.href -match 'winzip') -or ($_.href -match 'packaging=zip') } `
      | Where-Object { $_.href -match 'release=' } `
      | Select-Object -First 1 -ExpandProperty href

    if ($href) {
      $q = ([uri]"https://dummy.local/?$([uri]$href).Query").Query.TrimStart('?')
      $pairs = @{}
      foreach ($kv in $q -split '&') {
        $k,$v = $kv -split '=',2
        if ($k) { $pairs[$k] = [uri]::UnescapeDataString($v) }
      }
      if ($pairs['release']) { return $pairs['release'] }
    }

    $m = [regex]::Match($resp.Content, 'Neo4j Community Edition\s+(?<v>(2025\.\d{2}\.\d+|\d+\.\d+\.\d+))')
    if ($m.Success) { return $m.Groups['v'].Value }
  }

  throw "최신 버전을 찾지 못했습니다. -Version '5.26.12' 같은 식으로 지정하세요."
}

if ($Version -eq 'latest') { $Version = Get-LatestNeo4jVersion }
Write-Host "Using Neo4j Community version: $Version"

# --- 2) 다운로드 --------------------------------------------------------------
$zipFileName = "neo4j-community-$Version-windows.zip"
$ZIPPATH     = Join-Path $STAGE $zipFileName

$urls = @(
  "https://dist.neo4j.org/$zipFileName",                   # CDN (빠름)
  "https://neo4j.com/artifact.php?name=$zipFileName"       # 백업
)

# Stage 초기화
if (Test-Path $STAGE) { Remove-Item $STAGE -Recurse -Force }
New-Item -ItemType Directory -Path $STAGE | Out-Null
if (-not (Test-Path $BACKEND)) { New-Item -ItemType Directory -Path $BACKEND | Out-Null }

function Try-Download($url) {
  try {
    Write-Host "Downloading via HttpClient: $url"

    # PowerShell 5.x 호환: HttpClient 타입 로드
    if (-not ([System.Management.Automation.PSTypeName]'System.Net.Http.HttpClient').Type) {
      Add-Type -AssemblyName 'System.Net.Http'
    }

    $client = [System.Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromMinutes(15)
    $resp = $client.GetAsync($url, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).Result
    $resp.EnsureSuccessStatusCode()
    $fs = [System.IO.FileStream]::new($ZIPPATH, [System.IO.FileMode]::Create)
    $resp.Content.CopyToAsync($fs).Wait()
    $fs.Close()
    $client.Dispose()

    if ((Get-Item $ZIPPATH).Length -gt 10MB) { return $true } else { Remove-Item $ZIPPATH -Force }
  } catch {
    Write-Host "Download failed: $($_.Exception.Message)"
    return $false
  }
}

$ok = $false
foreach ($u in $urls) { if (Try-Download $u) { $ok = $true; break } }
if (-not $ok) { throw "Neo4j ZIP 다운로드 실패" }

# --- 3) 압축 해제 & 폴더 정리 ------------------------------------------------
Expand-Archive -Path $ZIPPATH -DestinationPath $STAGE -Force

$extracted = Get-ChildItem -Path $STAGE -Directory `
  | Where-Object { $_.Name -like "neo4j-community-*" } `
  | Select-Object -First 1
if (-not $extracted) { throw "압축 해제 후 폴더를 찾을 수 없습니다." }

$prepared = Join-Path $STAGE "neo4j"
if (Test-Path $prepared) { Remove-Item $prepared -Recurse -Force }
Rename-Item -Path $extracted.FullName -NewName "neo4j"

# --- 4) conf 수정 (안전 버전) ------------------------------------------------
function Set-ContentUtf8NoBom {
  param([string]$Path, [string]$Text)
  $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($Text)  # no BOM
  [System.IO.File]::WriteAllBytes($Path, $bytes)
}

$CONF = Join-Path $prepared "conf\neo4j.conf"
if (-not (Test-Path $CONF)) { throw "neo4j.conf not found: $CONF" }

# 통째로 읽고 줄바꿈 통일
$text = Get-Content -LiteralPath $CONF -Raw
$text = $text -replace "`r?`n", "`r`n"

# 주석/비주석/공백 변형 모두 통일
$pattern = '^[\t ]*#?[\t ]*dbms\.security\.auth_enabled[\t ]*=[\t ]*(true|false)[\t ]*$'
if ($text -match $pattern) {
  $text = [System.Text.RegularExpressions.Regex]::Replace(
    $text, $pattern, 'dbms.security.auth_enabled=false',
    [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
} else {
  if ($text.Length -gt 0 -and $text[-1] -ne "`n") { $text += "`r`n" }
  $text += 'dbms.security.auth_enabled=false' + "`r`n"
}

Set-ContentUtf8NoBom -Path $CONF -Text $text

# --- 5) 대상 위치로 이동 (폴더명 정확히 고정) --------------------------------
# 부모 디렉터리 보장
$TARGET_PARENT = Split-Path $TARGET -Parent
if (-not (Test-Path $TARGET_PARENT)) {
  New-Item -ItemType Directory -Path $TARGET_PARENT | Out-Null
}
# 기존 타겟 있으면 삭제
if (Test-Path $TARGET) { Remove-Item $TARGET -Recurse -Force }

# 일단 부모로 옮기고, 이름을 정확히 맞춘다
Move-Item -LiteralPath $prepared -Destination $TARGET_PARENT -Force
$justMoved = Join-Path $TARGET_PARENT 'neo4j'
if ((Split-Path $TARGET -Leaf) -ne 'neo4j') {
  if (Test-Path $justMoved) {
    Rename-Item -Path $justMoved -NewName (Split-Path $TARGET -Leaf) -ErrorAction SilentlyContinue
  }
}

# Stage 정리
Remove-Item $STAGE -Recurse -Force

Write-Host "✅ Neo4j $Version 준비 완료"
Write-Host "📂 경로: $TARGET"
Write-Host "🛠️ conf 적용: $CONF"
```
</details> 

<details> <summary><strong>Git Bash (Windows)</strong></summary>

```bash
코드 복사
#!/usr/bin/env bash
# Neo4j Community 자동 설치 (Git Bash / Windows)
# - backend/ 또는 루트(backend가 보이는 위치)에서 실행
# - 최신 버전 자동 탐지 → ZIP 다운로드 → 압축 해제 → conf 수정(auth 비활성)

set -euo pipefail

VERSION="${VERSION:-latest}"   # 예: VERSION=5.26.12 ./install_neo4j_gitbash.sh
die(){ echo "Error: $*" >&2; exit 1; }

# 실행 위치 규칙
CWD="$(pwd)"
if [[ "$(basename "$CWD")" == "backend" ]]; then
  ROOT="$(dirname "$CWD")"; BACKEND="$CWD"; TARGET="$CWD/neo4j"
elif [[ -d "$CWD/backend" ]]; then
  ROOT="$CWD"; BACKEND="$ROOT/backend"; TARGET="$BACKEND/neo4j"
else
  die "루트(backend 보이는 곳) 또는 backend 폴더에서 실행하세요."
fi
STAGE="$ROOT/neo4j_stage"

# 의존성
command -v curl >/dev/null || die "curl 필요"
command -v unzip >/dev/null || die "unzip 필요"
SED="sed"; command -v gsed >/dev/null && SED="gsed"

# 최신 버전 자동 탐지
get_latest_version() {
  local pages=(
    "https://neo4j.com/graph-data-science-software/"
    "https://neo4j.com/deployment-center/"
  )
  local ver=""
  for u in "${pages[@]}"; do
    html="$(curl -fsSL --max-time 30 "$u" || true)"; [[ -z "$html" ]] && continue
    rel="$(printf '%s' "$html" \
      | grep -Eo 'https?://[^"]*download-thanks[^"]+' \
      | grep -E 'edition=community' \
      | grep -E 'flavour=winzip|packaging=zip' \
      | grep -Eo 'release=[0-9]+\.[0-9]+\.[0-9]+' \
      | head -n1 | cut -d= -f2)"
    if [[ -n "$rel" ]]; then ver="$rel"; break; fi
    rel="$(printf '%s' "$html" \
      | grep -Eo 'Neo4j Community Edition[[:space:]]+[0-9]+\.[0-9]+\.[0-9]+' \
      | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)"
    [[ -n "$rel" ]] && { ver="$rel"; break; }
  done
  [[ -z "$ver" ]] && die "최신 버전 탐지 실패. VERSION 환경변수로 지정하세요."
  printf '%s' "$ver"
}
[[ "$VERSION" == "latest" ]] && VERSION="$(get_latest_version)"
echo "Using Neo4j Community version: $VERSION"

ZIP="neo4j-community-$VERSION-windows.zip"
URLS=(
  "https://dist.neo4j.org/$ZIP"
  "https://neo4j.com/artifact.php?name=$ZIP"
)

rm -rf "$STAGE"; mkdir -p "$STAGE" "$BACKEND"
ARCHIVE="$STAGE/$ZIP"

download() {
  local url="$1"
  echo "Downloading: $url"
  curl -fL --retry 5 --retry-delay 2 \
       --connect-timeout 25 --max-time 1800 \
       --speed-time 30 --speed-limit 10240 \
       -o "$ARCHIVE" "$url"
}
ok=0
for u in "${URLS[@]}"; do
  if download "$u"; then
    sz="$(wc -c <"$ARCHIVE" 2>/dev/null || echo 0)"
    if [[ "$sz" -gt $((10*1024*1024)) ]]; then ok=1; break; else rm -f "$ARCHIVE"; fi
  fi
done
[[ $ok -eq 1 ]] || die "Neo4j ZIP 다운로드 실패"

unzip -q "$ARCHIVE" -d "$STAGE"
extracted="$(find "$STAGE" -maxdepth 1 -type d -name 'neo4j-community-*' | head -n1)"
[[ -n "$extracted" ]] || die "압축 해제 후 폴더를 찾을 수 없음"

prepared="$STAGE/neo4j"
rm -rf "$prepared"; mv "$extracted" "$prepared"

CONF="$prepared/conf/neo4j.conf"
[[ -f "$CONF" ]] || die "neo4j.conf not found: $CONF"

# 주석/비주석 통합하여 auth 비활성화
if grep -Eq '^[[:space:]]*#?[[:space:]]*dbms\.security\.auth_enabled[[:space:]]*=' "$CONF"; then
  "$SED" -i -E 's/^[[:space:]]*#?[[:space:]]*dbms\.security\.auth_enabled[[:space:]]*=[[:space:]]*(true|false)[[:space:]]*$/dbms.security.auth_enabled=false/' "$CONF"
else
  printf '\n%s\n' 'dbms.security.auth_enabled=false' >> "$CONF"
fi

mkdir -p "$(dirname "$TARGET")"
rm -rf "$TARGET"
mv "$prepared" "$(dirname "$TARGET")"
if [[ "$(basename "$TARGET")" != "neo4j" && -d "$(dirname "$TARGET")/neo4j" ]]; then
  mv "$(dirname "$TARGET")/neo4j" "$TARGET"
fi

rm -rf "$STAGE"
echo "✅ Neo4j $VERSION 준비 완료"
echo "📂 경로: $TARGET"
echo "🛠️ conf 적용: $CONF"
```

</details> 

#### Mac에서 설치

<details><summary><strong>macOS / Linux</strong></summary>

```bash
( set -eu
  set +u; set -o pipefail 2>/dev/null || true; set -u

  : "${VERSION:=latest}"

  CWD="$PWD"
  if [[ "$(basename "$CWD")" == "backend" ]]; then
    ROOT="$(dirname "$CWD")"; BACKEND="$CWD"; TARGET="$BACKEND/neo4j"
  elif [[ -d "$CWD/backend" ]]; then
    ROOT="$CWD"; BACKEND="$ROOT/backend"; TARGET="$BACKEND/neo4j"
  else
    echo "❌ 여기서는 실행하지 마세요. 루트(backend 폴더 보이는 위치) 또는 backend/ 에서 실행" >&2
    exit 1
  fi
  STAGE="$ROOT/neo4j_stage"

  get_latest_version() {
    local pages=(
      "https://neo4j.com/graph-data-science-software/"
      "https://neo4j.com/deployment-center/"
    )
    local html rel
    for u in "${pages[@]}"; do
      html="$(curl -fsSL --max-time 30 "$u" || true)" || true
      [[ -z "$html" ]] && continue
      rel="$(printf '%s' "$html" \
        | grep -Eo 'https?://[^"]*download-thanks[^"]+' \
        | grep -E 'edition=community' \
        | grep -E 'unix|packaging=tar(\.gz)?|packaging=zip' \
        | grep -Eo 'release=[0-9]+\.[0-9]+\.[0-9]+' \
        | head -n1 | cut -d= -f2)"
      [[ -n "$rel" ]] && { printf '%s' "$rel"; return 0; }
      rel="$(printf '%s' "$html" \
        | grep -Eo 'Neo4j Community Edition[[:space:]]+[0-9]+\.[0-9]+\.[0-9]+' \
        | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' \
        | head -n1)"
      [[ -n "$rel" ]] && { printf '%s' "$rel"; return 0; }
    done
    return 1
  }

  if [[ "$VERSION" == "latest" ]]; then
    echo "🌐 최신 버전 확인 중..."
    if ! VERSION="$(get_latest_version)"; then
      echo "❌ 최신 버전 탐지 실패. 환경변수 VERSION으로 지정하세요. (예: export VERSION=5.26.12)" >&2
      exit 1
    fi
  fi
  echo "✅ Using Neo4j Community version: $VERSION"

  TAR="neo4j-community-$VERSION-unix.tar.gz"
  URLS=(
    "https://dist.neo4j.org/$TAR"
    "https://neo4j.com/artifact.php?name=$TAR"
  )

  rm -rf "$STAGE"; mkdir -p "$STAGE" "$BACKEND"
  ARCHIVE="$STAGE/$TAR"

  download() {
    local url="$1"
    echo "⬇️  Downloading: $url"
    curl -fL --retry 5 --retry-delay 2 \
      --connect-timeout 25 --max-time 1800 \
      --speed-time 30 --speed-limit 10240 \
      -o "$ARCHIVE" "$url"
  }
  ok=0
  for u in "${URLS[@]}"; do
    if download "$u"; then
      sz="$(wc -c <"$ARCHIVE" 2>/dev/null || echo 0)"
      if [[ "$sz" -gt $((10*1024*1024)) ]]; then ok=1; break; else rm -f "$ARCHIVE"; fi
    fi
  done
  [[ $ok -eq 1 ]] || { echo "❌ Neo4j tarball 다운로드 실패" >&2; exit 1; }

  tar -xzf "$ARCHIVE" -C "$STAGE"
  extracted="$(find "$STAGE" -maxdepth 1 -type d -name 'neo4j-community-*' | head -n1)"
  [[ -n "$extracted" ]] || { echo "❌ 압축 해제 후 폴더를 찾을 수 없습니다." >&2; exit 1; }

  prepared="$STAGE/neo4j"
  rm -rf "$prepared"; mv "$extracted" "$prepared"

  CONF="$prepared/conf/neo4j.conf"
  [[ -f "$CONF" ]] || { echo "❌ neo4j.conf not found: $CONF" >&2; exit 1; }

  if command -v gsed >/dev/null 2>&1; then SED="gsed"; else SED="sed"; fi
  if "$SED" --version >/dev/null 2>/dev/null; then
    if "$SED" -E -n 's/^[[:space:]]*#?[[:space:]]*dbms\.security\.auth_enabled[[:space:]]*=.*/X/p' "$CONF" | grep -q .; then
      "$SED" -i -E 's/^[[:space:]]*#?[[:space:]]*dbms\.security\.auth_enabled[[:space:]]*=[[:space:]]*(true|false)[[:space:]]*$/dbms.security.auth_enabled=false/' "$CONF"
    else
      printf '\n%s\n' 'dbms.security.auth_enabled=false' >> "$CONF"
    fi
  else
    if "$SED" -E -n 's/^[[:space:]]*#?[[:space:]]*dbms\.security\.auth_enabled[[:space:]]*=.*/X/p' "$CONF" | grep -q .; then
      "$SED" -i '' -E 's/^[[:space:]]*#?[[:space:]]*dbms\.security\.auth_enabled[[:space:]]*=[[:space:]]*(true|false)[[:space:]]*$/dbms.security.auth_enabled=false/' "$CONF"
    else
      printf '\n%s\n' 'dbms.security.auth_enabled=false' >> "$CONF"
    fi
  fi

  mkdir -p "$(dirname "$TARGET")"
  rm -rf "$TARGET"
  mv "$prepared" "$(dirname "$TARGET")"
  if [[ "$(basename "$TARGET")" != "neo4j" && -d "$(dirname "$TARGET")/neo4j" ]]; then
    mv "$(dirname "$TARGET")/neo4j" "$TARGET"
  fi

  rm -rf "$STAGE"
  echo ""
  echo "✅ Neo4j $VERSION 준비 완료"
  echo "📂 경로: $TARGET"
  echo "🛠️ conf 적용: $CONF"
  echo "🚀 실행 예:  $TARGET/bin/neo4j console"
)
```
</details>

#### 1.2.2 Ollama 설정 (로컬 AI 모델)

[Ollama 다운로드](https://ollama.com/download)

#### 1.2.3 백엔드 실행

```bash
cd frontend
npm install
```

### 1.3 프론트엔드 실행

#### 1.3.1 의존성 설치(BrainTrace/ 에서 시작)

```bash
cd frontend
npm install
```

#### 1.3.2 프론트엔드 실행

```bash
npm run dev
```
---
### 2. 도커로 실행

```bash
# 저장소 클론
git clone https://github.com/Qubit02/BrainTrace.git
cd BrainTrace

# 도커 컴포즈로 실행
docker-compose up -d

# 브라우저에서 접속
# 프론트엔드: http://localhost:5173
# 백엔드 API: http://localhost:8000
# Neo4j: http://localhost:7474
```

### 전체 스택 실행

```bash
# 모든 서비스 실행
docker-compose up -d
```

### 개별 서비스 실행

```bash
# 백엔드만 실행
docker-compose up backend

# 프론트엔드만 실행
docker-compose up frontend

# neo4j/ollama 공식 컨테이너 실행
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
