import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def brain_id():
    response = client.post("/brains/", json={"brain_name": "PDF용 브레인"})
    return response.json()["brain_id"]

def test_create_pdf(brain_id):
    response = client.post("/pdfs", json={
        "pdf_title": "테스트 PDF",
        "pdf_path": "/tmp/test.pdf",
        "brain_id": brain_id
    })
    assert response.status_code in (200, 201)
    data = response.json()
    assert data["pdf_title"] == "테스트 PDF"
    global created_pdf_id
    created_pdf_id = data["pdf_id"]

def test_get_pdf():
    response = client.get(f"/pdfs/{created_pdf_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["pdf_id"] == created_pdf_id

def test_update_pdf():
    response = client.put(f"/pdfs/{created_pdf_id}", json={"pdf_title": "수정된 PDF"})
    assert response.status_code == 200
    data = response.json()
    assert data["pdf_title"] == "수정된 PDF"

def test_delete_pdf():
    response = client.delete(f"/pdfs/{created_pdf_id}")
    assert response.status_code == 204 