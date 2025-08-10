/**
 * fileViewHandlers.js
 * 
 * 파일 뷰 관련 핸들러들을 관리하는 모듈입니다.
 * 
 * 주요 기능:
 * - 파일 드래그 앤 드롭 처리 (메모 → 소스 변환, 외부 파일 업로드)
 * - 소스 이름 변경 처리
 * - 소스 삭제 처리 (벡터 DB, 그래프 DB, 파일 시스템 정리)
 * - 업로드 큐 관리
 * 
 * 지원하는 파일 타입:
 * - pdf, txt, md, docx: 외부 파일 업로드
 * - memo: 메모를 소스로 변환
 * 
 * 주요 함수:
 * - handleDrop: 파일 드롭 이벤트 처리
 * - handleNameChange: 소스 이름 변경 처리
 * - handleDelete: 소스 삭제 처리
 */

// fileViewHandlers.js
import { toast } from 'react-toastify';
import { deleteDB } from '../../../../../api/services/graphApi';
import deleteHandlers from './deleteHandlers';
import nameUpdateHandlers from './nameUpdateHandlers';

/**
 * 파일 드롭 시 처리하는 로직 (메모 → 소스 변환 또는 외부 파일 업로드)
 * 드롭된 파일들을 uploadQueue에 추가합니다.
 * 
 * 처리 과정:
 * 1. 메모 드래그 처리: 메모를 소스로 변환
 * 2. 외부 파일 드래그 처리: 지원하는 파일 타입만 업로드 큐에 추가
 * 3. 지원하지 않는 파일 타입에 대한 에러 메시지 표시
 * 
 * @param {DragEvent} e - 드롭 이벤트 객체
 * @param {Function} setIsDrag - 드래그 상태 설정 함수
 * @param {Function} setUploadQueue - 업로드 큐 설정 함수
 */
export const handleDrop = async (e, setIsDrag, setUploadQueue) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDrag(false); // 드래그 상태 해제
  
  // 메모 드래그 처리 (메모 → 소스로 전환)
  const memoData = e.dataTransfer.getData('application/json-memo');
  if (memoData) {
    const { id, name, content } = JSON.parse(memoData);
    // 메모 내용이 비어있는지 확인
    if (!content || content.trim() === "") {
      toast.error('메모 내용이 비어 있어 소스로 추가할 수 없습니다.');
      return;
    }
    const key = `${name}-${content.length}-memo`;
    // (1) 큐에 추가
    setUploadQueue(q => [
      ...q,
      {
        key,
        name,
        filetype: 'memo',
        size: content.length,
        status: 'processing',
        memoId: id,
        memoContent: content
      }
    ]);
    // (2) 변환 작업은 큐 처리 로직에서 처리
    return;
  }
  
  // 외부 파일 드래그 앤 드롭 (pdf, txt, md, docx 허용)
  const dropped = Array.from(e.dataTransfer.files); // 드래그한 파일 배열로 변환
  if (!dropped.length) return; // 비어 있으면 종료
  
  // dropped 파일들을 큐에 모두 추가 (fileObj 포함)
  const allowedExts = ['pdf', 'txt', 'md', 'docx'];
  const newQueueItems = dropped
    .filter(file => allowedExts.includes(file.name.split('.').pop().toLowerCase()))
    .map(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      const uploadKey = `${file.name}-${file.size}-${ext}`;
      return {
        key: uploadKey,
        name: file.name,
        filetype: ext,
        size: file.size,
        status: 'processing',
        fileObj: file // 항상 fileObj 포함
      };
    });
  
  // 지원하지 않는 확장자 드래그 시 toast 메시지
  const unsupportedFiles = dropped.filter(file => !allowedExts.includes(file.name.split('.').pop().toLowerCase()));
  if (unsupportedFiles.length > 0) {
    toast.error(`지원하지 않는 파일 형식입니다: ${unsupportedFiles.map(f => f.name).join(', ')}`);
  }
  
  if (newQueueItems.length > 0) {
    setUploadQueue(q => [...q, ...newQueueItems]);
  }
};

/**
 * 소스 이름을 변경하는 함수
 * 
 * 처리 과정:
 * 1. 파일명에서 확장자 분리
 * 2. 새 이름이 기존 이름과 같은지 확인
 * 3. 해당 파일 타입의 이름 변경 핸들러 호출
 * 4. 성공 시 목록 새로고침 및 콜백 실행
 * 5. 실패 시 에러 메시지 표시
 * 
 * @param {Object} f - 이름을 변경할 파일 정보 객체
 * @param {string} tempName - 임시 파일명 (사용자 입력)
 * @param {string|number} brainId - 브레인 ID
 * @param {Function} setEditingId - 편집 중인 ID 설정 함수
 * @param {Function} refresh - 파일 목록 새로고침 함수
 * @param {Function} onFileUploaded - 파일 업로드 완료 콜백 함수
 */
export const handleNameChange = async (f, tempName, brainId, setEditingId, refresh, onFileUploaded) => {
  // 확장자 분리
  const ext = f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')) : '';
  const baseName = tempName.replace(/\.[^/.]+$/, '').trim();
  
  // 새 이름이 비어있거나 기존 이름과 같은 경우 처리 중단
  if (!baseName || baseName + ext === f.name) {
    setEditingId(null);
    return;
  }
  
  const newName = baseName + ext;
  try {
    // 해당 파일 타입의 이름 변경 핸들러 호출
    if (nameUpdateHandlers[f.filetype]) {
      await nameUpdateHandlers[f.filetype](f.id, newName, brainId);
    } else {
      throw new Error('지원하지 않는 파일 타입');
    }
    
    // 성공 시 목록 새로고침 및 콜백 실행
    await refresh();
    if (typeof onFileUploaded === 'function') {
      onFileUploaded();
    }
  } catch (e) {
    // 백엔드에서 온 에러 메시지 추출
    let msg = '이름 변경 실패';
    if (e && e.response && e.response.data && e.response.data.detail) {
      msg = e.response.data.detail;
    } else if (e && e.message) {
      msg = e.message;
    }
    toast.error(msg);
  } finally {
    setEditingId(null);
  }
};

/**
 * 소스를 삭제하는 함수
 * 
 * 처리 과정:
 * 1. 벡터 DB 및 지식 그래프 DB에서 해당 소스 삭제
 * 2. 실제 파일 삭제 (파일 시스템 또는 DB에서)
 * 3. 그래프 뷰 새로고침
 * 4. 소스 개수 새로고침
 * 5. 파일 목록 다시 로드
 * 
 * @param {Object} f - 삭제할 파일 정보 객체
 * @param {string|number} brainId - 브레인 ID
 * @param {Function} onGraphRefresh - 그래프 새로고침 콜백 함수
 * @param {Function} onSourceCountRefresh - 소스 개수 새로고침 콜백 함수
 * @param {Function} refresh - 파일 목록 새로고침 함수
 */
export const handleDelete = async (f, brainId, onGraphRefresh, onSourceCountRefresh, refresh) => {
  try {
    // 1) 벡터 DB 및 지식 그래프 DB에서 해당 소스 삭제
    try {
      await deleteDB(brainId, f.id);
      console.log('✅ 벡터 DB 및 그래프 DB 삭제 성공');
    } catch (dbError) {
      console.error('벡터/그래프 DB 삭제 실패 (계속 진행):', dbError);
    }

    // 2) 실제 파일 삭제 (파일 시스템 또는 DB에서)
    let deleted = false;
    if (deleteHandlers[f.filetype]) {
      // fileUrl을 전달하여 하이라이팅 데이터도 함께 삭제
      const fileUrl = f.fileUrl || f.url || f.path || null;
      deleted = await deleteHandlers[f.filetype](f.id, fileUrl);
    } else {
      throw new Error(`지원하지 않는 파일 타입: ${f.filetype}`);
    }
    
    // 삭제 실패 시 에러 처리
    if (!deleted) {
      throw new Error(`${f.filetype} 파일 삭제 실패`);
    }
    
    // 3) 그래프 뷰 새로고침
    if (onGraphRefresh) {
      onGraphRefresh();
    }
    
    // 4) 소스 개수 새로고침
    if (onSourceCountRefresh) {
      onSourceCountRefresh();
    }
    
    // 5) 파일 목록 다시 로드
    await refresh();
  } catch (e) {
    console.error('삭제 실패:', e);
    toast.error(`삭제 실패: ${e.message}`);
  }
}; 