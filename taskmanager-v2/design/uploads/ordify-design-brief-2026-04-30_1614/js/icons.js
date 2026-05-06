// ordify.me — inline SVG icon set (stroke-based, currentColor)
// Each method returns an HTML string. Icon viewBox is 24×24, stroke-width 1.8,
// linecap+linejoin round. Sizes default to 14 (sidebar) or 16 (inline).
const Icons = {
    _svg(body, size = 14) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
    },
    capture(s)  { return this._svg('<path d="M12 2l2.4 5.8L20 9l-4.6 4 1.4 6-4.8-3-4.8 3 1.4-6L4 9l5.6-1.2z"/>', s); },
    today(s)    { return this._svg('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>', s); },
    inbox(s)    { return this._svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>', s); },
    calendar(s) { return this._svg('<rect x="3" y="4" width="18" height="18" rx="0"/><path d="M16 2v4M8 2v4M3 10h18"/>', s); },
    matters(s)  { return this._svg('<path d="M2 7a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="M2 13h20"/>', s); },
    time(s)     { return this._svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', s); },
    invoice(s)  { return this._svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', s); },
    plus(s)     { return this._svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', s); },
    check(s)    { return this._svg('<polyline points="20 6 9 17 4 12"/>', s); },
    x(s)        { return this._svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', s); },
    edit(s)     { return this._svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>', s); },
    trash(s)    { return this._svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', s); },
    play(s)     { return this._svg('<polygon points="5 3 19 12 5 21 5 3"/>', s); },
    pause(s)    { return this._svg('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>', s); },
};

window.Icons = Icons;
