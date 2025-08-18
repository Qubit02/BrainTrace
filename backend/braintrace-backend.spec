"""
PyInstaller spec: braintrace-backend
------------------------------------

이 스펙 파일은 FastAPI 기반 백엔드를 **one-dir 모드(폴더 배포)**로 패키징합니다.
앱 실행에 필요한 **Neo4j 런타임 폴더**, **transformers 모델 코드/데이터**, **KoNLPy의 JAR**,
**encodings 서브모듈/데이터** 등을 수집해 번들하고, **JPype/KoNLPy 초기화용 런타임 훅**을 적용합니다.

구성 요약
- Neo4j 번들: 프로젝트 `neo4j/` 하위에서 데이터 폴더는 제외하고 `bin, conf, lib, plugins, ...`만 포함.
- encodings: 파이썬 `encodings` 패키지의 **모든 서브모듈/데이터**를 포함(파이썬 표준 인코딩 문제 방지).
- transformers: `collect_all("transformers")`로 코드/데이터/히든임포트를 한 번에 수집.
- KoNLPy JAR: `collect_data_files("konlpy")` 결과 중 `.../java/*.jar`만 선별하여
  번들 내 `konlpy/java/` 경로로 복사(런타임에서 JVM 클래스패스에 올리기 위함).
- hiddenimports: uvicorn/starlette/neo4j-driver 내부 네트워크 모듈, JPype 코어,
  KoNLPy JVM/Okt 로더 등 **동적 임포트되는 모듈**을 명시적으로 포함.
- excludes: tkinter, venv, 테스트 등 **불필요 리소스 제외**.
- runtime_hooks: `runtime_hook_konlpy.py`를 등록하여 실행 시 **JVM 초기화/클래스패스 세팅** 수행.
- 빌드 형태: `onefile=False`(one-dir), `console=True`, `debug=True`로 디버깅에 유리.

배포/실행
- 빌드 후 `dist/braintrace-backend/` 폴더가 생성되며, 해당 폴더 내 실행 파일을 사용.
- Neo4j/KoNLPy/transformers 리소스가 함께 들어 있어 별도 설치 의존성을 줄임.
- 모델 가중치 등 대형 파일을 포함하면 용량 증가가 크므로, 필요 시 런타임 다운로더로 분리 검토.
"""

# braintrace-backend.spec
# -*- mode: python; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_submodules, collect_data_files, collect_all
from PyInstaller.building.build_main import Analysis, PYZ, EXE

block_cipher = None
here = os.path.abspath(os.getcwd())

# ── 1) Neo4j 폴더 중 데이터 제외하고 번들할 서브폴더 지정 ─────────────────
neo4j_root = os.path.join(here, "neo4j")
neo4j_subs = ["bin", "conf", "lib", "plugins", "licenses", "run", "logs"]
neo4j_datas = [
    (os.path.join(neo4j_root, sub), os.path.join("neo4j", sub))
    for sub in neo4j_subs
]

# ── 2) encodings 패키지의 모든 서브모듈 및 데이터 파일 수집 ─────────────────
enc_subs = collect_submodules("encodings")
enc_data = collect_data_files("encodings")

# ── 3) transformers 패키지 전체 (모델 코드 포함) 수집 ───────────────────────
transformers_datas, transformers_binaries, transformers_hiddenimports = collect_all("transformers")

# ── 4) konlpy 패키지 내부의 JAR 자동 수집 ─────────────────────────────────
all_konlpy_data = collect_data_files("konlpy")
konlpy_jars = []
for src, dest in all_konlpy_data:
    if src.lower().endswith(".jar") and os.path.normpath(src).replace("\\", "/").find("/java/") != -1:
        # JAR 은 konlpy/java/ 하위로 복사
        konlpy_jars.append((src, os.path.join("konlpy", "java", os.path.basename(src))))

# ── 5) datas, binaries, hiddenimports 합치기 ─────────────────────────────────
datas = neo4j_datas + enc_data + transformers_datas + konlpy_jars
binaries = transformers_binaries
hiddenimports = (
    enc_subs
    + transformers_hiddenimports
    + [
        "uvicorn.main",
        "starlette.routing",
        "neo4j._impl.network",
        # JPype core 및 Okt 로더
        "jpype",
        "jpype.imports",
        "jpype._core",
        "jpype._jvmfinder",
        # konlpy JVM 및 Okt 태거
        "konlpy.jvm",
        "konlpy.tag._okt",
        # Java 패키지 네임스페이스
        "kr.lucypark.okt",
    ]
)

# ── 6) 불필요 폴더·모듈 제외 ────────────────────────────────────────────
excludes = [
    "tkinter",
    "__pycache__",
    "venv", ".venv",
    "tests",
    ".env",
    ".vscode", ".idea",
]

runtime_hooks = [os.path.join(here, "runtime_hook_konlpy.py")]

# ===== Analysis =====
a = Analysis(
    ["main.py"],        # 패키징할 엔트리 스크립트
    pathex=[here],      # 모듈 검색 경로를 프로젝트 루트로
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    runtime_hooks=runtime_hooks,   # ← 여기에 추가
    hookspath=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
)

# ===== PYZ =====
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# ===== EXE (one-dir + debug) =====
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name="braintrace-backend",
    console=True,
    debug=True,
    onefile=False,
    exclude_binaries=False,
)
