// matchHistory.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import your local firebase-config.js
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js'; 

let db;
let auth;
let currentUserId = null; // To store authenticated user ID

// Determine the final firebaseConfig to use: Canvas-provided or local fallback
let finalFirebaseConfig = {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'local-pool-tracker-app'; // Fallback ID for local testing

try {
    // Prefer Canvas-provided config if it's a valid non-empty string
    if (typeof __firebase_config === 'string' && __firebase_config.trim().length > 0) {
        finalFirebaseConfig = JSON.parse(__firebase_config);
        console.log("Using Canvas-provided Firebase config.");
    } else {
        // Fallback to locally imported config
        finalFirebaseConfig = localFirebaseConfig;
        console.warn("Runtime variable '__firebase_config' is not valid or empty. Using local 'firebase-config.js'.");
        if (finalFirebaseConfig.projectId === "YOUR_FIREBASE_PROJECT_ID") {
            console.warn("Using placeholder Firebase Project ID from local config. Firestore operations will not connect to a real project unless configured with your actual Firebase credentials in firebase-config.js.");
        }
    }
} catch (e) {
    console.error("Error parsing __firebase_config or loading local config. Using local fallback. Details:", e);
    finalFirebaseConfig = localFirebaseConfig;
    if (finalFirebaseConfig.projectId === "YOUR_FIREBASE_PROJECT_ID") {
        console.warn("Using placeholder Firebase Project ID from local config due to error. Firestore operations will not connect to a real project unless configured with your actual Firebase credentials in firebase-config.js.");
    }
}

// Helper function to show messages
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `mt-2 p-3 rounded-lg text-sm ${
            type === 'error' ? 'bg-red-700 text-white' : 
            type === 'success' ? 'bg-green-700 text-white' : 
            'bg-blue-700 text-white'
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
            throw new Error("Firebase configuration 'projectId' is missing. Cannot initialize Firebase.");
        }
        const app = initializeApp(finalFirebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("Firebase initialized.");
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        showMessage('matchHistoryErrorMessage', `Failed to initialize Firebase: ${error.message}. Please check console for details.`, 'error');
        return;
    }

    // Firestore collection path for public data (players)
    const PLAYERS_COLLECTION_PATH = `artifacts/${appId}/public/data/players`;

    // Authenticate user
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            console.log("Authenticated with Firebase UID:", currentUserId);
            await loadMatchHistory(); // Load match history after auth
        } else {
            console.log("No user signed in. Attempting anonymous sign-in.");
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                    console.log("Signed in with custom token.");
                } else {
                    await signInAnonymously(auth);
                    console.log("Signed in anonymously.");
                }
            } catch (error) {
                console.error("Firebase authentication failed:", error);
                showMessage('matchHistoryErrorMessage', 'Authentication failed. Match history might not load. Check console for details.', 'error');
            }
        }
    });

    /**
     * Loads and displays the match history for a specific player.
     */
    async function loadMatchHistory() {
        hideMessage('matchHistoryErrorMessage');
        showMessage('matchHistoryErrorMessage', 'Loading match history...', 'info');

        const urlParams = new URLSearchParams(window.location.search);
        const playerName = decodeURIComponent(urlParams.get('playerName'));

        if (!playerName) {
            showMessage('matchHistoryErrorMessage', 'Player name not found in URL. Cannot load match history.', 'error');
            return;
        }

        // Set the main header and player name display
        document.getElementById('mainHeader').textContent = `Match History`;
        document.getElementById('matchHistoryPlayerName').textContent = `Matches for ${playerName}`;

        // Set the "Back to Player Profile" link
        const backToProfileLink = document.getElementById('backToProfileLink');
        if (backToProfileLink) {
            backToProfileLink.href = `playerProfile.html?playerName=${encodeURIComponent(playerName)}`;
        }

        try {
            const matchesCollectionRef = collection(db, PLAYERS_COLLECTION_PATH, playerName, 'matches');
            // Order by timestamp descending to show most recent matches first
            const q = query(matchesCollectionRef, orderBy('timestamp', 'desc')); 
            const matchesSnapshot = await getDocs(q);
            const matchHistory = matchesSnapshot.docs.map(doc => doc.data());

            const tableBody = document.getElementById('matchHistoryTableBody');
            tableBody.innerHTML = ''; // Clear existing rows

            const noMatchesMessage = document.getElementById('noMatchesMessage');
            noMatchesMessage.classList.add('hidden'); // Hide it by default

            if (matchHistory.length === 0) {
                noMatchesMessage.classList.remove('hidden');
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-3 px-4 text-center text-sm text-gray-400">No matches found for ${playerName}.</td>
                    </tr>
                `;
            } else {
                matchHistory.forEach(match => {
                    // Ensure timestamp is converted from Firestore Timestamp object if it's not already a Date
                    const date = match.timestamp ? new Date(match.timestamp.toDate()).toLocaleDateString() : 'N/A';
                    const time = match.timestamp ? new Date(match.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
                    const gameType = match.gameType ? match.gameType.toUpperCase() : 'N/A';
                    
                    let yourOutcome = 'N/A';
                    let opponents = [];
                    let teammates = [];

                    if (match.gameType === '1v1') {
                        // For 1v1, the opponent is the other player in the opponents array
                        // Ensure match.opponents is an array before using find
                        const opponent = Array.isArray(match.opponents) ? match.opponents.find(p => p !== playerName) : undefined;
                        if (opponent) opponents.push(opponent);
                        yourOutcome = (match.outcome === 'win') ? 'Win 🟢' : 'Loss 🔴';
                    } else if (match.gameType === '2v2') {
                        // Use match.outcome directly for 2v2 to reflect win/loss for the current player
                        yourOutcome = (match.outcome === 'win') ? 'Win 🟢' : 'Loss 🔴';

                        // Determine teammates and opponents from the match record
                        // Add defensive checks for opponents and teammates arrays
                        if (Array.isArray(match.teamMates)) {
                            match.teamMates.forEach(tm => {
                                if (tm !== playerName) teammates.push(tm);
                            });
                        }
                        if (Array.isArray(match.opponents)) {
                            match.opponents.forEach(opp => opponents.push(opp));
                        }
                    }

                    const row = `
                        <tr class="border-b border-gray-200 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500">
                            <td class="py-2 px-4 text-sm text-gray-200">${date}</td>
                            <td class="py-2 px-4 text-sm text-gray-200">${time}</td>
                            <td class="py-2 px-4 text-sm text-gray-200">${gameType}</td>
                            <td class="py-2 px-4 text-sm text-gray-200">${yourOutcome}</td>
                            <td class="py-2 px-4 text-sm text-gray-200">${opponents.join(', ') || 'N/A'}</td>
                            <td class="py-2 px-4 text-sm text-gray-200">${teammates.join(', ') || 'N/A'}</td>
                        </tr>
                    `;
                    tableBody.innerHTML += row;
                });
            }
            hideMessage('matchHistoryErrorMessage');
        } catch (error) {
            console.error("Error fetching match history:", error);
            showMessage('matchHistoryErrorMessage', `Error loading match history: ${error.message}`, 'error');
        }
    }
});
