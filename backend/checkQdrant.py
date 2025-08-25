"""
Qdrant 내부 SQLite 스토리지 검사 스크립트
--------------------------------------

이 스크립트는 로컬 디스크 모드로 동작하는 Qdrant의 컬렉션 스토리지(SQLite)를 직접 열어
`points` 테이블의 `point` BLOB을 `pickle`로 역직렬화하여 payload 내용을 사람이 읽기 쉽게 출력합니다.

주의/안내:
- 경로 `data/qdrant/collection/brain_1/storage.sqlite`는 예시(brain_1)입니다. 다른 브레인을 확인하려면 경로를 변경하세요.
- Qdrant 내부 포맷은 버전에 따라 달라질 수 있으며, 직접 접근은 진단/디버깅 목적에서만 사용하세요.
- `pickle` 역직렬화는 신뢰할 수 있는 로컬 파일에만 사용해야 합니다(보안상 임의 코드 실행 위험).
"""

import sqlite3
import os
import pickle

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 확인할 Qdrant 컬렉션의 SQLite 경로(예: brain_1)
DB_PATH = os.path.join(BASE_DIR, "data/qdrant/collection/brain_1/storage.sqlite")

# 파일 존재 확인: 잘못된 경로 방지
if not os.path.exists(DB_PATH):
    raise FileNotFoundError(f"❌ 파일 없음: {DB_PATH}")

# SQLite 연결 및 커서 준비
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# points 테이블의 id, point(BLOB) 조회
cursor.execute("SELECT id, point FROM points")
rows = cursor.fetchall()

# 각 point 레코드의 payload를 안전하게 디코딩해서 출력
for i, (point_id, blob) in enumerate(rows, 1):
    try:
        # Pickle 역직렬화 (신뢰 가능한 내부 파일만 처리)
        data = pickle.loads(blob)

        # dict인 경우 표준 접근
        if isinstance(data, dict):
            payload = data.get("payload", {})
        else:
            # 일반 클래스/객체 형태인 경우 가능한 속성으로 접근
            if hasattr(data, "payload"):
                payload = data.payload
            elif hasattr(data, "__dict__"):
                payload = data.__dict__
            else:
                payload = "<❓ payload 접근 불가>"
    except Exception as e:
        payload = f"<❌ payload 디코딩 실패: {str(e)}>"

    print(f"[{i}] 🆔 ID: {point_id}")
    print(f"    📦 Payload: {payload}")
    print("-" * 50)

# 커넥션 정리
conn.close()
