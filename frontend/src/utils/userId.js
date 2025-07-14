// utils/userId.js
import { v4 as uuidv4 } from 'uuid';

export function getOrCreateUserId() {
    let uid = localStorage.getItem('userId');
    if (!uid) {
        uid = uuidv4(); // ex: 'b7e23e76-9d9a-4df1-80f2-abc123'
        localStorage.setItem('userId', uid);
    }
    return uid;
}
