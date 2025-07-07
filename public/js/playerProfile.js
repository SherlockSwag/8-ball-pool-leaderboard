// playerProfile.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, query, orderBy, limit, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import your local firebase-config.js
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js';

let db;
let auth;
let currentUserId = null;
let currentPlayerName = null; // To store the player name being viewed

// --- Constants for Firestore Collection Paths ---
// Ensure these match your actual Firestore structure
const PLAYERS_COLLECTION_PATH = 'artifacts/local-pool-tracker-app/public/data/players';
const MATCHES_COLLECTION_PATH = 'artifacts/local-pool-tracker-app/public/data/matches'; // Assuming matches are in a similar public path

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
            console.error("playerProfile.js: Firebase is using placeholder 'YOUR_FIREBASE_PROJECT_ID'. Please update firebase-config.js with your actual Firebase project ID.");
            showMessage('profileErrorMessage', 'Firebase is not correctly configured. Please check console.', 'error');
        }
    }
    initializeApp(finalFirebaseConfig);
    db = getFirestore();
    auth = getAuth();
    console.log("playerProfile.js: Firebase initialized in playerProfile.js");
} catch (error) {
    console.error("playerProfile.js: Error initializing Firebase:", error);
    showMessage('profileErrorMessage', `Failed to initialize Firebase: ${error.message}`, 'error');
}

// Helper function to display messages
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `p-3 rounded-md text-center text-sm mt-4 ${type === 'error' ? 'bg-red-800 text-white' : type === 'info' ? 'bg-blue-800 text-white' : 'bg-green-800 text-white'}`;
        element.classList.remove('hidden');
    }
}

function hideMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('hidden');
        element.textContent = ''; // Clear text when hidden
    }
}

// --- NEW: Utility function to format dates (YYYY-MM-DD string) ---
function formatDate(dateString) {
    if (!dateString) return '';
    try {
        // Assuming dateString is "YYYY-MM-DD"
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day); // Month is 0-indexed

        // Changed to 'en-GB' locale to get DD/MM/YYYY format by default
        // and specified options for 2-digit day and month, and full year
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        console.warn('Error formatting date string:', dateString, e);
        return dateString; // Return original string if formatting fails
    }
}

// --- NEW: Utility function to navigate to player profile ---
// This function needs to be correctly implemented to navigate to another player's profile page.
function navigateToPlayerProfile(playerName) {
    // Example: Redirect to the player profile page with the player's name as a URL parameter
    window.location.href = `playerProfile.html?playerName=${encodeURIComponent(playerName)}`;
    console.log(`Navigating to profile of: ${playerName}`);
}

// --- NEW: Utility function to navigate to full match history page ---
function navigateToMatchHistoryPage(playerName) {
    console.log(`Navigating to full match history for: ${playerName}`);
    // Example: Redirect to a dedicated match history page
    window.location.href = `matchHistory.html?playerName=${encodeURIComponent(playerName)}`;
}

// --- CORRECTED: Helper function to get players' names HTML (Opponent/Teammate) ---
function getPlayersHtml(match, currentPlayerName, gameType) {
    let html = '';
    if (gameType === '1v1') {
        const opponent = match.players.find(p => p !== currentPlayerName);
        // Ensure opponent is found before creating link
        if (opponent) {
            html = `<span class="text-blue-400 cursor-pointer hover:underline" onclick="navigateToPlayerProfile('${opponent}')">${opponent}</span>`;
        } else {
            html = `<span class="text-gray-500">N/A</span>`;
        }
    } else if (gameType === '2v2') {
        // Determine teammates and opponents based on who is the currentPlayer
        const teammates = (match.winningTeam && match.winningTeam.includes(currentPlayerName)) ?
                            match.winningTeam.filter(p => p !== currentPlayerName) :
                            (match.losingTeam && match.losingTeam.includes(currentPlayerName)) ?
                            match.losingTeam.filter(p => p !== currentPlayerName) : [];

        // Opponents are any players in the match who are not the current player or their teammates
        const allMatchPlayersExceptSelf = match.players.filter(p => p !== currentPlayerName);
        const opponents = allMatchPlayersExceptSelf.filter(p => !teammates.includes(p));

        html += `<span class="text-gray-400">With: </span>`;
        if (teammates.length > 0) {
            html += teammates.map(t => `<span class="text-purple-400 cursor-pointer hover:underline" onclick="navigateToPlayerProfile('${t}')">${t}</span>`).join(', ');
        } else {
            html += `<span class="text-gray-500">N/A</span>`; // Should ideally not happen if teams are correctly structured
        }
        
        html += `<br><span class="text-gray-400">Vs: </span>`;
        if (opponents.length > 0) {
            html += opponents.map(o => `<span class="text-blue-400 cursor-pointer hover:underline" onclick="navigateToPlayerProfile('${o}')">${o}</span>`).join(', ');
        } else {
            html += `<span class="text-gray-500">N/A</span>`;
        }
    }
    return html;
}


// --- NEW: Helper function to render a single match table (for 1v1 or 2v2) ---
function renderMatchTable(matches, tableBodyElement, currentPlayerName, gameType) {
    tableBodyElement.innerHTML = ''; // Clear existing rows (including "No matches" placeholder)

    // IMPORTANT: Adjusted colspan to 3 (Date, Players, Result) instead of 4
    if (matches.length === 0) {
        tableBodyElement.innerHTML = `<tr><td colspan="3" class="py-3 px-4 text-center text-gray-400">No ${gameType} recent matches.</td></tr>`;
        return;
    }

    matches.forEach(match => {
        const row = tableBodyElement.insertRow();
        row.className = 'border-b border-gray-600 last:border-b-0';

        // Date Cell
        const dateCell = row.insertCell();
        dateCell.className = 'py-3 px-4 text-left text-gray-300 whitespace-nowrap';
        dateCell.textContent = formatDate(match.date); // Use your updated formatDate function

        // Opponent/Teammate(s) Cell
        const playersCell = row.insertCell();
        playersCell.className = 'py-3 px-4 text-left text-gray-300';
        playersCell.innerHTML = getPlayersHtml(match, currentPlayerName, gameType);

        // Result Cell (Win/Loss with color)
        const resultCell = row.insertCell();
        resultCell.className = 'py-3 px-4 text-center';
        // Determine if current player won
        const isWinner = (gameType === '1v1' && match.winner === currentPlayerName) ||
                             (gameType === '2v2' && match.winningTeam && match.winningTeam.includes(currentPlayerName));
        resultCell.innerHTML = `<span class="${isWinner ? 'text-green-400' : 'text-red-400'} font-semibold">${isWinner ? 'Win' : 'Loss'}</span>`;

        // --- REMOVED: Score Cell creation lines ---
        // const scoreCell = row.insertCell();
        // scoreCell.className = 'py-3 px-4 text-center text-gray-300';
        // scoreCell.textContent = match.score || '-';
    });
}

// --- NEW: Main function to fetch and render recent matches ---
// Function to fetch and render recent matches (already updated in previous steps)
async function fetchAndRenderRecentMatches(playerName) {
    const recentMatchesCard = document.getElementById('recentMatchesCard');
    const recent1v1MatchesTableBody = document.getElementById('recent1v1MatchesTableBody');
    const recent2v2MatchesTableBody = document.getElementById('recent2v2MatchesTableBody');
    const viewAllMatchHistoryBtn = document.getElementById('viewAllMatchHistoryBtn');

    if (!recentMatchesCard || !recent1v1MatchesTableBody || !recent2v2MatchesTableBody || !playerName) {
        console.error("Required HTML elements or player name not found for recent matches card. Card will remain hidden.");
        if (recentMatchesCard) recentMatchesCard.classList.add('hidden');
        return;
    }

    recent1v1MatchesTableBody.innerHTML = '<tr><td colspan="3" class="py-3 px-4 text-center text-gray-400">Loading 1v1 matches...</td></tr>';
    recent2v2MatchesTableBody.innerHTML = '<tr><td colspan="3" class="py-3 px-4 text-center text-gray-400">Loading 2v2 matches...</td></tr>';
    recentMatchesCard.classList.remove('hidden'); // Make the card visible for loading state

    try {
        const matchesRef = collection(db, MATCHES_COLLECTION_PATH);
        const q = query(
            matchesRef,
            where('players', 'array-contains', playerName),
            orderBy('date', 'desc'),
            limit(20) // Fetch up to 20 recent matches to filter locally
        );
        const querySnapshot = await getDocs(q);

        const allRecentMatches = [];
        querySnapshot.forEach((doc) => {
            allRecentMatches.push({ id: doc.id, ...doc.data() });
        });

        const recent1v1Matches = allRecentMatches.filter(match => match.gameType === '1v1').slice(0, 5); // Get top 5 1v1
        const recent2v2Matches = allRecentMatches.filter(match => match.gameType === '2v2').slice(0, 5); // Get top 5 2v2

        renderMatchTable(recent1v1Matches, recent1v1MatchesTableBody, playerName, '1v1');
        renderMatchTable(recent2v2Matches, recent2v2MatchesTableBody, playerName, '2v2');

        if (viewAllMatchHistoryBtn) {
            viewAllMatchHistoryBtn.onclick = () => navigateToMatchHistoryPage(playerName);
        }

        if (recent1v1Matches.length === 0 && recent2v2Matches.length === 0) {
            console.log("No recent 1v1 or 2v2 matches found for this player.");
            // recentMatchesCard.classList.add('hidden'); // Uncomment to hide the card if completely empty
        }

    } catch (error) {
        console.error("Error fetching or rendering recent matches:", error);
        recent1v1MatchesTableBody.innerHTML = `<tr><td colspan="3" class="py-3 px-4 text-center text-red-400">Error loading 1v1 matches.</td></tr>`;
        recent2v2MatchesTableBody.innerHTML = `<tr><td colspan="3" class="py-3 px-4 text-center text-red-400">Error loading 2v2 matches.</td></tr>`;
        recentMatchesCard.classList.remove('hidden'); 
    }
}


// Helper function to calculate streak (this was already good)
function calculateStreak(matchHistory) {
    if (matchHistory.length === 0) return 'N/A';

    // Ensure matchHistory is sorted from most recent to oldest for correct streak calculation
    const sortedHistory = [...matchHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedHistory.length === 0) return 'N/A';

    let streakCount = 0;
    const firstResult = sortedHistory[0].isWin;
    let streakType = firstResult ? '+' : '-'; // '+' for win streak, '-' for loss streak

    for (let i = 0; i < sortedHistory.length; i++) {
        if (sortedHistory[i].isWin === firstResult) {
            streakCount++;
        } else {
            break; // Streak broken
        }
    }

    return `${streakType}${streakCount} ${firstResult ? 'Wins' : 'Losses'}`;
}

// --- NEW: Function to fetch and render rivalries (already updated) ---
async function fetchAndRenderRivalries(playerName) {
    const rivalriesCard = document.getElementById('rivalriesCard');
    const rivalriesTableBody = document.getElementById('rivalriesTableBody');
    const noRivalriesMessage = document.getElementById('noRivalriesMessage');

    // Initially show card and hide message
    if (rivalriesCard) rivalriesCard.classList.remove('hidden');
    if (noRivalriesMessage) noRivalriesMessage.classList.add('hidden');
    if (rivalriesTableBody) {
        rivalriesTableBody.innerHTML = '<tr><td colspan="6" class="py-3 px-4 text-center text-gray-400">Loading top rivals...</td></tr>'; // Loading message
    }

    try {
        const q = query(
            collection(db, MATCHES_COLLECTION_PATH),
            where('players', 'array-contains', playerName),
            orderBy('date', 'desc') // Important for streak calculation
        );
        const querySnapshot = await getDocs(q);

        const allPlayerMatches = [];
        querySnapshot.forEach((doc) => {
            allPlayerMatches.push({ id: doc.id, ...doc.data() });
        });

        const rivalryStats = {};

        // Process all matches to calculate stats against each opponent
        allPlayerMatches.forEach(match => {
            // Only consider 1v1 and 2v2 where current player is involved
            if (match.gameType === '1v1' || match.gameType === '2v2') {
                let isCurrentPlayerWinner = false;
                if (match.gameType === '1v1') {
                    isCurrentPlayerWinner = (match.winner === playerName);
                } else if (match.gameType === '2v2') {
                    isCurrentPlayerWinner = (match.winningTeam && match.winningTeam.includes(playerName));
                }

                // Identify opponent(s) for rivalry tracking
                const opponentsInMatch = [];
                if (match.gameType === '1v1') {
                    const opponent = match.players.find(p => p !== playerName);
                    if (opponent) {
                        opponentsInMatch.push(opponent);
                    }
                } else if (match.gameType === '2v2') {
                    // Find the opposing team
                    let opposingTeam = [];
                    if (match.winningTeam && !match.winningTeam.includes(playerName)) {
                        opposingTeam = match.winningTeam;
                    } else if (match.losingTeam && !match.losingTeam.includes(playerName)) {
                        opposingTeam = match.losingTeam;
                    }
                    // Add all players from the opposing team as rivals for this match
                    opponentsInMatch.push(...opposingTeam);
                }

                opponentsInMatch.forEach(opponentName => {
                    // Ensure the opponent is not the player themselves (e.g. if their own name appeared in a team incorrectly)
                    if (opponentName === playerName) return;

                    if (!rivalryStats[opponentName]) {
                        rivalryStats[opponentName] = { wins: 0, losses: 0, totalMatches: 0, matchHistory: [] };
                    }

                    if (isCurrentPlayerWinner) {
                        rivalryStats[opponentName].wins++;
                    } else {
                        rivalryStats[opponentName].losses++;
                    }
                    rivalryStats[opponentName].totalMatches++;
                    // Store match result and date for streak calculation, ensures most recent is first
                    // Due to orderBy('date', 'desc') in query, matches are added in correct order for streak calculation
                    rivalryStats[opponentName].matchHistory.push({ date: match.date, isWin: isCurrentPlayerWinner });
                });
            }
        });

        // Convert rivalryStats object to an array, sort by total matches, and get top 5
        const topRivals = Object.entries(rivalryStats)
            .map(([opponentName, stats]) => ({ opponentName, ...stats }))
            .sort((a, b) => b.totalMatches - a.totalMatches) // Sort descending by total matches
            .slice(0, 5); // Get top 5

        if (rivalriesTableBody) rivalriesTableBody.innerHTML = ''; // Clear loading message

        if (topRivals.length === 0) {
            if (noRivalriesMessage) noRivalriesMessage.classList.remove('hidden'); // Show "No rivalries" message
            return;
        }

        // Render the top rivals table
        topRivals.forEach(rival => {
            const row = rivalriesTableBody.insertRow();
            row.className = 'border-b border-gray-700 last:border-b-0 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500'; // Added odd/even/hover colors

            // Opponent Name Cell (Clickable)
            const opponentCell = row.insertCell();
            opponentCell.className = 'py-2 px-4 text-sm text-gray-100 whitespace-nowrap';
            opponentCell.innerHTML = `
                <a href="playerProfile.html?playerName=${encodeURIComponent(rival.opponentName)}" class="flex items-center text-blue-300 hover:text-blue-200 font-semibold transition duration-150 ease-in-out">
                    <img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(rival.opponentName)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffeedc,f4d15b&size=64" alt="${rival.opponentName}" class="w-8 h-8 rounded-full mr-3 border-2 border-orange-500">
                    <span>${rival.opponentName}</span>
                </a>
            `;


            // Win/Loss Line Bar Cell
            const barCell = row.insertCell();
            barCell.className = 'py-2 px-4';
            const total = rival.wins + rival.losses;
            const winPercentage = total > 0 ? (rival.wins / total) * 100 : 0;
            const lossPercentage = total > 0 ? (rival.losses / total) * 100 : 0;
            barCell.innerHTML = `
                <div class="w-full bg-gray-500 rounded-full h-2.5 flex overflow-hidden">
                    <div class="bg-green-500 h-2.5" style="width: ${winPercentage}%"></div>
                    <div class="bg-red-500 h-2.5" style="width: ${lossPercentage}%"></div>
                </div>
            `;

            // Number of Wins Against
            const winsCell = row.insertCell();
            winsCell.className = 'py-2 px-4 text-center text-sm text-green-400 font-semibold';
            winsCell.textContent = `${rival.wins}W`;

            // Number of Losses Against
            const lossesCell = row.insertCell();
            lossesCell.className = 'py-2 px-4 text-center text-sm text-red-400 font-semibold';
            lossesCell.textContent = `${rival.losses}L`;

            // Win Rate Percentage
            const winRateCell = row.insertCell();
            winRateCell.className = 'py-2 px-4 text-center text-sm text-gray-100';
            const winRate = total > 0 ? ((rival.wins / total) * 100).toFixed(1) : 0;
            winRateCell.textContent = `${winRate}%`;

            // Current Streak
            const streakCell = row.insertCell();
            streakCell.className = 'py-2 px-4 text-center text-sm';
            const currentStreak = calculateStreak(rival.matchHistory);
            streakCell.innerHTML = `<span class="${currentStreak.startsWith('+') ? 'text-green-400' : (currentStreak.startsWith('-') ? 'text-red-400' : 'text-gray-400')}">${currentStreak}</span>`;
        });

    } catch (error) {
        console.error("Error fetching or rendering rivalries:", error);
        if (rivalriesTableBody) rivalriesTableBody.innerHTML = ''; // Clear loading
        if (noRivalriesMessage) {
            noRivalriesMessage.classList.remove('hidden'); // Show generic error message
            noRivalriesMessage.textContent = 'Error loading rivalries. Please try again.';
            noRivalriesMessage.classList.remove('text-gray-400');
            noRivalriesMessage.classList.add('text-red-400');
        }
    }
}

// --- NEW: Function to fetch and render partnerships (Modified significantly) ---
async function fetchAndRenderPartnerships(playerName) {
    const partnershipsCard = document.getElementById('partnershipsCard');
    const partnershipsTableBody = document.getElementById('partnershipsTableBody');
    const noPartnershipsMessage = document.getElementById('noPartnershipsMessage');

    // Initially show card and hide message
    if (partnershipsCard) partnershipsCard.classList.remove('hidden');
    if (noPartnershipsMessage) noPartnershipsMessage.classList.add('hidden');
    if (partnershipsTableBody) {
        partnershipsTableBody.innerHTML = '<tr><td colspan="6" class="py-3 px-4 text-center text-gray-400">Loading top partnerships...</td></tr>'; // Loading message
    }

    try {
        const q = query(
            collection(db, MATCHES_COLLECTION_PATH),
            where('players', 'array-contains', playerName),
            orderBy('date', 'desc') // Important for streak calculation
        );
        const querySnapshot = await getDocs(q);

        const allPlayerMatches = [];
        querySnapshot.forEach((doc) => {
            allPlayerMatches.push({ id: doc.id, ...doc.data() });
        });

        const partnershipStats = {};

        // Process all matches to calculate stats for each teammate
        allPlayerMatches.forEach(match => {
            // Only consider 2v2 matches where the current player is involved
            if (match.gameType === '2v2') {
                let isCurrentPlayerWinner = (match.winningTeam && match.winningTeam.includes(playerName));
                
                // Find teammates (players on the same team as currentPlayer)
                let teammatesInMatch = [];
                if (match.winningTeam && match.winningTeam.includes(playerName)) {
                    teammatesInMatch = match.winningTeam.filter(p => p !== playerName);
                } else if (match.losingTeam && match.losingTeam.includes(playerName)) {
                    teammatesInMatch = match.losingTeam.filter(p => p !== playerName);
                }

                teammatesInMatch.forEach(teammateName => {
                    // Ensure the teammate is not the player themselves
                    if (teammateName === playerName) return;

                    if (!partnershipStats[teammateName]) {
                        partnershipStats[teammateName] = { wins: 0, losses: 0, totalMatches: 0, matchHistory: [] };
                    }

                    if (isCurrentPlayerWinner) {
                        partnershipStats[teammateName].wins++;
                    } else {
                        partnershipStats[teammateName].losses++;
                    }
                    partnershipStats[teammateName].totalMatches++;
                    // Store match result and date for streak calculation
                    partnershipStats[teammateName].matchHistory.push({ date: match.date, isWin: isCurrentPlayerWinner });
                });
            }
        });

        // Convert partnershipStats object to an array, sort by total matches, and get top 5
        const topPartnerships = Object.entries(partnershipStats)
            .map(([teammateName, stats]) => ({ teammateName, ...stats }))
            .sort((a, b) => b.totalMatches - a.totalMatches) // Sort descending by total matches
            .slice(0, 5); // Get top 5

        if (partnershipsTableBody) partnershipsTableBody.innerHTML = ''; // Clear loading message

        if (topPartnerships.length === 0) {
            if (noPartnershipsMessage) noPartnershipsMessage.classList.remove('hidden'); // Show "No partnerships" message
            return;
        }

        // Render the top partnerships table
        topPartnerships.forEach(partner => {
            const row = partnershipsTableBody.insertRow();
            row.className = 'border-b border-gray-700 last:border-b-0 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500'; // Added odd/even/hover colors

            // Teammate Name Cell (Clickable)
            const teammateCell = row.insertCell();
            teammateCell.className = 'py-2 px-4 text-sm text-gray-100 whitespace-nowrap';
            teammateCell.innerHTML = `
                <a href="playerProfile.html?playerName=${encodeURIComponent(partner.teammateName)}" class="flex items-center text-blue-300 hover:text-blue-200 font-semibold transition duration-150 ease-in-out">
                    <img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(partner.teammateName)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffeedc,f4d15b&size=64" alt="${partner.teammateName}" class="w-8 h-8 rounded-full mr-3 border-2 border-purple-500">
                    <span>${partner.teammateName}</span>
                </a>
            `;

            // Win/Loss Line Bar Cell
            const barCell = row.insertCell();
            barCell.className = 'py-2 px-4';
            const total = partner.wins + partner.losses;
            const winPercentage = total > 0 ? (partner.wins / total) * 100 : 0;
            const lossPercentage = total > 0 ? (partner.losses / total) * 100 : 0;
            barCell.innerHTML = `
                <div class="w-full bg-gray-500 rounded-full h-2.5 flex overflow-hidden">
                    <div class="bg-green-500 h-2.5" style="width: ${winPercentage}%"></div>
                    <div class="bg-red-500 h-2.5" style="width: ${lossPercentage}%"></div>
                </div>
            `;

            // Number of Wins Together
            const winsCell = row.insertCell();
            winsCell.className = 'py-2 px-4 text-center text-sm text-green-400 font-semibold';
            winsCell.textContent = `${partner.wins}W`;

            // Number of Losses Together
            const lossesCell = row.insertCell();
            lossesCell.className = 'py-2 px-4 text-center text-sm text-red-400 font-semibold';
            lossesCell.textContent = `${partner.losses}L`;

            // Win Rate Percentage
            const winRateCell = row.insertCell();
            winRateCell.className = 'py-2 px-4 text-center text-sm text-gray-100';
            const winRate = total > 0 ? ((partner.wins / total) * 100).toFixed(1) : 0;
            winRateCell.textContent = `${winRate}%`;

            // Current Streak
            const streakCell = row.insertCell();
            streakCell.className = 'py-2 px-4 text-center text-sm';
            const currentStreak = calculateStreak(partner.matchHistory);
            streakCell.innerHTML = `<span class="${currentStreak.startsWith('+') ? 'text-green-400' : (currentStreak.startsWith('-') ? 'text-red-400' : 'text-gray-400')}">${currentStreak}</span>`;
        });

    } catch (error) {
        console.error("Error fetching or rendering partnerships:", error);
        if (partnershipsTableBody) partnershipsTableBody.innerHTML = ''; // Clear loading
        if (noPartnershipsMessage) {
            noPartnershipsMessage.classList.remove('hidden'); // Show generic error message
            noPartnershipsMessage.textContent = 'Error loading partnerships. Please try again.';
            noPartnershipsMessage.classList.remove('text-gray-400');
            noPartnershipsMessage.classList.add('text-red-400');
        }
    }
}


// --- Main Profile Rendering Function ---
async function fetchAndRenderPlayerProfile() {
    console.log("playerProfile.js: fetchAndRenderPlayerProfile called.");

    const urlParams = new URLSearchParams(window.location.search);
    currentPlayerName = urlParams.get('playerName');

    if (!currentPlayerName) {
        console.error("playerProfile.js: Player name not found in URL.");
        showMessage('profileErrorMessage', 'Player name not specified in URL.', 'error');
        return;
    }

    console.log(`playerProfile.js: Extracted playerName from URL: "${currentPlayerName}"`);

    const playersCollectionRef = collection(db, PLAYERS_COLLECTION_PATH);
    const playerDocRef = doc(playersCollectionRef, currentPlayerName);

    try {
        console.log(`playerProfile.js: Attempting to fetch player: "${currentPlayerName}" from Firestore at path: "${playerDocRef.path}".`);
        const playerDocSnap = await getDoc(playerDocRef);

        if (playerDocSnap.exists()) {
            const playerData = playerDocSnap.data();
            console.log("playerProfile.js: Player data fetched successfully:", playerData);

            // --- Console Logs for Display Debugging ---
            console.log("playerProfile.js: Starting display rendering check.");
            console.log("playerProfile.js: Player Name:", playerData.name);
            console.log("playerProfile.js: Avatar URL:", playerData.avatarUrl);
            console.log("playerProfile.js: Total Games Played (from data):", playerData.totalGamesPlayed);
            console.log("playerProfile.js: Total Wins (from data):", playerData.totalWins);
            console.log("playerProfile.js: Total Losses (from data):", playerData.totalLosses);
            console.log("playerProfile.js: Overall Win Rate (from data):", playerData.overallWinRate);
            console.log("playerProfile.js: Current Streak (from data):", playerData.currentStreak);
            console.log("playerProfile.js: Longest Win Streak (from data):", playerData.longestWinStreak);
            console.log("playerProfile.js: Longest Losing Streak (from data):", playerData.longestLosingStreak);
            console.log("playerProfile.js: Partnerships (from data):", playerData.partnerships);
            // --- End Console Logs for Display Debugging ---

            // Update player name in header
            const profileNameElement = document.getElementById('profilePlayerName');
            if (profileNameElement) {
                profileNameElement.textContent = playerData.name || currentPlayerName;
                console.log(`playerProfile.js: Profile name updated to: ${profileNameElement.textContent}`);
            }

            // Update avatar
            const avatarElement = document.getElementById('playerAvatar');
            if (avatarElement && playerData.avatarUrl) {
                avatarElement.src = playerData.avatarUrl;
                console.log(`playerProfile.js: Avatar src set to: ${avatarElement.src}`);
            } else if (avatarElement) {
                avatarElement.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(currentPlayerName)}&size=64`;
                console.log("playerProfile.js: Using default avatar as avatarUrl is missing.");
            }

            // Update overall stats
            document.getElementById('totalGamesPlayed').textContent = playerData.totalGamesPlayed || 0;
            const totalWins = playerData.totalWins || 0;
            const totalLosses = playerData.totalLosses || 0;
            document.getElementById('overallWinsLosses').textContent = `${totalWins}W - ${totalLosses}L`;
            const overallWinRate = typeof playerData.overallWinRate === 'number' ? playerData.overallWinRate.toFixed(1) : '0.0';
            document.getElementById('overallWinRate').textContent = `${overallWinRate}%`;

            // Update 1v1 stats
            document.getElementById('games1v1').textContent = playerData.games1v1 || 0;
            const wins1v1 = playerData.wins1v1 || 0;
            const losses1v1 = playerData.losses1v1 || 0;
            document.getElementById('winsLosses1v1').textContent = `${wins1v1}W - ${losses1v1}L`;
            const winRate1v1 = typeof playerData.winRate1v1 === 'number' ? playerData.winRate1v1.toFixed(1) : '0.0';
            document.getElementById('winRate1v1').textContent = `${winRate1v1}%`;

            // Update 2v2 stats
            document.getElementById('games2v2').textContent = playerData.games2v2 || 0;
            const wins2v2 = playerData.wins2v2 || 0;
            const losses2v2 = playerData.losses2v2 || 0;
            document.getElementById('winsLosses2v2').textContent = `${wins2v2}W - ${losses2v2}L`;
            const winRate2v2 = typeof playerData.winRate2v2 === 'number' ? playerData.winRate2v2.toFixed(1) : '0.0';
            document.getElementById('winRate2v2').textContent = `${winRate2v2}%`;

            // Update streaks
            const currentStreakElement = document.getElementById('currentStreak');
            if (currentStreakElement) {
                const streak = playerData.currentStreak || 0;
                const displayedStreak = Math.abs(streak);
                const streakType = streak >= 0 ? 'Wins' : 'Losses';
                currentStreakElement.textContent = `${displayedStreak} ${streakType}`;
            }
            document.getElementById('longestWinStreak').textContent = playerData.longestWinStreak || 0;
            document.getElementById('longestLosingStreak').textContent = playerData.longestLosingStreak || 0;

            // --- Call the NEW Recent Match History function here ---
            await fetchAndRenderRecentMatches(currentPlayerName);

            // --- Call the NEW Rivalries function here ---
            await fetchAndRenderRivalries(currentPlayerName); // IMPORTANT: Make sure this is called

            // --- Call the NEW Partnerships function here ---
            await fetchAndRenderPartnerships(currentPlayerName);

            hideMessage('profileErrorMessage');
        } else {
            console.warn(`playerProfile.js: No player document found for "${currentPlayerName}".`);
            showMessage('profileErrorMessage', `Player "${currentPlayerName}" not found.`, 'error');
        }
    } catch (error) {
        console.error("playerProfile.js: Error fetching player data:", error);
        showMessage('profileErrorMessage', `Error loading player profile: ${error.message}`, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("playerProfile.js: DOMContentLoaded fired.");
    // Initial authentication state check and profile fetch
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Sign in anonymously if no user is authenticated
            try {
                await signInAnonymously(auth);
                console.log("playerProfile.js: Signed in anonymously for playerProfile.js.");
                fetchAndRenderPlayerProfile(); // Call after successful sign-in to ensure context
            } catch (error) {
                console.error("playerProfile.js: Error signing in anonymously for playerProfile.js:", error);
                showMessage('profileErrorMessage', `Authentication error: ${error.message}`, 'error');
            }
        } else {
            currentUserId = user.uid;
            console.log("playerProfile.js: Existing user detected for playerProfile.js:", currentUserId);
            fetchAndRenderPlayerProfile(); // Call if already signed in
        }
    });

    // Event listener for "View All Match History" link (if you have one elsewhere in HTML)
    // Note: The new "Recent Match History Card" has its own button
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
});