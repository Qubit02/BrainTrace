from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
import logging
from services import embedding_service
from sqlite_db import SQLiteHandler

router = APIRouter(
    prefix="/search",
    tags=["search"],
    responses={404: {"description": "Not found"}}
)

class SearchRequest(BaseModel):
    query: str
    brain_id: str

class SearchResponse(BaseModel):
    source_ids: List[str]  # 중복 제거된 source_id 목록

@router.post("/getSimilarSourceIds",
    summary="유사도 기반 소스 검색",
    description="입력된 설명이나 키워드와 유사한 문장을 벡터DB에서 찾아 해당 source_id들을 반환합니다.",
    response_model=SearchResponse)
async def search_similar_descriptions(request: SearchRequest):
    """
    설명이나 키워드로 유사한 문장을 검색하고 source_id를 반환합니다:
    
    - **query**: 검색할 설명이나 키워드
    - **brain_id**: 브레인 ID
    
    반환값:
    - **source_ids**: 유사도 순으로 정렬된 source_id 목록 (중복 제거됨)
    """
    logging.info(f"유사 문장 검색 시작 - query: {request.query}, brain_id: {request.brain_id}")
    
    try:
        # 1. 텍스트 기반 제목 검색 (우선)
        db = SQLiteHandler()
        title_results = db.search_titles_by_query(request.query, int(request.brain_id))
        
        # 제목 검색 결과의 source_id 추출 (숫자만)
        title_source_ids = []
        seen_ids = set()  # 중복 체크를 위한 set
        
        for result in title_results:
            id_num = str(result['id'])
            if id_num not in seen_ids:
                seen_ids.add(id_num)
                title_source_ids.append(id_num)
        
        # 2. 벡터 DB 검색
        if not embedding_service.is_index_ready(request.brain_id):
            embedding_service.initialize_collection(request.brain_id)
            logging.info("Qdrant 컬렉션 초기화 완료: %s", request.brain_id)
        
        query_embedding = embedding_service.encode_text(request.query)
        
        similar_descriptions = embedding_service.search_similar_descriptions(
            embedding=query_embedding,
            brain_id=request.brain_id,
            limit=10
        )
        
        # 벡터 검색 결과의 source_id 추출
        vector_source_ids = []
        for desc in similar_descriptions:
            source_id = desc["source_id"]
            if source_id and source_id not in seen_ids:
                seen_ids.add(source_id)
                vector_source_ids.append(source_id)
        
        # 3. 결과 병합 (제목 검색 결과를 우선)
        final_source_ids = title_source_ids + vector_source_ids
        
        logging.info(f"검색 결과: {len(final_source_ids)}개의 고유 source_id 발견")
        return {"source_ids": final_source_ids}
        
    except Exception as e:
        logging.error("검색 오류: %s", str(e))
        raise HTTPException(status_code=500, detail=f"검색 중 오류가 발생했습니다: {str(e)}") 