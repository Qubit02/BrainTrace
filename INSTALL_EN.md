# 🚀 BrainTrace Run Guide

> **BrainTrace** is a knowledge-graph-powered AI chatbot system. Upload documents, and it automatically builds a knowledge graph and generates accurate answers.

## 📋 Table of Contents

- [System Requirements](#-system-requirements)
- [Quick Start](#-quick-start)
- [Detailed Installation Guide](#-detailed-installation-guide)
- [Run with Docker](#-run-with-docker)

## 🔧 System Requirements

- **Operating System**: Windows 10/11
- **Python**: 3.12 or higher
- **Node.js**: 20.19.0 or higher
- **Neo4j** (see below)
- **Ollama** (see below)

### Minimum Requirements

| Profile | CPU | RAM | Disk |
|---|---|---|---|
| **A) Use external LLM / No local LLM** | 2–4 cores | **≥ 8GB** | 10–20GB (images/logs) |
| **B) Local LLM (Ollama 7B, Q4)** | 4–8 cores | **Min 12GB (16GB recommended)** | 30–50GB+ (model/cache) |

> **Common Guidance**  
> • Recommended memory: **16GB+**  
> • Minimum free disk: **10GB+** (add model size if using a local LLM)


### Recommended Specs
- **CPU**: 8 cores
- **Memory**: 16GB RAM
- **Storage**: 50GB+ free (AI models & database)

## ⚡ Quick Start

### Run with Docker

```bash
# Clone the repo
git clone https://github.com/OSSBrainTrace/BrainTrace.git
cd BrainTrace

# Start with Docker Compose
docker-compose up -d

# Open in browser
# Frontend:  http://localhost:5173
# Backend:   http://localhost:8000
# Neo4j:     http://localhost:7474
```

## 📖 Detailed Installation Guide

### 1. Clone the Repository

```bash
git clone https://github.com/OSSBrainTrace/BrainTrace.git
cd BrainTrace
```

### 2. Backend Setup

#### 2.1 Create & Activate Python Virtual Env

```bash
cd backend

# Create venv
python -m venv venv

# Activate venv
# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

#### 2.2 Install Dependencies

```bash
pip install -r requirements.txt
```

#### 2.3 Environment Variables

```bash
# Create .env file in backend directory
cp .env.example .env

# Fill in required API keys and settings
# OPENAI_API_KEY=your_api_key_here
# NEO4J_URI=bolt://localhost:7687
# OLLAMA_API_URL=http://localhost:11434
```

#### 2.4 Run the Backend

```bash
python main.py
```

### 3. Frontend Setup

#### 3.1 Install Dependencies

```bash
cd frontend
npm install
```

#### 3.2 Run the Frontend

```bash
npm run dev
```

### 4. Database Setup

#### 4.1 Neo4j Setup — Run from Repo Root

<details>
  <summary><b>PowerShell</b></summary>

```powershell
# Run from REPO ROOT (PowerShell)
$ErrorActionPreference = 'Stop'

# 0) Version/paths
$VER      = '2025.07.1'
$ZIP_NAME = "neo4j-community-$VER-windows.zip"
$ZIP_URL  = "https://neo4j.com/artifact.php?name=$ZIP_NAME"

$ROOT    = (Get-Location).Path
$STAGE   = Join-Path $ROOT "neo4j"       # staging
$BACKEND = Join-Path $ROOT "backend"
$TARGET  = Join-Path $BACKEND "neo4j"    # final destination: backend/neo4j

# 1) Prepare stage
if (Test-Path $STAGE) { Remove-Item $STAGE -Recurse -Force }
New-Item -ItemType Directory -Path $STAGE | Out-Null
if (-not (Test-Path $BACKEND)) { New-Item -ItemType Directory -Path $BACKEND | Out-Null }

# 2) Download ZIP → save to stage
$ZIPPATH = Join-Path $STAGE $ZIP_NAME
Invoke-WebRequest -Uri $ZIP_URL -OutFile $ZIPPATH

# (Optional) Integrity check - SHA256
# Get-FileHash $ZIPPATH -Algorithm SHA256 | Format-List

# 3) Extract to stage
Expand-Archive -Path $ZIPPATH -DestinationPath $STAGE -Force

# 4) Rename extracted "neo4j-community-*" to 'neo4j'
$extracted = Get-ChildItem -Path $STAGE -Directory |
  Where-Object { $_.Name -like "neo4j-community-*" } | Select-Object -First 1
if (-not $extracted) { throw "Neo4j folder not found under $STAGE" }

$prepared = Join-Path $STAGE "neo4j"
if (Test-Path $prepared) { Remove-Item $prepared -Recurse -Force }
Rename-Item -Path $extracted.FullName -NewName "neo4j"

# 5) In neo4j.conf, uncomment '#dbms.security.auth_enabled=false'
$CONF = Join-Path $prepared "conf\neo4j.conf"
if (-not (Test-Path $CONF)) { throw "neo4j.conf not found: $CONF" }

$content = Get-Content $CONF
$changed = $false

# a) If the exact commented line exists, just remove the comment
$new = $content -replace '^\s*#\s*(dbms\.security\.auth_enabled\s*=\s*false)\s*$', '$1'
if ($new -ne $content) { $changed = $true; $content = $new }

# b) If the key doesn't exist at all, append a new line (dev convenience)
if (-not ($content -match '^\s*dbms\.security\.auth_enabled\s*=')) {
  $content += 'dbms.security.auth_enabled=false'
  $changed = $true
}

if ($changed) { $content | Set-Content $CONF -Encoding UTF8 }

# 6) Move stage/neo4j -> backend/neo4j
if (Test-Path $TARGET) { Remove-Item $TARGET -Recurse -Force }
Move-Item -LiteralPath $prepared -Destination $TARGET -Force

# (Optional) clean stage
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
STAGE="$ROOT/neo4j"          # stage: prepare folder structure first
BACKEND="$ROOT/backend"
TARGET="$BACKEND/neo4j"

rm -rf "$STAGE"
mkdir -p "$STAGE" "$BACKEND"

# 1) Download (follow redirects)
curl -L -o "$STAGE/$ZIP_NAME" "$ZIP_URL"

# 2) Extract
if command -v unzip >/dev/null 2>&1; then
  unzip -q "$STAGE/$ZIP_NAME" -d "$STAGE"
else
  tar -xf "$STAGE/$ZIP_NAME" -C "$STAGE"
fi

# 3) Normalize extracted folder to 'neo4j'
extracted="$(find "$STAGE" -maxdepth 1 -type d -name 'neo4j-community-*' | head -n1)"
[ -n "$extracted" ] || { echo "Neo4j folder not found under $STAGE"; exit 1; }
rm -rf "$STAGE/neo4j"
mv "$extracted" "$STAGE/neo4j"

# 4) Uncomment or add neo4j.conf flag
CONF="$STAGE/neo4j/conf/neo4j.conf"
if grep -Eq '^\s*#\s*dbms\.security\.auth_enabled\s*=\s*false\s*$' "$CONF"; then
  sed -i -E 's/^\s*#\s*(dbms\.security\.auth_enabled\s*=\s*false)\s*$//' "$CONF"
elif ! grep -Eq '^\s*dbms\.security\.auth_enabled\s*=' "$CONF"; then
  printf '
%s
' 'dbms.security.auth_enabled=false' >> "$CONF"
fi

# 5) Move stage/neo4j -> backend/neo4j
rm -rf "$TARGET"
mv "$STAGE/neo4j" "$TARGET"
rm -rf "$STAGE"

echo "✔ Prepared and moved to: $TARGET"
echo "✔ Edited: $CONF"
```
</details>

#### 4.2 Ollama Setup (Local AI Models)

<a href="https://ollama.com/download" rel="noopener noreferrer">Download Ollama</a>

## 🐳 Run with Docker

### Bring up the full stack

```bash
# Start all services
docker-compose up -d

# Tail logs
docker-compose logs -f

# Start specific services
docker-compose up backend frontend
```

### Run individual services

```bash
# Backend only
docker-compose up backend

# Frontend only
docker-compose up frontend

# Databases only
docker-compose up neo4j ollama
```

### Stop & clean up

```bash
# Stop services
docker-compose down

# Remove volumes as well
docker-compose down -v

# Rebuild images
docker-compose build --no-cache
```

## 🌐 Access

| Service            | URL                         | Description                 |
|--------------------|-----------------------------|-----------------------------|
| **Frontend**       | http://localhost:5173       | Main web app                |
| **Backend API**    | http://localhost:8000       | REST API server             |
| **Swagger Docs**   | http://localhost:8000/docs  | API docs & testing          |
| **Neo4j Browser**  | http://localhost:7474       | Graph DB management         |
| **Ollama API**     | http://localhost:11434      | Local AI model API          |

## 📚 Additional Resources

- [Project README](./README.md)
- [Knowledge Graph Docs](./KNOWLEDGE_GRAPH.md)
- [API Docs](http://localhost:8000/docs)
- [Neo4j Docs](https://neo4j.com/docs/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)

## 🤝 Contributing

Want to contribute?

1. Open an issue for bugs or feature requests
2. Fork, then submit a Pull Request
3. Join code reviews and testing

## 📞 Support

If you run into problems or need help:

- Open a [GitHub Issue](https://github.com/OSSBrainTrace/BrainTrace/issues)
- Check the project docs
- Leverage community forums

---

**⚠️ Caution**: AI model downloads can consume significant disk space. Allow up to ~10GB per model file.
