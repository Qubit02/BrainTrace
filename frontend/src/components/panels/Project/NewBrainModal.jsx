// src/components/NewBrainModal.jsx
import React, { useEffect, useState, useRef } from 'react';
import { createBrain } from '../../../../api/config/apiIndex';
import './NewBrainModal.css';
import { RiDeleteBack2Line } from "react-icons/ri";
export default function NewBrainModal({ onClose, onCreated }) {

    // 프로젝트 이름 상태
    const [name, setName] = useState('');

    // API 요청 중 여부 상태
    const [loading, setLoading] = useState(false);

    // 입력창 포커스를 위한 ref
    const inputRef = useRef(null);

    // 모달 열리면 자동 포커스
    useEffect(() => {
        inputRef.current?.focus();
    }, []);


    // 생성 버튼 시 실행
    const handleSubmit = async e => {
        e.preventDefault(); // 폼 기본 제출 막기
        setLoading(true);
        try {
            // API 요청: 새로운 브레인 생성
            const newBrain = await createBrain({ brain_name: name });

            // 상위 컴포넌트에 전달
            onCreated(newBrain);
            onClose();
        } catch (err) {
            // 에러 메시지 출력
            alert(err.response?.data?.detail ?? '생성 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-back">
            <form className="modal-box" onSubmit={handleSubmit}>
                <div className="modal-header">

                    <h3>새 프로젝트 만들기</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className='close-button'
                    >
                        ✕
                    </button>
                </div>

                {/* 프로젝트 이름 입력 */}
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="프로젝트 이름 입력"
                    value={name}
                    onChange={e => setName(e.target.value)}
                />

                {/* 생성 버튼: 입력 없으면 비활성화 */}
                <button type="submit" disabled={loading || !name.trim()}>
                    {loading ? '저장 중…' : '생성'}
                </button>

            </form>
        </div>
    );
}
