# BrainTrace Execution Guide

> **BrainTrace** is a knowledge graph-based AI chatbot system that automatically builds a knowledge graph when documents are uploaded and generates accurate answers.

## Table of Contents

- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Detailed Installation Guide](#detailed-installation-guide)
- [Docker Execution](#docker-execution)
- [Access Information](#access-information)
- [Additional Resources](#additional-resources)

## System Requirements

### Basic Requirements

- **Operating System**: Windows 10/11
- **Python**: 3.12 or higher
- **Node.js**: 20.19.0 or higher
- **Neo4j**: See below
- **Ollama**: See below

### Hardware Requirements

#### Profile A: External LLM Usage / No Local LLM

| Profile                                         | CPU       | RAM                             | Disk                   |
| ----------------------------------------------- | --------- | ------------------------------- | ---------------------- |
| **A) External LLM Usage / No Local LLM**        | 2-4 cores | **≥ 8GB**                       | 10-20GB (images/logs)  |
| **B) Local LLM (Ollama 7B, Q4 standard) Usage** | 4-8 cores | **Min 12GB (16GB recommended)** | 30-50GB+ (model/cache) |

**Recommended Specifications**

## Quick Start

- CPU: 8 cores
- Memory: 16GB RAM
- Storage: 50GB+ free space (for AI models and database)

### Run with Docker

```bash
# Clone repository
git clone https://github.com/OSSBrainTrace/BrainTrace.git
cd BrainTrace

# Run with Docker Compose
docker-compose up -d

# Access in browser
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# Neo4j: http://localhost:7474
```

## Detailed Installation Guide

### 1. Clone Repository

```bash
git clone https://github.com/OSSBrainTrace/BrainTrace.git
cd BrainTrace
```

### 2. Backend Setup

#### 2.1 Create and Activate Python Virtual Environment

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
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
# Create .env file (in backend directory)
cp .env.example .env

# Enter required API keys and settings
# OPENAI_API_KEY=your_api_key_here
# NEO4J_URI=bolt://localhost:7687
# OLLAMA_API_URL=http://localhost:11434
```

#### 2.4 Run Backend

```bash
python main.py
```

### 3. Frontend Setup

#### 3.1 Install Dependencies

```bash
cd frontend
npm install
```

#### 3.2 Run Frontend

```bash
npm run dev
```

### 4. Database Setup

#### 4.1 Neo4j Setup

**PowerShell Execution (from repository root)**

```powershell
$ErrorActionPreference = 'Stop'

# 0) Version/paths
$VER      = '2025.07.1'
$ZIP_NAME = "neo4j-community-$VER-windows.zip"
$ZIP_URL  = "https://neo4j.com/artifact.php?name=$ZIP_NAME"

$ROOT    = (Get-Location).Path
$STAGE   = Join-Path $ROOT "neo4j"       # 1st stage work (stage)
$BACKEND = Join-Path $ROOT "backend"
$TARGET  = Join-Path $BACKEND "neo4j"    # Final destination: backend/neo4j

# 1) Prepare stage
if (Test-Path $STAGE) { Remove-Item $STAGE -Recurse -Force }
New-Item -ItemType Directory -Path $STAGE | Out-Null
if (-not (Test-Path $BACKEND)) { New-Item -ItemType Directory -Path $BACKEND | Out-Null }

# 2) Download ZIP → save to stage
$ZIPPATH = Join-Path $STAGE $ZIP_NAME
Invoke-WebRequest -Uri $ZIP_URL -OutFile $ZIPPATH

# 3) Extract (extracted to same stage)
Expand-Archive -Path $ZIPPATH -DestinationPath $STAGE -Force

# 4) Rename extracted "neo4j-community-*" folder to 'neo4j'
$extracted = Get-ChildItem -Path $STAGE -Directory |
  Where-Object { $_.Name -like "neo4j-community-*" } | Select-Object -First 1
if (-not $extracted) { throw "Neo4j folder not found under $STAGE" }

$prepared = Join-Path $STAGE "neo4j"
if (Test-Path $prepared) { Remove-Item $prepared -Recurse -Force }
Rename-Item -Path $extracted.FullName -NewName "neo4j"

# 5) Uncomment '#dbms.security.auth_enabled=false' in neo4j.conf
$CONF = Join-Path $prepared "conf\neo4j.conf"
if (-not (Test-Path $CONF)) { throw "neo4j.conf not found: $CONF" }

$content = Get-Content $CONF
$changed = $false

# a) If exactly commented line exists, just remove comment
$new = $content -replace '^\s*#\s*(dbms\.security\.auth_enabled\s*=\s*false)\s*$', '$1'
if ($new -ne $content) { $changed = $true; $content = $new }

# b) If key doesn't exist, add line (for development convenience)
if (-not ($content -match '^\s*dbms\.security\.auth_enabled\s*=')) {
  $content += 'dbms.security.auth_enabled=false'
  $changed = $true
}

if ($changed) { $content | Set-Content $CONF -Encoding UTF8 }

# 6) Move stage/neo4j -> backend/neo4j
if (Test-Path $TARGET) { Remove-Item $TARGET -Recurse -Force }
Move-Item -LiteralPath $prepared -Destination $TARGET -Force

# (Optional) Clean stage
Remove-Item $STAGE -Recurse -Force

Write-Host "Prepared and moved to: $TARGET"
Write-Host "Edited: $CONF"
```

**Git Bash Execution (from repository root)**

```bash
set -euo pipefail

VER=2025.07.1
ZIP_NAME="neo4j-community-$VER-windows.zip"
ZIP_URL="https://neo4j.com/artifact.php?name=$ZIP_NAME"

ROOT="$PWD"
STAGE="$ROOT/neo4j"          # Complete folder structure in stage first
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
  sed -i -E 's/^\s*#\s*(dbms\.security\.auth_enabled\s*=\s*false)\s*$/\1/' "$CONF"
elif ! grep -Eq '^\s*dbms\.security\.auth_enabled\s*=' "$CONF"; then
  printf '\n%s\n' 'dbms.security.auth_enabled=false' >> "$CONF"
fi

# 5) Move stage/neo4j -> backend/neo4j
rm -rf "$TARGET"
mv "$STAGE/neo4j" "$TARGET"
rm -rf "$STAGE"

echo "Prepared and moved to: $TARGET"
echo "Edited: $CONF"
```

#### 4.2 Ollama Setup (Local AI Models)

[Download Ollama](https://ollama.com/download)

## Docker Execution

### Full Stack Execution

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Run specific services only
docker-compose up backend frontend
```

### Individual Service Execution

```bash
# Backend only
docker-compose up backend

# Frontend only
docker-compose up frontend

# Database only
docker-compose up neo4j ollama
```

### Service Stop and Cleanup

```bash
# Stop services
docker-compose down

# Remove volumes as well
docker-compose down -v

# Rebuild images
docker-compose build --no-cache
```

## Access Information

| Service           | URL                        | Description                   |
| ----------------- | -------------------------- | ----------------------------- |
| **Frontend**      | http://localhost:5173      | Main web application          |
| **Backend API**   | http://localhost:8000      | REST API server               |
| **Swagger Docs**  | http://localhost:8000/docs | API documentation and testing |
| **Neo4j Browser** | http://localhost:7474      | Graph database management     |
| **Ollama API**    | http://localhost:11434     | Local AI model API            |

## Additional Resources

- [Project README](./README.md)
- [Knowledge Graph Documentation](./KNOWLEDGE_GRAPH.md)
- [API Documentation](http://localhost:8000/docs)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## Contributing

If you want to contribute to the project:

1. Create an issue to suggest bugs or feature requests
2. Fork and submit a Pull Request
3. Participate in code reviews and testing

## Support

If you encounter problems or need help:

- Create a [GitHub Issue](https://github.com/OSSBrainTrace/BrainTrace/issues)
- Refer to project documentation
- Utilize community forums

---

**Note**: AI model downloads may require significant disk space. Up to 10GB of free space may be needed per model file.
