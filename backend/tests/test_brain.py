import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_create_brain():
    response = client.post("/brains/", json={"brain_name": "테스트 브레인"})
    assert response.status_code == 201
    data = response.json()
    assert data["brain_name"] == "테스트 브레인"
    assert "brain_id" in data
    global created_brain_id
    created_brain_id = data["brain_id"]


def test_get_all_brains():
    response = client.get("/brains/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_brain():
    response = client.get(f"/brains/{created_brain_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["brain_id"] == created_brain_id


def test_update_brain():
    response = client.put(f"/brains/{created_brain_id}", json={"brain_name": "수정된 브레인"})
    assert response.status_code == 200
    data = response.json()
    assert data["brain_name"] == "수정된 브레인"


def test_rename_brain():
    response = client.patch(f"/brains/{created_brain_id}/rename", json={"brain_name": "이름변경 브레인"})
    assert response.status_code == 200
    data = response.json()
    assert data["brain_name"] == "이름변경 브레인"


def test_delete_brain():
    response = client.delete(f"/brains/{created_brain_id}")
    assert response.status_code == 204 