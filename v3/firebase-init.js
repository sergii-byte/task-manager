/* ordify v3 · Firebase
 *
 * The same project as v2 (`ordify-69f53`), because it is the same person and
 * the same practice — signing in must land you on your own data, and the
 * migration out of v2 has to read from somewhere.
 *
 * v3 writes under a different root, `practices/{uid}/…`, one document per
 * record. v2's `/userdata/{uid}` blob is never touched by anything here, so
 * production keeps working while this is being built.
 *
 * These values are public by design. What protects the data is Auth plus the
 * rules in firestore.rules, not secrecy — an API key in a static page is a
 * project identifier, not a credential.
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
    if (typeof firebase === 'undefined') throw new Error('Firebase SDK did not load');
    firebase.initializeApp(firebaseConfig);

    fbAuth = firebase.auth();
    fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch(e => console.warn('auth will not survive a restart', e));

    fbDb = firebase.firestore();
    /* Writes are durable on this device and sync when the network comes back;
       reads work with no network at all. A practice manager that stops working
       on a train is not a practice manager. */
    fbDb.enablePersistence({ synchronizeTabs: true })
        .catch(e => console.warn('no offline cache in this browser', e));

    fbReady = true;
} catch (e) {
    console.error('Firebase unavailable — the app will run on this device only', e);
    fbReady = false;
}
