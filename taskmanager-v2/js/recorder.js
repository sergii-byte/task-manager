// ordify.me — Audio / video recording (Phase 10)
//
// Wraps MediaRecorder for two modes:
//   • voice  — microphone only (calls, dictation, voice notes)
//   • meeting — screen + tab/system audio + microphone (Zoom / Meet calls)
//
// On stop, the recording is saved via Files.put and attached to the
// owning entity (matter / meeting / task / client). No upload anywhere
// else — phase 11 syncs the blob to backend storage.

const Recorder = {
    _media: null,        // MediaRecorder
    _stream: null,       // active MediaStream
    _chunks: [],
    _kind: null,         // 'voice' | 'meeting'
    _owner: null,        // { type, id, label }
    _onStop: null,       // resolve callback for the current recording
    _startedAt: 0,
    _tickHandle: null,

    isRecording() { return !!this._media && this._media.state === 'recording'; },

    /** Begin recording. Returns a promise that resolves with the saved attachment metadata when the user calls stop(). */
    async start({ kind = 'voice', owner = null } = {}) {
        if (this.isRecording()) throw new Error('already recording');
        let stream;
        if (kind === 'voice') {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else if (kind === 'meeting') {
            // Screen + tab/system audio. Then merge in microphone too.
            const display = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,         // system / tab audio
            });
            let mic = null;
            try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); }
            catch (_) { /* mic optional */ }
            stream = mic ? this._mergeAudio(display, mic) : display;
        } else {
            throw new Error('unknown kind: ' + kind);
        }

        // Pick the first supported mime type the browser knows
        const candidates = kind === 'meeting'
            ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
            : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
        const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';

        this._stream = stream;
        this._chunks = [];
        this._kind = kind;
        this._owner = owner;
        this._media = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        this._sessionId = 'rec_' + Date.now().toString(36);
        this._media.ondataavailable = (e) => {
            if (!e.data || !e.data.size) return;
            this._chunks.push(e.data);
            // Drain to IndexedDB so a browser crash mid-record doesn't lose audio.
            // Stored under a session-keyed prefix; cleaned up on _finalise / cancel.
            if (typeof indexedDB !== 'undefined') {
                try {
                    const open = indexedDB.open('ordify-rec-chunks', 1);
                    open.onupgradeneeded = () => {
                        const db = open.result;
                        if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
                    };
                    open.onsuccess = () => {
                        const tx = open.result.transaction('chunks', 'readwrite');
                        tx.objectStore('chunks').put(e.data, this._sessionId + '_' + Date.now());
                    };
                } catch (_) {}
            }
        };
        this._media.onstop = () => this._finalise();

        this._media.start(1000);  // emit a chunk every second so we can show a live size if needed
        this._startedAt = Date.now();
        this._tickHandle = setInterval(() => this._notifyTick(), 1000);

        return new Promise((resolve, reject) => {
            this._onStop = { resolve, reject };
        });
    },

    stop() {
        if (!this.isRecording()) return;
        try { this._media.stop(); } catch (_) {}
        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop());
            this._stream = null;
        }
        if (this._tickHandle) { clearInterval(this._tickHandle); this._tickHandle = null; }
    },

    /** Cancel without saving — used on errors or user dismissal. */
    cancel() {
        try { this._media?.stop(); } catch (_) {}
        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop());
            this._stream = null;
        }
        if (this._tickHandle) { clearInterval(this._tickHandle); this._tickHandle = null; }
        this._chunks = [];
        this._media = null;
        if (this._onStop) {
            this._onStop.reject(new Error('cancelled'));
            this._onStop = null;
        }
    },

    elapsedSec() {
        if (!this._startedAt) return 0;
        return Math.floor((Date.now() - this._startedAt) / 1000);
    },

    /** Merge two MediaStreams' audio into one stream (display + mic). */
    _mergeAudio(display, mic) {
        const ctx = new AudioContext();
        const dst = ctx.createMediaStreamDestination();
        for (const stream of [display, mic]) {
            if (!stream.getAudioTracks().length) continue;
            const src = ctx.createMediaStreamSource(stream);
            src.connect(dst);
        }
        const merged = new MediaStream();
        display.getVideoTracks().forEach(t => merged.addTrack(t));
        dst.stream.getAudioTracks().forEach(t => merged.addTrack(t));
        return merged;
    },

    _notifyTick() {
        // External listeners can subscribe via Recorder.onTick
        if (typeof this.onTick === 'function') this.onTick(this.elapsedSec());
    },

    async _finalise() {
        const isVideo = this._kind === 'meeting';
        const ext = isVideo ? 'webm' : 'webm';
        const stamp = new Date().toISOString().replace('T', '_').replace(/[:.]/g, '-').slice(0, 19);
        const name = (isVideo ? 'meeting-rec_' : 'voice-rec_') + stamp + '.' + ext;
        const mime = this._chunks[0]?.type || (isVideo ? 'video/webm' : 'audio/webm');
        const blob = new Blob(this._chunks, { type: mime });
        // Wrap as a File-ish object so Files.put picks up name
        const file = new File([blob], name, { type: mime });
        try {
            const meta = await Files.put(file, {
                ownerType: this._owner?.type || null,
                ownerId:   this._owner?.id   || null,
            });
            // Append to owner.attachmentIds for the convenience of the UI
            if (this._owner?.type && this._owner?.id) {
                const owner = this._lookupOwner(this._owner.type, this._owner.id);
                if (owner) {
                    if (!owner.attachmentIds) owner.attachmentIds = [];
                    owner.attachmentIds.push(meta.id);
                    Store.flush();
                }
            }
            this._onStop?.resolve(meta);
        } catch (e) {
            this._onStop?.reject(e);
        }
        // Clean up backup chunks for this session
        try {
            const open = indexedDB.open('ordify-rec-chunks', 1);
            open.onsuccess = () => {
                const db = open.result;
                const tx = db.transaction('chunks', 'readwrite');
                const store = tx.objectStore('chunks');
                const keysReq = store.getAllKeys();
                keysReq.onsuccess = () => {
                    for (const k of keysReq.result) {
                        if (typeof k === 'string' && k.startsWith(this._sessionId + '_')) {
                            store.delete(k);
                        }
                    }
                };
            };
        } catch (_) {}
        this._onStop = null;
        this._media = null;
        this._chunks = [];
    },

    _lookupOwner(type, id) {
        if (type === 'matter')  return Store.getMatter(id);
        if (type === 'task')    return Store.getTask(id);
        if (type === 'client')  return Store.getClient(id);
        if (type === 'meeting') return Store.getMeeting(id);
        return null;
    },
};

window.Recorder = Recorder;
