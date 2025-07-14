import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# 테스트용 브레인 생성
@pytest.fixture(scope="module")
def brain_id():
    response = client.post("/brains/", json={"brain_name": "메모용 브레인"})
    return response.json()["brain_id"]


def test_create_memo(brain_id):
    response = client.post("/memos/", json={
        "memo_title": "테스트 메모",
        "memo_text": "메모 내용",
        "brain_id": brain_id
    })
    assert response.status_code == 200 or response.status_code == 201
    data = response.json()
    assert data["memo_title"] == "테스트 메모"
    global created_memo_id
    created_memo_id = data["memo_id"]


def test_get_memo():
    response = client.get(f"/memos/{created_memo_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["memo_id"] == created_memo_id


def test_update_memo():
    response = client.put(f"/memos/{created_memo_id}", json={"memo_title": "수정된 메모"})
    assert response.status_code == 200
    data = response.json()
    assert data["memo_title"] == "수정된 메모"


def test_delete_memo():
    response = client.delete(f"/memos/{created_memo_id}")
    assert response.status_code == 204 