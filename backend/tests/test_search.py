import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_search_titles_by_query():
    # 테스트용 브레인 및 PDF/텍스트 파일 생성
    brain_resp = client.post("/brains/", json={"brain_name": "검색용 브레인"})
    brain_id = brain_resp.json()["brain_id"]
    client.post("/pdfs", json={"pdf_title": "검색테스트PDF", "pdf_path": "/tmp/test.pdf", "brain_id": brain_id})
    client.post("/textfiles", json={"txt_title": "검색테스트TXT", "txt_path": "/tmp/test.txt", "brain_id": brain_id})

    # 검색
    response = client.get(f"/search/titles?query=검색&brain_id={brain_id}")
    assert response.status_code == 200
    data = response.json()
    assert any("검색테스트PDF" in d["title"] or "검색테스트TXT" in d["title"] for d in data) 