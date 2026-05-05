// ordify.me — Local snapshots (Phase 10)
//
// Keeps the last N daily snapshots of Store._data in IndexedDB so the
// user can roll back if something goes wrong (mis-parsed AI commit,
// accidental bulk delete that escaped soft-delete window, manual edit
// that broke things).
//
// One snapshot per calendar day, taken on first flush of that day.
// Snapshots older than KEEP_DAYS are pruned at boot.

const Snapshots = {
    DB_NAME: 'ordify-snapshots',
    DB_VER: 1,
    STORE: 'snapshots',
    KEEP_DAYS: 7,
    _dbPromise: null,
    _lastTakenKey: null,

    _open() {
        if (this._dbPromise) return this._dbPromise;
        this._dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.DB_VER);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(this.STORE)) {
                    db.createObjectStore(this.STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
        return this._dbPromise;
    },

    _todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },

    /** Take a snapshot if we haven't yet today. Called from Store.flush. */
    async maybeTake() {
        const key = this._todayKey();
        if (this._lastTakenKey === key) return;
        try {
            const db = await this._open();
            const tx = db.transaction(this.STORE, 'readwrite');
            const store = tx.objectStore(this.STORE);
            await new Promise((resolve, reject) => {
                const req = store.get(key);
                req.onsuccess = () => {
                    if (req.result) { this._lastTakenKey = key; resolve(); return; }
                    const put = store.put({
                        date: key,
                        takenAt: new Date().toISOString(),
                        data: JSON.parse(JSON.stringify(Store._data)),
                    }, key);
                    put.onsuccess = () => { this._lastTakenKey = key; resolve(); };
                    put.onerror   = () => reject(put.error);
                };
                req.onerror = () => reject(req.error);
            });
            await this.prune();
        } catch (_) { /* never block writes */ }
    },

    async list() {
        const db = await this._open();
        const tx = db.transaction(this.STORE, 'readonly');
        const store = tx.objectStore(this.STORE);
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => {
                const items = (req.result || []).map(s => ({
                    date: s.date, takenAt: s.takenAt,
                    counts: {
                        clients:  s.data.clients?.length || 0,
                        matters:  s.data.matters?.length || 0,
                        tasks:    s.data.tasks?.length || 0,
                        logs:     s.data.timeLogs?.length || 0,
                        invoices: s.data.invoices?.length || 0,
                    },
                }));
                items.sort((a, b) => b.date.localeCompare(a.date));
                resolve(items);
            };
            req.onerror = () => reject(req.error);
        });
    },

    async restore(dateKey) {
        const db = await this._open();
        const tx = db.transaction(this.STORE, 'readonly');
        const store = tx.objectStore(this.STORE);
        const snap = await new Promise((resolve, reject) => {
            const req = store.get(dateKey);
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
        if (!snap) throw new Error('Snapshot not found');
        Store._data = Store._normalize(snap.data);
        try { localStorage.setItem(Store.KEY, JSON.stringify(Store._data)); } catch (_) {}
        return snap;
    },

    async prune() {
        const horizon = new Date();
        horizon.setDate(horizon.getDate() - this.KEEP_DAYS);
        const horizonKey = `${horizon.getFullYear()}-${String(horizon.getMonth()+1).padStart(2,'0')}-${String(horizon.getDate()).padStart(2,'0')}`;
        const db = await this._open();
        const tx = db.transaction(this.STORE, 'readwrite');
        const store = tx.objectStore(this.STORE);
        return new Promise((resolve) => {
            const req = store.getAllKeys();
            req.onsuccess = () => {
                for (const k of (req.result || [])) {
                    if (typeof k === 'string' && k < horizonKey) store.delete(k);
                }
                resolve();
            };
            req.onerror = () => resolve();
        });
    },
};

window.Snapshots = Snapshots;
