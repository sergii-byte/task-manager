/* ordify · Google integrations
 * Gmail draft creation, Calendar event creation, Sheets export.
 * Uses Google Identity Services (GIS) for OAuth implicit flow with PKCE-style
 * token client. No server. Token kept in memory for the session.
 *
 * SETUP REQUIRED (one-time, by the user):
 *   1. https://console.cloud.google.com → create project
 *   2. APIs & Services → Library → enable "Gmail API", "Google Calendar API",
 *      "Google Sheets API", "Google Drive API"
 *   3. APIs & Services → OAuth consent screen → External, add your email as
 *      test user, scopes don't need to be added at consent screen
 *   4. APIs & Services → Credentials → Create Credentials → OAuth client ID
 *      → type "Web application"
 *      → Authorized JavaScript origins: https://ordifyme.netlify.app
 *      → Save and copy the Client ID
 *   5. In ordify Settings → paste Client ID into "Google OAuth Client ID"
 */
'use strict';

const Google = {
    SCOPES: [
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
    ].join(' '),

    GIS_SRC: 'https://accounts.google.com/gsi/client',

    _gisLoaded: null,
    _tokenClient: null,
    _accessToken: null,
    _expiresAt: 0,

    configured() {
        return !!state.profile?.googleClientId;
    },

    async _loadGis() {
        if (Google._gisLoaded) return Google._gisLoaded;
        Google._gisLoaded = new Promise((resolve, reject) => {
            if (window.google?.accounts?.oauth2) return resolve();
            const s = document.createElement('script');
            s.src = Google.GIS_SRC; s.async = true; s.defer = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
            document.head.appendChild(s);
        });
        return Google._gisLoaded;
    },

    async _ensureToken({ force = false } = {}) {
        if (!Google.configured()) {
            throw new Error('Google Client ID not set. Add it in Settings.');
        }
        if (!force && Google._accessToken && Date.now() < Google._expiresAt - 60000) {
            return Google._accessToken;
        }
        await Google._loadGis();
        return new Promise((resolve, reject) => {
            try {
                Google._tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: state.profile.googleClientId,
                    scope: Google.SCOPES,
                    callback: (resp) => {
                        if (resp.error) return reject(new Error(resp.error_description || resp.error));
                        Google._accessToken = resp.access_token;
                        Google._expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
                        resolve(resp.access_token);
                    },
                    error_callback: (err) => reject(new Error(err.message || 'OAuth error'))
                });
                Google._tokenClient.requestAccessToken({ prompt: force ? 'consent' : '' });
            } catch (e) { reject(e); }
        });
    },

    async signOut() {
        if (Google._accessToken && window.google?.accounts?.oauth2) {
            try { window.google.accounts.oauth2.revoke(Google._accessToken, () => {}); } catch (e) {}
        }
        Google._accessToken = null;
        Google._expiresAt = 0;
        toast('Signed out of Google');
    },

    async _api(url, opts = {}) {
        const tok = await Google._ensureToken();
        const res = await fetch(url, {
            ...opts,
            headers: {
                'Authorization': 'Bearer ' + tok,
                ...(opts.headers || {})
            }
        });
        if (!res.ok) {
            const err = await res.text().catch(()=>'');
            // 401 → token expired or revoked, retry once
            if (res.status === 401) {
                Google._accessToken = null;
                const tok2 = await Google._ensureToken({ force: true });
                const res2 = await fetch(url, {
                    ...opts,
                    headers: { 'Authorization': 'Bearer ' + tok2, ...(opts.headers || {}) }
                });
                if (!res2.ok) throw new Error(`HTTP ${res2.status}: ${(await res2.text().catch(()=>'')).slice(0,200)}`);
                return res2.json().catch(() => ({}));
            }
            throw new Error(`HTTP ${res.status}: ${err.slice(0,200)}`);
        }
        return res.json().catch(() => ({}));
    },

    /* =====================================================================
     * GMAIL — create draft
     * ===================================================================== */
    async createDraft({ to, subject, body, attachmentBlob = null, attachmentName = null }) {
        const boundary = '----ordify' + Math.random().toString(36).slice(2);
        const lines = [];
        if (attachmentBlob) {
            lines.push(`MIME-Version: 1.0`);
            lines.push(`To: ${to || ''}`);
            lines.push(`Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject || '')))}?=`);
            lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
            lines.push('');
            lines.push(`--${boundary}`);
            lines.push(`Content-Type: text/plain; charset="UTF-8"`);
            lines.push(`Content-Transfer-Encoding: 7bit`);
            lines.push('');
            lines.push(body || '');
            lines.push(`--${boundary}`);
            lines.push(`Content-Type: ${attachmentBlob.type || 'application/octet-stream'}; name="${attachmentName}"`);
            lines.push(`Content-Disposition: attachment; filename="${attachmentName}"`);
            lines.push(`Content-Transfer-Encoding: base64`);
            lines.push('');
            const ab = await attachmentBlob.arrayBuffer();
            lines.push(Google._b64(new Uint8Array(ab)));
            lines.push(`--${boundary}--`);
        } else {
            lines.push(`MIME-Version: 1.0`);
            lines.push(`To: ${to || ''}`);
            lines.push(`Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject || '')))}?=`);
            lines.push(`Content-Type: text/plain; charset="UTF-8"`);
            lines.push(`Content-Transfer-Encoding: 7bit`);
            lines.push('');
            lines.push(body || '');
        }
        const raw = Google._b64url(new TextEncoder().encode(lines.join('\r\n')));
        const draft = await Google._api(
            'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: { raw } })
            }
        );
        audit('gmailDraft', draft.id || null, `to ${to}: ${subject}`);
        return draft;
    },

    /** Open the Gmail web UI to view drafts for the signed-in user. */
    openDrafts() {
        window.open('https://mail.google.com/mail/u/0/#drafts', '_blank');
    },

    /* =====================================================================
     * CALENDAR — create event
     * ===================================================================== */
    async createEvent({ summary, description = '', date = null, dateTime = null, durationMinutes = 60, attendees = [] }) {
        let start, end;
        if (dateTime) {
            const d = new Date(dateTime);
            start = { dateTime: d.toISOString() };
            end   = { dateTime: new Date(d.getTime() + durationMinutes * 60000).toISOString() };
        } else if (date) {
            start = { date };
            // end is exclusive for all-day events
            const d = new Date(date + 'T00:00:00');
            const next = new Date(d.getTime() + 86400000);
            end = { date: next.toISOString().slice(0,10) };
        } else {
            throw new Error('Either date or dateTime is required');
        }
        const evt = await Google._api(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ summary, description, start, end, attendees: attendees.map(e => ({ email: e })) })
            }
        );
        audit('calendarEvent', evt.id || null, summary);
        return evt;
    },

    /* =====================================================================
     * SHEETS — export time logs
     * ===================================================================== */
    async exportTimeLogs() {
        const logs = liveLogs();
        if (!logs.length) throw new Error('No time entries to export');
        const sheet = await Google._api(
            'https://sheets.googleapis.com/v4/spreadsheets',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    properties: { title: `ordify time log ${todayISO()}` }
                })
            }
        );
        const sheetId = sheet.spreadsheetId;
        const header = ['Date', 'Client', 'Matter', 'Notes', 'Minutes', 'Hours', 'Rate', 'Amount', 'Currency', 'Billed'];
        const rows = logs.map(l => {
            const c = clientById(l.clientId);
            const m = matterById(l.matterId);
            const rate = matterRate(m);
            const hours = +(l.minutes / 60).toFixed(2);
            return [
                l.startedAt.slice(0,10),
                c?.name || '',
                m?.title || '',
                l.notes || '',
                l.minutes,
                hours,
                rate,
                +(hours * rate).toFixed(2),
                profileCurrency(),
                l.invoiceId ? 'yes' : 'no'
            ];
        });
        await Google._api(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=RAW`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [header, ...rows] })
            }
        );
        audit('sheetsExport', sheetId, `${rows.length} entries`);
        return { sheetId, url: sheet.spreadsheetUrl, rows: rows.length };
    },

    /* =====================================================================
     * Compose helpers (build draft from invoice / task)
     * ===================================================================== */

    async draftInvoiceEmail(invoiceId) {
        const inv = invoiceById(invoiceId);
        if (!inv) throw new Error('Invoice not found');
        const c = clientById(inv.clientId);
        if (!c) throw new Error('Client missing');
        const total = (inv.items || []).reduce((s,i) => s + (Number(i.amount)||0), 0);
        const subject = `Invoice ${inv.number}`;
        const lines = [
            `Dear ${c.name || 'client'},`,
            ``,
            `Please find attached invoice ${inv.number} dated ${inv.dateIssued} for ${total.toFixed(2)} ${inv.currency}.`,
            inv.dateDue ? `Payment is due by ${inv.dateDue}.` : '',
            ``,
            `Best regards,`,
            state.profile.name || ''
        ].filter(Boolean);
        const draft = await Google.createDraft({
            to: c.email || '',
            subject,
            body: lines.join('\n')
        });
        return draft;
    },

    async syncTaskToCalendar(taskId) {
        const t = taskById(taskId);
        if (!t) throw new Error('Task not found');
        if (!t.due) throw new Error('Task has no due date');
        const m = matterById(t.matterId);
        const c = clientById(t.clientId);
        const summary = t.title;
        const description = [
            c ? `Client: ${c.name}` : '',
            m ? `Matter: ${m.title}` : '',
            t.notes || ''
        ].filter(Boolean).join('\n');
        const evt = await Google.createEvent({
            summary,
            description,
            date: t.due
        });
        // store back-ref so we don't double-create
        t.calendarEventId = evt.id;
        Store.save();
        return evt;
    },

    /* =====================================================================
     * base64 helpers (URL-safe and standard)
     * ===================================================================== */
    _b64(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    },
    _b64url(bytes) {
        return Google._b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
};
