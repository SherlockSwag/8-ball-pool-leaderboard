// playerProfile.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import your local firebase-config.js
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js';

let db;
let auth;
let currentUserId = null;
let currentPlayerName = null; // To store the player name being viewed

// Determine the final firebaseConfig to use: Canvas-provided or local fallback
let finalFirebaseConfig = {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'local-pool-tracker-app'; // Fallback ID for local testing

try {
    // Prefer Canvas-provided config if it's a valid non-empty string
    if (typeof __firebase_config === 'string' && __firebase_config.trim().length > 0) {
        finalFirebaseConfig = JSON.parse(__firebase_config);
        console.log("playerProfile.js: Using Canvas-provided Firebase config.");
    } else {
        // Fallback to locally imported config
        finalFirebaseConfig = localFirebaseConfig;
        console.warn("playerProfile.js: Runtime variable '__firebase_config' is not valid or empty. Using local 'firebase-config.js'.");
        if (finalFirebaseConfig.projectId === "YOUR_FIREBASE_PROJECT_ID") {
            console.warn("playerProfile.js: Using placeholder Firebase Project ID from local firebase-config.js. Please update it!");
        }
    }
    initializeApp(finalFirebaseConfig);
    db = getFirestore();
    auth = getAuth();
    console.log("playerProfile.js: Firebase initialized in playerProfile.js");
} catch (e) {
    console.error("playerProfile.js: Failed to initialize Firebase:", e);
    // You might want to show a user-friendly error message on the page
}

// Define the correct collection path for players
const PLAYERS_COLLECTION_PATH = `artifacts/${appId}/public/data/players`;
// Define the correct collection path for matches
const MATCHES_COLLECTION_PATH = `artifacts/${appId}/public/data/matches`;


// --- Helper function to display messages ---
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `p-3 rounded-lg text-sm text-center mt-4 ${
            type === 'error' ? 'bg-red-700 text-white' :
            type === 'success' ? 'bg-green-600 text-white' :
            'bg-blue-600 text-white'
        }`;
        element.classList.remove('hidden');
    }
}

// --- Helper function to hide messages ---
function hideMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('hidden');
        element.textContent = ''; // Clear text content when hidden
    }
}

// --- Main function to fetch and render player profile ---
async function fetchAndRenderPlayerProfile() {
    console.log("playerProfile.js: fetchAndRenderPlayerProfile called.");

    // Get references to all the elements that will display data
    const playerAvatar = document.getElementById('playerAvatar');
    const playerNameDisplay = document.getElementById('playerNameDisplay');
    const totalGamesPlayed = document.getElementById('totalGamesPlayed');
    const totalWinsLosses = document.getElementById('totalWinsLosses');
    const overallWinRate = document.getElementById('overallWinRate');
    const longestWinStreak = document.getElementById('longestWinStreak');
    const longestLosingStreak = document.getElementById('longestLosingStreak');
    const currentStreak = document.getElementById('currentStreak');
    const games1v1 = document.getElementById('games1v1');
    const winsLosses1v1 = document.getElementById('winsLosses1v1');
    const winRate1v1 = document.getElementById('winRate1v1');
    const games2v2 = document.getElementById('games2v2');
    const winsLosses2v2 = document.getElementById('winsLosses2v2');
    const winRate2v2 = document.getElementById('winRate2v2');
    const playerProfileLoadingMessage = document.getElementById('playerProfileLoadingMessage');

    // Show loading message initially and clear previous messages
    if (playerProfileLoadingMessage) playerProfileLoadingMessage.classList.remove('hidden');
    hideMessage('profileErrorMessage');
    hideMessage('profileSuccessMessage');

    if (!currentPlayerName) {
        console.warn("playerProfile.js: currentPlayerName is null or empty.");
        showMessage('profileErrorMessage', 'Player name not found in URL. Please ensure the link from the leaderboard includes "?playerName=PlayerName".', 'error');
        if (playerProfileLoadingMessage) playerProfileLoadingMessage.classList.add('hidden');
        // Set all elements to N/A or default if player name is missing
        if (playerAvatar) playerAvatar.src = "https://placehold.co/96x96/4299E1/FFFFFF?text=?";
        if (playerNameDisplay) playerNameDisplay.textContent = 'Player not found.';
        if (totalGamesPlayed) totalGamesPlayed.textContent = 'N/A';
        if (totalWinsLosses) totalWinsLosses.textContent = 'N/A';
        if (overallWinRate) overallWinRate.textContent = 'N/A';
        if (longestWinStreak) longestWinStreak.textContent = 'N/A';
        if (longestLosingStreak) longestLosingStreak.textContent = 'N/A';
        if (currentStreak) currentStreak.textContent = 'N/A';
        if (games1v1) games1v1.textContent = 'N/A';
        if (winsLosses1v1) winsLosses1v1.textContent = 'N/A';
        if (winRate1v1) winRate1v1.textContent = 'N/A';
        if (games2v2) games2v2.textContent = 'N/A';
        if (winsLosses2v2) winsLosses2v2.textContent = 'N/A';
        if (winRate2v2) winRate2v2.textContent = 'N/A';
        renderRivalries({}); // Clear tables
        renderPartnerships({}); // Clear tables
        return;
    }

    console.log(`playerProfile.js: Attempting to fetch player: "${currentPlayerName}" from Firestore at path: "${PLAYERS_COLLECTION_PATH}".`);
    try {
        const playerDocRef = doc(db, PLAYERS_COLLECTION_PATH, currentPlayerName);
        const playerDocSnap = await getDoc(playerDocRef);

        if (playerDocSnap.exists()) {
            const playerData = playerDocSnap.data();
            console.log("playerProfile.js: Player data fetched successfully:", playerData);

            // Calculate overall stats
            const totalGames = (playerData.wins || 0) + (playerData.losses || 0);
            const overallWinRateValue = totalGames > 0 ? ((playerData.wins / totalGames) * 100).toFixed(1) : 0;

            // Calculate 1v1 stats
            const wins1v1 = playerData.wins1v1 || 0;
            const losses1v1 = playerData.losses1v1 || 0;
            const games1v1Total = wins1v1 + losses1v1;
            const winRate1v1Value = games1v1Total > 0 ? ((wins1v1 / games1v1Total) * 100).toFixed(1) : 0;

            // Calculate 2v2 stats
            const wins2v2 = playerData.wins2v2 || 0;
            const losses2v2 = playerData.losses2v2 || 0;
            const games2v2Total = wins2v2 + losses2v2;
            const winRate2v2Value = games2v2Total > 0 ? ((wins2v2 / games2v2Total) * 100).toFixed(1) : 0;

            // Update player avatar
            if (playerAvatar) {
                playerAvatar.src = playerData.profilePicUrl || `https://placehold.co/96x96/4299E1/FFFFFF?text=${encodeURIComponent(playerData.name ? playerData.name.charAt(0).toUpperCase() : '?')}`;
            }

            // Update main player details
            if (playerNameDisplay) playerNameDisplay.textContent = playerData.name || 'Unknown Player';
            if (totalGamesPlayed) totalGamesPlayed.textContent = totalGames;
            if (totalWinsLosses) totalWinsLosses.textContent = `${playerData.wins || 0}W / ${playerData.losses || 0}L`;
            if (overallWinRate) overallWinRate.textContent = `${overallWinRateValue}%`;

            // Update streaks
            if (longestWinStreak) longestWinStreak.textContent = playerData.longestWinStreak || 0;
            if (longestLosingStreak) longestLosingStreak.textContent = playerData.longestLosingStreak || 0;
            if (currentStreak) {
                const streakValue = playerData.streak !== undefined ? playerData.streak : 0;
                const streakText = streakValue >= 0 ? `${streakValue} Wins` : `${Math.abs(streakValue)} Losses`;
                currentStreak.textContent = streakText;
            }

            // Update 1v1 stats
            if (games1v1) games1v1.textContent = games1v1Total;
            if (winsLosses1v1) winsLosses1v1.textContent = `${wins1v1}W / ${losses1v1}L`;
            if (winRate1v1) winRate1v1.textContent = `${winRate1v1Value}%`;

            // Update 2v2 stats
            if (games2v2) games2v2.textContent = games2v2Total;
            if (winsLosses2v2) winsLosses2v2.textContent = `${wins2v2}W / ${losses2v2}L`;
            if (winRate2v2) winRate2v2.textContent = `${winRate2v2Value}%`;

            // Hide loading message
            if (playerProfileLoadingMessage) playerProfileLoadingMessage.classList.add('hidden');

            // Populate rivalry table
            renderRivalries(playerData.rivalries || {});
            // Populate partnerships table
            renderPartnerships(playerData.partnerships || {});

        } else {
            // Player not found in Firestore
            console.warn(`playerProfile.js: Player document "${currentPlayerName}" does not exist in Firestore at path: "${PLAYERS_COLLECTION_PATH}".`);
            if (playerProfileLoadingMessage) playerProfileLoadingMessage.classList.add('hidden');
            showMessage('profileErrorMessage', `Player "${currentPlayerName}" not found in the database.`, 'error');
            // Set all elements to "N/A" or "Not found"
            if (playerAvatar) playerAvatar.src = "https://placehold.co/96x96/4299E1/FFFFFF?text=?";
            if (playerNameDisplay) playerNameDisplay.textContent = `Player "${currentPlayerName}" not found.`;
            if (totalGamesPlayed) totalGamesPlayed.textContent = 'N/A';
            if (totalWinsLosses) totalWinsLosses.textContent = 'N/A';
            if (overallWinRate) overallWinRate.textContent = 'N/A';
            if (longestWinStreak) longestWinStreak.textContent = 'N/A';
            if (longestLosingStreak) longestLosingStreak.textContent = 'N/A';
            if (currentStreak) currentStreak.textContent = 'N/A';
            if (games1v1) games1v1.textContent = 'N/A';
            if (winsLosses1v1) winsLosses1v1.textContent = 'N/A';
            if (winRate1v1) winRate1v1.textContent = 'N/A';
            if (games2v2) games2v2.textContent = 'N/A';
            if (winsLosses2v2) winsLosses2v2.textContent = 'N/A';
            if (winRate2v2) winRate2v2.textContent = 'N/A';
            renderRivalries({}); // Clear tables
            renderPartnerships({}); // Clear tables
        }
    } catch (error) {
        console.error("playerProfile.js: Error fetching player profile:", error);
        if (playerProfileLoadingMessage) playerProfileLoadingMessage.classList.add('hidden');
        showMessage('profileErrorMessage', `Error loading player profile: ${error.message}`, 'error');
        // Set all elements to "Error" or "N/A"
        if (playerAvatar) playerAvatar.src = "https://placehold.co/96x96/4299E1/FFFFFF?text=!";
        if (playerNameDisplay) playerNameDisplay.textContent = 'Error loading player data.';
        if (totalGamesPlayed) totalGamesPlayed.textContent = 'N/A';
        if (totalWinsLosses) totalWinsLosses.textContent = 'N/A';
        if (overallWinRate) overallWinRate.textContent = 'N/A';
        if (longestWinStreak) longestWinStreak.textContent = 'N/A';
        if (longestLosingStreak) longestLosingStreak.textContent = 'N/A';
        if (currentStreak) currentStreak.textContent = 'N/A';
        if (games1v1) games1v1.textContent = 'N/A';
        if (winsLosses1v1) winsLosses1v1.textContent = 'N/A';
        if (winRate1v1) winRate1v1.textContent = 'N/A';
        if (games2v2) games2v2.textContent = 'N/A';
        if (winsLosses2v2) winsLosses2v2.textContent = 'N/A';
        if (winRate2v2) winRate2v2.textContent = 'N/A';
        renderRivalries({}); // Clear tables
        renderPartnerships({}); // Clear tables
    }
}

// Function to render Rivalries
function renderRivalries(rivalries) {
    const rivalriesTableBody = document.getElementById('rivalriesTableBody');
    const noRivalriesMessage = document.getElementById('noRivalriesMessage');
    rivalriesTableBody.innerHTML = ''; // Clear previous content

    const rivalryNames = Object.keys(rivalries);
    if (rivalryNames.length === 0) {
        noRivalriesMessage.classList.remove('hidden');
        // Add a placeholder row if no rivalries
        rivalriesTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-4 text-center text-sm text-gray-400">No rivalries to display yet.</td></tr>`;
        return;
    } else {
        noRivalriesMessage.classList.add('hidden');
    }

    rivalryNames.sort((a, b) => {
        const totalGamesA = (rivalries[a].wins || 0) + (rivalries[a].losses || 0);
        const totalGamesB = (rivalries[b].wins || 0) + (rivalries[b].losses || 0);
        return totalGamesB - totalGamesA; // Sort by total games descending
    }).forEach(rivalName => {
        const rivalData = rivalries[rivalName];
        const rivalWins = rivalData.wins || 0;
        const rivalLosses = rivalData.losses || 0;
        const totalRivalGames = rivalWins + rivalLosses;
        const rivalWinRate = totalRivalGames > 0 ? ((rivalWins / totalRivalGames) * 100).toFixed(1) : 0;

        const row = `
            <tr class="border-b border-gray-700 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500">
                <td class="py-2 px-4 text-sm text-gray-200">
                    <a href="playerProfile.html?playerName=${encodeURIComponent(rivalName)}" class="text-blue-300 hover:text-blue-100 font-medium">
                        ${rivalName}
                    </a>
                </td>
                <td class="py-2 px-4 text-center text-sm text-green-300 font-medium">${rivalWins}</td>
                <td class="py-2 px-4 text-center text-sm text-red-300 font-medium">${rivalLosses}</td>
                <td class="py-2 px-4 text-center text-sm text-purple-300 font-medium">${rivalWinRate}%</td>
            </tr>
        `;
        rivalriesTableBody.innerHTML += row;
    });
}

// Function to render Partnerships
function renderPartnerships(partnerships) {
    const partnershipsTableBody = document.getElementById('partnershipsTableBody');
    const noPartnershipsMessage = document.getElementById('noPartnershipsMessage');
    partnershipsTableBody.innerHTML = ''; // Clear previous content

    const partnershipNames = Object.keys(partnerships);
    if (partnershipNames.length === 0) {
        noPartnershipsMessage.classList.remove('hidden');
        // Add a placeholder row if no partnerships
        partnershipsTableBody.innerHTML = `<tr><td colspan="3" class="py-3 px-4 text-center text-sm text-gray-400">No partnerships to display yet.</td></tr>`;
        return;
    } else {
        noPartnershipsMessage.classList.add('hidden');
    }

    partnershipNames.sort((a, b) => {
        const totalGamesA = (partnerships[a].wins || 0) + (partnerships[a].losses || 0);
        const totalGamesB = (partnerships[b].wins || 0) + (partnerships[b].losses || 0);
        return totalGamesB - totalGamesA; // Sort by total games descending
    }).forEach(partnerName => {
        const partnerData = partnerships[partnerName];
        const partnerWins = partnerData.wins || 0;
        const partnerLosses = partnerData.losses || 0;
        const row = `
            <tr class="border-b border-gray-700 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500">
                <td class="py-2 px-4 text-sm text-gray-200">
                    <a href="playerProfile.html?playerName=${encodeURIComponent(partnerName)}" class="text-blue-300 hover:text-blue-100 font-medium">
                        ${partnerName}
                    </a>
                </td>
                <td class="py-2 px-4 text-center text-sm text-green-300 font-medium">${partnerWins}</td>
                <td class="py-2 px-4 text-center text-sm text-red-300 font-medium">${partnerLosses}</td>
            </tr>
        `;
        partnershipsTableBody.innerHTML += row;
    });
}

// --- INITIALIZATION ON PAGE LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("playerProfile.js: DOMContentLoaded fired.");

    // Extract player name from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    currentPlayerName = urlParams.get('playerName');
    console.log(`playerProfile.js: Extracted playerName from URL: "${currentPlayerName}"`);

    // Event listener for "View All Match History" link
    const viewMatchHistoryLink = document.getElementById('viewMatchHistoryLink');
    if (viewMatchHistoryLink) {
        viewMatchHistoryLink.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default link behavior
            if (currentPlayerName) {
                console.log(`playerProfile.js: Navigating to match history for ${currentPlayerName}`);
                window.location.href = `matchHistory.html?playerName=${encodeURIComponent(currentPlayerName)}`;
            } else {
                showMessage('profileErrorMessage', 'No player selected to view match history.', 'error');
            }
        });
    }

    // Authenticate user and then fetch profile
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Sign in anonymously if no user is authenticated
            try {
                await signInAnonymously(auth);
                console.log("playerProfile.js: Signed in anonymously.");
                fetchAndRenderPlayerProfile(); // Call after successful sign-in to ensure context
            } catch (error) {
                console.error("playerProfile.js: Error signing in anonymously:", error);
                showMessage('profileErrorMessage', `Authentication error: ${error.message}`, 'error');
            }
        } else {
            currentUserId = user.uid;
            console.log("playerProfile.js: Existing user detected:", currentUserId);
            fetchAndRenderPlayerProfile(); // Call if already signed in
        }
    });
});