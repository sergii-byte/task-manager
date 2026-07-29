/* ordify · sheet
 *
 * Where proposals are confirmed. A column of header / scrolling list / pinned
 * correction row — in v2 the whole panel scrolled, so with three proposals the
 * correction row sat 1794px down a 568px box, which is the one control the
 * panel exists for.
 *
 * The correction row is the point: the AI's first answer is a draft, and
 * saying what is wrong must be cheaper than filling the fields by hand.
 */
'use strict';

const Sheet = {
    el: null,
    scrim: null,

    mount() {
        if (Sheet.el) return;
        const scrim = document.createElement('div');
        scrim.id = 'scrim'; scrim.hidden = true;
        const el = document.createElement('div');
        el.id = 'sheet'; el.hidden = true;
        document.body.append(scrim, el);
        Sheet.el = el; Sheet.scrim = scrim;

        scrim.addEventListener('click', Sheet.hide);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !el.hidden) Sheet.hide();
        });

        // An on-screen keyboard shrinks the visual viewport but not the layout
        // one, so a bottom-anchored sheet ends up underneath it.
        if (window.visualViewport) {
            const sync = () => {
                const kb = Math.max(0, Math.round(
                    window.innerHeight - visualViewport.height - visualViewport.offsetTop));
                document.documentElement.style.setProperty('--kb', kb + 'px');
            };
            visualViewport.addEventListener('resize', sync);
            visualViewport.addEventListener('scroll', sync);
        }

        el.addEventListener('click', (e) => {
            const b = e.target.closest('[data-sheet]');
            if (!b) return;
            const act = b.dataset.sheet, i = Number(b.dataset.i);
            if (act === 'close')   return Sheet.hide();
            if (act === 'discard') return Capture.clear(), render();
            if (act === 'all')     return Capture.acceptAll();
            if (act === 'accept')  return Capture.accept(i).then(ok => { if (ok) Sheet.repaint(); render(); });
            if (act === 'skip')    { Capture.proposals.splice(i, 1); Sheet.repaint(); return; }
            if (act === 'redo') {
                const box = el.querySelector('#fixit');
                return Capture.submit(box ? box.value : '');
            }
            if (act === 'mic') {
                return Mic.toggle(el.querySelector('#fixit'));
            }
        });

        el.addEventListener('keydown', (e) => {
            if (e.target.id === 'fixit' && e.key === 'Enter') {
                e.preventDefault();
                Capture.submit(e.target.value);
            }
        });

        // edits write straight through, so Accept needs no separate save
        el.addEventListener('change', (e) => {
            const f = e.target.closest('[data-field]');
            if (!f) return;
            const p = Capture.proposals[Number(f.dataset.i)];
            if (!p) return;
            p.data = p.data || {};
            p.data[f.dataset.field] = f.value || null;
            const line = el.querySelector(`[data-desc="${f.dataset.i}"]`);
            if (line) line.textContent = describe(p);
        });
    },

    _open(html) {
        Sheet.mount();
        Sheet.el.innerHTML = html;
        Sheet.el.hidden = false;
        Sheet.scrim.hidden = false;
    },

    loading(msg) {
        Sheet._open(`<div class="s-body"><div class="s-loading">${esc(msg || 'Working…')}</div></div>`);
    },

    error(msg) {
        Sheet._open(`
            <div class="s-head"><strong>Didn't work</strong>
                <button class="btn sm" data-sheet="close">Close</button></div>
            <div class="s-body"><div class="s-error">${esc(msg)}</div></div>`);
    },

    hide() {
        if (!Sheet.el) return;
        Sheet.el.hidden = true;
        Sheet.scrim.hidden = true;
    },

    repaint() { Sheet.show({ actions: Capture.proposals }); },

    show(result) {
        Sheet.mount();
        const ps = Capture.proposals;
        if (result && result.clarify && !ps.length) {
            return Sheet._open(`
                <div class="s-head"><strong>One question</strong>
                    <button class="btn sm" data-sheet="close">Close</button></div>
                <div class="s-body"><p>${esc(result.clarify)}</p></div>
                ${Sheet._fixRow('Answer it')}`);
        }
        if (!ps.length) {
            return Sheet._open(`
                <div class="s-head"><strong>Nothing to do</strong>
                    <button class="btn sm" data-sheet="close">Close</button></div>
                <div class="s-body"><p class="muted">No actions came out of that. Try saying it differently.</p></div>
                ${Sheet._fixRow()}`);
        }

        Sheet._open(`
            <div class="s-head">
                <strong>${ps.length} proposed</strong>
                <span class="grow"></span>
                <button class="btn sm" data-sheet="all">Accept all</button>
                <button class="btn sm" data-sheet="discard">Discard</button>
                <button class="btn sm" data-sheet="close">×</button>
            </div>
            <div class="s-body">
                ${ps.map((p, i) => Sheet._card(p, i)).join('')}
            </div>
            ${Sheet._fixRow()}`);
    },

    _card(p, i) {
        const d = p.data || {};
        const fields = [];
        if ('title' in d || p.op !== 'logTime')
            fields.push(['title', 'Title', 'text', d.title || '']);
        if (p.op === 'createTask')
            fields.push(['due', 'Due', 'date', d.due || '']);
        if (p.op === 'logTime')
            fields.push(['minutes', 'Minutes', 'number', d.minutes || '']);
        return `
            <div class="s-card ${p.accepted ? 'done' : ''}">
                <div class="s-op">${esc(p.op.replace(/([A-Z])/g, ' $1').toLowerCase())}</div>
                <div class="s-desc" data-desc="${i}">${esc(describe(p))}</div>
                ${p.why ? `<div class="s-why">${esc(p.why)}</div>` : ''}
                <div class="s-fields">
                    ${fields.map(([name, label, type, val]) => `
                        <label class="s-f">
                            <span>${esc(label)}</span>
                            <input data-field="${esc(name)}" data-i="${i}" type="${type}"
                                   value="${esc(val)}">
                        </label>`).join('')}
                </div>
                ${p.accepted ? `<div class="s-ok">Added</div>` : `
                <div class="s-acts">
                    <button class="btn sm primary" data-sheet="accept" data-i="${i}">Accept</button>
                    <button class="btn sm" data-sheet="skip" data-i="${i}">Skip</button>
                </div>`}
            </div>`;
    },

    /* Pinned, never scrolled away from — this is what the sheet is for. */
    _fixRow(label) {
        return `
            <div class="s-fix">
                <label for="fixit">${esc(label || 'Not right? Say what to change')}</label>
                <div class="s-fix-row">
                    <input id="fixit" type="text" autocomplete="off"
                           placeholder="e.g. it's Datavise, due Friday, drop the second one">
                    <button class="btn sm" id="mic" data-sheet="mic" title="Dictate">🎙</button>
                    <button class="btn sm primary" data-sheet="redo">Redo</button>
                </div>
            </div>`;
    }
};

if (typeof module !== 'undefined') module.exports = { Sheet };
