/* ordify · auth gate (Phase 0)
 * Gates the whole app behind Google sign-in. The app's boot() (exposed as
 * window.ordifyBoot by app.js) only runs once a user is authenticated.
 *
 * Phase 0 scope: authentication only. Data still lives in localStorage —
 * Phase 1 migrates the data layer to Firestore.
 */
'use strict';

const Auth = {
    user: null,
    booted: false,

    init() {
        const gate = document.getElementById('auth-gate');
        const signinBtn = document.getElementById('auth-signin');
        const errEl = document.getElementById('auth-error');

        if (!fbReady || !fbAuth) {
            gate.hidden = false;
            if (errEl) {
                errEl.hidden = false;
                errEl.textContent = 'Could not reach Firebase. Check your connection and reload the page.';
            }
            if (signinBtn) signinBtn.disabled = true;
            return;
        }

        signinBtn.addEventListener('click', () => Auth.signIn());

        // If a previous attempt fell back to a redirect, complete it here.
        fbAuth.getRedirectResult().catch((e) => console.warn('redirect result', e));

        fbAuth.onAuthStateChanged((user) => {
            Auth.user = user;
            if (user) {
                gate.hidden = true;
                Auth._renderAccount();
                if (!Auth.booted) {
                    Auth.booted = true;
                    if (typeof window.ordifyBoot === 'function') {
                        window.ordifyBoot();
                    }
                }
            } else {
                gate.hidden = false;
            }
        });
    },

    async signIn() {
        const errEl = document.getElementById('auth-error');
        const btn = document.getElementById('auth-signin');
        if (errEl) errEl.hidden = true;
        if (btn) btn.disabled = true;

        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            await fbAuth.signInWithPopup(provider);
            // onAuthStateChanged takes over from here.
        } catch (e) {
            console.error('sign-in failed', e);
            if (e.code === 'auth/popup-closed-by-user' ||
                e.code === 'auth/cancelled-popup-request') {
                // user dismissed — silent
            } else if (e.code === 'auth/popup-blocked') {
                // popup blocked — fall back to a full-page redirect
                try {
                    await fbAuth.signInWithRedirect(provider);
                    return;
                } catch (e2) {
                    if (errEl) {
                        errEl.hidden = false;
                        errEl.textContent = 'Sign-in failed: ' + (e2.message || e2.code);
                    }
                }
            } else if (errEl) {
                errEl.hidden = false;
                errEl.textContent = 'Sign-in failed: ' + (e.message || e.code);
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    signOut() {
        if (!confirm('Sign out of ordify?')) return;
        fbAuth.signOut().then(() => location.reload());
    },

    _renderAccount() {
        const host = document.getElementById('account-chip');
        if (!host || !Auth.user) return;
        const u = Auth.user;
        // esc is a global from app.js (shared lexical scope across classic scripts)
        const name = u.displayName || u.email || 'Signed in';
        host.innerHTML = `
            <div class="acct">
                ${u.photoURL
                    ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">`
                    : '<span class="acct-ph"></span>'}
                <span class="acct-name" title="${esc(u.email || '')}">${esc(name)}</span>
                <button id="acct-signout" type="button" title="Sign out">⎋</button>
            </div>`;
        const btn = document.getElementById('acct-signout');
        if (btn) btn.addEventListener('click', () => Auth.signOut());
    }
};

document.addEventListener('DOMContentLoaded', Auth.init);
