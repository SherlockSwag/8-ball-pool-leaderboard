// public/js/allMatches.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import your local firebase-config.js
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js'; 

let db;
let auth;
let currentUserId = null; // To store authenticated user ID
let allMatches = []; // Store the full match history here for filtering

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
            throw new new Error("Firebase configuration 'projectId' is missing. Cannot initialize Firebase.");
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

    // Firestore collection path for matches
    const MATCHES_COLLECTION_PATH = `artifacts/${appId}/public/data/matches`;

    // Get filter elements
    const filterButton = document.getElementById('filterButton');
    const filterControls = document.getElementById('filterControls');
    const gameTypeFilter = document.getElementById('gameTypeFilter');
    const winnerFilter = document.getElementById('winnerFilter'); // NEW
    const loserFilter = document.getElementById('loserFilter');   // NEW
    const dateFilter = document.getElementById('dateFilter');     // NEW
    const applyFiltersButton = document.getElementById('applyFiltersButton');
    const clearFiltersButton = document.getElementById('clearFiltersButton');

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
                    <td colspan="5" class="py-3 px-4 text-center text-sm text-gray-400">No matches found with current filters.</td>
                </tr>
            `;
            return;
        }

        matchesToRender.forEach(match => {
            // Determine the display date from match.date string
            let displayDate = 'N/A';
            if (match.date && typeof match.date === 'string') {
                const parsedDate = new Date(match.date + 'T00:00:00'); // Add T00:00:00 to ensure UTC interpretation and avoid timezone issues
                if (!isNaN(parsedDate.getTime())) {
                    displayDate = parsedDate.toLocaleDateString('en-GB'); // Changed to DD/MM/YYYY format
                } else {
                    console.warn('Invalid date string in match.date:', match.date);
                }
            } else {
                 console.warn('Match object missing "date" field or invalid format for date string for date display:', match);
            }

            // Determine the display time from match.timestamp
            let displayTime = 'N/A';
            let timestampDateObject; // A Date object derived from match.timestamp
            if (match.timestamp) {
                if (typeof match.timestamp.toDate === 'function') {
                    // Firebase Timestamp object
                    timestampDateObject = match.timestamp.toDate();
                } else if (match.timestamp instanceof Date) {
                    // Already a Date object
                    timestampDateObject = match.timestamp;
                } else if (typeof match.timestamp === 'number') {
                    // Unix timestamp number
                    timestampDateObject = new Date(match.timestamp);
                } else {
                    console.warn('Unexpected timestamp format for match.timestamp for time extraction:', match.timestamp);
                }

                if (timestampDateObject && !isNaN(timestampDateObject.getTime())) {
                    displayTime = timestampDateObject.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            } else {
                console.warn('Match object missing "timestamp" field for time extraction:', match);
            }

            const gameType = match.gameType ? match.gameType.toUpperCase() : 'N/A';
            
            let winners = 'N/A';
            let losers = 'N/A';

            if (match.gameType === '1v1') {
                winners = match.winner || 'N/A';
                losers = match.loser || 'N/A';
            } else if (match.gameType === '2v2') {
                winners = (match.winningTeam && match.winningTeam.length > 0) ? match.winningTeam.join(', ') : 'N/A';
                losers = (match.losingTeam && match.losingTeam.length > 0) ? match.losingTeam.join(', ') : 'N/A';
            }

            const row = `
                <tr class="border-b border-gray-200 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500">
                    <td class="py-2 px-4 text-sm text-gray-200">${displayDate}</td>
                    <td class="py-2 px-4 text-sm text-gray-200">${displayTime}</td>
                    <td class="py-2 px-4 text-sm text-gray-200">${gameType}</td>
                    <td class="py-2 px-4 text-sm text-green-300 font-semibold">${winners}</td>
                    <td class="py-2 px-4 text-sm text-red-300 font-semibold">${losers}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
        hideMessage('matchHistoryErrorMessage'); // Hide loading message once rendered
    }

    // Function to populate the winner and loser filter dropdowns
    function populateFilterOptions(matches) {
        const uniqueWinners = new Set();
        const uniqueLosers = new Set();

        matches.forEach(match => {
            if (match.gameType === '1v1') {
                if (match.winner) uniqueWinners.add(match.winner);
                if (match.loser) uniqueLosers.add(match.loser);
            } else if (match.gameType === '2v2') {
                if (match.winningTeam && Array.isArray(match.winningTeam)) {
                    match.winningTeam.forEach(p => uniqueWinners.add(p));
                }
                if (match.losingTeam && Array.isArray(match.losingTeam)) {
                    match.losingTeam.forEach(p => uniqueLosers.add(p));
                }
            }
        });

        // Populate Winner Filter
        winnerFilter.innerHTML = '<option value="all">Any Winner</option>';
        Array.from(uniqueWinners).sort().forEach(player => {
            const option = document.createElement('option');
            option.value = player;
            option.textContent = player;
            winnerFilter.appendChild(option);
        });

        // Populate Loser Filter
        loserFilter.innerHTML = '<option value="all">Any Loser</option>';
        Array.from(uniqueLosers).sort().forEach(player => {
            const option = document.createElement('option');
            option.value = player;
            option.textContent = player;
            loserFilter.appendChild(option);
        });
    }

    // Function to apply filters
    function applyFilters() {
        const selectedGameType = gameTypeFilter.value;
        const selectedWinner = winnerFilter.value;
        const selectedLoser = loserFilter.value;
        const selectedDateStr = dateFilter.value; // Format 'YYYY-MM-DD'
        const selectedDate = selectedDateStr ? new Date(selectedDateStr) : null;
        if (selectedDate) selectedDate.setHours(0, 0, 0, 0); // Normalize to start of day

        const filteredMatches = allMatches.filter(match => {
            // Filter by Game Type
            if (selectedGameType !== 'all' && match.gameType.toLowerCase() !== selectedGameType.toLowerCase()) {
                return false;
            }

            // Filter by Winner
            if (selectedWinner !== 'all') {
                let matchWinners = [];
                if (match.gameType === '1v1' && match.winner) {
                    matchWinners.push(match.winner);
                } else if (match.gameType === '2v2' && match.winningTeam) {
                    matchWinners.push(...match.winningTeam);
                }
                if (!matchWinners.includes(selectedWinner)) {
                    return false;
                }
            }

            // Filter by Loser
            if (selectedLoser !== 'all') {
                let matchLosers = [];
                if (match.gameType === '1v1' && match.loser) {
                    matchLosers.push(match.loser);
                } else if (match.gameType === '2v2' && match.losingTeam) {
                    matchLosers.push(...match.losingTeam);
                }
                if (!matchLosers.includes(selectedLoser)) {
                    return false;
                }
            }

            // Filter by Date (on or after selected date)
            if (selectedDate) {
                let matchDate;
                if (match.timestamp && typeof match.timestamp.toDate === 'function') {
                    matchDate = match.timestamp.toDate();
                } else if (match.timestamp instanceof Date) {
                    matchDate = match.timestamp;
                } else if (typeof match.timestamp === 'number') {
                    matchDate = new Date(match.timestamp);
                } else {
                    return false; // Cannot filter if date is invalid or missing
                }
                matchDate.setHours(0, 0, 0, 0); // Normalize match date to start of day

                if (matchDate < selectedDate) {
                    return false;
                }
            }

            return true;
        });

        renderMatches(filteredMatches);
    }

    // Function to clear all filters
    function clearFilters() {
        gameTypeFilter.value = 'all';
        winnerFilter.value = 'all';
        loserFilter.value = 'all';
        dateFilter.value = ''; // Clear date input
        applyFilters(); // Re-apply filters to show all matches
    }

    // Authenticate user
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            console.log("Authenticated with Firebase UID:", currentUserId);
            await loadAllMatchesHistory(); // Load match history after auth
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
     * Loads and displays all match history from the database.
     * Also populates the filter options.
     */
    async function loadAllMatchesHistory() {
        hideMessage('matchHistoryErrorMessage');
        showMessage('matchHistoryErrorMessage', 'Loading all match history...', 'info');

        try {
            const allMatchesRef = collection(db, MATCHES_COLLECTION_PATH);
            const q = query(
                allMatchesRef,
                orderBy('timestamp', 'desc') // No 'where' clause for a specific player
            );
            const matchesSnapshot = await getDocs(q);
            allMatches = matchesSnapshot.docs.map(doc => ({ ...doc.data() }));

            // Populate filter options (winners, losers)
            populateFilterOptions(allMatches);

            // Render all matches initially
            renderMatches(allMatches);

        } catch (error) {
            console.error("Error fetching all match history:", error);
            showMessage('matchHistoryErrorMessage', `Error loading all match history: ${error.message}. Please ensure the necessary Firebase index is created.`, 'error');
        }
    }

    // Event Listeners for filters
    filterButton.addEventListener('click', () => {
        filterControls.classList.toggle('hidden');
    });

    applyFiltersButton.addEventListener('click', applyFilters);
    clearFiltersButton.addEventListener('click', clearFilters);
});