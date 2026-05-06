/* ordify · attachments
 * IndexedDB-backed storage for files and audio recordings.
 * Each attachment row: { id, kind: 'file'|'audio', name, mime, size, ts,
 *                        matterId, taskId, clientId, blob }
 *
 * Metadata (without blob) is mirrored to state.attachments so views can render
 * lists without async lookups. Blobs are fetched on demand.
 */
'use strict';

const Attach = {
    DB: 'ordify-attachments',
    STORE: 'files',
    _db: null,

    async _open() {
        if (Attach._db) return Attach._db;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(Attach.DB, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(Attach.STORE)) {
                    const s = db.createObjectStore(Attach.STORE, { keyPath: 'id' });
                    s.createIndex('matterId', 'matterId');
                    s.createIndex('taskId', 'taskId');
                    s.createIndex('clientId', 'clientId');
                }
            };
            req.onsuccess = () => { Attach._db = req.result; resolve(req.result); };
            req.onerror = () => reject(req.error);
        });
    },

    async add({ blob, name, mime, kind = 'file', matterId = null, taskId = null, clientId = null }) {
        const db = await Attach._open();
        const item = {
            id: uuid(),
            kind,
            name: name || `untitled.${(mime||'').split('/')[1] || 'bin'}`,
            mime: mime || blob.type || 'application/octet-stream',
            size: blob.size,
            ts: new Date().toISOString(),
            matterId, taskId, clientId,
            blob
        };
        await new Promise((resolve, reject) => {
            const tx = db.transaction(Attach.STORE, 'readwrite');
            tx.objectStore(Attach.STORE).put(item);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        // mirror metadata to state for fast rendering
        if (!Array.isArray(state.attachments)) state.attachments = [];
        const meta = { ...item }; delete meta.blob;
        state.attachments.push(meta);
        audit('attach', item.id, `${item.kind}: ${item.name}`);
        Store.save();
        return item.id;
    },

    async get(id) {
        const db = await Attach._open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(Attach.STORE, 'readonly');
            const req = tx.objectStore(Attach.STORE).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async delete(id) {
        const db = await Attach._open();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(Attach.STORE, 'readwrite');
            tx.objectStore(Attach.STORE).delete(id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        if (Array.isArray(state.attachments)) {
            state.attachments = state.attachments.filter(a => a.id !== id);
        }
        audit('detach', id, '');
        Store.save();
    },

    forMatter(mid) {
        return (state.attachments || []).filter(a => a.matterId === mid);
    },
    forTask(tid) {
        return (state.attachments || []).filter(a => a.taskId === tid);
    },
    forClient(cid) {
        return (state.attachments || []).filter(a => a.clientId === cid);
    },

    async download(id) {
        const item = await Attach.get(id);
        if (!item) { toast('Attachment not found', 'error'); return; }
        const url = URL.createObjectURL(item.blob);
        const a = document.createElement('a');
        a.href = url; a.download = item.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    },

    async play(id) {
        const item = await Attach.get(id);
        if (!item) { toast('Attachment not found', 'error'); return; }
        const url = URL.createObjectURL(item.blob);
        // open simple modal-less player
        const audio = new Audio(url);
        audio.controls = true;
        audio.play().catch(e => toast('Playback failed: ' + e.message, 'error'));
        audio.onended = () => URL.revokeObjectURL(url);
        // also create visible widget
        Attach._showAudioPlayer(item, url);
    },

    _showAudioPlayer(item, url) {
        let el = document.getElementById('audio-player-bar');
        if (!el) {
            el = document.createElement('div');
            el.id = 'audio-player-bar';
            document.body.appendChild(el);
        }
        el.innerHTML = `
            <span class="ap-name">🎵 ${esc(item.name)}</span>
            <audio controls autoplay src="${url}"></audio>
            <button class="ap-close" aria-label="Close">×</button>
        `;
        el.hidden = false;
        el.querySelector('.ap-close').onclick = () => {
            el.hidden = true;
            const a = el.querySelector('audio');
            if (a) a.pause();
            URL.revokeObjectURL(url);
        };
    },

    fmtSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
        return (bytes/1024/1024).toFixed(2) + ' MB';
    },

    iconFor(kind, mime = '') {
        if (kind === 'audio') return '🎵';
        if (mime.startsWith('image/')) return '🖼';
        if (mime === 'application/pdf') return '📄';
        if (mime.includes('word') || mime.includes('document')) return '📝';
        if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊';
        if (mime.startsWith('video/')) return '🎬';
        return '📎';
    },

    /** Render an attachments block into the given host element id. */
    renderInto(hostId, items, allowAdd) {
        const host = document.getElementById(hostId);
        if (!host) return;
        const rows = items.length ? items.map(a => `
            <li class="att-row" data-id="${a.id}">
                <span class="att-ic">${Attach.iconFor(a.kind, a.mime)}</span>
                <span class="att-name">${esc(a.name)}</span>
                <span class="att-meta">${Attach.fmtSize(a.size)} · ${fmtDate(a.ts)}</span>
                <span class="att-actions">
                    ${a.kind === 'audio' ? `<button class="btn sm" data-att="play" data-id="${a.id}">▶ Play</button>` : ''}
                    <button class="btn sm" data-att="download" data-id="${a.id}">Download</button>
                    <button class="btn sm danger" data-att="delete" data-id="${a.id}">Remove</button>
                </span>
            </li>
        `).join('') : `<li class="att-empty">No attachments yet.</li>`;
        host.innerHTML = `
            <ul class="att-list">${rows}</ul>
            ${allowAdd ? `
                <div class="att-drop" data-host="${esc(hostId)}">
                    <span>📎 Drop files here or <button class="btn sm" data-att="pick" data-host="${esc(hostId)}">choose…</button></span>
                </div>
            ` : ''}
        `;
        if (allowAdd) Attach._wireDrop(host);
    },

    _wireDrop(host) {
        const drop = host.querySelector('.att-drop');
        if (!drop) return;
        const ctx = Attach._currentContext();
        ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => {
            e.preventDefault(); e.stopPropagation(); drop.classList.add('over');
        }));
        ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => {
            e.preventDefault(); e.stopPropagation(); drop.classList.remove('over');
        }));
        drop.addEventListener('drop', async (e) => {
            const files = Array.from(e.dataTransfer.files || []);
            for (const f of files) await Attach._addFile(f, ctx);
            render();
        });
    },

    _currentContext() {
        const { view, id } = parseHash();
        if (view === 'matters' && id) {
            const m = matterById(id);
            return { matterId: id, clientId: m?.clientId || null };
        }
        if (view === 'clients' && id) return { clientId: id };
        return {};
    },

    async _addFile(file, ctx) {
        if (file.size > 50 * 1024 * 1024) {
            toast(`${file.name} too large (>50MB)`, 'error');
            return;
        }
        await Attach.add({
            blob: file, name: file.name, mime: file.type,
            kind: 'file',
            ...ctx
        });
        toast(`Added ${file.name}`);
    },

    /** Trigger file picker for a host. */
    async pick(hostId) {
        const ctx = Attach._currentContext();
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.multiple = true;
        inp.onchange = async () => {
            for (const f of Array.from(inp.files || [])) await Attach._addFile(f, ctx);
            render();
        };
        inp.click();
    }
};

/* Global event delegation for attachment buttons */
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-att]');
    if (!btn) return;
    const action = btn.dataset.att;
    const id = btn.dataset.id;
    if (action === 'play')     Attach.play(id);
    else if (action === 'download') Attach.download(id);
    else if (action === 'delete')   {
        if (confirm('Remove this attachment?')) Attach.delete(id).then(() => render());
    }
    else if (action === 'pick')     Attach.pick(btn.dataset.host);
});
