/* ordify · cloud
 *
 * Sign-in, and the adapter that puts the practice in Firestore.
 *
 * The whole point of the storage design is realised here: one document per
 * record, merged field by field. v2 serialised the entire practice into a
 * single document and wrote it whole on every change, so a rename typed on a
 * laptop and a due date set on a phone could not both survive — the later
 * write simply replaced the earlier one, silently, with no way to notice.
 *
 * Two things make that impossible here:
 *
 *   1. A write touches one record. Two edits to different things never meet.
 *   2. Two edits to the SAME record are merged inside a transaction, per
 *      field, newest wins. Store.merge is the arbiter — the same function the
 *      tests exercise against the memory adapter — so the rule that decides
 *      the outcome is one rule, not one per backend.
 *
 * Nothing above this file knows Firestore exists. The adapter has the same
 * four methods as MemoryAdapter and LocalAdapter, which is what made it
 * possible to build and test the whole app before writing any of this.
 */
'use strict';

/* Our record kinds, and where they live. A practice belongs to exactly one
   person, so the uid is the root and the rules need say nothing cleverer
   than "you may read and write your own". */
const COLLECTION = { node: 'nodes', entry: 'entries', memo: 'memos', invoice: 'invoices' };

function FirestoreAdapter(uid) {
    if (!fbReady || !fbDb) throw new Error('Firestore is not available');
    if (!uid) throw new Error('Cannot open a practice without a signed-in user');

    const col = (kind) => {
        const name = COLLECTION[kind];
        if (!name) throw new Error('Unknown record kind: ' + kind);
        return fbDb.collection('practices').doc(uid).collection(name);
    };
    const strip = (doc) => doc.exists ? doc.data() : null;

    return {
        async all(kind) {
            const snap = await col(kind).get();
            return snap.docs.map(d => d.data());
        },

        async get(kind, id) {
            return strip(await col(kind).doc(id).get());
        },

        async put(kind, rec) {
            await col(kind).doc(rec.id).set(rec);
            return rec;
        },

        /* Read-modify-write in one atomic step. Without the transaction two
           devices saving at the same moment could both read the old document
           and the second write would drop the first one's field — which is
           precisely the bug this rewrite exists to kill, reintroduced one
           layer lower. */
        async putMerged(kind, stamped, merge) {
            const ref = col(kind).doc(stamped.id);
            return fbDb.runTransaction(async (tx) => {
                const existing = strip(await tx.get(ref));
                const merged = merge(existing, stamped);
                tx.set(ref, merged);
                return merged;
            });
        },

        /* Another device is another writer. Firestore tells us the moment it
           writes, and the callback names which kind changed so the app can
           reload just that. Local echoes are skipped: we already have them,
           and re-rendering on our own write would fight the caret. */
        subscribe(onExternal) {
            const offs = Object.keys(COLLECTION).map(kind =>
                col(kind).onSnapshot({ includeMetadataChanges: false }, (snap) => {
                    const external = snap.docChanges().some(c => !c.doc.metadata.hasPendingWrites);
                    if (external) onExternal(kind);
                }, (err) => console.warn('lost the live connection for ' + kind, err))
            );
            return () => offs.forEach(off => off());
        }
    };
}

/* ------------------------------------------------------------------ auth ---
   Google only. This is one lawyer's practice, not a product with accounts to
   manage, and a password is one more thing to lose. */
const Auth = {
    user: null,
    _watchers: [],

    ready() { return !!(fbReady && fbAuth); },

    /* Called once at boot. Firebase answers asynchronously even when the
       session is already on disk, so the app waits for the first answer
       rather than flashing a sign-in screen at someone who is signed in. */
    watch(fn) {
        Auth._watchers.push(fn);
        if (Auth._watching) return;
        Auth._watching = true;
        if (!Auth.ready()) { fn(null); return; }
        fbAuth.onAuthStateChanged((user) => {
            Auth.user = user || null;
            Auth._watchers.forEach(w => w(Auth.user));
        });
    },

    async signIn() {
        if (!Auth.ready()) throw new Error('Sign-in is unavailable — Firebase did not load.');
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            await fbAuth.signInWithPopup(provider);
        } catch (e) {
            // Blocked popups and in-app browsers are the normal case on a
            // phone, not an error worth showing.
            if (/popup|blocked|cancelled|closed/i.test(e.code || e.message || '')) {
                return fbAuth.signInWithRedirect(provider);
            }
            throw new Error(Auth._say(e));
        }
    },

    async signOut() {
        if (Auth.ready()) await fbAuth.signOut();
    },

    _say(e) {
        const code = String(e && e.code || '');
        if (code.includes('network')) return 'No connection to Google.';
        if (code.includes('unauthorized-domain')) {
            return 'This address is not authorised in the Firebase project.';
        }
        return e && e.message || 'Sign-in failed.';
    }
};

if (typeof module !== 'undefined') module.exports = { FirestoreAdapter, Auth, COLLECTION };
