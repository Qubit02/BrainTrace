// src/components/NewBrainModal.jsx
import React, { useState } from 'react';
import { createBrain } from '../../../backend/services/backend';
import './NewBrainModal.css';
import { RiDeleteBack2Line } from "react-icons/ri";
export default function NewBrainModal({ onClose, onCreated }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async e => {
        e.preventDefault();
        const uid = Number(localStorage.getItem('userId'));
        if (!uid) return alert('로그인이 필요합니다');

        setLoading(true);
        try {
            const newBrain = await createBrain({
                brain_name: name,
                user_id: uid,
            });
            onCreated(newBrain);
            onClose();
        } catch (err) {
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
                        onClick={onClose}
                        className='close-button'
                    >
                        <RiDeleteBack2Line size={22} />
                    </button>
                </div>

                <input
                    type="text"
                    placeholder="프로젝트 이름 입력"
                    value={name}
                    onChange={e => setName(e.target.value)}
                />


                <button type="submit" disabled={loading}>
                    {loading ? '저장 중…' : '생성'}
                </button>
            </form>
        </div>
    );
}
