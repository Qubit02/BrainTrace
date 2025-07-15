import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def brain_id():
    response = client.post("/brains/", json={"brain_name": "채팅용 브레인"})
    return response.json()["brain_id"]

def test_create_chat(brain_id):
    response = client.post("/chat", json={
        "is_ai": True,
        "message": "테스트 메시지",
        "brain_id": brain_id
    })
    assert response.status_code in (200, 201)
    data = response.json()
    assert data["message"] == "테스트 메시지"
    global created_chat_id
    created_chat_id = data["chat_id"]

def test_get_chat_list(brain_id):
    response = client.get(f"/chat/chatList/{brain_id}")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_delete_chat():
    response = client.delete(f"/chat/{created_chat_id}/delete")
    assert response.status_code == 200 or response.status_code == 204 