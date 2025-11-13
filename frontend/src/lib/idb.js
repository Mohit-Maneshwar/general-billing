// src/lib/idb.js
export const DB_NAME = 'general_billing_db';
export const STORE_BILLS = 'bills';

function openDB() {
    return new Promise((res, rej) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => {
            const db = r.result;
            if (!db.objectStoreNames.contains(STORE_BILLS)) {
                const s = db.createObjectStore(STORE_BILLS, { keyPath: 'id' });
                s.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
}

export async function addBill(bill) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const tx = db.transaction(STORE_BILLS, 'readwrite');
        tx.objectStore(STORE_BILLS).put(bill);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
    });
}

export async function getAllBills() {
    const db = await openDB();
    return new Promise((res, rej) => {
        const tx = db.transaction(STORE_BILLS, 'readonly');
        const req = tx.objectStore(STORE_BILLS).getAll();
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}

export async function deleteOldBills(hours = 24) {
    const db = await openDB();
    const cutoff = Date.now() - hours * 3600000;
    return new Promise((res, rej) => {
        const tx = db.transaction(STORE_BILLS, 'readwrite');
        const store = tx.objectStore(STORE_BILLS);
        const idx = store.index('createdAt');
        const range = IDBKeyRange.upperBound(cutoff, true);
        const cursorReq = idx.openCursor(range);
        cursorReq.onsuccess = e => {
            const cur = e.target.result;
            if (!cur) { res(true); return; }
            store.delete(cur.primaryKey);
            cur.continue();
        };
        cursorReq.onerror = () => rej(cursorReq.error);
    });
}
