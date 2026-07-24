/* ordify · omni-input + AI parser + Web Speech dictation
 * Single intelligent input: type or dictate → Claude proposes actions → user accepts.
 * Depends on globals from app.js: state, Store, $, $$, esc, uuid, todayISO,
 *   clientById, matterById, taskById, matterRate, profileCurrency, audit, toast,
 *   render, navigate, fmtDate, fmtMinutes
 */
'use strict';

/* =========================================================================
 * 1. OMNI STATE & MOUNT
 * ========================================================================= */

const Omni = {
    el: null,
    input: null,
    micBtn: null,
    aiBtn: null,
    attachBtn: null,
    panel: null,
    busy: false,
    proposals: [],   // [{ op, data, summary, accepted }]
    lastInput: '',   // what produced them — the refine call needs it for context
    sourceEmail: null, // set when proposals came from an inbox email
    listening: false,

    init() {
        Omni.el        = $('#omni');
        Omni.input     = $('#omni-input');
        Omni.micBtn    = $('#omni-mic');
        Omni.aiBtn     = $('#omni-ai');
        Omni.attachBtn = $('#omni-attach');
        Omni.panel     = $('#omni-panel');

        Omni.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.metaKey || e.ctrlKey || Omni._looksLikeNL(Omni.input.value)) {
                    Omni.runAI();
                } else {
                    Omni.runSearch();
                }
            } else if (e.key === 'Escape') {
                Omni.clear();
            }
        });
        Omni.input.addEventListener('input', () => {
            if (Omni.input.value.trim().length >= 2) Omni._renderSearchHints();
            else Omni._hide();
        });
        // With drafts still pending, this button reopens them rather than
        // re-parsing: closing the sheet must not be the same as losing them.
        Omni.aiBtn.addEventListener('click', () => {
            const pending = Omni.proposals.filter(p => !p.accepted).length;
            if (pending && Omni.panel.hidden) {
                Omni._renderProposals({ actions: Omni.proposals });
                return;
            }
            Omni.runAI();
        });
        Omni.micBtn.addEventListener('click', () => Recorder.toggle());
        if (Omni.attachBtn) Omni.attachBtn.addEventListener('click', () => Omni.attach());

        // global ⌘K / Ctrl+K
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                Omni.input.focus();
                Omni.input.select();
            }
        });

        // Clicking away closes search hints, but never discards proposals:
        // they are unsaved work, and the only way back used to be retyping
        // the whole sentence.
        document.addEventListener('click', (e) => {
            if (Omni.el.contains(e.target) || Omni.panel.contains(e.target)) return;
            if (Omni.scrim && Omni.scrim.contains(e.target)) return;
            if (Omni.proposals.length) return;
            Omni._hide();
        });

        // Escape closes the sheet whatever it is showing
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !Omni.panel.hidden) Omni._hide();
        });

        // Tapping the scrim dismisses the sheet, the way a sheet should.
        Omni.scrim = $('#omni-scrim');
        if (Omni.scrim) Omni.scrim.addEventListener('click', () => Omni._hide());

        // An on-screen keyboard shrinks the visual viewport but not the
        // layout viewport, so a bottom-anchored sheet ends up underneath it.
        if (window.visualViewport) {
            const sync = () => Omni._syncViewport();
            window.visualViewport.addEventListener('resize', sync);
            window.visualViewport.addEventListener('scroll', sync);
        }
    },

    _syncViewport() {
        const vv = window.visualViewport;
        if (!vv || !Omni.panel) return;
        const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        // --kb both shortens the sheet and lifts it clear of the keyboard
        document.documentElement.style.setProperty('--kb', kb + 'px');
    },

    /* `sheet` marks the proposal UI, which on a phone is a modal bottom sheet
     * and so earns a scrim. Search hints are a dropdown either way. */
    _show({ sheet = false } = {}) {
        Omni.panel.hidden = false;
        if (Omni.scrim) Omni.scrim.hidden = !sheet;   // CSS hides it above 720px
        Omni._syncViewport();
    },

    _hide() {
        Omni.panel.hidden = true;
        if (Omni.scrim) Omni.scrim.hidden = true;
        document.documentElement.style.setProperty('--kb', '0px');
    },

    clear() {
        Omni.input.value = '';
        Omni.proposals = [];
        Omni.sourceEmail = null;
        Omni.panel.innerHTML = '';
        Omni._hide();
    },

    _looksLikeNL(s) {
        // crude: more than 4 words OR contains a verb-ish phrase OR ends with .?!
        const words = s.trim().split(/\s+/);
        if (words.length > 4) return true;
        if (/[.?!]\s*$/.test(s)) return true;
        return false;
    },

    /* ---- search hints ---- */
    runSearch() {
        const q = Omni.input.value.trim().toLowerCase();
        if (!q) return;
        const results = Omni._search(q);
        if (results.length) { Omni._go(results[0]); Omni.clear(); }
        else toast('No matches');
    },

    /* Tasks have no page of their own — land on Today and open the task. */
    _go({ path, taskId }) {
        navigate(path);
        if (taskId) setTimeout(() => openTaskForm(taskId), 0);
    },

    _search(q) {
        const out = [];
        state.clients.filter(c => !c.deletedAt).forEach(c => {
            if ((c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q))
                out.push({ kind: 'client', label: c.name, sub: c.email||'', path: 'clients/'+c.id });
        });
        state.matters.filter(m => !m.deletedAt).forEach(m => {
            if ((m.title||'').toLowerCase().includes(q))
                out.push({ kind: 'project', label: m.title, sub: clientById(m.clientId)?.name||'', path: 'matters/'+m.id });
        });
        state.tasks.filter(t => !t.deletedAt).forEach(t => {
            if ((t.title||'').toLowerCase().includes(q))
                out.push({ kind: 'task', label: t.title, sub: matterById(t.matterId)?.title||'',
                           path: 'today', taskId: t.id });
        });
        state.invoices.filter(i => !i.deletedAt).forEach(i => {
            if ((i.number||'').toLowerCase().includes(q))
                out.push({ kind: 'invoice', label: i.number, sub: clientById(i.clientId)?.name||'', path: 'invoices/'+i.id });
        });
        return out.slice(0, 12);
    },

    _renderSearchHints() {
        const q = Omni.input.value.trim().toLowerCase();
        if (!q) { Omni._hide(); return; }
        const results = Omni._search(q);
        const isNL = Omni._looksLikeNL(Omni.input.value);
        Omni.panel.innerHTML = `
            <div class="omni-hint">
                ${isNL
                    ? `Press <kbd>Enter</kbd> to ask AI · <kbd>Esc</kbd> to clear`
                    : `<kbd>Enter</kbd> to jump · <kbd>⌘+Enter</kbd> to ask AI`}
            </div>
            ${results.length ? `<ul class="omni-results">${results.map((r,i) => `
                <li class="omni-row" data-go="${esc(r.path)}" data-task="${esc(r.taskId || '')}">
                    <span class="kind">${esc(r.kind)}</span>
                    <span class="lbl">${esc(r.label)}</span>
                    <span class="sub">${esc(r.sub)}</span>
                </li>
            `).join('')}</ul>` : ''}
        `;
        Omni._show();
        $$('.omni-row', Omni.panel).forEach(li => {
            li.addEventListener('click', () => {
                Omni._go({ path: li.dataset.go, taskId: li.dataset.task || null });
                Omni.clear();
            });
        });
    },

    /* ---- attach one or more files (document / image / A-V) → AI extracts
     * actions from each, merged into one proposal sheet. Read sequentially so
     * a stack of files can't fire a burst of parallel API calls into a rate
     * limit; a file that fails is reported and the rest still land. ---- */
    attach() {
        if (!state.profile.anthropicKey) {
            Omni._renderError('Add your Anthropic API key in Settings to use file attachments. <a href="#/settings">Open settings →</a>');
            return;
        }
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.multiple = true;
        inp.accept = '.docx,application/pdf,image/*,text/plain,audio/*,video/*';
        inp.onchange = async () => {
            const files = Array.from(inp.files || []);
            if (!files.length) return;
            if (Omni.busy) return;
            Omni.busy = true;
            Omni.sourceEmail = null;
            // Text the user already typed is their instruction for the files —
            // NOT something to overwrite with a filename. Keep it in the box and
            // pass it to the parser so "log time for each of these" works.
            const note = Omni.input.value.trim();
            Omni.lastInput = (note ? note + ' — ' : '') + 'attached: ' + files.map(f => f.name).join(', ');

            const actions = [];
            const transcripts = [];
            const failed = [];
            for (let i = 0; i < files.length; i++) {
                Omni._renderLoading(files.length > 1
                    ? `Reading ${i + 1} of ${files.length}: ${files[i].name}…`
                    : undefined);
                try {
                    const result = await AI.parseFile(files[i], note);
                    (result.actions || []).forEach(a => actions.push(a));
                    if (result.transcript) transcripts.push(result.transcript);
                } catch (e) {
                    console.error('attach parse failed', files[i].name, e);
                    failed.push(`${files[i].name}: ${e.message || 'error'}`);
                }
            }

            Omni.busy = false;
            if (!actions.length) {
                Omni._renderError(failed.length
                    ? 'Could not read ' + esc(failed.join('; '))
                    : 'Nothing actionable found in ' + (files.length === 1 ? 'that file' : 'those files') + '.');
                return;
            }
            Omni.proposals = actions.map(a => ({ ...a, accepted: false }));
            const result = { actions };
            if (transcripts.length) result.transcript = transcripts.join('\n\n———\n\n');
            Omni._renderProposals(result);
            if (failed.length) toast(`Couldn't read ${failed.length} file${failed.length === 1 ? '' : 's'}`, 'error');
        };
        inp.click();
    },

    /* ---- AI parse ---- */
    async runAI() {
        const text = Omni.input.value.trim();
        if (!text) return;
        if (!state.profile.anthropicKey) {
            Omni._renderError(`Add your Anthropic API key in Settings to use AI parsing. <a href="#/settings">Open settings →</a>`);
            return;
        }
        if (Omni.busy) return;
        Omni.busy = true;
        Omni.sourceEmail = null;
        Omni.lastInput = text;
        Omni._renderLoading();
        try {
            const result = await AI.parseInput(text);
            Omni.proposals = (result.actions || []).map(a => ({ ...a, accepted: false }));
            Omni._renderProposals(result);
        } catch (e) {
            console.error('AI parse failed', e);
            Omni._renderError('AI request failed: ' + esc(e.message));
        } finally {
            Omni.busy = false;
        }
    },

    _renderLoading(message) {
        Omni.panel.innerHTML = `<div class="omni-loading"><span class="spinner"></span> ${esc(message || 'Asking Claude…')}</div>`;
        Omni._show();
    },

    _renderError(msg) {
        Omni.panel.innerHTML = `<div class="omni-error">${msg}</div>`;
        Omni._show();
    },

    _renderProposals(result) {
        if (result.clarify) {
            Omni.panel.innerHTML = `
                <div class="omni-clarify">
                    <strong>Need clarification</strong>
                    <p>${esc(result.clarify)}</p>
                </div>`;
            Omni._show();
            return;
        }
        if (!Omni.proposals.length) {
            Omni.panel.innerHTML = `<div class="omni-error">Claude couldn't extract any actions. Try rephrasing.</div>`;
            Omni._show();
            return;
        }
        Omni.panel.innerHTML = `
            <div class="omni-head">
                <strong>${Omni.proposals.length} proposed action${Omni.proposals.length===1?'':'s'}</strong>
                <span class="grow"></span>
                <button class="btn sm" data-omni="accept-all">Accept all</button>
                <button class="btn sm ghost" data-omni="discard">Discard</button>
                <button class="omni-close" data-omni="close" title="Close" aria-label="Close">×</button>
            </div>
            <ul class="omni-proposals">
                ${Omni.proposals.map((p, i) => `
                    <li class="proposal" data-i="${i}">
                        <div class="op-tag op-${esc(p.op)}">${esc(Omni._opLabel(p.op))}</div>
                        <div class="op-summary" data-sum="${i}">${esc(p.summary || Omni._defaultSummary(p))}</div>
                        ${p.reason ? `<div class="op-reason">${esc(p.reason)}</div>` : ''}
                        ${Omni._gapPickerHtml(p, i)}
                        ${Omni._editorHtml(p, i)}
                        <div class="op-actions">
                            <button class="btn sm primary" data-omni="accept" data-i="${i}">Accept</button>
                            <button class="btn sm" data-omni="edit" data-i="${i}">Edit</button>
                            <button class="btn sm ghost" data-omni="skip" data-i="${i}">Skip</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
            <div class="omni-refine">
                <label for="omni-refine-input">Not right? Say what to change</label>
                <div class="refine-row">
                    <input id="omni-refine-input" type="text" autocomplete="off"
                           placeholder="e.g. the client is Datavise, due Friday, drop the second one">
                    <button type="button" class="btn sm icon" data-omni="refine-mic" title="Dictate the correction" aria-label="Dictate the correction">
                        <svg class="ic-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>
                    </button>
                    <button type="button" class="btn sm primary" data-omni="refine">Redo</button>
                </div>
            </div>
            ${result.transcript ? `<details class="omni-transcript"><summary>Source transcript</summary><div>${esc(result.transcript)}</div></details>` : ''}
        `;
        Omni._show({ sheet: true });
        Omni.panel.querySelectorAll('[data-omni]').forEach(b => {
            b.addEventListener('click', () => Omni._handleProposalAction(b.dataset.omni, b.dataset.i));
        });
        // a correction is a sentence, so Enter sends it
        const rin = Omni.panel.querySelector('#omni-refine-input');
        if (rin) rin.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); Omni._handleProposalAction('refine'); }
        });
        // edits write straight through to the proposal, so Accept needs no
        // separate "save" step and the summary can stay honest
        Omni.panel.querySelectorAll('[data-edit]').forEach(el => {
            el.addEventListener('change', () => Omni._applyEdit(el));
            if (el.tagName === 'INPUT') el.addEventListener('input', () => Omni._applyEdit(el));
        });
        // matter picker → repopulate the dependent task picker
        Omni.panel.querySelectorAll('select[data-gap="matter"]').forEach(sel => {
            sel.addEventListener('change', () => {
                const taskSel = Omni.panel.querySelector(`select[data-gap="task"][data-i="${sel.dataset.i}"]`);
                if (!taskSel) return;
                if (!sel.value || sel.value === '__new__') {
                    taskSel.innerHTML = '<option value="">— no specific task —</option>';
                    taskSel.disabled = true;
                } else {
                    taskSel.innerHTML = Omni._taskOptionsHtml(sel.value);
                    taskSel.disabled = false;
                }
            });
        });
    },

    /* ---- inline correction of a single proposal ----
     * The talk-to-it path handles most mistakes, but when exactly one field is
     * wrong, changing it directly beats describing the change. */

    _clientOpts() {
        return [{ v: '', l: '— none —' }].concat(
            state.clients.filter(c => !c.deletedAt).map(c => ({ v: c.id, l: c.name })));
    },
    _matterOpts() {
        return [{ v: '', l: '— none —' }].concat(
            state.matters.filter(m => !m.deletedAt).map(m => ({
                v: m.id, l: `${clientById(m.clientId)?.name || '—'} · ${m.title}` })));
    },
    _openTaskOpts() {
        return [{ v: '', l: '— none —' }].concat(
            state.tasks.filter(t => !t.deletedAt && t.status !== 'done')
                       .map(t => ({ v: t.id, l: t.title })));
    },

    /* Which fields are worth exposing per op — the ones that actually get
     * misread, not every key in the payload. `alt` names the free-text twin
     * the model uses when it could not resolve a record ("matterName"). */
    _editFieldsFor(p) {
        const PRIO = [{ v:'low', l:'Low' }, { v:'normal', l:'Normal' }, { v:'high', l:'High' }];
        switch (p.op) {
            case 'createTask':
            case 'updateTask':
                return [
                    { k:'title',    l:'Title',    t:'text' },
                    { k:'matterId', l:'Project',  t:'select', o: Omni._matterOpts(), alt:'matterName' },
                    { k:'due',      l:'Due',      t:'date' },
                    { k:'priority', l:'Priority', t:'select', o: PRIO }
                ];
            case 'createClient':
            case 'updateClient':
                return [
                    { k:'name',  l:'Name',  t:'text' },
                    { k:'email', l:'Email', t:'text' },
                    { k:'phone', l:'Phone', t:'text' }
                ];
            case 'createMatter':
            case 'updateMatter':
                return [
                    { k:'title',    l:'Title',  t:'text' },
                    { k:'clientId', l:'Client', t:'select', o: Omni._clientOpts(), alt:'clientName' },
                    { k:'status',   l:'Status', t:'select', o:[
                        { v:'open', l:'Open' }, { v:'on-hold', l:'On hold' }, { v:'closed', l:'Closed' }] }
                ];
            case 'logTime':
                return [
                    { k:'minutes',  l:'Minutes', t:'number' },
                    { k:'date',     l:'Date',    t:'date' },
                    { k:'matterId', l:'Project', t:'select', o: Omni._matterOpts(), alt:'matterName' },
                    { k:'notes',    l:'Notes',   t:'text' }
                ];
            case 'completeTask':
                return [{ k:'taskId', l:'Task', t:'select', o: Omni._openTaskOpts() }];
            case 'createInvoice':
                return [
                    { k:'matterId',   l:'Project', t:'select', o: Omni._matterOpts(), alt:'matterName' },
                    { k:'dateIssued', l:'Issued',  t:'date' },
                    { k:'dateDue',    l:'Due',     t:'date' }
                ];
            default:
                return [];
        }
    },

    /* A select shows the id when there is one; when the model only produced a
     * name, try to match it so the user sees a resolved record rather than a
     * blank dropdown next to the right-looking summary. */
    _editValue(p, f) {
        const d = p.data || {};
        if (d[f.k] != null && d[f.k] !== '') return String(d[f.k]);
        if (!f.alt || !d[f.alt]) return '';
        const want = String(d[f.alt]).toLowerCase();
        const hit = (f.o || []).find(o => o.l.toLowerCase().includes(want));
        return hit ? hit.v : '';
    },

    _editorHtml(p, i) {
        const fields = Omni._editFieldsFor(p);
        if (!fields.length) return '';
        return `
            <div class="op-editor" data-editor="${i}" hidden>
                ${fields.map(f => {
                    const val = Omni._editValue(p, f);
                    const id = `oe_${i}_${f.k}`;
                    const input = f.t === 'select'
                        ? `<select id="${id}" data-edit="${i}" data-k="${esc(f.k)}" ${f.alt?`data-alt="${esc(f.alt)}"`:''}>
                               ${f.o.map(o => `<option value="${esc(o.v)}" ${o.v === val ? 'selected':''}>${esc(o.l)}</option>`).join('')}
                           </select>`
                        : `<input id="${id}" data-edit="${i}" data-k="${esc(f.k)}" type="${f.t}" value="${esc(val)}">`;
                    return `<div class="oe-field"><label for="${id}">${esc(f.l)}</label>${input}</div>`;
                }).join('')}
                ${(p.data && (p.data.matterName || p.data.clientName))
                    ? `<div class="oe-note">Claude wrote “${esc(p.data.matterName || p.data.clientName)}” — pick the record above to link it, or leave it to create a new one.</div>`
                    : ''}
            </div>`;
    },

    _applyEdit(el) {
        const i = Number(el.dataset.edit);
        const p = Omni.proposals[i];
        if (!p) return;
        p.data = p.data || {};
        const k = el.dataset.k;
        const v = el.value;
        if (el.type === 'number') p.data[k] = v === '' ? null : Number(v);
        else p.data[k] = v === '' ? null : v;
        // choosing a real record retires the free-text twin, so the applier
        // links instead of creating a duplicate
        if (el.dataset.alt && v) delete p.data[el.dataset.alt];
        p.edited = true;
        const sum = Omni.panel.querySelector(`[data-sum="${i}"]`);
        if (sum) sum.textContent = Omni._defaultSummary(p);
    },

    async _refine() {
        const inp = Omni.panel.querySelector('#omni-refine-input');
        const correction = inp ? inp.value.trim() : '';
        if (!correction) { if (inp) inp.focus(); return; }
        if (Omni.busy) return;
        // only the untouched proposals are worth re-deriving; anything already
        // applied stays applied
        const pending = Omni.proposals.filter(p => !p.accepted);
        Omni.busy = true;
        Omni._renderLoading();
        try {
            const result = await AI.refine(Omni.lastInput, pending, correction);
            const applied = Omni.proposals.filter(p => p.accepted);
            Omni.proposals = applied.concat(
                (result.actions || []).map(a => ({ ...a, accepted: false })));
            Omni._renderProposals(result);
            if (!result.clarify) toast('Reworked');
        } catch (e) {
            console.error('refine failed', e);
            Omni._renderError('Could not rework that: ' + esc(e.message || 'error'));
        } finally {
            Omni.busy = false;
        }
    },

    _handleProposalAction(action, idx) {
        if (action === 'close') { Omni._hide(); return; }
        if (action === 'discard') { Omni.clear(); return; }
        if (action === 'refine') { Omni._refine(); return; }
        if (action === 'refine-mic') {
            const el = Omni.panel.querySelector('#omni-refine-input');
            Recorder.toggle({
                el,
                btn: Omni.panel.querySelector('[data-omni="refine-mic"]'),
                onFinal: () => Omni._refine(),
                onAudio: async (file) => {
                    // phone path: the recording is the correction, so read it
                    // back to text first rather than parsing it as new input
                    try {
                        const r = await Gemini.transcribe(file);
                        if (el) el.value = r;
                        Omni._refine();
                    } catch (e) {
                        toast('Could not read the recording: ' + (e.message || 'error'), 'error');
                    }
                }
            });
            return;
        }
        if (action === 'edit') {
            const ed = Omni.panel.querySelector(`[data-editor="${idx}"]`);
            if (ed) {
                ed.hidden = !ed.hidden;
                if (!ed.hidden) {
                    const first = ed.querySelector('input, select');
                    if (first) first.focus();
                }
            }
            return;
        }
        if (action === 'accept-all') {
            let ok = 0;
            Omni.proposals.forEach((p, i) => { if (Omni._applyProposal(i)) ok++; });
            render();
            if (ok) toast(`Applied ${ok} action${ok === 1 ? '' : 's'}`);
            if (ok === Omni.proposals.length) {
                Omni.clear();
            } else {
                // some failed — reflect state, keep panel open for retry
                Omni.proposals.forEach((p, i) => {
                    if (p.accepted) {
                        const li = Omni.panel.querySelector(`.proposal[data-i="${i}"]`);
                        if (li) li.classList.add('done');
                    }
                });
            }
            return;
        }
        if (action === 'accept') {
            const ok = Omni._applyProposal(Number(idx));
            if (ok) {
                const li = Omni.panel.querySelector(`.proposal[data-i="${idx}"]`);
                if (li) li.classList.add('done');
                render();
            }
            return;
        }
        if (action === 'skip') {
            const li = Omni.panel.querySelector(`.proposal[data-i="${idx}"]`);
            if (li) li.classList.add('skipped');
        }
    },

    _applyProposal(i) {
        const p = Omni.proposals[i];
        if (!p || p.accepted) return false;

        // Resolve any inline gap pickers (matter / task) before applying.
        if (Omni._gapsFor(p).includes('matter')) {
            const li = Omni.panel.querySelector(`.proposal[data-i="${i}"]`);
            const mSel = li && li.querySelector('select[data-gap="matter"]');
            const tSel = li && li.querySelector('select[data-gap="task"]');
            if (!mSel || !mSel.value) {
                toast('Pick a project first', 'error');
                return false;
            }
            if (mSel.value === '__new__') {
                const title = (prompt('New project name:', 'General') || '').trim();
                if (!title) return false;
                p.data.matterName = title;
                delete p.data.matterId;
            } else {
                p.data.matterId = mSel.value;
                delete p.data.matterName;
            }
            p.data.taskId = (tSel && tSel.value) ? tSel.value : null;
        }

        try {
            AI.applyAction(p);
            p.accepted = true;
            // proposals that came from an email leave the source in the inbox
            // until at least one of them is accepted — kept on Omni, not the
            // proposal, so it survives a refine that restructures the list
            if (Omni.sourceEmail && typeof markEmailProcessed === 'function') {
                markEmailProcessed(Omni.sourceEmail);
                Omni.sourceEmail = null;
            }
            return true;
        } catch (e) {
            console.error('apply failed', e);
            toast('Failed: ' + e.message, 'error');
            return false;
        }
    },

    _opLabel(op) {
        return ({
            createClient: 'New client',
            updateClient: 'Update client',
            createMatter: 'New project',
            updateMatter: 'Update matter',
            createTask:   'New task',
            updateTask:   'Update task',
            completeTask: 'Complete task',
            logTime:      'Log time',
            createInvoice:'New invoice'
        })[op] || op;
    },

    _defaultSummary(p) {
        const d = p.data || {};
        switch (p.op) {
            case 'createClient':  return d.name || '—';
            case 'createMatter':  return `${d.title || '—'} for ${d.clientName || d.clientId || '?'}`;
            case 'createTask':    return `${d.title || '—'}${d.due?` · due ${d.due}`:''}`;
            case 'logTime':       return `${d.minutes || 0} min${d.clientName?' · '+d.clientName:''}`;
            case 'createInvoice': return `Invoice for ${d.matterName || d.matterId || '?'}`;
            case 'completeTask':  return `Done: ${d.taskTitle || d.taskId || '?'}`;
            default:              return JSON.stringify(d).slice(0, 120);
        }
    },

    /* Which required fields a proposal still needs the user to pick. */
    _gapsFor(p) {
        const gaps = [];
        if (p.op === 'logTime' && !p.accepted) {
            const d = p.data || {};
            const hasMatter =
                (d.matterId && matterById(d.matterId)) ||
                (d.matterName && state.matters.find(m =>
                    !m.deletedAt && m.title && m.title.toLowerCase() === d.matterName.toLowerCase()));
            if (!hasMatter) gaps.push('matter');
        }
        return gaps;
    },

    _taskOptionsHtml(matterId) {
        let opts = '<option value="">— no specific task —</option>';
        if (matterId && matterId !== '__new__') {
            const tasks = state.tasks.filter(t =>
                !t.deletedAt && t.matterId === matterId && t.status !== 'done');
            opts += tasks.map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
        }
        return opts;
    },

    /* Inline matter + task pickers shown inside a proposal that has a gap. */
    _gapPickerHtml(p, i) {
        if (!Omni._gapsFor(p).includes('matter')) return '';
        const d = p.data || {};
        let client = d.clientId ? clientById(d.clientId) : null;
        if (!client && d.clientName) {
            client = state.clients.find(c =>
                !c.deletedAt && c.name && c.name.toLowerCase() === d.clientName.toLowerCase());
        }
        const matters = client
            ? state.matters.filter(m => !m.deletedAt && m.clientId === client.id)
            : [];
        const matterOpts = matters.map((m, idx) =>
            `<option value="${esc(m.id)}" ${idx === 0 ? 'selected' : ''}>${esc(m.title)}</option>`).join('');
        const newSelected = matters.length ? '' : 'selected';
        const firstId = matters.length ? matters[0].id : '';
        return `
            <div class="op-gap">
                <label>Matter
                    <select data-gap="matter" data-i="${i}">
                        ${matterOpts}
                        <option value="__new__" ${newSelected}>＋ New project…</option>
                    </select>
                </label>
                <label>Task
                    <select data-gap="task" data-i="${i}" ${matters.length ? '' : 'disabled'}>
                        ${Omni._taskOptionsHtml(firstId)}
                    </select>
                </label>
                ${!client ? `<div class="op-gap-note">New client “${esc(d.clientName || '?')}” will be created.</div>` : ''}
            </div>`;
    }
};

/* =========================================================================
 * 2. AI — Claude API client + action applier
 * ========================================================================= */

const AI = {
    /* Ask Anthropic which models this key can use, rather than shipping a
     * hardcoded list that rots — models retire on Anthropic's schedule and a
     * dropdown offering a dead one turns a 404 into a hunt for a bug that
     * isn't there. Returns [] on any failure so Settings falls back quietly. */
    async listModels() {
        return (await AI.checkKey()).models || [];
    },

    /* Does this key work? The model list doubles as the cheapest possible
     * probe: it needs no tokens, and a key that can list models can call them.
     * Returns a reason rather than a boolean so Settings can say what is wrong
     * instead of just going red. */
    async checkKey(key) {
        key = key || state.profile.anthropicKey;
        if (!key) return { ok: false, reason: 'missing' };
        try {
            const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
                headers: {
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            });
            if (res.status === 401 || res.status === 403) return { ok: false, reason: 'rejected' };
            if (!res.ok) return { ok: false, reason: 'http', status: res.status };
            const data = await res.json();
            const models = (data.data || [])
                .map(m => ({ id: m.id, name: m.display_name || m.id }))
                .filter(m => m.id);
            return { ok: true, models };
        } catch (e) {
            console.warn('Anthropic unreachable', e);
            return { ok: false, reason: 'network' };
        }
    },

    /* Rank models so the app can choose for the user. Scoring by shape rather
     * than by name means it keeps working as Anthropic ships and retires
     * models — no list to maintain, nothing to go stale. */
    _score(id) {
        const s = id.toLowerCase();
        let score = 0;
        if (s.includes('opus')) score += 100;
        else if (s.includes('sonnet')) score += 60;
        else if (s.includes('haiku')) score += 30;
        // restricted or preview tiers a normal key usually cannot call
        if (/preview|mythos/.test(s)) score -= 500;
        const v = s.match(/(\d+)[-.](\d+)/);          // "opus-4-8" -> 4.8
        if (v) score += Number(v[1]) * 10 + Number(v[2]);
        else {
            const n = s.match(/(\d+)/);
            if (n) score += Number(n[1]) * 10;
        }
        return score;
    },

    /* The model the app will actually use: the saved one if it is still real,
     * otherwise the best available — saved back so the choice sticks. */
    async ensureModel({ force = false } = {}) {
        const saved = state.profile.anthropicModel;
        if (saved && !force) return saved;
        const models = await AI.listModels();
        if (!models.length) return saved || 'claude-opus-4-8';
        const best = models.map(m => m.id).sort((a, b) => AI._score(b) - AI._score(a))[0];
        state.profile.anthropicModel = best;
        Store.save();
        return best;
    },

    /* One place that talks to Anthropic. Picks the model, and if that model
     * has been retired since it was saved, re-picks and retries once instead
     * of handing the user a 404 to solve. */
    async _send({ system, messages, max_tokens }) {
        const call = async (model) => {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': state.profile.anthropicKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({ model, max_tokens, system, messages })
            });
            return res;
        };

        let model = await AI.ensureModel();
        let res = await call(model);

        if (res.status === 404) {
            const fresh = await AI.ensureModel({ force: true });
            if (fresh && fresh !== model) {
                console.warn(`model ${model} is gone — switched to ${fresh}`);
                toast(`Switched to ${fresh} — the previous model was retired`);
                model = fresh;
                res = await call(model);
            }
        }
        if (!res.ok) {
            const err = await res.text().catch(() => '');
            throw AI._httpError(res.status, err, model);
        }
        return res.json();
    },

    /* Turn an HTTP failure into something the user can act on. A retired
     * model is the likeliest cause of a 404 here and the fix is one dropdown
     * away. */
    _httpError(status, body, model) {
        if (status === 404) {
            return new Error(`Model "${model}" no longer exists. Pick another in Settings.`);
        }
        if (status === 401 || status === 403) {
            return new Error('Anthropic rejected the API key. Check it in Settings.');
        }
        if (status === 429) {
            return new Error('Rate limited by Anthropic — try again in a moment.');
        }
        if (status >= 500) {
            return new Error(`Anthropic is having trouble (HTTP ${status}) — try again shortly.`);
        }
        return new Error(`HTTP ${status}: ${String(body).slice(0, 200)}`);
    },

    SYSTEM_PROMPT: `You are an action-extraction assistant for "ordify", a practice manager for solo lawyers.

The user types or dictates in English, Russian, or Ukrainian. Your job is to read their input and output a JSON list of structured actions to perform on the data model.

DATA MODEL:
- Client: { name, email?, phone?, taxId?, address?, notes? }
- Matter: { clientId or clientName, title, status: "open"|"on-hold"|"closed", rate?, description? }
- Task:   { matterId or matterName, title, due? (ISO date YYYY-MM-DD), priority: "low"|"normal"|"high", assigneeEmail? (only if the user explicitly delegates to a person), notes? }
- TimeLog:{ matterId or matterName (optional — omit if unknown), date (ISO YYYY-MM-DD), minutes, notes? }
- Invoice:{ matterId or matterName, dateIssued (ISO), dateDue?, notes? }

ALLOWED ACTIONS (op values):
- "createClient"  data: Client fields
- "createMatter"  data: Matter fields (use clientName if client doesn't yet exist)
- "createTask"    data: Task fields
- "completeTask"  data: { taskId or taskTitle }
- "logTime"       data: TimeLog fields
- "createInvoice" data: Invoice fields

OUTPUT RULES:
- Output ONLY valid JSON: { "actions": [...], "transcript"?: "...", "clarify"?: "..." }
- ALL data field values MUST be in English, even if the user spoke Russian/Ukrainian. Translate proper nouns conservatively (keep names like "Іван Шевченко" → "Ivan Shevchenko").
- Each action MUST include a "summary" field — one short English sentence describing what will happen.
- If the user references a client/matter that exists in CONTEXT below, use its id (e.g. "matterId": "id-abc"). Otherwise use a name field (clientName, matterName) and order actions so creates come first.
- Use { "clarify": "question" } ONLY when you genuinely cannot tell what the user wants. Do NOT use clarify just because a matter or task is unknown.
- For "logTime": ALWAYS return the logTime action with whatever you know (clientName or clientId, minutes, date, notes). If the matter is unknown, simply omit matterId/matterName — the app will ask the user to pick the matter and task. Never block a time log on a missing matter.
- Dates must be ISO YYYY-MM-DD. Resolve relative dates ("tomorrow", "next Friday", "завтра") against TODAY.
- For dictated free-form text, also include a "transcript" field with the cleaned-up source text.
- Do NOT invent emails, phone numbers, or tax IDs — only include them if explicit in input.
- If nothing actionable, return { "actions": [], "clarify": "What would you like to do?" }.
- Never wrap the JSON in markdown fences. Output raw JSON.`,

    async parseInput(text) {
        const ctx = AI._buildContext();
        const userMsg = `TODAY: ${todayISO()}

CONTEXT:
${ctx}

USER INPUT:
${text}`;

        const json = await AI._send({
            system: AI.SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMsg }],
            max_tokens: 1500
        });
        const content = json.content?.[0]?.text || '';
        let parsed;
        try {
            // strip code fences if present
            const cleaned = content.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            throw new Error('AI returned non-JSON response: ' + content.slice(0, 200));
        }
        return parsed;
    },

    /* Send a file (docx / PDF / image / txt) to Claude and return the same
     * { actions, transcript?, clarify? } shape as parseInput. `note` is any
     * text the user typed alongside the file — their instruction about it
     * ("log time for each receipt", "these are all for the Acme matter"). */
    async parseFile(file, note = '') {
        const today = todayISO();
        const ctx = AI._buildContext();
        const name = (file.name || '').toLowerCase();
        const noteLine = note ? `\n\nUSER NOTE (their own instruction about this file — follow it): ${note}` : '';
        const intro = `TODAY: ${today}\n\nCONTEXT:\n${ctx}${noteLine}\n\nUSER INPUT (from file ${file.name}):`;
        let content;
        if (name.endsWith('.docx')) {
            if (typeof DocImport === 'undefined') throw new Error('docx reader not loaded');
            const text = await DocImport._docxText(file);
            if (!text.trim()) throw new Error('No readable text in the .docx');
            content = intro + '\n\n' + text.slice(0, 14000);
        } else if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
            const b64 = await DocImport._b64(file);
            content = [
                { type: 'text', text: intro + ' read the attached PDF.' },
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
            ];
        } else if ((file.type || '').startsWith('image/')) {
            const b64 = await DocImport._b64(file);
            content = [
                { type: 'text', text: intro + ' read the attached image.' },
                { type: 'image', source: { type: 'base64', media_type: file.type, data: b64 } }
            ];
        } else if (file.type === 'text/plain' || name.endsWith('.txt')) {
            const text = await file.text();
            content = intro + '\n\n' + text.slice(0, 14000);
        } else if ((file.type || '').startsWith('audio/') || (file.type || '').startsWith('video/')) {
            // Claude can't read audio/video — route to Gemini, which can.
            return await Gemini.parseAV(file, note);
        } else {
            throw new Error('Unsupported file. Use .docx, PDF, image, .txt, audio or video.');
        }
        const json = await AI._send({
            system: AI.SYSTEM_PROMPT,
            messages: [{ role: 'user', content }],
            max_tokens: 1500
        });
        const txt = (json.content && json.content[0] && json.content[0].text) || '';
        const cleaned = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        try { return JSON.parse(cleaned); }
        catch (e) { throw new Error('AI returned a non-JSON response'); }
    },

    /* Every call here asks for raw JSON and every model occasionally wraps it
     * in a code fence anyway. One place to unwrap it. */
    _json(json) {
        const txt = (json.content && json.content[0] && json.content[0].text) || '';
        const cleaned = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        try { return JSON.parse(cleaned); }
        catch (e) { throw new Error('AI returned a non-JSON response'); }
    },

    /* Correct a set of proposals by talking, instead of by filling in fields.
     * The model gets what it proposed last time plus what the user says is
     * wrong, and returns the whole corrected list — so a correction can add,
     * drop or merge actions, not just patch one. */
    async refine(originalText, proposals, correction) {
        const sys = AI.SYSTEM_PROMPT + `

REFINEMENT MODE
You already proposed a list of actions. The user is telling you what you got wrong.
Return the COMPLETE corrected list in the same JSON shape — not just the changed entries.
- Keep every action the user did not object to, byte for byte.
- The correction may add actions, remove them, split one into two, or merge two into one.
- The correction wins over your earlier reading and over the original input.
- If the correction is genuinely ambiguous, use "clarify" instead of guessing.`;
        const userMsg = `TODAY: ${todayISO()}

CONTEXT:
${AI._buildContext()}

ORIGINAL USER INPUT:
${originalText || '(not available)'}

ACTIONS YOU PROPOSED:
${JSON.stringify(proposals.map(p => ({ op: p.op, data: p.data })), null, 1)}

THE USER'S CORRECTION:
${correction}`;
        const json = await AI._send({
            system: sys,
            messages: [{ role: 'user', content: userMsg }],
            max_tokens: 1500
        });
        return AI._json(json);
    },

    /* Fill a form from a sentence. The caller passes its own field list, so
     * this works for any modal without knowing what a task or a client is —
     * the point being that the user describes the thing once, in their own
     * words, instead of tabbing through seven inputs. */
    async fillForm({ fields, values, text, title }) {
        const spec = fields.map(f => {
            const bits = [`- "${f.name}" (${f.type || 'text'}): ${f.label}`];
            if (f.options) {
                bits.push(`    allowed values: ${f.options
                    .filter(o => o.value !== '')
                    .map(o => `"${o.value}" = ${o.label}`).join(' | ')}`);
            }
            if (f.hint) bits.push(`    note: ${f.hint}`);
            return bits.join('\n');
        }).join('\n');

        const sys = `You fill in one form in "ordify", a practice manager for a solo lawyer.
The user describes what they want in English, Russian or Ukrainian — often tersely, sloppily, or dictated with speech-recognition errors. Turn that into field values.

Return ONLY raw JSON, no markdown fences:
{ "values": { "<fieldName>": <value>, ... }, "note"?: "one short line if something could not be filled" }

Rules:
- Only include fields you are actually confident about. Omit the rest — an omitted field keeps its current value.
- For "select" fields the value MUST be one of the allowed values, exactly. Match by meaning, not by spelling.
- For "date" fields output ISO YYYY-MM-DD. Resolve relative dates ("Friday", "в пятницу", "через неделю") against TODAY.
- Reference fields (project, client) hold an id from CONTEXT. Match by name, case-insensitively and across languages. If no record matches, omit the field and say so in "note".
- Write the title as a short actionable phrase, cleaned up — fix dictation garble, drop filler. Keep names, case numbers and references exactly as given.
- Never invent a deadline, an amount or a person that the user did not state.`;

        const userMsg = `TODAY: ${todayISO()}

CONTEXT (existing records — use these ids for reference fields):
${AI._buildContext()}

FORM: ${title || 'form'}
FIELDS:
${spec}

CURRENT VALUES:
${JSON.stringify(values || {}, null, 1)}

WHAT THE USER SAID:
${text}`;

        const json = await AI._send({
            system: sys,
            messages: [{ role: 'user', content: userMsg }],
            max_tokens: 1200
        });
        const parsed = AI._json(json);
        return { values: parsed.values || {}, note: parsed.note || '' };
    },

    /* Read one email's body and extract the lawyer's action items — and, unlike
     * before, place them under the right project. The extractor used to get no
     * context at all, so every email task landed unlinked; two items about the
     * same matter (a reply and a review of the same contract) came out as two
     * orphans. Now it sees the client/matter list and links against it, so
     * both land under, say, StellarsTech — which is the grouping, without
     * inventing a "related tasks" concept. */
    async extractEmailTasks(subject, body) {
        const sys = `This email was received by a solo lawyer. Read it and extract the concrete action items the lawyer must do, and link each to an existing project where one clearly fits.

Return ONLY raw JSON, no markdown fences:
{ "tasks": [ { "title": "", "due": null, "priority": "normal", "matterId": null, "matterName": null, "clientName": null, "notes": "" } ] }
Rules:
- "title": a short, actionable task in English (keep case numbers, names and references as-is). NOT the email subject verbatim — the actual thing to do.
- "due": ISO date YYYY-MM-DD if a deadline is stated or clearly implied; otherwise null. Resolve relative dates against TODAY.
- "priority": "high" if urgent or deadline-driven, otherwise "normal".
- LINKING — use the CONTEXT below (existing clients and matters):
  · if the email clearly concerns an existing matter, set "matterId" to that matter's id and leave the name fields null.
  · else if it clearly concerns an existing client but no specific matter, set "clientName" to that client's name.
  · else leave all three null — never guess a link that isn't supported by the email.
  · when several action items in this one email concern the SAME matter, give them all the same matterId. Keep them as SEPARATE tasks — do not merge distinct actions (e.g. "reply to X" and "review the draft") into one.
- "notes": one short line of context.
- If the email needs no action (newsletter, receipt, FYI, automated notice), return { "tasks": [] }.
- At most 4 tasks. Output raw JSON only.`;
        const userMsg = `TODAY: ${todayISO()}

CONTEXT (existing records — link tasks to these when the email fits):
${AI._buildContext()}

SUBJECT: ${subject}

BODY:
${body}`;
        const json = await AI._send({
            system: sys,
            messages: [{ role: 'user', content: userMsg }],
            max_tokens: 1024
        });
        const content = (json.content && json.content[0] && json.content[0].text) || '';
        const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        let parsed;
        try { parsed = JSON.parse(cleaned); }
        catch (e) { throw new Error('AI returned an unreadable response'); }
        return Array.isArray(parsed.tasks) ? parsed.tasks : [];
    },

    _buildContext() {
        const clients = state.clients.filter(c => !c.deletedAt).slice(0, 50)
            .map(c => `- client "${c.id}": ${c.name}`).join('\n');
        const matters = state.matters.filter(m => !m.deletedAt).slice(0, 60)
            .map(m => `- matter "${m.id}": ${m.title} (client: ${clientById(m.clientId)?.name||'?'})`).join('\n');
        const openTasks = state.tasks.filter(t => !t.deletedAt && t.status !== 'done').slice(0, 40)
            .map(t => `- task "${t.id}": ${t.title}`).join('\n');
        return [clients, matters, openTasks].filter(Boolean).join('\n') || '(no records yet)';
    },

    /* ---- Action appliers ---- */

    applyAction(p) {
        const handlers = {
            createClient:  AI._applyCreateClient,
            updateClient:  AI._applyUpdateClient,
            createMatter:  AI._applyCreateMatter,
            updateMatter:  AI._applyUpdateMatter,
            createTask:    AI._applyCreateTask,
            updateTask:    AI._applyUpdateTask,
            completeTask:  AI._applyCompleteTask,
            logTime:       AI._applyLogTime,
            createInvoice: AI._applyCreateInvoice
        };
        const h = handlers[p.op];
        if (!h) throw new Error('Unknown op: ' + p.op);
        h(p.data || {});
        Store.save();
    },

    _resolveClient(d) {
        if (d.clientId) return clientById(d.clientId);
        if (d.clientName) {
            const found = state.clients.find(c => !c.deletedAt && c.name?.toLowerCase() === d.clientName.toLowerCase());
            if (found) return found;
            // create on the fly
            const c = {
                id: uuid(), name: d.clientName, createdAt: new Date().toISOString()
            };
            state.clients.push(c);
            return c;
        }
        return null;
    },

    _resolveMatter(d, opts) {
        opts = opts || {};
        if (d.matterId && d.matterId !== '__new__') {
            const m = matterById(d.matterId);
            if (m) return m;
        }
        if (d.matterName) {
            const found = state.matters.find(m => !m.deletedAt && m.title?.toLowerCase() === d.matterName.toLowerCase());
            if (found) return found;
            if (opts.create) {
                const c = AI._resolveClient(d);
                const m = {
                    id: uuid(),
                    clientId: c ? c.id : null,
                    title: d.matterName,
                    status: 'open',
                    rate: null,
                    description: '',
                    openedAt: new Date().toISOString()
                };
                state.matters.push(m);
                return m;
            }
        }
        return null;
    },

    _applyCreateClient(d) {
        const c = {
            id: uuid(),
            name: d.name || 'Unnamed client',
            email: d.email || '', phone: d.phone || '',
            address: d.address || '', taxId: d.taxId || '',
            notes: d.notes || '',
            createdAt: new Date().toISOString()
        };
        state.clients.push(c);
    },

    _applyUpdateClient(d) {
        const c = clientById(d.clientId) || state.clients.find(x => !x.deletedAt && x.name?.toLowerCase() === (d.name||'').toLowerCase());
        if (!c) throw new Error('Client not found');
        Object.assign(c, d);
    },

    _applyCreateMatter(d) {
        const c = AI._resolveClient(d);
        if (!c) throw new Error('Client missing for matter');
        const m = {
            id: uuid(),
            clientId: c.id,
            title: d.title || 'Untitled matter',
            status: d.status || 'open',
            rate: d.rate ?? null,
            description: d.description || '',
            openedAt: new Date().toISOString()
        };
        state.matters.push(m);
    },

    _applyUpdateMatter(d) {
        const m = AI._resolveMatter(d);
        if (!m) throw new Error('Matter not found');
        Object.assign(m, d);
    },

    _applyCreateTask(d) {
        const m = AI._resolveMatter(d, { create: true });
        const t = {
            id: uuid(),
            matterId: m?.id || null,
            clientId: m?.clientId || null,
            title: d.title || 'Untitled task',
            due: d.due || null,
            priority: d.priority || 'normal',
            assigneeEmail: (d.assigneeEmail || '').toLowerCase() || null,
            notes: d.notes || '',
            status: 'todo',
            createdAt: new Date().toISOString()
        };
        Tasks.put(t);
    },

    _applyUpdateTask(d) {
        const t = (d.taskId && taskById(d.taskId)) || state.tasks.find(x => !x.deletedAt && x.title?.toLowerCase() === (d.taskTitle||'').toLowerCase());
        if (!t) throw new Error('Task not found');
        Object.assign(t, d);
        Tasks.put(t);
    },

    _applyCompleteTask(d) {
        const t = (d.taskId && taskById(d.taskId)) || state.tasks.find(x => !x.deletedAt && x.title?.toLowerCase() === (d.taskTitle||'').toLowerCase());
        if (!t) throw new Error('Task not found');
        t.status = 'done';
        t.completedAt = new Date().toISOString();
        Tasks.put(t);
    },

    _applyLogTime(d) {
        const m = AI._resolveMatter(d, { create: true });
        if (!m) throw new Error('Pick a matter for this time log');
        const date = d.date || todayISO();
        const startedAt = new Date(date + 'T09:00:00').toISOString();
        const minutes = Number(d.minutes) || 0;
        if (minutes < 1) throw new Error('Minutes must be ≥ 1');
        const log = {
            id: uuid(),
            taskId: d.taskId || null,
            matterId: m.id,
            clientId: m.clientId,
            startedAt,
            endedAt: new Date(new Date(startedAt).getTime() + minutes * 60000).toISOString(),
            minutes,
            notes: d.notes || '',
            invoiceId: null
        };
        state.logs.push(log);
    },

    _applyCreateInvoice(d) {
        const m = AI._resolveMatter(d);
        if (!m) throw new Error('Matter not found for invoice');
        const unbilled = state.logs.filter(l => l.matterId === m.id && !l.invoiceId);
        if (!unbilled.length) throw new Error('No unbilled time on this matter');
        const rate = matterRate(m);
        const items = unbilled.map(l => {
            const hours = +(l.minutes / 60).toFixed(2);
            return {
                description: `${fmtDate(l.startedAt)}${l.notes?' — '+l.notes:''}`,
                hours, rate, amount: +(hours * rate).toFixed(2)
            };
        });
        const number = state.profile.invoiceNumberPrefix + String(state.profile.invoiceNumberCounter).padStart(4, '0');
        const inv = {
            id: uuid(), number,
            clientId: m.clientId, matterId: m.id,
            dateIssued: d.dateIssued || todayISO(),
            dateDue: d.dateDue || null,
            currency: profileCurrency(),
            items, notes: d.notes || '', status: 'draft'
        };
        state.invoices.push(inv);
        state.profile.invoiceNumberCounter += 1;
        unbilled.forEach(l => l.invoiceId = inv.id);
    }
};

/* =========================================================================
 * 2c. GEMINI — handles audio and video (Claude can't read those)
 *
 * Same { actions, transcript?, clarify? } JSON shape as AI.parseInput,
 * so the omni proposal panel renders the result identically.
 * ========================================================================= */

const Gemini = {
    /* Ask Google which models this key can actually use. Hardcoding a list
     * ages badly — Google retires models on its own schedule, and a dropdown
     * offering a dead one sends the user hunting for a bug that is really a
     * 404. Returns [] on any failure so Settings can fall back quietly. */
    async listModels() {
        return (await Gemini.checkKey()).models || [];
    },

    /* Same probe as AI.checkKey — listing models costs nothing and proves the
     * key is live. */
    async checkKey(key) {
        key = key || state.profile.geminiKey;
        if (!key) return { ok: false, reason: 'missing' };
        try {
            const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                headers: { 'x-goog-api-key': key }
            });
            if (res.status === 400 || res.status === 401 || res.status === 403) {
                return { ok: false, reason: 'rejected' };
            }
            if (!res.ok) return { ok: false, reason: 'http', status: res.status };
            const data = await res.json();
            const models = (data.models || [])
                .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
                .map(m => (m.name || '').replace(/^models\//, ''))
                .filter(n => n && !/embedding|aqa|imagen|veo/i.test(n))
                .sort();
            return { ok: true, models };
        } catch (e) {
            console.warn('Gemini unreachable', e);
            return { ok: false, reason: 'network' };
        }
    },

    /* Google lists dozens of models; the user should never have to rank them.
     * Score by shape — favour current stable flash tiers, which are the fast,
     * cheap ones with a free-tier allowance, and avoid experimental builds. */
    _score(id) {
        const s = id.toLowerCase();
        let score = 0;
        if (s.includes('flash')) score += 100;      // fast + free tier: right for dictation
        else if (s.includes('pro')) score += 40;
        if (/exp|preview|thinking|tuning/.test(s)) score -= 500;   // unstable
        if (s.includes('lite')) score -= 20;
        if (/gemma|learnlm/.test(s)) score -= 300;  // not general-purpose here
        const v = s.match(/(\d+)\.(\d+)/);          // "gemini-2.5-flash" -> 2.5
        if (v) score += Number(v[1]) * 10 + Number(v[2]);
        return score;
    },

    /* The model the app will actually use. `exclude` lets a failed call ask for
     * the next best one instead of the same dead or exhausted model. */
    async ensureModel({ force = false, exclude = [] } = {}) {
        const saved = state.profile.geminiModel;
        if (saved && !force && !exclude.includes(saved)) return saved;
        const models = (await Gemini.listModels()).filter(m => !exclude.includes(m));
        if (!models.length) return exclude.includes(saved) ? null : (saved || 'gemini-2.0-flash');
        const best = [...models].sort((a, b) => Gemini._score(b) - Gemini._score(a))[0];
        state.profile.geminiModel = best;
        Store.save();
        return best;
    },

    /* Guard rails shared by everything that sends a file to Gemini. */
    async _prepare(file) {
        if (!state.profile.geminiKey) {
            throw new Error('Add your Gemini API key in Settings to upload audio or video.');
        }
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > 18) {
            throw new Error(`File is ${sizeMB.toFixed(1)} MB — Gemini inline limit is ~20 MB. Trim it down or split it.`);
        }
        return await DocImport._b64(file);
    },

    /* One request, with the model chosen for the user and re-chosen if the
     * first pick turns out to be retired or out of quota. Returns raw text. */
    async _run(payload) {
        const call = (m) => fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-goog-api-key': state.profile.geminiKey
                },
                body: JSON.stringify(payload)
            }
        );

        let used = await Gemini.ensureModel();
        let res = await call(used);

        // 404 = the model was retired; 429 = this model has no allowance left.
        // Both are fixed by using a different model, and the user should not
        // have to know that — try the next best one automatically.
        if (res.status === 404 || res.status === 429) {
            const next = await Gemini.ensureModel({ force: true, exclude: [used] });
            if (next && next !== used) {
                console.warn(`gemini ${used} → ${next} (HTTP ${res.status})`);
                toast(`Switched to ${next}`);
                used = next;
                res = await call(used);
            }
        }

        if (!res.ok) {
            const err = await res.text().catch(() => '');
            if (res.status === 429) {
                throw new Error(`Google's free quota for this key is used up (${used}). `
                    + `It resets daily — see aistudio.google.com/usage.`);
            }
            if (res.status === 403 || res.status === 401) {
                throw new Error('Gemini rejected the API key. Check it in Settings.');
            }
            throw new Error(`Gemini HTTP ${res.status}: ${err.slice(0, 200)}`);
        }
        const json = await res.json();
        return (json.candidates && json.candidates[0]
                && json.candidates[0].content
                && json.candidates[0].content.parts
                && json.candidates[0].content.parts[0]
                && json.candidates[0].content.parts[0].text) || '';
    },

    async parseAV(file, note = '') {
        const b64 = await Gemini._prepare(file);
        const kind = (file.type || '').startsWith('video/') ? 'video' : 'audio';
        const noteLine = note ? `\n\nUSER NOTE (their own instruction about this recording — follow it): ${note}` : '';
        const userText = `TODAY: ${todayISO()}

CONTEXT:
${AI._buildContext()}${noteLine}

USER INPUT — listen to / watch the attached ${kind} (file: ${file.name}) and extract the user's intended actions per the system rules above. Respond with the same JSON shape: { "actions": [...], "transcript"?: "...", "clarify"?: "..." }.`;
        const txt = await Gemini._run({
            contents: [{
                role: 'user',
                parts: [
                    { text: AI.SYSTEM_PROMPT + '\n\n---\n\n' + userText },
                    { inline_data: { mime_type: file.type, data: b64 } }
                ]
            }],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2,
                maxOutputTokens: 1500
            }
        });
        const cleaned = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        try { return JSON.parse(cleaned); }
        catch (e) { throw new Error('Gemini returned a non-JSON response'); }
    },

    /* Words only — no action extraction. Used where the recording is meant to
     * fill a field or correct a proposal, not to become new instructions. */
    async transcribe(file) {
        const b64 = await Gemini._prepare(file);
        const txt = await Gemini._run({
            contents: [{
                role: 'user',
                parts: [
                    { text: 'Transcribe the attached recording verbatim. '
                          + 'Keep the speaker\'s language — do not translate. '
                          + 'Fix obvious mis-hearings of names only where the correction is certain. '
                          + 'Output the transcript as plain text and nothing else — no preamble, no quotes, no formatting.' },
                    { inline_data: { mime_type: file.type, data: b64 } }
                ]
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 900 }
        });
        const out = txt.trim();
        if (!out) throw new Error('Nothing recognisable in the recording');
        return out;
    }
};

/* =========================================================================
 * 3. RECORDER — Web Speech API dictation
 * ========================================================================= */

const Recorder = {
    rec: null,           // SpeechRecognition instance
    media: null,         // MediaRecorder instance (audio capture)
    stream: null,        // MediaStream (for stop)
    chunks: [],          // audio data chunks
    listening: false,
    finalText: '',
    interimText: '',
    startedAt: null,

    supported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    },

    canRecordAudio() {
        return !!(navigator.mediaDevices && window.MediaRecorder);
    },

    /* Where dictation lands. Null means the omni bar; a modal or the refine
     * box passes its own, so the same microphone serves every input in the
     * app instead of only the one at the top. */
    target: null,

    _tgt() {
        return Recorder.target || {
            el: Omni.input,
            onFinal: () => Omni.runAI(),
            onAudio: async (file) => {
                Omni.busy = true;
                Omni._renderLoading();
                try {
                    const result = await AI.parseFile(file);
                    Omni.proposals = (result.actions || []).map(a => ({ ...a, accepted: false }));
                    Omni.lastInput = result.transcript || Omni.lastInput;
                    Omni._renderProposals(result);
                } catch (e) {
                    console.error('dictation parse failed', e);
                    Omni._renderError('Could not read the recording: ' + esc(e.message || 'error'));
                } finally {
                    Omni.busy = false;
                }
            }
        };
    },

    _write(text) {
        const el = Recorder._tgt().el;
        if (!el) return;
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    },

    toggle(target = null) {
        if (Recorder.listening) { Recorder.stop(); return; }
        Recorder.target = target;
        Recorder.start();
    },

    /* A phone hands the microphone to one consumer at a time. Running
     * MediaRecorder and SpeechRecognition together — which is fine on
     * desktop Chrome, where recognition is served out of band — starves
     * recognition on mobile: it starts, hears nothing, ends empty, and the
     * button looks broken. So on a phone we pick exactly one path. */
    isMobile() {
        return matchMedia('(pointer: coarse)').matches
            || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    },

    async start() {
        if (!Recorder.supported() && !Recorder.canRecordAudio()) {
            toast('Voice input not supported in this browser. Use Chrome or Edge.', 'error');
            return;
        }

        const mobile = Recorder.isMobile();
        // Record-and-transcribe beats live recognition on a phone, but it
        // needs Gemini to read the audio afterwards.
        // Record-and-transcribe wherever there's a Gemini key — not just on a
        // phone. The browser's own SpeechRecognition is poor at Ukrainian and
        // Russian (and worse when they're mixed with English legal terms),
        // which is what made dictation feel unusable; Gemini reads the whole
        // recording with context and gets names and jargon right far more often.
        // Web Speech stays as the fallback when there's no key.
        Recorder.avMode = !!state.profile.geminiKey && Recorder.canRecordAudio();
        const useRecognition = Recorder.supported() && !Recorder.avMode;
        const useMediaRecorder = Recorder.canRecordAudio() && (!mobile || Recorder.avMode);

        if (mobile && !Recorder.avMode && !Recorder.supported()) {
            toast('Add a Gemini API key in Settings to dictate on this phone.', 'error');
            return;
        }

        // Acquire mic for both speech recognition AND raw audio recording
        let stream = null;
        if (useMediaRecorder) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                Recorder.stream = stream;
                const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
                             MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
                const media = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
                Recorder.chunks = [];
                media.ondataavailable = (e) => { if (e.data && e.data.size > 0) Recorder.chunks.push(e.data); };
                media.onstop = async () => {
                    const blob = new Blob(Recorder.chunks, { type: media.mimeType || 'audio/webm' });
                    if (blob.size > 0) {
                        const ctx = Attach._currentContext();
                        const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
                        const fname = `dictation-${stamp}.webm`;
                        await Attach.add({
                            blob, name: fname, mime: blob.type, kind: 'audio', ...ctx
                        });
                        // do not toast here; the AI completion toast is more useful

                        // On a phone nothing was transcribed live — the recording
                        // itself is the input, so hand it to whoever asked for
                        // the microphone.
                        if (Recorder.avMode) {
                            const file = new File([blob], fname, { type: blob.type || 'audio/webm' });
                            await Recorder._tgt().onAudio(file);
                        }
                    } else if (Recorder.avMode) {
                        toast('Nothing recorded — check the microphone permission', 'error');
                    }
                };
                media.start();
                Recorder.media = media;
            } catch (e) {
                console.warn('MediaRecorder unavailable', e);
            }
        }

        // Speech recognition for live transcription
        if (useRecognition) {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            const rec = new SR();
            rec.lang = Recorder.resolveLang();
            // mobile engines ignore `continuous` and cut off at the first
            // pause; asking for it there only makes the end event unreliable
            rec.continuous = !mobile;
            rec.interimResults = true;

            Recorder.finalText = '';
            Recorder.interimText = '';
            Recorder.startedAt = Date.now();

            rec.onresult = (e) => {
                let interim = '', final = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const r = e.results[i];
                    if (r.isFinal) final += r[0].transcript + ' ';
                    else interim += r[0].transcript;
                }
                if (final) Recorder.finalText += final;
                Recorder.interimText = interim;
                const combined = (Recorder.finalText + Recorder.interimText).trim();
                Recorder._write(combined);
            };
            rec.onerror = (e) => {
                console.warn('Speech recognition error', e);
                if (e.error === 'not-allowed') toast('Microphone permission denied', 'error');
                else if (e.error === 'no-speech') {}
                else toast('Recognition error: ' + e.error, 'error');
                Recorder._setListening(false);
            };
            rec.onend = () => {
                Recorder._setListening(false);
                const txt = (Recorder.finalText + Recorder.interimText).trim();
                if (txt) {
                    Recorder._write(txt);
                    Recorder._tgt().onFinal(txt);
                } else {
                    // Silence here is what "the mic does nothing" feels like:
                    // say so, and point at the fix that actually works.
                    toast(mobile
                        ? 'Heard nothing. Add a Gemini API key in Settings — dictation is far more reliable on phones.'
                        : 'Heard nothing — try again, closer to the mic.', 'error');
                }
            };
            try {
                rec.start();
                Recorder.rec = rec;
            } catch (err) {
                console.error('rec.start failed', err);
                toast('Could not start recognition: ' + err.message, 'error');
            }
        }

        Recorder._setListening(true);
        // Focusing the field on a phone raises the on-screen keyboard over the
        // mic button you need to press again to stop.
        if (!mobile) {
            const el = Recorder._tgt().el;
            if (el) el.focus();
        }
        toast(Recorder.avMode
            ? 'Recording — tap the mic again to stop'
            : `Listening (${Recorder.resolveLang()})…`);
    },

    /** Resolve the dictation lang setting to a real BCP-47 tag. */
    resolveLang() {
        const setting = state.profile.dictationLang || 'auto';
        if (setting !== 'auto') return setting;
        const supported = ['uk-UA','ru-RU','en-US','pl-PL'];
        const nav = (navigator.language || 'uk-UA');
        const navBase = nav.toLowerCase().split('-')[0];
        // exact match first
        const exact = supported.find(s => s.toLowerCase() === nav.toLowerCase());
        if (exact) return exact;
        // base-language match (e.g. "ru" -> "ru-RU")
        const base = supported.find(s => s.toLowerCase().split('-')[0] === navBase);
        if (base) return base;
        // also peek at navigator.languages array for the next best supported
        for (const l of (navigator.languages || [])) {
            const lb = l.toLowerCase().split('-')[0];
            const m = supported.find(s => s.toLowerCase().split('-')[0] === lb);
            if (m) return m;
        }
        return 'uk-UA';
    },

    stop() {
        if (Recorder.rec) {
            try { Recorder.rec.stop(); } catch (e) {}
        }
        if (Recorder.media && Recorder.media.state !== 'inactive') {
            try { Recorder.media.stop(); } catch (e) {}
        }
        if (Recorder.stream) {
            Recorder.stream.getTracks().forEach(t => t.stop());
            Recorder.stream = null;
        }
        // drop the instances so a stale recognizer can't fire onend into the
        // next session
        Recorder.rec = null;
        Recorder.media = null;
        Recorder._setListening(false);
    },

    /* Light whichever mic was actually pressed — a listening indicator on a
     * different button than the one you tapped reads as a bug. */
    _setListening(v) {
        Recorder.listening = v;
        const own = Recorder.target && Recorder.target.btn;
        if (own) own.classList.toggle('listening', v);
        if (Omni.micBtn) Omni.micBtn.classList.toggle('on', v && !own);
        // the target is deliberately NOT cleared here: onend calls this before
        // delivering the transcript, and clearing would send it to the omni bar
        // instead of whoever asked for the microphone. toggle() sets it anew.
    }
};

/* =========================================================================
 * 4. BOOT
 * ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    // wait until app.js boot has run (state loaded, DOM populated)
    setTimeout(() => {
        Omni.init();
        if (!Recorder.supported() && Omni.micBtn) {
            Omni.micBtn.disabled = true;
            Omni.micBtn.title = 'Voice input requires Chrome or Edge';
        }
    }, 50);
});
