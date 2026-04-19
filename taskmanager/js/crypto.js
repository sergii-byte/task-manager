// Ordify — at-rest encryption (WebCrypto AES-GCM + PBKDF2)
//
// Threat model: protect client data if a stranger gets access to the browser
// storage (lost laptop, malicious extension reading localStorage, forensic
// dump). NOT a defence against an attacker who controls the running JS
// environment — at that point the in-memory key is exposed.
//
// Design:
//   - AES-GCM 256, fresh 12-byte IV per encryption (prepended to ciphertext)
//   - PBKDF2-SHA256 with 200 000 iterations, 16-byte salt (one per install)
//   - Salt stored in localStorage (it's not secret), key kept in memory only
//   - "Forgot passphrase" = data is gone. By design.

const Crypto = {
    PBKDF2_ITERATIONS: 200000,
    KEY_LENGTH: 256,           // bits, AES-256
    IV_LENGTH: 12,             // bytes, recommended for AES-GCM
    SALT_LENGTH: 16,           // bytes
    CHECK_PLAINTEXT: 'ordify-check-v1',  // canary for passphrase verification

    // ----- base64 helpers -----
    _toB64(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    },
    _fromB64(b64) {
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    },

    // ----- random -----
    _randomBytes(n) {
        const a = new Uint8Array(n);
        crypto.getRandomValues(a);
        return a;
    },

    /** Generate a fresh salt (base64). */
    generateSalt() {
        return this._toB64(this._randomBytes(this.SALT_LENGTH));
    },

    /** Derive an AES-GCM key from a passphrase + salt (base64). */
    async deriveKey(passphrase, saltB64) {
        if (!passphrase) throw new Error('empty-passphrase');
        const enc = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            'raw',
            enc.encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: this._fromB64(saltB64),
                iterations: this.PBKDF2_ITERATIONS,
                hash: 'SHA-256',
            },
            baseKey,
            { name: 'AES-GCM', length: this.KEY_LENGTH },
            false,                             // not extractable — key never leaves WebCrypto
            ['encrypt', 'decrypt']
        );
    },

    /** Encrypt a UTF-8 string with the given key. Returns base64(iv || ciphertext). */
    async encrypt(key, plaintext) {
        const iv = this._randomBytes(this.IV_LENGTH);
        const enc = new TextEncoder();
        const ct = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(String(plaintext))
        );
        // pack iv + ciphertext into one buffer
        const ctBytes = new Uint8Array(ct);
        const out = new Uint8Array(iv.length + ctBytes.length);
        out.set(iv, 0);
        out.set(ctBytes, iv.length);
        return this._toB64(out);
    },

    /** Decrypt base64(iv || ciphertext). Throws on tamper / wrong key. */
    async decrypt(key, blobB64) {
        const blob = this._fromB64(blobB64);
        if (blob.length < this.IV_LENGTH + 16) throw new Error('blob-too-short');
        const iv = blob.slice(0, this.IV_LENGTH);
        const ct = blob.slice(this.IV_LENGTH);
        const pt = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ct
        );
        return new TextDecoder().decode(pt);
    },

    /** Verify that a key matches the stored canary. Returns true/false, never throws. */
    async verifyKey(key, checkBlobB64) {
        if (!checkBlobB64) return true;  // no canary stored yet (first run)
        try {
            const pt = await this.decrypt(key, checkBlobB64);
            return pt === this.CHECK_PLAINTEXT;
        } catch (_) {
            return false;
        }
    },

    /** Trigger a download of arbitrary text content as a file. Used for backups. */
    download(filename, content, mime = 'application/json') {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    },

    /** Quick passphrase strength check. Returns { ok: bool, reason: string }. */
    checkPassphrase(p) {
        if (!p || p.length < 10) return { ok: false, reason: 'too-short' };
        const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter(re => re.test(p)).length;
        if (classes < 2) return { ok: false, reason: 'too-simple' };
        return { ok: true };
    },
};
