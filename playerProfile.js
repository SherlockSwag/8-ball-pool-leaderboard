// playerProfile.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import your local firebase-config.js
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js'; 

let db;
let auth;

// Determine the final firebaseConfig to use: Canvas-provided or local fallback
let finalFirebaseConfig = {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'local-pool-tracker-app'; // Fallback ID for local testing

try {
    if (typeof __firebase_config === 'string' && __firebase_config.trim().length > 0) {
        finalFirebaseConfig = JSON.parse(__firebase_config);
        console.log("Player Profile: Using Canvas-provided Firebase config.");
    } else {
        finalFirebaseConfig = localFirebaseConfig;
        console.warn("Player Profile: Runtime variable '__firebase_config' is not valid or empty. Using local 'firebase-config.js'.");
    }
} catch (e) {
    console.error("Player Profile: Error parsing __firebase_config or loading local config. Using local fallback. Details:", e);
    finalFirebaseConfig = localFirebaseConfig;
}

// Firestore collection path for public data (leaderboard) - must match leaderboard.js
const PLAYERS_COLLECTION_PATH = `artifacts/${appId}/public/data/players`;

// Helper function to show messages
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `mt-2 p-2 rounded text-center text-sm ${
            type === 'error' ? 'bg-red-100 text-red-700' :
            type === 'info' ? 'bg-blue-100 text-blue-700' :
            'bg-green-100 text-green-700' // For success, though not typically used here
        }`;
        element.classList.remove('hidden');
    }
}

// Function to hide messages
function hideMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('hidden');
        element.textContent = '';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase
    try {
        if (!finalFirebaseConfig || !finalFirebaseConfig.projectId) {
            throw new Error("Firebase configuration 'projectId' is missing.");
        }
        const app = initializeApp(finalFirebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("Player Profile: Firebase initialized.");
    } catch (error) {
        console.error("Player Profile: Error initializing Firebase:", error);
        showMessage('profileErrorMessage', `Failed to initialize Firebase: ${error.message}.`, 'error');
        return;
    }

    // Authenticate user (anonymously for read access)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Player Profile: Authenticated with Firebase UID:", user.uid);
            await loadPlayerProfile(); // Load profile after authentication
        } else {
            console.log("Player Profile: No user signed in. Attempting anonymous sign-in.");
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                    console.log("Player Profile: Signed in with custom token.");
                } else {
                    await signInAnonymously(auth);
                    console.log("Player Profile: Signed in anonymously.");
                }
            } catch (error) {
                console.error("Player Profile: Firebase authentication failed:", error);
                showMessage('profileErrorMessage', 'Authentication failed. Player data might not load. Check console for details.', 'error');
            }
        }
    });

    /**
     * Loads and displays the player's profile data.
     */
    async function loadPlayerProfile() {
        const urlParams = new URLSearchParams(window.location.search);
        const playerName = urlParams.get('playerName');

        if (!playerName) {
            showMessage('profileErrorMessage', 'Player name not found in URL. Please go back to the leaderboard.', 'error');
            return;
        }

        document.getElementById('playerNameDisplay').textContent = playerName;
        showMessage('profileErrorMessage', `Loading profile for ${playerName}...`, 'info');

        try {
            if (!db) {
                showMessage('profileErrorMessage', 'Firebase database not initialized. Cannot load profile.', 'error');
                return;
            }
            const playerDocRef = doc(db, PLAYERS_COLLECTION_PATH, playerName);
            const playerDocSnap = await getDoc(playerDocRef);

            if (playerDocSnap.exists()) {
                const playerData = playerDocSnap.data();
                document.getElementById('wins1v1').textContent = playerData.wins1v1 || 0;
                document.getElementById('losses1v1').textContent = playerData.losses1v1 || 0;
                document.getElementById('wins2v2').textContent = playerData.wins2v2 || 0;
                document.getElementById('losses2v2').textContent = playerData.losses2v2 || 0;

                const totalWins = (playerData.wins1v1 || 0) + (playerData.wins2v2 || 0);
                const totalLosses = (playerData.losses1v1 || 0) + (playerData.losses2v2 || 0);
                const totalGames = totalWins + totalLosses;
                const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(2) + '%' : 'N/A';
                document.getElementById('overallWinRate').textContent = winRate;
                // document.getElementById('eloRating').textContent = playerData.elo || 'N/A'; // For future Elo

                hideMessage('profileErrorMessage'); // Hide loading message
            } else {
                showMessage('profileErrorMessage', `Player "${playerName}" not found.`, 'error');
            }
        } catch (error) {
            console.error("Player Profile: Error fetching player data:", error);
            showMessage('profileErrorMessage', `Error loading profile: ${error.message}`, 'error');
        }
    }
});
