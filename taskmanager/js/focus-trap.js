// Modal focus trap — keeps Tab/Shift+Tab cycling within an open overlay
// and restores focus to the previously-active element on close.
//
// Stack-based: nested modals (e.g. Settings opened from inside Import)
// pop back to the previously-trapped overlay instead of leaking focus
// to the page underneath.
//
// Usage:
//   FocusTrap.open('settings-overlay');
//   ...
//   FocusTrap.close('settings-overlay');

const FocusTrap = {
    _stack: [],
    _focusableSelector:
        'a[href], button:not([disabled]), textarea:not([disabled]), ' +
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
        '[tabindex]:not([tabindex="-1"])',

    /** Visible focusables inside `root`, in document order. */
    _focusableIn(root) {
        if (!root) return [];
        return Array.from(root.querySelectorAll(this._focusableSelector))
            .filter(el => el.offsetParent !== null || el === document.activeElement);
    },

    /**
     * Activate trap on the overlay with the given id.
     * Marks aria-hidden=false, captures previous activeElement so close()
     * can restore it, and installs a Tab/Shift+Tab keydown handler.
     */
    open(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;
        overlay.setAttribute('aria-hidden', 'false');
        const prev = document.activeElement;
        const handler = (e) => {
            if (e.key !== 'Tab') return;
            const items = this._focusableIn(overlay);
            if (!items.length) { e.preventDefault(); return; }
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        };
        overlay.addEventListener('keydown', handler);
        this._stack.push({ overlayId, prev, handler });
    },

    /**
     * Deactivate trap on the overlay. Removes the handler, restores focus
     * to whatever was active when open() was called.
     */
    close(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) overlay.setAttribute('aria-hidden', 'true');
        const idx = this._stack.findIndex(e => e.overlayId === overlayId);
        if (idx === -1) return;
        const entry = this._stack.splice(idx, 1)[0];
        if (overlay && entry.handler) {
            overlay.removeEventListener('keydown', entry.handler);
        }
        if (entry.prev && typeof entry.prev.focus === 'function') {
            try { entry.prev.focus(); } catch (_) { /* element gone */ }
        }
    },
};
