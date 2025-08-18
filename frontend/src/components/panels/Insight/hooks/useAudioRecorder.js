/*
 useAudioRecorder.js

 브라우저 마이크로부터 오디오를 녹음하고, 녹음 데이터를 Whisper API로 전송해 텍스트로 전사한 뒤
 콜백으로 전달하는 커스텀 훅. Web Audio API를 활용하여 실시간 볼륨 레벨도 제공합니다.

 주요 기능:
 1) 마이크 권한 요청 및 녹음 시작/중지 토글
 2) MediaRecorder로 오디오 수집 후 Blob/File 생성
 3) AudioContext + Analyser로 실시간 볼륨 계산(0~1)
 4) 전사 API 호출 후 콜백(onTranscribe)으로 결과 전달

 사용 예시:
   const {
     isRecording,
     isTranscribing,
     volume,
     elapsedTime,
     showOnIcon,
     handleMicClick,
   } = useAudioRecorder(async (text) => {
     // 전사 텍스트 처리
   });

 주의:
 - 전사 중(isTranscribing)에는 녹음 토글을 막아 중복 동작을 방지합니다.
 - AudioContext는 onstop에서 반드시 닫아 리소스 누수를 방지합니다.
 - getUserMedia는 HTTPS 또는 localhost 환경에서만 동작합니다.
*/
import { useState, useRef } from 'react';
import { transcribeAudio } from '../../../../../api/config/apiIndex';

/**
 * 음성 녹음/전사 훅
 *
 * @param {(text: string) => void | Promise<void>} onTranscribe - 전사 결과 처리 콜백
 * @returns {{
 *   isRecording: boolean,
 *   isTranscribing: boolean,
 *   volume: number,
 *   elapsedTime: number,
 *   showOnIcon: boolean,
 *   handleMicClick: () => Promise<void>
 * }}
 */
export default function useAudioRecorder(onTranscribe) {

    // ===== 상태 =====
    // 음성 녹음 상태
    const [isRecording, setIsRecording] = useState(false);

    // 녹음 시간 (초 단위)
    const [elapsedTime, setElapsedTime] = useState(0);

    // 마이크 아이콘 깜빡임 여부
    const [showOnIcon, setShowOnIcon] = useState(true);

    // 실시간 볼륨 수치 (0 ~ 1)
    const [volume, setVolume] = useState(0);

    // Whisper 텍스트 변환 진행 상태
    const [isTranscribing, setIsTranscribing] = useState(false);

    // ===== refs =====
    // 인터벌 타이머 관련 ref
    const intervalRef = useRef(null);     // 녹음 시간 측정
    const blinkRef = useRef(null);        // 마이크 아이콘 깜빡임

    // 녹음 및 오디오 분석 관련 ref
    const mediaRecorderRef = useRef(null);      // MediaRecorder 인스턴스
    const recordedChunksRef = useRef([]);       // 녹음된 오디오 데이터
    const audioContextRef = useRef(null);       // AudioContext 객체
    const analyserRef = useRef(null);           // AnalyserNode 객체
    const dataArrayRef = useRef(null);          // 볼륨 측정용 데이터 배열
    const sourceRef = useRef(null);             // MediaStreamAudioSourceNode
    const volumeIntervalRef = useRef(null);     // 볼륨 측정 인터벌

    // ===== 이벤트/핸들러 =====
    /**
     * 마이크 버튼 클릭 핸들러
     * - 전사 중이면 조작을 차단
     * - isRecording에 따라 녹음을 시작/중지
     */
    const handleMicClick = async () => {
        if (isTranscribing) {
            return; // 음성 → 텍스트 변환 중에는 녹음 시작/중지 비활성화
        }

        if (!isRecording) {
            // 녹음 시작

            // 녹음 데이터를 저장할 버퍼 초기화
            recordedChunksRef.current = [];

            // 마이크 권한 요청 및 오디오 스트림 획득
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // MediaRecorder 생성 및 설정
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            // 오디오 볼륨 시각화를 위한 AudioContext 및 Analyser 설정
            audioContextRef.current = new AudioContext();
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;

            const bufferLength = analyserRef.current.frequencyBinCount;
            dataArrayRef.current = new Uint8Array(bufferLength);
            sourceRef.current.connect(analyserRef.current);

            // 볼륨 측정 인터벌 시작 (0~1 사이로 정규화)
            volumeIntervalRef.current = setInterval(() => {
                analyserRef.current.getByteFrequencyData(dataArrayRef.current);
                const avg = dataArrayRef.current.reduce((a, b) => a + b, 0) / bufferLength;
                setVolume(avg / 255);
            }, 100);

            // 오디오 데이터 수집
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunksRef.current.push(e.data);
                }
            };

            // 녹음 종료 시 처리
            mediaRecorder.onstop = async () => {
                clearInterval(volumeIntervalRef.current);

                // AudioContext 종료 처리
                try {
                    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                        await audioContextRef.current.close();
                    }
                } catch (e) {
                    console.warn("AudioContext 종료 오류:", e);
                }

                const recordedChunks = recordedChunksRef.current;
                if (recordedChunks.length === 0) {
                    alert("녹음된 오디오가 없습니다.");
                    return;
                }

                // Blob → File 생성
                const blob = new Blob(recordedChunks, { type: 'audio/webm' });
                const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });

                setIsTranscribing(true); // 변환 중 상태 설정
                try {
                    // Whisper로 음성 → 텍스트 변환
                    const result = await transcribeAudio(file);
                    const transcribedText = result.text || '';
                    if (transcribedText.trim().length > 0) {
                        await onTranscribe(transcribedText); // 메모 추가
                    } else {
                        alert("텍스트를 추출하지 못했습니다.");
                    }
                } catch (err) {
                    console.error('변환 오류:', err);
                    alert('음성 텍스트 변환에 실패했습니다.');
                } finally {
                    setIsTranscribing(false); // 로딩 종료
                }
            };

            // 녹음 시작
            mediaRecorder.start();
            setElapsedTime(0); // 시간 초기화
            intervalRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
            blinkRef.current = setInterval(() => setShowOnIcon(prev => !prev), 1000); // 아이콘 깜빡임
        } else {
            // 녹음 중지

            clearInterval(intervalRef.current);
            clearInterval(blinkRef.current);
            clearInterval(volumeIntervalRef.current);
            audioContextRef.current?.close();

            // 녹음 상태면 종료
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        }

        // 상태 반전 (녹음 중 <-> 아님)
        setIsRecording(prev => !prev);
    };

    return {
        isRecording,
        isTranscribing,
        volume,
        elapsedTime,
        showOnIcon,
        handleMicClick,
    };
}
