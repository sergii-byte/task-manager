// ordify.me — DOM helpers (single source of truth for escaping + safe colour)
const Dom = {
    escape(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
    safeColor(c) {
        if (typeof c !== 'string') return '#0a0a0a';
        return /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#0a0a0a';
    },
    on(id, ev, fn) {
        const el = typeof id === 'string' ? document.getElementById(id) : id;
        if (el) el.addEventListener(ev, fn);
    },
};

window.Dom = Dom;
