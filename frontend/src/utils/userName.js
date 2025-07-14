// utils/userName.js
import { getOrCreateUserId } from './userId';

export function getOrCreateUserName() {
    let name = localStorage.getItem('userName');
    if (!name) {
        const uid = getOrCreateUserId();
        // uid 일부로 랜덤 이름 생성 (예: user-9DF2)
        name = `user-${uid.slice(0, 4).toUpperCase()}`;
        localStorage.setItem('userName', name);
    }
    return name;
}

export function setUserName(newName) {
    localStorage.setItem('userName', newName);
}
