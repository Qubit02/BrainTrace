import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def brain_id():
    response = client.post("/brains/", json={"brain_name": "텍스트용 브레인"})
    return response.json()["brain_id"]

def test_create_textfile(brain_id):
    response = client.post("/textfiles", json={
        "txt_title": "테스트 텍스트",
        "txt_path": "/tmp/test.txt",
        "brain_id": brain_id
    })
    assert response.status_code in (200, 201)
    data = response.json()
    assert data["txt_title"] == "테스트 텍스트"
    global created_txt_id
    created_txt_id = data["txt_id"]

def test_get_textfile():
    response = client.get(f"/textfiles/{created_txt_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["txt_id"] == created_txt_id

def test_update_textfile():
    response = client.put(f"/textfiles/{created_txt_id}", json={"txt_title": "수정된 텍스트"})
    assert response.status_code == 200
    data = response.json()
    assert data["txt_title"] == "수정된 텍스트"

def test_delete_textfile():
    response = client.delete(f"/textfiles/{created_txt_id}")
    assert response.status_code == 204 