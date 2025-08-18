# BrainTrace Installation & Run Guide

> **BrainTrace** is a knowledge‑graph–based AI chatbot system. When you upload documents, it automatically builds a knowledge graph and generates accurate answers.

## Table of Contents

- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Detailed Installation Guide](#detailed-installation-guide)
- [Run with Docker](#run-with-docker)
- [Access Information](#access-information)
- [Additional Resources](#additional-resources)

## System Requirements

### Basic Requirements

- **Operating System**: Windows 10/11
- **Python**: 3.12 or later
- **Node.js**: 20.19.0 or later
- **Neo4j**: see below
- **Ollama**: see below

### Hardware Requirements

#### Profile A: Use External LLM / Do Not Use Local LLM

| Profile                                        | CPU       | RAM                               | Disk                      |
| ---------------------------------------------- | --------- | ---------------------------------- | ------------------------- |
| **A) External LLM / No Local LLM**             | 2–4 cores | **≥ 8GB**                          | 10–20GB (images/logs)     |
| **B) Local LLM (Ollama 7B, Q4 baseline)**      | 4–8 cores | **Min 12GB (16GB recommended)**    | 30–50GB+ (models/cache)   |

**Recommended Specs**

- CPU: 8 cores
- Memory: 16GB RAM
- Storage: 50GB+ free space (for AI models and database)


## Detailed Installation Guide

### 1. Run with Docker

```bash
# Clone the repository
git clone https://github.com/OSSBrainTrace/BrainTrace.git
cd BrainTrace

# Start with Docker Compose
docker-compose up -d

# Open in your browser
# Frontend:   http://localhost:5173
# Backend API: http://localhost:8000
# Neo4j:      http://localhost:7474
```

### Run the Entire Stack

```bash
# Start all services
docker-compose up -d

# Tail logs
docker-compose logs -f

# Start specific services only
docker-compose up backend frontend
```

### Run Individual Services

```bash
# Backend only
docker-compose up backend

# Frontend only
docker-compose up frontend

# Database only
docker-compose up neo4j ollama
```

### Stop & Clean Up

```bash
# Stop services
docker-compose down

# Remove volumes as well
docker-compose down -v

# Rebuild images
docker-compose build --no-cache
```


### 2. Run in a Regular (Non-Docker) Environment

```bash
git clone https://github.com/OSSBrainTrace/BrainTrace.git
cd BrainTrace
```

### 2.1 Backend Setup

#### 2.1.1 Create & Activate Python Virtual Environment

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

#### 2.1.2 Install Dependencies

```bash
pip install -r requirements.txt
```

#### 2.1.3 Set Environment Variables

```bash
# Create .env file (inside backend directory)
cp .env.example .env

# Fill in required API keys and settings
# OPENAI_API_KEY=your_api_key_here
# NEO4J_URI=bolt://localhost:7687
# OLLAMA_API_URL=http://localhost:11434
```

#### 2.1.4 Run Backend

```bash
python main.py
```

### 2.2 Frontend Setup

#### 2.2.1 Install Dependencies

```bash
cd frontend
npm install
```

#### 2.2.2 Run Frontend

```bash
npm run dev
```

### 2.3 Database Setup

#### 2.3.1 Neo4j Setup

**Run in PowerShell (from repository root)**

```powershell
$ErrorActionPreference = 'Stop'

# 0) Version/paths
$VER      = '2025.07.1'
$ZIP_NAME = "neo4j-community-$VER-windows.zip"
$ZIP_URL  = "https://neo4j.com/artifact.php?name=$ZIP_NAME"

$ROOT    = (Get-Location).Path
$STAGE   = Join-Path $ROOT "neo4j"       # staging directory
$BACKEND = Join-Path $ROOT "backend"
$TARGET  = Join-Path $BACKEND "neo4j"    # final location: backend/neo4j

# 1) prepare stage
if (Test-Path $STAGE) { Remove-Item $STAGE -Recurse -Force }
New-Item -ItemType Directory -Path $STAGE | Out-Null
if (-not (Test-Path $BACKEND)) { New-Item -ItemType Directory -Path $BACKEND | Out-Null }

# 2) download ZIP to stage
$ZIPPATH = Join-Path $STAGE $ZIP_NAME
Invoke-WebRequest -Uri $ZIP_URL -OutFile $ZIPPATH

# 3) extract into stage
Expand-Archive -Path $ZIPPATH -DestinationPath $STAGE -Force

# 4) rename extracted "neo4j-community-*" folder to 'neo4j'
$extracted = Get-ChildItem -Path $STAGE -Directory |
  Where-Object { $_.Name -like "neo4j-community-*" } | Select-Object -First 1
if (-not $extracted) { throw "Neo4j folder not found under $STAGE" }

$prepared = Join-Path $STAGE "neo4j"
if (Test-Path $prepared) { Remove-Item $prepared -Recurse -Force }
Rename-Item -Path $extracted.FullName -NewName "neo4j"

# 5) in neo4j.conf, un-comment '#dbms.security.auth_enabled=false'
$CONF = Join-Path $prepared "conf\neo4j.conf"
if (-not (Test-Path $CONF)) { throw "neo4j.conf not found: $CONF" }

$content = Get-Content $CONF
$changed = $false

# a) if the exact commented line exists, just remove the comment
$new = $content -replace '^\s*#\s*(dbms\.security\.auth_enabled\s*=\s*false)\s*$', '$1'
if ($new -ne $content) { $changed = $true; $content = $new }

# b) if the key doesn't exist at all, append it (dev convenience)
if (-not ($content -match '^\s*dbms\.security\.auth_enabled\s*=')) {
  $content += 'dbms.security.auth_enabled=false'
  $changed = $true
}

if ($changed) { $content | Set-Content $CONF -Encoding UTF8 }

# 6) move stage/neo4j -> backend/neo4j
if (Test-Path $TARGET) { Remove-Item $TARGET -Recurse -Force }
Move-Item -LiteralPath $prepared -Destination $TARGET -Force

# (optional) clean stage
Remove-Item $STAGE -Recurse -Force

Write-Host "Prepared and moved to: $TARGET"
Write-Host "Edited: $CONF"
```

**Run in Git Bash (from repository root)**

```bash
set -euo pipefail

VER=2025.07.1
ZIP_NAME="neo4j-community-$VER-windows.zip"
ZIP_URL="https://neo4j.com/artifact.php?name=$ZIP_NAME"

ROOT="$PWD"
STAGE="$ROOT/neo4j"          # build stage
BACKEND="$ROOT/backend"
TARGET="$BACKEND/neo4j"

rm -rf "$STAGE"
mkdir -p "$STAGE" "$BACKEND"

# 1) download (follow redirects)
curl -L -o "$STAGE/$ZIP_NAME" "$ZIP_URL"

# 2) extract
if command -v unzip >/dev/null 2>&1; then
  unzip -q "$STAGE/$ZIP_NAME" -d "$STAGE"
else
  tar -xf "$STAGE/$ZIP_NAME" -C "$STAGE"
fi

# 3) normalize to 'neo4j' folder name
extracted="$(find "$STAGE" -maxdepth 1 -type d -name 'neo4j-community-*' | head -n1)"
[ -n "$extracted" ] || { echo "Neo4j folder not found under $STAGE"; exit 1; }
rm -rf "$STAGE/neo4j"
mv "$extracted" "$STAGE/neo4j"

# 4) un-comment or add setting in neo4j.conf
CONF="$STAGE/neo4j/conf/neo4j.conf"
if grep -Eq '^\s*#\s*dbms\.security\.auth_enabled\s*=\s*false\s*$' "$CONF"; then
  sed -i -E 's/^\s*#\s*(dbms\.security\.auth_enabled\s*=\s*false)\s*$//' "$CONF"
elif ! grep -Eq '^\s*dbms\.security\.auth_enabled\s*=' "$CONF"; then
  printf '\n%s\n' 'dbms.security.auth_enabled=false' >> "$CONF"
fi

# 5) move stage/neo4j -> backend/neo4j
rm -rf "$TARGET"
mv "$STAGE/neo4j" "$TARGET"
rm -rf "$STAGE"

echo "Prepared and moved to: $TARGET"
echo "Edited: $CONF"
```

#### 2.3.2 Ollama Setup (Local AI Models)

[Download Ollama](https://ollama.com/download)


## Access Information

| Service            | URL                        | Description               |
| ------------------ | -------------------------- | ------------------------- |
| **Frontend**       | http://localhost:5173      | Main web application      |
| **Backend API**    | http://localhost:8000      | REST API server           |
| **Swagger Docs**   | http://localhost:8000/docs | API docs & testing        |
| **Neo4j Browser**  | http://localhost:7474      | Graph database management |
| **Ollama API**     | http://localhost:11434     | Local AI model API        |

## Additional Resources

- [Project README](./README.md)
- [Knowledge Graph Docs](./KNOWLEDGE_GRAPH.md)
- [API Docs](http://localhost:8000/docs)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## Contributing

If you want to contribute to the project:

1. Open an issue to report bugs or request features
2. Fork the repo and submit a Pull Request
3. Participate in code review and testing

## Support

If you run into issues or need help:

- Open an issue: [GitHub Issues](https://github.com/OSSBrainTrace/BrainTrace/issues)
- Check the project documentation
- Use community forums

---

**Note**: AI model downloads may require substantial disk space. You may need up to 10GB of free space **per model file**.
