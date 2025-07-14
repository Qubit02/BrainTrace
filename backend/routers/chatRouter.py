from fastapi import APIRouter, HTTPException
from sqlite_db import SQLiteHandler
import logging

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    responses={404: {"description": "Not found"}}
)

@router.delete("/{chat_id}/delete",
    summary="채팅 삭제",
    description="특정 채팅 ID에 해당하는 대화를 데이터베이스에서 삭제합니다.",
    response_description="삭제 성공 여부를 반환합니다.")
async def delete_chat(chat_id: int):
    """
    채팅 ID를 받아 해당 채팅을 삭제합니다:
    
    - **chat_id**: 삭제할 채팅의 ID
    
    반환값:
    - **message**: 삭제 성공 메시지
    """
    try:
        db_handler = SQLiteHandler()
        success = db_handler.delete_chat(chat_id)
        
        if not success:
            raise HTTPException(status_code=404, detail=f"채팅 ID {chat_id}를 찾을 수 없습니다.")
            
        return {"message": f"채팅 ID {chat_id}가 성공적으로 삭제되었습니다."}
    except Exception as e:
        logging.error(f"채팅 삭제 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"채팅 삭제 중 오류가 발생했습니다: {str(e)}")

@router.get("/{chat_id}/referenced_nodes",
    summary="채팅 참고 노드 조회",
    description="특정 채팅 ID에 해당하는 대화의 참고 노드 목록을 반환합니다.",
    response_description="참고 노드 목록을 배열로 반환합니다.")
async def get_referenced_nodes(chat_id: int):
    """
    채팅 ID를 받아 해당 채팅의 참고 노드 목록을 반환합니다:
    
    - **chat_id**: 조회할 채팅의 ID
    
    반환값:
    - **referenced_nodes**: 참고 노드 목록 배열
    """
    try:
        db_handler = SQLiteHandler()
        referenced_nodes_text = db_handler.get_referenced_nodes(chat_id)
        
        if referenced_nodes_text is None:
            raise HTTPException(status_code=404, detail=f"채팅 ID {chat_id}를 찾을 수 없습니다.")
            
        # 텍스트를 배열로 파싱
        referenced_nodes = [node.strip().strip('"') for node in referenced_nodes_text.split(",")] if referenced_nodes_text else []
            
        return {"referenced_nodes": referenced_nodes}
    except Exception as e:
        logging.error(f"참고 노드 조회 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"참고 노드 조회 중 오류가 발생했습니다: {str(e)}")

@router.get("/chatList/{brain_id}",
    summary="브레인 채팅 목록 조회",
    description="특정 브레인 ID에 해당하는 모든 채팅 목록을 시간순으로 반환합니다.",
    response_description="채팅 목록을 배열로 반환합니다.")
async def get_chat_list(brain_id: int):
    """
    브레인 ID를 받아 해당 브레인의 모든 채팅 목록을 반환합니다:
    
    - **brain_id**: 조회할 브레인의 ID
    
    반환값:
    - **chats**: 채팅 목록 배열 (각 채팅은 chat_id, is_ai, message, referenced_nodes 정보를 포함)
    """
    try:
        db_handler = SQLiteHandler()
        chats = db_handler.get_chat_list(brain_id)
        
        if chats is None:
            raise HTTPException(status_code=404, detail=f"브레인 ID {brain_id}를 찾을 수 없습니다.")
            
        return {"chats": chats}
    except Exception as e:
        logging.error(f"채팅 목록 조회 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"채팅 목록 조회 중 오류가 발생했습니다: {str(e)}") 