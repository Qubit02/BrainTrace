import sqlite3
import os
import pickle

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data/qdrant/collection/brain_1/storage.sqlite")

if not os.path.exists(DB_PATH):
    raise FileNotFoundError(f"❌ 파일 없음: {DB_PATH}")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("SELECT id, point FROM points")
rows = cursor.fetchall()

for i, (point_id, blob) in enumerate(rows, 1):
    try:
        # Pickle 역직렬화
        data = pickle.loads(blob)

        # dict인 경우
        if isinstance(data, dict):
            payload = data.get("payload", {})
        else:
            # 일반 클래스일 경우
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

conn.close()
