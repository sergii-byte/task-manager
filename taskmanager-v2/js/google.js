// ordify.me — Shared Google OAuth + REST helper (Phase 9)
//
// Uses Google Identity Services (GIS) for popup-based PKCE-less token flow.
// The user must register an OAuth Client (type: Web application) in their
// own Google Cloud project and paste the Client ID into Settings. Token is
// kept in-memory only — never persisted — so a refresh requires re-auth.

const Google = {
    _gsiLoaded: null,    // Promise that resolves when gsi/client script is ready
    _tokenClient: null,
    _accessToken: null,
    _expiresAt: 0,
    _scopes: '',

    /** Lazy-load the Google Identity Services library. */
    _loadGsi() {
        if (this._gsiLoaded) return this._gsiLoaded;
        this._gsiLoaded = new Promise((resolve, reject) => {
            if (window.google?.accounts?.oauth2) return resolve();
            const s = document.createElement('script');
            s.src = 'https://accounts.google.com/gsi/client';
            s.async = true;
            s.defer = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
            document.head.appendChild(s);
        });
        return this._gsiLoaded;
    },

    /**
     * Request an access token. Caches in memory for the page session.
     * If the user has previously consented this scope (recorded in
     * settings.google_connected_scopes), tries silent reauth first
     * (no popup) — falls back to interactive only when silent fails.
     */
    async requestToken(scopes) {
        const clientId = Store.getSetting('google_client_id');
        if (!clientId) throw new Error('No Google Client ID. Add one in Settings.');

        await this._loadGsi();

        if (this._accessToken && this._scopes === scopes && Date.now() < this._expiresAt - 60_000) {
            return this._accessToken;
        }

        // Try silent reauth if we've previously connected this scope
        const known = Store.getSetting('google_connected_scopes') || [];
        const hasSilent = known.some(s => s.split(' ').every(x => scopes.includes(x)));

        const acquire = (prompt) => new Promise((resolve, reject) => {
            this._tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: scopes,
                callback: (resp) => {
                    if (resp.error) { reject(new Error(resp.error)); return; }
                    this._accessToken = resp.access_token;
                    this._expiresAt = Date.now() + (resp.expires_in || 3600) * 1000;
                    this._scopes = scopes;
                    // Record that we've successfully connected these scopes
                    const list = Store.getSetting('google_connected_scopes') || [];
                    if (!list.includes(scopes)) {
                        list.push(scopes);
                        Store.setSetting('google_connected_scopes', list);
                    }
                    resolve(resp.access_token);
                },
                error_callback: (err) => reject(new Error(err?.type || 'OAuth cancelled')),
            });
            this._tokenClient.requestAccessToken({ prompt });
        });

        if (hasSilent) {
            try { return await acquire('none'); } catch (_) { /* fall through */ }
        }
        return acquire('');
    },

    /** Forget any saved scope — use after revoking access or wanting fresh consent. */
    forget() {
        Store.setSetting('google_connected_scopes', []);
        this._accessToken = null;
        this._expiresAt = 0;
        this._scopes = '';
    },

    /** Force a fresh consent flow (used if scopes were revoked or expanded). */
    async reconnect(scopes) {
        await this._loadGsi();
        this._accessToken = null;
        this._expiresAt = 0;
        this._scopes = '';
        return this.requestToken(scopes);
    },

    isConnected(scopes) {
        return !!this._accessToken && this._scopes.includes(scopes) && Date.now() < this._expiresAt - 60_000;
    },

    /** Authenticated GET to a Google API endpoint. Returns parsed JSON. */
    async get(url, scopes) {
        const tok = await this.requestToken(scopes);
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${tok}` },
        });
        if (!res.ok) {
            let detail = '';
            try { detail = (await res.json())?.error?.message || ''; } catch (_) {}
            throw new Error(`Google ${res.status}${detail ? ': ' + detail : ''}`);
        }
        return res.json();
    },
};

window.Google = Google;
