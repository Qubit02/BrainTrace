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
