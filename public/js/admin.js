// public/js/admin.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, writeBatch, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

import { firebaseConfig as localFirebaseConfig } from './firebase-config.js'; // Your Firebase config
import { showMessage, hideMessage } from './utils.js'; // Your utility functions

// Define your collection paths (must be consistent)
const PLAYERS_COLLECTION_PATH = 'artifacts/local-pool-tracker-app/public/data/players';
const MATCHES_COLLECTION_PATH = 'artifacts/local-pool-tracker-app/public/data/matches';

let db;
let auth;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase in this script as well
    const firebaseApp = initializeApp(localFirebaseConfig);
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);

    // Authenticate (e.g., anonymously) if needed for admin actions
    try {
        await signInAnonymously(auth);
        console.log("Signed in anonymously for admin.js.");
    } catch (error) {
        console.error("Error signing in anonymously for admin.js:", error);
        showMessage('clearDataMessage', `Authentication error: ${error.message}`, 'error', 5000);
        return; // Stop if authentication fails
    }

    // Get references to the specific elements on admin.html
    const clearAllDataButton = document.getElementById('clearAllDataButton');
    const clearConfirmationMessage = document.getElementById('clearConfirmationMessage');
    const confirmClearButton = document.getElementById('confirmClearButton');
    const cancelClearButton = document.getElementById('cancelClearButton');
    const clearDataMessage = document.getElementById('clearDataMessage'); // This one for messages within admin controls

    // --- Clear All Data Functions ---
    function initiateClearAllData() {
        if (clearConfirmationMessage) {
            clearConfirmationMessage.classList.remove('hidden');
            showMessage('clearDataMessage', 'Confirming will delete all player and match data. This cannot be undone!', 'error');
        }
    }

    async function clearAllDataConfirmed() {
        try {
            confirmClearButton.disabled = true;
            cancelClearButton.disabled = true;
            showMessage('clearDataMessage', 'Clearing data, please wait...', 'info');

            const playersRef = collection(db, PLAYERS_COLLECTION_PATH);
            const matchesRef = collection(db, MATCHES_COLLECTION_PATH);

            const playerDocs = await getDocs(playersRef);
            const playerBatch = writeBatch(db);

            // --- Step 1: Delete Rivalries Subcollections for each player ---
            for (const playerDoc of playerDocs.docs) {
                const rivalrySubcollectionRef = collection(db, PLAYERS_COLLECTION_PATH, playerDoc.id, 'rivalries');
                const rivalryDocs = await getDocs(rivalrySubcollectionRef);

                rivalryDocs.forEach(rivalryDoc => {
                    playerBatch.delete(rivalryDoc.ref);
                });
                console.log(`Rivalries for player ${playerDoc.id} added to batch for deletion.`);
            }

            // --- Step 2: Delete Player Documents themselves ---
            playerDocs.forEach(doc => {
                playerBatch.delete(doc.ref);
            });

            await playerBatch.commit();
            console.log("All player data (including rivalries) deleted.");

            // --- Delete Match Documents (remains the same) ---
            const matchDocs = await getDocs(matchesRef);
            const matchBatch = writeBatch(db);
            matchDocs.forEach(doc => {
                matchBatch.delete(doc.ref);
            });
            await matchBatch.commit();
            console.log("All match data deleted.");

            showMessage('clearDataMessage', 'All leaderboard data has been successfully cleared.', 'success', 3000);

            // IMPORTANT: If you move the admin controls to a separate page,
            // this page won't automatically refresh the leaderboard/latest matches
            // on the *index.html* page. The user would need to navigate back to index.html
            // to see the refreshed data. You'd remove these lines:
            // await fetchAndRenderLeaderboard();
            // await fetchAndRenderLatestMatches();
            // const playersAfterClear = await fetchPlayersFromFirebase();
            // populatePlayerDropdowns(playersAfterClear);

        } catch (error) {
            console.error("Error clearing all data:", error);
            showMessage('clearDataMessage', `Error clearing data: ${error.message}`, 'error', 5000);
        } finally {
            if (clearConfirmationMessage) {
                clearConfirmationMessage.classList.add('hidden');
            }
            confirmClearButton.disabled = false;
            cancelClearButton.disabled = false;
            hideMessage('clearDataMessage');
        }
    }

    function cancelClearAllData() {
        if (clearConfirmationMessage) {
            clearConfirmationMessage.classList.add('hidden');
        }
        if (clearDataMessage) {
            clearDataMessage.textContent = '';
            hideMessage('clearDataMessage');
        }
    }

    // Attach event listeners for clear data buttons
    clearAllDataButton.addEventListener('click', initiateClearAllData);
    confirmClearButton.addEventListener('click', clearAllDataConfirmed);
    cancelClearButton.addEventListener('click', cancelClearAllData);
});