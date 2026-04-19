// DOM utilities — safe templating + escapers.
//
// Goals:
//   1. Eliminate the "did I remember to escape this?" footgun by giving
//      a tagged-template helper that auto-escapes interpolations.
//   2. Centralise the escape implementation so it's audited once.
//   3. Provide a safeColor normaliser for any untrusted CSS color value.
//
// New code should prefer `Dom.html\`<div>${userInput}</div>\``.
// Old call sites can keep using App.esc() (which now delegates here).

const Dom = {
    /**
     * Escape a string for safe insertion into HTML text content.
     * Returns '' for null/undefined.
     */
    escape(s) {
        if (s == null) return '';
        // Using textContent → innerHTML is the bulletproof primitive: it
        // delegates to the browser's parser, so any future HTML quirk is
        // their bug, not ours.
        const div = document.createElement('div');
        div.textContent = String(s);
        return div.innerHTML;
    },

    /**
     * Escape for use inside a double-quoted HTML attribute.
     * Strict superset of text escape — also handles raw quotes.
     */
    attr(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    /**
     * Normalise any untrusted color value (Sheets, AI, user input) to a
     * safe 6-digit hex. Prevents CSS injection when the color is
     * interpolated into a `style="..."` attribute. Invalid input returns
     * a neutral grey. Accepts #abc, #aabbcc, #aabbccff (alpha dropped).
     */
    safeColor(c) {
        const FALLBACK = '#888888';
        if (!c || typeof c !== 'string') return FALLBACK;
        const v = c.trim().toLowerCase();
        const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
        if (m3) return '#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
        if (/^#[0-9a-f]{6}$/.test(v)) return v;
        const m8 = /^#([0-9a-f]{6})[0-9a-f]{2}$/.exec(v);
        if (m8) return '#' + m8[1];
        return FALLBACK;
    },

    /**
     * Tagged template that auto-escapes interpolations.
     *
     *   Dom.html`<div title=${user.name}>${user.bio}</div>`
     *
     * Interpolations inside attribute context are escaped via attr(), inside
     * text context via escape(). To bypass escaping (e.g. interpolating
     * Icons.foo() output), wrap the value with Dom.raw(htmlString).
     *
     * Returns a string. Caller assigns to innerHTML or wraps with frag().
     */
    html(strings, ...values) {
        let out = '';
        for (let i = 0; i < strings.length; i++) {
            out += strings[i];
            if (i < values.length) {
                const v = values[i];
                if (v && v.__rawHtml === true) {
                    out += v.value;
                } else if (Array.isArray(v)) {
                    // Arrays: join with no separator. Each item: raw if
                    // marked, else escape. Useful for `${rows}` patterns.
                    out += v.map(item =>
                        item && item.__rawHtml === true ? item.value : Dom.escape(item)
                    ).join('');
                } else {
                    // Cheap context detection: look at the trailing chars
                    // of the preceding literal to decide attr vs text.
                    out += Dom._isAttrContext(strings[i]) ? Dom.attr(v) : Dom.escape(v);
                }
            }
        }
        return out;
    },

    /** Mark a string as already-safe HTML — bypasses escaping in Dom.html. */
    raw(htmlString) {
        return { __rawHtml: true, value: String(htmlString == null ? '' : htmlString) };
    },

    /** True if the slice ends inside an attribute value context. */
    _isAttrContext(slice) {
        // Scan from the right: if we hit `=` or `="..."` before `>`, attr.
        // This is a heuristic, not a parser, but it covers the patterns
        // we use (`<div title="${x}">`, `<a href=${x}>`).
        const tail = slice.slice(-200);  // window
        const lastOpen = tail.lastIndexOf('<');
        const lastClose = tail.lastIndexOf('>');
        if (lastOpen <= lastClose) return false;          // outside any tag
        const inTag = tail.slice(lastOpen);
        // Inside a tag and the last `=` (after the tag name) means we're
        // in an attribute value.
        return /=\s*"?[^"<>]*$/.test(inTag);
    },

    /** Parse an HTML string into a DocumentFragment (no scripts execute). */
    frag(html) {
        const tpl = document.createElement('template');
        tpl.innerHTML = String(html == null ? '' : html);
        return tpl.content;
    },
};
