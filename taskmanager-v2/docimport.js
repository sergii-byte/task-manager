/* ordify · import billing details from an existing invoice
 *
 * Accepts a .docx (unzipped in-browser with fflate), a PDF, or an image.
 * The content goes to Claude, which extracts the invoice ISSUER's details
 * (the user's own name, address, tax id, bank accounts). The user reviews
 * the result before it is written into the profile.
 *
 * Depends on globals from app.js: state, Store, Modal, esc, uuid, toast,
 * render. And the global `fflate` (loaded from CDN) for .docx unzipping.
 */
'use strict';

const DocImport = {

    run() {
        if (!state.profile.anthropicKey) {
            toast('Add your Anthropic API key in Settings first', 'error');
            return;
        }
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.docx,application/pdf,image/*';
        inp.onchange = () => {
            const file = inp.files && inp.files[0];
            if (file) DocImport._handle(file);
        };
        inp.click();
    },

    async _handle(file) {
        toast('Reading ' + file.name + '…');
        try {
            const name = (file.name || '').toLowerCase();
            let extracted;
            if (name.endsWith('.docx')) {
                const text = await DocImport._docxText(file);
                if (!text.trim()) throw new Error('No readable text in the .docx');
                extracted = await DocImport._ask({ text });
            } else if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
                extracted = await DocImport._ask({ pdf: await DocImport._b64(file) });
            } else if ((file.type || '').startsWith('image/')) {
                extracted = await DocImport._ask({ image: await DocImport._b64(file), mime: file.type });
            } else {
                throw new Error('Unsupported file — use .docx, PDF or an image');
            }
            DocImport._review(extracted);
        } catch (e) {
            console.error('invoice import failed', e);
            toast('Import failed: ' + (e.message || e), 'error');
        }
    },

    /* --- .docx → plain text (document + headers + footers) --- */
    async _docxText(file) {
        if (typeof fflate === 'undefined') throw new Error('Unzip library not loaded — check your connection');
        const buf = new Uint8Array(await file.arrayBuffer());
        const files = fflate.unzipSync(buf);
        const parts = [];
        Object.keys(files).forEach(n => {
            if (/^word\/(document|header\d*|footer\d*)\.xml$/.test(n)) {
                let xml = new TextDecoder('utf-8').decode(files[n]);
                xml = xml.replace(/<\/w:p>/g, '\n')
                         .replace(/<w:tab\/?>/g, '\t')
                         .replace(/<w:br\/?>/g, '\n');
                const text = xml.replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
                if (text.trim()) parts.push(text);
            }
        });
        if (!parts.length) throw new Error('Not a valid .docx file');
        return parts.join('\n');
    },

    async _b64(file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < buf.length; i += CHUNK) {
            bin += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
        }
        return btoa(bin);
    },

    async _ask(payload) {
        const sys = `You are reading an invoice that THE USER issues to their own clients. Extract the SENDER's billing details — the invoice ISSUER (the user), NOT the client / recipient / "bill to" party.

Return ONLY raw JSON, no markdown fences:
{
  "name": "", "email": "", "phone": "", "address": "", "taxId": "", "paymentTerms": "",
  "bankAccounts": [ { "currency": "EUR", "iban": "", "swift": "", "bankName": "", "holder": "" } ]
}
Rules:
- Use "" for any scalar not found, [] if no bank accounts are present.
- "address" may be multi-line.
- If several bank accounts for different currencies are listed, return every one.
- "currency" must be a 3-letter code (EUR, USD, GBP, ...).
- Return the ISSUER's details only — never the recipient's.`;

        let content;
        if (payload.text) {
            content = 'INVOICE TEXT:\n\n' + payload.text.slice(0, 14000);
        } else if (payload.pdf) {
            content = [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: payload.pdf } },
                { type: 'text', text: 'Extract the issuer billing details per the system instructions.' }
            ];
        } else {
            content = [
                { type: 'image', source: { type: 'base64', media_type: payload.mime, data: payload.image } },
                { type: 'text', text: 'Extract the issuer billing details per the system instructions.' }
            ];
        }

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': state.profile.anthropicKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: state.profile.anthropicModel || 'claude-3-5-haiku-latest',
                max_tokens: 1024,
                system: sys,
                messages: [{ role: 'user', content }]
            })
        });
        if (!res.ok) {
            const err = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
        }
        const json = await res.json();
        const txt = (json.content && json.content[0] && json.content[0].text) || '';
        const cleaned = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch (e) {
            throw new Error('AI returned an unreadable response');
        }
    },

    _review(d) {
        d = d || {};
        const accts = Array.isArray(d.bankAccounts) ? d.bankAccounts.filter(a => a && a.iban) : [];
        const anyScalar = ['name','email','phone','address','taxId','paymentTerms'].some(k => d[k]);
        if (!anyScalar && !accts.length) {
            toast('Could not find billing details in that file', 'error');
            return;
        }
        Modal.open({
            title: 'Review imported details',
            saveLabel: 'Apply to profile',
            fields: [
                { name: 'name',  label: 'Name', value: d.name || '', full: true },
                { name: 'email', label: 'Email', value: d.email || '' },
                { name: 'phone', label: 'Phone', value: d.phone || '' },
                { name: 'taxId', label: 'Tax / VAT ID', value: d.taxId || '' },
                { name: 'address', label: 'Address', type: 'textarea', value: d.address || '', rows: 2, full: true },
                { name: 'paymentTerms', label: 'Payment terms', type: 'textarea', value: d.paymentTerms || '', rows: 2, full: true },
                { name: '_accts', label: 'Bank accounts detected', type: 'textarea', rows: 3, full: true,
                    value: accts.length
                        ? accts.map(a => `${(a.currency||'?')}  ${a.iban||''}${a.swift?'  '+a.swift:''}`).join('\n')
                        : '(none found)',
                    hint: 'New accounts are added on apply. Edit them afterwards in Settings → Bank accounts.' }
            ],
            onSave: (data) => {
                ['name','email','phone','taxId','address','paymentTerms'].forEach(k => {
                    if (data[k] && data[k].trim()) state.profile[k] = data[k].trim();
                });
                if (!Array.isArray(state.profile.bankAccounts)) state.profile.bankAccounts = [];
                let added = 0;
                accts.forEach(a => {
                    const iban = (a.iban || '').trim();
                    if (!iban) return;
                    const norm = (s) => (s || '').replace(/\s/g, '').toLowerCase();
                    if (state.profile.bankAccounts.some(x => norm(x.iban) === norm(iban))) return;
                    state.profile.bankAccounts.push({
                        id: uuid(),
                        currency: (a.currency || 'EUR').toUpperCase().slice(0, 3),
                        iban,
                        swift: a.swift || '',
                        bankName: a.bankName || '',
                        holder: a.holder || ''
                    });
                    added++;
                });
                Store.save();
                render();
                toast('Profile updated' + (added ? ` · +${added} bank account${added===1?'':'s'}` : ''));
            }
        });
    }
};
