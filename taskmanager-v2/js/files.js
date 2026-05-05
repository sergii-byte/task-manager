// ordify.me — Attachment storage (Phase 10)
//
// File blobs live in IndexedDB (browser quota ~50MB+), keyed by id.
// The metadata record (name, mime, size, owner ref) is held in
// Store._data.attachments as plain JSON so it survives flushes and
// participates in the encrypted Sheets backup. Blobs do NOT go through
// the encrypted backup yet — that's Phase 11 when we move to R2.

const Files = {
    DB_NAME: 'ordify-files',
    DB_VER: 1,
    STORE: 'blobs',
    _dbPromise: null,

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

    async _tx(mode) {
        const db = await this._open();
        return db.transaction(this.STORE, mode).objectStore(this.STORE);
    },

    /**
     * Save a File or Blob under a freshly-generated id. Returns the
     * metadata record (without the blob). Caller is responsible for
     * persisting the metadata into the owning entity's attachmentIds.
     */
    async put(file, { ownerType, ownerId } = {}) {
        const id = 'att-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const store = await this._tx('readwrite');
        await new Promise((resolve, reject) => {
            const req = store.put(file, id);
            req.onsuccess = () => resolve();
            req.onerror   = () => reject(req.error);
        });
        const meta = {
            id,
            name: file.name || 'file',
            mime: file.type || 'application/octet-stream',
            size: file.size || 0,
            ownerType: ownerType || null,
            ownerId: ownerId || null,
            created: new Date().toISOString(),
        };
        // Keep metadata in Store too so it survives backup/restore
        if (!Store._data.attachments) Store._data.attachments = [];
        Store._data.attachments.push(meta);
        Store.flush();
        return meta;
    },

    /** Read the blob for an attachment id. Returns null if missing. */
    async get(id) {
        const store = await this._tx('readonly');
        return new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror   = () => reject(req.error);
        });
    },

    /** Returns a transient blob: URL for previewing in a new tab. */
    async openUrl(id) {
        const blob = await this.get(id);
        if (!blob) throw new Error('Attachment not found');
        return URL.createObjectURL(blob);
    },

    /** Trigger a download of the file via a temporary anchor. */
    async download(id) {
        const blob = await this.get(id);
        if (!blob) throw new Error('Attachment not found');
        const meta = (Store._data.attachments || []).find(a => a.id === id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = meta?.name || id;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
    },

    /** Delete blob + metadata. */
    async remove(id) {
        const store = await this._tx('readwrite');
        await new Promise((resolve) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror   = () => resolve();   // tolerate missing blob
        });
        if (Store._data.attachments) {
            Store._data.attachments = Store._data.attachments.filter(a => a.id !== id);
            // Remove from any owning entity's attachmentIds
            for (const arr of [Store._data.matters, Store._data.tasks, Store._data.clients, Store._data.invoices]) {
                for (const e of arr) {
                    if (e.attachmentIds) e.attachmentIds = e.attachmentIds.filter(x => x !== id);
                }
            }
            Store.flush();
        }
    },

    /** All metadata records for a given owner. */
    listFor(ownerType, ownerId) {
        const all = Store._data.attachments || [];
        return all.filter(a => a.ownerType === ownerType && a.ownerId === ownerId);
    },

    /** Pretty-print a byte size. */
    fmtSize(bytes) {
        if (!bytes) return '0';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
        return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    },

    /** Pick a small icon character for a mime type. */
    iconFor(mime) {
        if (!mime) return '◌';
        if (mime === 'application/pdf') return '⊟';
        if (mime.startsWith('image/'))  return '▣';
        if (mime.includes('word') || mime.includes('document')) return '▤';
        if (mime.includes('sheet') || mime.includes('excel'))   return '▦';
        if (mime.includes('zip')  || mime.includes('archive'))  return '▥';
        if (mime.startsWith('text/')) return '≡';
        return '◌';
    },
};

window.Files = Files;
