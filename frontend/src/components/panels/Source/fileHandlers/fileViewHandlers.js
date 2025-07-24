// fileViewHandlers.js
import { toast } from 'react-toastify';
import { deleteDB } from '../../../../../api/graphApi';
import deleteHandlers from './deleteHandlers';
import nameUpdateHandlers from './nameUpdateHandlers';

/**
 * 파일 드롭 시 처리하는 로직 (메모 → 소스 변환 또는 외부 파일 업로드)
 * 드롭된 파일들을 uploadQueue에 추가합니다.
 * @param {DragEvent} e - 드롭 이벤트
 * @param {Function} setIsDrag
 * @param {Function} setUploadQueue
 */
export const handleDrop = async (e, setIsDrag, setUploadQueue) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDrag(false); // 드래그 상태 해제
  // 메모 드래그 처리 (메모 → 소스로 전환)
  const memoData = e.dataTransfer.getData('application/json-memo');
  if (memoData) {
    const { id, name, content } = JSON.parse(memoData);
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
 * @param {Object} f - 이름을 변경할 파일 정보
 * @param {string} tempName - 임시 파일명
 * @param {string|number} brainId - 브레인 ID
 * @param {Function} setEditingId
 * @param {Function} refresh
 * @param {Function} onFileUploaded
 */
export const handleNameChange = async (f, tempName, brainId, setEditingId, refresh, onFileUploaded) => {
  // 확장자 분리
  const ext = f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')) : '';
  const baseName = tempName.replace(/\.[^/.]+$/, '').trim();
  if (!baseName || baseName + ext === f.name) {
    setEditingId(null);
    return;
  }
  const newName = baseName + ext;
  try {
    if (nameUpdateHandlers[f.filetype]) {
      await nameUpdateHandlers[f.filetype](f.id, newName, brainId);
    } else {
      throw new Error('지원하지 않는 파일 타입');
    }
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
 * @param {Object} f - 삭제할 파일 정보
 * @param {string|number} brainId - 브레인 ID
 * @param {Function} onGraphRefresh
 * @param {Function} onSourceCountRefresh
 * @param {Function} refresh
 */
export const handleDelete = async (f, brainId, onGraphRefresh, onSourceCountRefresh, refresh) => {
  try {
    // 1) 벡터 DB 및 지식 그래프 DB에서 해당 소스 삭제
    try {
      await deleteDB(brainId, f.id);
      console.log('✅ 벡터 DB 및 그래프 DB 삭제 성공');
    } catch (dbError) {
      console.error('⚠️ 벡터/그래프 DB 삭제 실패 (계속 진행):', dbError);
    }

    // 2) 실제 파일 삭제 (파일 시스템 또는 DB에서)
    let deleted = false;
    if (deleteHandlers[f.filetype]) {
      deleted = await deleteHandlers[f.filetype](f.id);
    } else {
      throw new Error('지원하지 않는 파일 타입');
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
    console.error('❌ 삭제 실패:', e);
    alert('삭제 실패');
  }
}; 