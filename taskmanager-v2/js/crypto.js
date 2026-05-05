// ordify.me — WebCrypto wrapper (Phase 10)
//
// Passphrase-derived AES-GCM encryption. Used to encrypt the Store blob
// before pushing it to Google Sheets so that Google never sees plaintext.
//
//   key   = PBKDF2(passphrase, salt, 100k iterations, SHA-256, 256 bits)
//   blob  = saltLen | salt | iv | aesGcmCipher
//
// The whole package is base64-encoded for storage in a single sheet cell.

const Crypto = {
    PBKDF_ITER: 100_000,
    SALT_LEN: 16,
    IV_LEN: 12,

    _enc: new TextEncoder(),
    _dec: new TextDecoder('utf-8'),
    _keyCache: new Map(),  // passphrase → CryptoKey

    async _deriveKey(passphrase, salt) {
        const cacheKey = passphrase + ':' + this._b64(salt);
        if (this._keyCache.has(cacheKey)) return this._keyCache.get(cacheKey);
        const baseKey = await crypto.subtle.importKey(
            'raw', this._enc.encode(passphrase),
            { name: 'PBKDF2' }, false, ['deriveKey']
        );
        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: this.PBKDF_ITER, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
        this._keyCache.set(cacheKey, key);
        return key;
    },

    /**
     * Encrypt a string with a passphrase. Returns base64 package
     * containing salt+iv+ciphertext.
     */
    async encrypt(plaintext, passphrase) {
        const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LEN));
        const iv   = crypto.getRandomValues(new Uint8Array(this.IV_LEN));
        const key  = await this._deriveKey(passphrase, salt);
        const cipher = new Uint8Array(await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            this._enc.encode(plaintext)
        ));
        // Pack: 1 byte salt-len | salt | iv | cipher
        const out = new Uint8Array(1 + salt.length + iv.length + cipher.length);
        out[0] = salt.length;
        out.set(salt, 1);
        out.set(iv, 1 + salt.length);
        out.set(cipher, 1 + salt.length + iv.length);
        return this._b64(out);
    },

    /** Decrypt a base64 package back to plaintext. */
    async decrypt(b64, passphrase) {
        const buf = this._unb64(b64);
        const saltLen = buf[0];
        const salt = buf.slice(1, 1 + saltLen);
        const iv   = buf.slice(1 + saltLen, 1 + saltLen + this.IV_LEN);
        const cipher = buf.slice(1 + saltLen + this.IV_LEN);
        const key = await this._deriveKey(passphrase, salt);
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            cipher
        );
        return this._dec.decode(plain);
    },

    _b64(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return btoa(s);
    },
    _unb64(b64) {
        const s = atob(b64);
        const out = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
        return out;
    },
};

window.Crypto = Crypto;
