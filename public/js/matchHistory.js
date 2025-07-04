// playerMatchHistory.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, query, orderBy, getDocs, where } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import your local firebase-config.js
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js'; 

let db;
let auth;
let currentUserId = null; // To store authenticated user ID
let allMatches = []; // Store the full match history here for filtering
let currentPlayerName = null; // Store the current player's name

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

    // Firestore collection path for public data (players) and matches
    const PLAYERS_COLLECTION_PATH = `artifacts/${appId}/public/data/players`;
    const MATCHES_COLLECTION_PATH = `artifacts/${appId}/public/data/matches`;

    // Get filter elements
    const filterButton = document.getElementById('filterButton');
    const filterControls = document.getElementById('filterControls');
    const outcomeFilter = document.getElementById('outcomeFilter');
    const gameTypeFilter = document.getElementById('gameTypeFilter');
    const opponentFilter = document.getElementById('opponentFilter');
    const teammateFilter = document.getElementById('teammateFilter'); // NEW: Get teammate filter
    const applyFiltersButton = document.getElementById('applyFiltersButton');
    const clearFiltersButton = document.getElementById('clearFiltersButton');

    // --- START: Functions defined within DOMContentLoaded for correct scope ---

    // Function to render matches to the table based on a provided array
    function renderMatches(matchesToRender) {
        const tableBody = document.getElementById('matchHistoryTableBody');
        tableBody.innerHTML = ''; // Clear existing rows
        const noMatchesMessage = document.getElementById('noMatchesMessage');
        noMatchesMessage.classList.add('hidden'); // Hide it by default

        if (matchesToRender.length === 0) {
            noMatchesMessage.classList.remove('hidden');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-3 px-4 text-center text-sm text-gray-400">No matches found with current filters.</td>
                </tr>
            `;
            return;
        }

        matchesToRender.forEach(match => {
            let matchDate;
            if (match.timestamp && typeof match.timestamp.toDate === 'function') {
                matchDate = match.timestamp.toDate();
            } else if (match.timestamp instanceof Date) {
                matchDate = match.timestamp;
            } else if (typeof match.timestamp === 'number') {
                matchDate = new Date(match.timestamp);
            } else {
                matchDate = null; 
                console.warn('Unexpected timestamp format for match:', match);
            }

            const date = matchDate ? matchDate.toLocaleDateString() : 'N/A';
            const time = matchDate ? matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
            const gameType = match.gameType ? match.gameType.toUpperCase() : 'N/A';
            
            let yourOutcome = 'N/A';
            let opponents = [];
            let teammates = [];

            if (match.gameType === '1v1') {
                if (match.winner === currentPlayerName) {
                    yourOutcome = 'Win 🏆';
                    opponents.push(match.loser);
                } else if (match.loser === currentPlayerName) {
                    yourOutcome = 'Loss 📉';
                    opponents.push(match.winner);
                }
            } else if (match.gameType === '2v2') {
                if (match.winningTeam && match.winningTeam.includes(currentPlayerName)) {
                    yourOutcome = 'Win 🏆';
                    teammates = match.winningTeam.filter(p => p !== currentPlayerName);
                    opponents = match.losingTeam || []; 
                } else if (match.losingTeam && match.losingTeam.includes(currentPlayerName)) {
                    yourOutcome = 'Loss 📉';
                    teammates = match.losingTeam.filter(p => p !== currentPlayerName);
                    opponents = match.winningTeam || []; 
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
        hideMessage('matchHistoryErrorMessage'); // Hide loading message once rendered
    }

    // Function to populate opponent and teammate filter dropdowns
    function populatePlayerFilters(matches) {
        const uniqueOpponents = new Set();
        const uniqueTeammates = new Set(); // NEW: Set for unique teammates

        matches.forEach(match => {
            if (match.gameType === '1v1' && match.winner && match.loser) {
                if (match.winner === currentPlayerName) {
                    uniqueOpponents.add(match.loser);
                } else if (match.loser === currentPlayerName) {
                    uniqueOpponents.add(match.winner);
                }
            } else if (match.gameType === '2v2' && match.winningTeam && match.losingTeam) {
                // Opponents
                let currentMatchOpponents = [];
                if (match.winningTeam.includes(currentPlayerName)) {
                    currentMatchOpponents = match.losingTeam;
                } else if (match.losingTeam.includes(currentPlayerName)) {
                    currentMatchOpponents = match.winningTeam;
                }
                currentMatchOpponents.forEach(opp => uniqueOpponents.add(opp));

                // Teammates (for 2v2 only)
                if (match.winningTeam.includes(currentPlayerName)) {
                    match.winningTeam.forEach(tm => {
                        if (tm !== currentPlayerName) uniqueTeammates.add(tm);
                    });
                } else if (match.losingTeam.includes(currentPlayerName)) {
                    match.losingTeam.forEach(tm => {
                        if (tm !== currentPlayerName) uniqueTeammates.add(tm);
                    });
                }
            }
        });

        // Populate Opponent Filter
        opponentFilter.innerHTML = '<option value="all">All Opponents</option>';
        Array.from(uniqueOpponents).sort().forEach(opponent => {
            const option = document.createElement('option');
            option.value = opponent;
            option.textContent = opponent;
            opponentFilter.appendChild(option);
        });

        // NEW: Populate Teammate Filter
        teammateFilter.innerHTML = '<option value="all">All Teammates</option>';
        Array.from(uniqueTeammates).sort().forEach(teammate => {
            const option = document.createElement('option');
            option.value = teammate;
            option.textContent = teammate;
            teammateFilter.appendChild(option);
        });
    }

    // Function to apply filters
    function applyFilters() {
        const selectedOutcome = outcomeFilter.value;
        const selectedGameType = gameTypeFilter.value;
        const selectedOpponent = opponentFilter.value;
        const selectedTeammate = teammateFilter.value; // NEW: Get selected teammate

        const filteredMatches = allMatches.filter(match => {
            // Filter by Outcome
            if (selectedOutcome !== 'all' && match.playerOutcome !== selectedOutcome) {
                return false;
            }

            // Filter by Game Type
            if (selectedGameType !== 'all' && match.gameType.toLowerCase() !== selectedGameType.toLowerCase()) {
                return false;
            }

            // Filter by Opponent
            if (selectedOpponent !== 'all') {
                if (match.gameType === '1v1') {
                    if (match.winner === currentPlayerName && match.loser !== selectedOpponent) return false;
                    if (match.loser === currentPlayerName && match.winner !== selectedOpponent) return false;
                } else if (match.gameType === '2v2') {
                    let matchOpponents = [];
                    if (match.winningTeam.includes(currentPlayerName)) {
                        matchOpponents = match.losingTeam;
                    } else if (match.losingTeam.includes(currentPlayerName)) {
                        matchOpponents = match.winningTeam;
                    }
                    if (!matchOpponents.includes(selectedOpponent)) return false;
                }
            }

            // NEW: Filter by Teammate
            if (selectedTeammate !== 'all') {
                // Teammate filter only applies to 2v2 matches
                if (match.gameType !== '2v2') return false; 
                
                let matchTeammates = [];
                if (match.winningTeam.includes(currentPlayerName)) {
                    matchTeammates = match.winningTeam.filter(p => p !== currentPlayerName);
                } else if (match.losingTeam.includes(currentPlayerName)) {
                    matchTeammates = match.losingTeam.filter(p => p !== currentPlayerName);
                }
                if (!matchTeammates.includes(selectedTeammate)) return false;
            }

            return true;
        });

        renderMatches(filteredMatches);
    }

    // Function to clear all filters
    function clearFilters() {
        outcomeFilter.value = 'all';
        gameTypeFilter.value = 'all';
        opponentFilter.value = 'all';
        teammateFilter.value = 'all'; // NEW: Clear teammate filter
        applyFilters(); // Re-apply filters to show all matches
    }

    // --- END: Functions defined within DOMContentLoaded for correct scope ---

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
     * Also populates the filter options.
     */
    async function loadMatchHistory() {
        hideMessage('matchHistoryErrorMessage');
        showMessage('matchHistoryErrorMessage', 'Loading match history...', 'info');

        const urlParams = new URLSearchParams(window.location.search);
        currentPlayerName = decodeURIComponent(urlParams.get('playerName')); // Set global player name

        if (!currentPlayerName) {
            showMessage('matchHistoryErrorMessage', 'Player name not found in URL. Cannot load match history.', 'error');
            return;
        }

        // Set the main header and player name display
        document.getElementById('mainHeader').textContent = `Match History`;
        document.getElementById('matchHistoryPlayerName').textContent = `${currentPlayerName}'s Match History`;

        // Set the "Back to Player Profile" link
        const backToProfileLink = document.getElementById('backToProfileLink');
        if (backToProfileLink) {
            backToProfileLink.href = `playerProfile.html?playerName=${encodeURIComponent(currentPlayerName)}`;
        }

        try {
            const allMatchesRef = collection(db, MATCHES_COLLECTION_PATH);
            const q = query(
                allMatchesRef,
                where('players', 'array-contains', currentPlayerName), // Filter by player name in the 'players' array
                orderBy('timestamp', 'desc')
            );
            const matchesSnapshot = await getDocs(q);
            allMatches = matchesSnapshot.docs.map(doc => {
                // Attach a computed 'playerOutcome' for easier filtering
                let outcome = 'N/A';
                if (doc.data().gameType === '1v1') {
                    if (doc.data().winner === currentPlayerName) outcome = 'win';
                    else if (doc.data().loser === currentPlayerName) outcome = 'loss';
                } else if (doc.data().gameType === '2v2') {
                    if (doc.data().winningTeam && doc.data().winningTeam.includes(currentPlayerName)) outcome = 'win';
                    else if (doc.data().losingTeam && doc.data().losingTeam.includes(currentPlayerName)) outcome = 'loss';
                }
                return { ...doc.data(), playerOutcome: outcome };
            });

            // Populate opponent and teammate filter options
            populatePlayerFilters(allMatches); // Renamed from populateOpponentFilter

            // Render all matches initially
            renderMatches(allMatches);

        } catch (error) {
            console.error("Error fetching match history:", error);
            showMessage('matchHistoryErrorMessage', `Error loading match history: ${error.message}. Please ensure the necessary Firebase index is created.`, 'error');
        }
    }

    // Event Listeners for filters
    filterButton.addEventListener('click', () => {
        filterControls.classList.toggle('hidden');
    });

    applyFiltersButton.addEventListener('click', applyFilters);
    clearFiltersButton.addEventListener('click', clearFilters);
});