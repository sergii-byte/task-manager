/* ordify · ai
 *
 * Gemini has the ears, Claude has the head.
 *
 * A recording is transcribed and then the words go down exactly the path
 * typed words go down. In v2 dictation reached different conclusions from
 * typing the same sentence, because a second engine was doing the thinking
 * with a prompt written for the first.
 *
 * Everything here returns { actions: [...] } — the same shape whatever came
 * in — so the sheet that shows proposals never learns where they came from.
 */
'use strict';

const AI = {
    keys: { anthropic: '', gemini: '' },

    loadKeys() {
        try {
            AI.keys.anthropic = localStorage.getItem('ordify.v3.key.anthropic') || '';
            AI.keys.gemini    = localStorage.getItem('ordify.v3.key.gemini') || '';
        } catch (e) { /* private mode */ }
    },
    saveKey(which, value) {
        AI.keys[which] = value || '';
        try { localStorage.setItem('ordify.v3.key.' + which, AI.keys[which]); } catch (e) {}
    },

    /* What the model is allowed to propose, and the shape it must answer in.
       Deliberately small: four verbs cover a practice. */
    system() {
        return `You turn a solo lawyer's sentence into actions in their practice manager.

Answer with raw JSON only, no markdown fences:
{ "actions": [ { "op": "...", "data": {...}, "why": "short reason" } ], "clarify": "optional question" }

Ops and their data:
- createClient  { title }
- createProject { title, clientName? | clientId?, billing?: "hourly"|"fixed"|"probono"|"partnership", rate?, fee? }
- createTask    { title, projectName? | parentId?, clientName?, due?: "YYYY-MM-DD", blocked?, link? }
- logTime       { minutes, nodeId? | projectName? | clientName?, on?: "YYYY-MM-DD" }

Rules:
- Use ids from CONTEXT when the thing already exists; use names only when it does not.
- A description of work is a TASK, not a note. "consultation about removing double residency"
  is a task titled "Consultation on removing double residency".
- Distinct actions stay distinct: "reply to X and review the draft" is two tasks, not one.
- Several items about the same matter share that matter.
- Dates are ISO and resolved against TODAY. Never invent a deadline, an amount or a person.
- Write titles in English, short and actionable; keep names, case numbers and references as given.
- If you genuinely cannot tell what is wanted, return no actions and ask in "clarify".`;
    },

    contextBlock() {
        const lines = [];
        P.ofType('client').slice(0, 60).forEach(c => lines.push(`client "${c.id}": ${c.title}`));
        P.ofType('project').slice(0, 80).forEach(p => {
            const c = P.clientOf(p);
            lines.push(`project "${p.id}": ${p.title}${c ? ' (client: ' + c.title + ')' : ''}`);
        });
        P.ofType('task').filter(t => t.status !== 'done').slice(0, 40)
            .forEach(t => lines.push(`task "${t.id}": ${t.title}`));
        return lines.join('\n') || '(nothing yet)';
    },

    async parse(text, { parentId = null } = {}) {
        const here = parentId && P.byId(parentId)
            ? `\n\nTHE USER IS LOOKING AT: "${P.byId(parentId).title}" (id ${parentId}) — ` +
              `prefer to put new things under it unless they say otherwise.`
            : '';
        const msg = `TODAY: ${today()}\n\nCONTEXT:\n${AI.contextBlock()}${here}\n\nUSER:\n${text}`;
        return AI._json(await AI.claude(AI.system(), msg));
    },

    /* Correcting is not patching one field — the correction may add, drop,
       split or merge, so the whole list is re-derived. */
    async refine(original, proposals, correction) {
        const sys = AI.system() + `

REFINEMENT
You already proposed these actions and the user is telling you what is wrong.
Return the COMPLETE corrected list, not just the changes. Keep everything they
did not object to. Their correction outranks your earlier reading.`;
        const msg = `TODAY: ${today()}\n\nCONTEXT:\n${AI.contextBlock()}\n\n` +
            `ORIGINAL:\n${original || '(not available)'}\n\n` +
            `YOU PROPOSED:\n${JSON.stringify(proposals.map(p => ({ op: p.op, data: p.data })), null, 1)}\n\n` +
            `CORRECTION:\n${correction}`;
        return AI._json(await AI.claude(sys, msg));
    },

    /* ---- Claude ---- */
    async claude(system, user, max = 1500) {
        if (!AI.keys.anthropic) {
            throw new Error('Add an Anthropic API key in Settings to use this.');
        }
        const call = (model) => fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': AI.keys.anthropic,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({ model, max_tokens: max, system, messages: [{ role: 'user', content: user }] })
        });

        let model = await AI.model();
        let res = await call(model);
        if (res.status === 404) {                    // the model was retired
            const fresh = await AI.model({ force: true });
            if (fresh && fresh !== model) { model = fresh; res = await call(model); }
        }
        if (!res.ok) throw AI._httpError(res.status, await res.text().catch(() => ''), model);
        const json = await res.json();
        return (json.content && json.content[0] && json.content[0].text) || '';
    },

    /* Ask the key which models exist rather than shipping a list that rots —
       v2 spent weeks 404-ing because its default had been retired. */
    async model({ force = false } = {}) {
        if (AI._model && !force) return AI._model;
        try {
            const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
                headers: {
                    'x-api-key': AI.keys.anthropic,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            });
            if (!res.ok) return AI._model || 'claude-opus-4-8';
            const ids = ((await res.json()).data || []).map(m => m.id).filter(Boolean);
            AI._model = ids.sort((a, b) => AI._score(b) - AI._score(a))[0] || 'claude-opus-4-8';
            return AI._model;
        } catch (e) {
            return AI._model || 'claude-opus-4-8';
        }
    },
    _score(id) {
        const s = id.toLowerCase();
        let n = s.includes('opus') ? 100 : s.includes('sonnet') ? 60 : s.includes('haiku') ? 30 : 0;
        if (/preview|mythos/.test(s)) n -= 500;
        const v = s.match(/(\d+)[-.](\d+)/);
        return n + (v ? Number(v[1]) * 10 + Number(v[2]) : 0);
    },
    _httpError(status, body, model) {
        if (status === 404) return new Error(`Model "${model}" no longer exists.`);
        if (status === 401 || status === 403) return new Error('Anthropic rejected the API key.');
        if (status === 429) return new Error('Rate limited — try again in a moment.');
        if (status >= 500) return new Error(`Anthropic is having trouble (HTTP ${status}).`);
        return new Error(`HTTP ${status}: ${String(body).slice(0, 200)}`);
    },

    /* ---- Gemini: ears only ---- */
    async transcribe(blob) {
        if (!AI.keys.gemini) throw new Error('Add a Gemini API key in Settings to dictate.');
        const b64 = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(',')[1]);
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
        const res = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-goog-api-key': AI.keys.gemini },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [
                        { text: 'Transcribe this recording verbatim. Keep the speaker\'s language — ' +
                                'do not translate. Output the words and nothing else.' },
                        { inline_data: { mime_type: blob.type || 'audio/webm', data: b64 } }
                    ]}],
                    generationConfig: { temperature: 0, maxOutputTokens: 900 }
                })
            });
        if (!res.ok) {
            if (res.status === 429) throw new Error('Google\'s free quota for this key is used up.');
            if (res.status === 401 || res.status === 403) throw new Error('Gemini rejected the API key.');
            throw new Error('Gemini HTTP ' + res.status);
        }
        const j = await res.json();
        const txt = (((j.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || '';
        if (!txt.trim()) throw new Error('Nothing recognisable in the recording');
        return txt.trim();
    },

    /* Models are asked for raw JSON and occasionally wrap it anyway. */
    _json(text) {
        const cleaned = String(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        try {
            const parsed = JSON.parse(cleaned);
            return { actions: Array.isArray(parsed.actions) ? parsed.actions : [],
                     clarify: parsed.clarify || '' };
        } catch (e) {
            throw new Error('The model did not answer with JSON');
        }
    }
};

/* ---- dictation ----
   One microphone. It records, Gemini turns it into words, and the words are
   shown before anything is proposed so a mis-hearing is visible and editable. */
const Mic = {
    rec: null, chunks: [], on: false,

    supported() { return !!(navigator.mediaDevices && window.MediaRecorder); },

    async toggle(input) {
        if (Mic.on) return Mic.stop();
        if (!Mic.supported()) { Sheet.error('This browser cannot record audio.'); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus' : '';
            const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
            Mic.chunks = [];
            rec.ondataavailable = (e) => { if (e.data && e.data.size) Mic.chunks.push(e.data); };
            rec.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                Mic._setOn(false);
                const blob = new Blob(Mic.chunks, { type: rec.mimeType || 'audio/webm' });
                if (!blob.size) { Sheet.error('Nothing was recorded.'); return; }
                Sheet.loading('Transcribing…');
                try {
                    const words = await AI.transcribe(blob);
                    if (input) input.value = words;      // seen before it is acted on
                    await Capture.submit(words);
                } catch (e) {
                    Sheet.error(e.message || 'Could not read the recording');
                }
            };
            rec.start();
            Mic.rec = rec;
            Mic._setOn(true);
        } catch (e) {
            Sheet.error('Microphone permission denied.');
        }
    },

    stop() { if (Mic.rec && Mic.rec.state !== 'inactive') Mic.rec.stop(); },

    _setOn(v) {
        Mic.on = v;
        const b = document.getElementById('mic');
        if (b) { b.classList.toggle('rec', v); b.title = v ? 'Stop and transcribe' : 'Dictate'; }
    }
};

if (typeof module !== 'undefined') module.exports = { AI, Mic };
