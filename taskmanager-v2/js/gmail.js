// ordify.me — Gmail integration (Phase 9)
//
// Pulls recent messages via the Gmail REST API and lets the AI extract
// structured tasks (one or more per email). Read-only scope: we do not
// modify the user's Gmail in this version.
//
// Workflow:
//   1. User clicks Connect Gmail in Settings → Google OAuth popup
//   2. ordify pulls last 20 messages from inbox (q=in:inbox newer_than:14d)
//   3. For each, header (from, subject, date) + plain-text body decoded
//   4. AI (`AI.parseEmail`) returns { tasks: [{ title, deadline, ... }] }
//   5. UI lists messages with extracted task suggestions; one click commits

const Gmail = {
    SCOPE: 'https://www.googleapis.com/auth/gmail.readonly',

    isConnected() {
        return Google.isConnected(this.SCOPE);
    },

    async connect() {
        await Google.requestToken(this.SCOPE);
    },

    async listRecent({ max = 20, query = 'in:inbox newer_than:14d' } = {}) {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(query)}`;
        const data = await Google.get(url, this.SCOPE);
        return data.messages || [];
    },

    async getMessage(id) {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`;
        const data = await Google.get(url, this.SCOPE);
        return this._normalize(data);
    },

    /** Walk MIME parts and pick the best plaintext body. */
    _extractBody(payload) {
        if (!payload) return '';
        const decode = (b64) => {
            try {
                const std = b64.replace(/-/g, '+').replace(/_/g, '/');
                const bin = atob(std);
                const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
                return new TextDecoder('utf-8').decode(bytes);
            } catch (_) { return ''; }
        };
        const walk = (part, depth = 0) => {
            if (depth > 6) return null;
            if (part.mimeType === 'text/plain' && part.body?.data) return decode(part.body.data);
            if (part.parts) {
                for (const p of part.parts) {
                    const r = walk(p, depth + 1);
                    if (r) return r;
                }
            }
            return null;
        };
        const plain = walk(payload);
        if (plain) return plain;
        // Fallback: HTML stripped
        const walkHtml = (part, depth = 0) => {
            if (depth > 6) return null;
            if (part.mimeType === 'text/html' && part.body?.data) return decode(part.body.data);
            if (part.parts) {
                for (const p of part.parts) {
                    const r = walkHtml(p, depth + 1);
                    if (r) return r;
                }
            }
            return null;
        };
        const html = walkHtml(payload);
        if (html) return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return '';
    },

    _normalize(msg) {
        const headers = msg.payload?.headers || [];
        const h = (name) => headers.find(x => x.name.toLowerCase() === name.toLowerCase())?.value || '';
        const subject = h('Subject');
        const from    = h('From');
        const dateStr = h('Date');
        const date    = dateStr ? new Date(dateStr).toISOString() : '';
        const snippet = msg.snippet || '';
        const body    = this._extractBody(msg.payload);
        return {
            id: msg.id,
            threadId: msg.threadId,
            from, subject, date, snippet,
            body: body.slice(0, 8000),  // cap so the AI prompt stays modest
            unread: (msg.labelIds || []).includes('UNREAD'),
        };
    },
};

window.Gmail = Gmail;
