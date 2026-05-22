/* ordify · Firebase initialization (Phase 0)
 * Uses the Firebase compat SDK (loaded from gstatic CDN before this file),
 * which exposes a global `firebase` object — compatible with classic scripts.
 *
 * These config values are PUBLIC by design. Access is governed by Firebase
 * Auth + Firestore security rules, not by keeping the keys secret.
 */
'use strict';

const firebaseConfig = {
    apiKey: 'AIzaSyAaCzNMTqKysbRe_9u00U9v-lfRsxGsPes',
    authDomain: 'ordify-69f53.firebaseapp.com',
    projectId: 'ordify-69f53',
    storageBucket: 'ordify-69f53.firebasestorage.app',
    messagingSenderId: '927226885239',
    appId: '1:927226885239:web:3d815f840b577ac02a4272'
};

let fbAuth = null;
let fbDb = null;
let fbReady = false;

try {
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK did not load');
    }
    firebase.initializeApp(firebaseConfig);

    fbAuth = firebase.auth();
    // Persist the session across reloads / browser restarts.
    fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((e) => {
        console.warn('Auth persistence could not be set', e);
    });

    fbDb = firebase.firestore();
    // Offline cache: writes are durable locally and sync when back online;
    // reads work offline. synchronizeTabs allows multiple open tabs.
    fbDb.enablePersistence({ synchronizeTabs: true }).catch((e) => {
        console.warn('Firestore persistence could not be enabled', e);
    });

    fbReady = true;
} catch (e) {
    console.error('Firebase init failed', e);
    fbReady = false;
}
