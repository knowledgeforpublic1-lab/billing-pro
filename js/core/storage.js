/**
 * @file High-Capacity Hybrid Storage Engine (IndexedDB + LocalStorage)
 * @description Provides seamless gigabyte-level client-side storage using IndexedDB
 * with transparent LocalStorage fallback. Prevents QuotaExceededError when saving
 * large bills, extensive activity quantities, and multiple history snapshots.
 */

(function (window) {
    'use strict';

    const DB_NAME = 'BillingProDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'app_state';

    let dbPromise = null;

    function getDB() {
        if (dbPromise) return dbPromise;
        if (!window.indexedDB) {
            return Promise.resolve(null);
        }

        dbPromise = new Promise((resolve) => {
            try {
                const req = window.indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME);
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = (e) => {
                    console.warn('[StorageEngine] IndexedDB open error, falling back to LocalStorage', e);
                    resolve(null);
                };
            } catch (err) {
                console.warn('[StorageEngine] IndexedDB not available', err);
                resolve(null);
            }
        });
        return dbPromise;
    }

    const BillingStorage = {
        /**
         * Asynchronously set key-value in IndexedDB + LocalStorage (Dual-Write)
         */
        async setItem(key, value) {
            const strVal = typeof value === 'string' ? value : JSON.stringify(value);

            // 1. Try writing to LocalStorage (synchronous fast-boot cache)
            try {
                localStorage.setItem(key, strVal);
            } catch (err) {
                // If LocalStorage quota exceeded, don't crash — log warning and rely on IndexedDB
                console.warn(`[StorageEngine] LocalStorage quota exceeded for key [${key}], persisting safely to IndexedDB only.`);
            }

            // 2. Persist full copy to IndexedDB (virtually unlimited capacity)
            try {
                const db = await getDB();
                if (db) {
                    await new Promise((resolve, reject) => {
                        const tx = db.transaction(STORE_NAME, 'readwrite');
                        const store = tx.objectStore(STORE_NAME);
                        const putReq = store.put(strVal, key);
                        putReq.onsuccess = () => resolve();
                        putReq.onerror = () => reject(putReq.error);
                    });
                }
            } catch (idbErr) {
                console.error(`[StorageEngine] IndexedDB write failed for key [${key}]:`, idbErr);
            }
        },

        /**
         * Asynchronously get key-value with IndexedDB priority
         */
        async getItemAsync(key) {
            try {
                const db = await getDB();
                if (db) {
                    const val = await new Promise((resolve) => {
                        const tx = db.transaction(STORE_NAME, 'readonly');
                        const store = tx.objectStore(STORE_NAME);
                        const getReq = store.get(key);
                        getReq.onsuccess = () => resolve(getReq.result);
                        getReq.onerror = () => resolve(null);
                    });
                    if (val !== undefined && val !== null) {
                        return val;
                    }
                }
            } catch (e) {
                // Ignore IndexedDB read error, fall through to localStorage
            }

            // Fallback to LocalStorage
            try {
                return localStorage.getItem(key);
            } catch (e) {
                return null;
            }
        },

        /**
         * Synchronous get (from LocalStorage for instant render)
         */
        getItem(key) {
            try {
                return localStorage.getItem(key);
            } catch (e) {
                return null;
            }
        },

        /**
         * Remove key from both LocalStorage and IndexedDB
         */
        async removeItem(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {}

            try {
                const db = await getDB();
                if (db) {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    tx.objectStore(STORE_NAME).delete(key);
                }
            } catch (e) {}
        },

        /**
         * Get client disk quota info (MB used, MB available)
         */
        async getQuotaInfo() {
            if (navigator.storage && navigator.storage.estimate) {
                try {
                    const est = await navigator.storage.estimate();
                    const usedMB = ((est.usage || 0) / (1024 * 1024)).toFixed(1);
                    const quotaMB = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
                    return {
                        usedMB: Number(usedMB),
                        quotaMB: Number(quotaMB),
                        percent: est.quota ? Math.round((est.usage / est.quota) * 100) : 0
                    };
                } catch (e) {}
            }
            return { usedMB: 0, quotaMB: 0, percent: 0 };
        }
    };

    window.BillingStorage = BillingStorage;
})(typeof window !== 'undefined' ? window : this);

