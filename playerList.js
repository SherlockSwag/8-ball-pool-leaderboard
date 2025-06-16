// players.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, query, getDocs, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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
        console.log("Using Canvas-provided Firebase config.");
    } else {
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

// Firestore collection path for public data (players)
const PLAYERS_COLLECTION_PATH = `artifacts/${appId}/public/data/players`;

// Helper function to show messages (errors, success, loading)
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `col-span-full mt-4 p-3 rounded-lg text-sm text-center ${
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
        console.log("Firebase initialized in players.js.");
    } catch (error) {
        console.error("Error initializing Firebase in players.js:", error);
        showMessage('playersErrorMessage', `Failed to initialize Firebase: ${error.message}. Please check console for details.`, 'error');
        return;
    }

    // Authenticate user
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Authenticated with Firebase UID:", user.uid);
            await fetchAndRenderPlayers(); // Fetch and render players after auth
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
                await fetchAndRenderPlayers(); // Fetch and render players after sign-in attempt
            } catch (error) {
                console.error("Firebase authentication failed in players.js:", error);
                showMessage('playersErrorMessage', 'Authentication failed. Player data might not load. Check console for details.', 'error');
            }
        }
    });

    /**
     * Calculates the current win/loss streak for a player based on their match history.
     * The 'outcome' field in each match object directly reflects the outcome for the player whose history this is.
     * @param {Array<Object>} matches - An array of match objects for the player, sorted by timestamp descending.
     * @returns {string} The current streak (e.g., "3 Wins", "2 Losses", "No Streak").
     */
    function calculateCurrentStreak(matches) {
        if (!matches || matches.length === 0) {
            return "No Streak";
        }

        let streakCount = 0;
        let streakType = null; // 'win' or 'loss'

        // Matches are already sorted by timestamp descending, so process from most recent.
        for (const match of matches) {
            const currentMatchOutcome = match.outcome; // 'win' or 'loss' for this player

            if (currentMatchOutcome !== 'win' && currentMatchOutcome !== 'loss') {
                console.warn("Invalid outcome in match history, skipping:", match);
                continue; 
            }
            
            if (streakType === null) {
                streakType = currentMatchOutcome;
                streakCount = 1;
            } else if (currentMatchOutcome === streakType) {
                streakCount++;
            } else {
                // Streak broken, stop here
                break; 
            }
        }

        if (streakType === 'win') {
            return `${streakCount} Win(s)`;
        } else if (streakType === 'loss') {
            return `${streakCount} Loss(es)`;
        }
        return "No Streak";
    }


    /**
     * Fetches all player data and renders them as cards in a grid.
     */
    async function fetchAndRenderPlayers() {
        const playersGrid = document.getElementById('playersGrid');
        const playersLoadingMessage = document.getElementById('playersLoadingMessage');
        const noPlayersMessage = document.getElementById('noPlayersMessage');
        
        // Clear previous content and show loading
        playersGrid.innerHTML = '';
        hideMessage('playersErrorMessage');
        noPlayersMessage.classList.add('hidden');
        playersLoadingMessage.classList.remove('hidden');

        if (!db) {
            showMessage('playersErrorMessage', 'Firebase database not initialized. Cannot load players.', 'error');
            playersLoadingMessage.classList.add('hidden');
            return;
        }

        try {
            const playersRef = collection(db, PLAYERS_COLLECTION_PATH);
            const querySnapshot = await getDocs(query(playersRef));

            const players = [];
            if (querySnapshot.empty) {
                playersLoadingMessage.classList.add('hidden');
                noPlayersMessage.classList.remove('hidden');
                return;
            }

            for (const playerDoc of querySnapshot.docs) {
                const playerData = playerDoc.data();
                players.push(playerData);

                // Fetch match history for streak calculation
                const matchesRef = collection(playerDoc.ref, 'matches');
                const matchesQuery = query(matchesRef, orderBy('timestamp', 'desc'), limit(100)); // Get recent matches for streak
                const matchesSnapshot = await getDocs(matchesQuery);
                
                const playerMatches = [];
                matchesSnapshot.forEach(matchDoc => {
                    playerMatches.push(matchDoc.data());
                });
                playerData.matches = playerMatches; // Attach matches to player data
            }

            playersLoadingMessage.classList.add('hidden');
            
            // Sort players alphabetically by name for consistent display
            players.sort((a, b) => a.name.localeCompare(b.name));

            players.forEach(player => {
                const totalWins = (player.wins1v1 || 0) + (player.wins2v2 || 0);
                const totalLosses = (player.losses1v1 || 0) + (player.losses2v2 || 0);
                const totalGames = totalWins + totalLosses;
                const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(2) : 'N/A';
                
                const currentStreak = calculateCurrentStreak(player.matches); // Pass only matches, as outcome is player-centric

                const playerCard = `
                    <div class="bg-gray-700 p-6 rounded-xl shadow-lg border border-gray-600 flex flex-col items-center text-center">
                        <div class="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold text-white mb-4 overflow-hidden">
                            <!-- Placeholder for player image -->
                            <img src="https://placehold.co/96x96/4299E1/FFFFFF?text=${player.name.charAt(0).toUpperCase()}" 
                                 alt="${player.name}" 
                                 class="w-full h-full object-cover">
                        </div>
                        <h3 class="text-xl font-semibold text-blue-300 mb-2">${player.name}</h3>
                        <p class="text-gray-200 text-sm mb-1">
                            <strong class="font-medium">Total Games:</strong> ${totalGames}
                        </p>
                        <p class="text-gray-200 text-sm mb-1">
                            <strong class="font-medium">Win Rate:</strong> ${winRate}%
                        </p>
                        <p class="text-gray-200 text-sm mb-4">
                            <strong class="font-medium">Streak:</strong> ${currentStreak}
                        </p>
                        <a href="playerProfile.html?playerName=${encodeURIComponent(player.name)}" 
                           class="inline-block bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition duration-150 ease-in-out transform hover:scale-105">
                            View Profile
                        </a>
                    </div>
                `;
                playersGrid.innerHTML += playerCard;
            });

        } catch (error) {
            console.error("Error fetching and rendering players:", error);
            showMessage('playersErrorMessage', `Error loading players: ${error.message}`, 'error');
            playersLoadingMessage.classList.add('hidden');
        }
    }
});
