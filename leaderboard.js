// leaderboard.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    collection, 
    query, 
    getDocs, 
    increment, 
    writeBatch, 
    deleteDoc, 
    getDoc,
    serverTimestamp, // Ensure serverTimestamp is imported here
    orderBy
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import your local firebase-config.js
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js'; 

let db;
let auth;
let currentUserId = null;

// --- ALL ELEMENT REFERENCES DECLARED HERE FOR GLOBAL ACCESS ---
// Get elements for Player Inputs
let player1Input;
let player2Input;
let player3Input;
let player4Input;
let matchDateInput; // <-- CORRECTLY DECLARED HERE

// Get elements for Game Type selection
let gameTypeRadios; 
let team1PlayersContainer; 
let team2PlayersContainer; 

// Get elements for Winner Selection
let winnerSelectionDiv; 
let winnerPlayer1RadioDiv; 
let winnerPlayer2RadioDiv; 
let winnerTeam1RadioDiv; 
let winnerTeam2RadioDiv; 

// Get the actual radio buttons themselves for setting checked state
let winnerPlayer1Radio; 
let winnerPlayer2Radio; 
let winnerTeam1Radio; 
let winnerTeam2Radio; 

let gameType1v1Radio; 
let gameType2v2Radio; 

let winnerPlayer1Label; 
let winnerPlayer2Label; 
let team1Player1Label; 
let team1Player2Label; 
let team2Player3Label; 
let team2Player4Label; 

let addMatchButton; 
let leaderboardTableBody; 
let matchErrorMessageDisplay; 

// Elements for Clear All Data
let clearAllDataButton; 
let clearConfirmationMessage; 
let confirmClearButton; 
let cancelClearButton; 
let clearDataMessage; 
// --- END ALL ELEMENT REFERENCES DECLARED HERE ---

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
    }

    // Initialize Firebase
    const app = initializeApp(finalFirebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase initialized.");

} catch (error) {
    console.error("Failed to initialize Firebase:", error);
    alert("Error initializing Firebase. Check console for details.");
}


document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded fired.");

    // Firestore collection path for public data (leaderboard)
    const PLAYERS_COLLECTION_PATH = `artifacts/${appId}/public/data/players`;
    const MATCHES_COLLECTION_PATH = `artifacts/${appId}/public/data/matches`; // Define matches collection path
    console.log("Firestore Players Collection Path:", PLAYERS_COLLECTION_PATH);

    // Authenticate user
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            console.log("User signed in anonymously with UID:", currentUserId);
            // Fetch and render leaderboard and match history after authentication
            await fetchAndRenderLeaderboard();
        } else {
            // Sign in anonymously if no user is authenticated
            try {
                await signInAnonymously(auth);
                console.log("Signed in anonymously.");
            } catch (error) {
                console.error("Error signing in anonymously:", error);
                showMessage('leaderboardErrorMessage', `Authentication error: ${error.message}`, 'error');
            }
        }
    });

    // --- ASSIGNMENTS TO ELEMENT REFERENCES (NO 'const' or 'let' here for already declared vars) ---

    // Get elements for Game Type selection
    gameTypeRadios = document.querySelectorAll('input[name="gameType"]');
    team1PlayersContainer = document.getElementById('team1PlayersContainer'); 
    team2PlayersContainer = document.getElementById('team2PlayersContainer'); 

    // Get elements for Player Inputs
    player1Input = document.getElementById('player1'); 
    player2Input = document.getElementById('player2'); 
    player3Input = document.getElementById('player3'); 
    player4Input = document.getElementById('player4'); 
    matchDateInput = document.getElementById('matchDate'); // <-- CORRECTLY ASSIGNED HERE

    // Get elements for Winner Selection
    winnerSelectionDiv = document.getElementById('winnerSelection');
    winnerPlayer1RadioDiv = document.getElementById('winner_player1_radio_div'); 
    winnerPlayer2RadioDiv = document.getElementById('winner_player2_radio_div'); 
    winnerTeam1RadioDiv = document.getElementById('winner_team1_radio_div'); 
    winnerTeam2RadioDiv = document.getElementById('winner_team2_radio_div'); 

    // Get the actual radio buttons themselves for setting checked state
    winnerPlayer1Radio = document.querySelector('#winner_player1_radio_div input'); 
    winnerPlayer2Radio = document.querySelector('#winner_player2_radio_div input'); 
    winnerTeam1Radio = document.querySelector('#winner_team1_radio_div input'); 
    winnerTeam2Radio = document.querySelector('#winner_team2_radio_div input'); 

    // Assuming these IDs exist in your HTML from the radio inputs directly,
    // if not, adjust to select by name or parent div
    // For example: document.querySelector('input[name="gameType"][value="1v1"]');
    gameType1v1Radio = document.querySelector('input[name="gameType"][value="1v1"]'); 
    gameType2v2Radio = document.querySelector('input[name="gameType"][value="2v2"]'); 

    winnerPlayer1Label = document.getElementById('winner_player1_label'); 
    winnerPlayer2Label = document.getElementById('winner_player2_label'); 
    team1Player1Label = document.getElementById('team1_player1_label'); 
    team1Player2Label = document.getElementById('team1_player2_label'); 
    team2Player3Label = document.getElementById('team2_player3_label'); 
    team2Player4Label = document.getElementById('team2_player4_label'); 

    addMatchButton = document.getElementById('addMatchButton'); 
    leaderboardTableBody = document.getElementById('leaderboardTableBody'); 
    matchErrorMessageDisplay = document.getElementById('matchErrorMessage'); 

    // Elements for Clear All Data
    clearAllDataButton = document.getElementById('clearAllDataButton'); 
    clearConfirmationMessage = document.getElementById('clearConfirmationMessage'); 
    confirmClearButton = document.getElementById('confirmClearButton'); 
    cancelClearButton = document.getElementById('cancelClearButton'); 
    clearDataMessage = document.getElementById('clearDataMessage'); 
    // --- END ASSIGNMENTS ---

    /**
     * Shows a message in a designated error/info display area.
     * @param {string} elementId The ID of the HTML element to display the message.
     * @param {string} message The message to display.
     * @param {'error'|'success'|'info'} type The type of message to determine styling.
     */
    function showMessage(elementId, message, type) {
        const displayElement = document.getElementById(elementId);
        if (displayElement) {
            displayElement.textContent = message;
            displayElement.classList.remove('hidden', 'bg-red-800', 'bg-green-800', 'bg-blue-800');
            if (type === 'error') {
                displayElement.classList.add('bg-red-800');
            } else if (type === 'success') {
                displayElement.classList.add('bg-green-800');
            } else { // info
                displayElement.classList.add('bg-blue-800');
            }
        }
    }

    /**
     * Hides a message in a designated error/info display area.
     * @param {string} elementId The ID of the HTML element to hide the message.
     */
    function hideMessage(elementId) {
        const displayElement = document.getElementById(elementId);
        if (displayElement) {
            displayElement.classList.add('hidden');
            displayElement.textContent = ''; // Clear text when hidden
        }
    }

    // Function to update the display based on game type selection
    function updateGameTypeDisplay() {
        const selectedGameType = document.querySelector('input[name="gameType"]:checked').value;

        if (selectedGameType === '1v1') {
            team1PlayersContainer.classList.remove('hidden');
            team2PlayersContainer.classList.add('hidden');
            player3Input.value = ''; // Clear 2v2 player inputs
            player4Input.value = '';

            // Adjust winner selection for 1v1
            winnerPlayer1RadioDiv.classList.remove('hidden');
            winnerPlayer2RadioDiv.classList.remove('hidden');
            winnerTeam1RadioDiv.classList.add('hidden');
            winnerTeam2RadioDiv.classList.add('hidden');
        } else { // 2v2
            team1PlayersContainer.classList.remove('hidden');
            team2PlayersContainer.classList.remove('hidden');

            // Adjust winner selection for 2v2
            winnerPlayer1RadioDiv.classList.add('hidden');
            winnerPlayer2RadioDiv.classList.add('hidden');
            winnerTeam1RadioDiv.classList.remove('hidden');
            winnerTeam2RadioDiv.classList.remove('hidden');
        }
        updateWinnerLabels(); // Update labels immediately after type change
    }

    // Function to update winner labels dynamically
    function updateWinnerLabels() {
        winnerPlayer1Label.textContent = player1Input.value || 'Player 1';
        winnerPlayer2Label.textContent = player2Input.value || 'Player 2';
        team1Player1Label.textContent = player1Input.value || 'Player 1';
        team1Player2Label.textContent = player2Input.value || 'Player 2';
        team2Player3Label.textContent = player3Input.value || 'Player 3';
        team2Player4Label.textContent = player4Input.value || 'Player 4';

        // Clear winner selection when players change
        winnerPlayer1Radio.checked = false;
        winnerPlayer2Radio.checked = false;
        winnerTeam1Radio.checked = false;
        winnerTeam2Radio.checked = false;
    }

    // Helper function to safely calculate win rate, returning a number (0 if total games is 0)
    function calculateWinRate(wins, losses) {
        if (wins === 0 && losses === 0) {
            return 0;
        }
        return (wins / (wins + losses)) * 100;
    }

    // Helper function for formatting dates from Firestore Timestamps
    function formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        // If it's a Firestore Timestamp object
        if (timestamp.toDate) {
            const date = timestamp.toDate();
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
        // If it's a Date object already (less likely from Firestore direct fetch, but good to handle)
        if (timestamp instanceof Date) {
            return timestamp.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
        return 'N/A'; // Fallback for unexpected format
    }


    // Main function to handle adding a match
    // Inside leaderboard.js

    async function handleAddMatch() {
        hideMessage('matchErrorMessage'); // Hide any previous error messages

        const gameType = document.querySelector('input[name="gameType"]:checked').value;
        const player1Name = player1Input.value.trim();
        const player2Name = player2Input.value.trim();
        const player3Name = player3Input.value.trim(); // Only for 2v2
        const player4Name = player4Input.value.trim(); // Only for 2v2
        const matchDate = matchDateInput.value;

        let winnerName, loserName;
        let team1Players = [];
        let team2Players = [];
        let winningTeam, losingTeam;

        // Basic validation
        if (!player1Name || !player2Name || !matchDate) {
            showMessage('matchErrorMessage', 'Player 1, Player 2, and Match Date are required.', 'error');
            return;
        }

        if (gameType === '1v1') {
            // Now, we query for name="winner" but specifically for the visible 1v1 radios
            // This is important because the 2v2 radios also have name="winner"
            // We'll rely on the 'value' to differentiate, assuming the hidden ones won't be checked
            const selectedWinnerRadio = document.querySelector('input[name="winner"]:checked');
            
            if (!selectedWinnerRadio) {
                showMessage('matchErrorMessage', 'Please select a winner.', 'error');
                return;
            }
            
            // Ensure the selected winner value corresponds to a 1v1 player
            if (selectedWinnerRadio.value !== 'player1' && selectedWinnerRadio.value !== 'player2') {
                showMessage('matchErrorMessage', 'Invalid winner selection for 1v1 game type. Please re-select.', 'error');
                return;
            }

            if (player1Name === player2Name) {
                showMessage('matchErrorMessage', 'Player 1 and Player 2 cannot be the same in 1v1.', 'error');
                return;
            }
            winnerName = selectedWinnerRadio.value === 'player1' ? player1Name : player2Name;
            loserName = selectedWinnerRadio.value === 'player1' ? player2Name : player1Name;

        } else { // 2v2
            if (!player3Name || !player4Name) {
                showMessage('matchErrorMessage', 'All four player names are required for 2v2.', 'error');
                return;
            }
            const allPlayers = [player1Name, player2Name, player3Name, player4Name];
            const uniquePlayers = new Set(allPlayers);
            if (uniquePlayers.size !== 4) {
                showMessage('matchErrorMessage', 'All four players must be unique for 2v2.', 'error');
                return;
            }

            // Again, query for name="winner"
            const selectedWinnerRadio = document.querySelector('input[name="winner"]:checked');
            
            if (!selectedWinnerRadio) {
                showMessage('matchErrorMessage', 'Please select a winning team.', 'error');
                return;
            }

            // Ensure the selected winner value corresponds to a 2v2 team
            if (selectedWinnerRadio.value !== 'team1' && selectedWinnerRadio.value !== 'team2') {
                showMessage('matchErrorMessage', 'Invalid winner selection for 2v2 game type. Please re-select.', 'error');
                return;
            }

            team1Players = [player1Name, player2Name];
            team2Players = [player3Name, player4Name];

            if (selectedWinnerRadio.value === 'team1') {
                winningTeam = team1Players;
                losingTeam = team2Players;
            } else {
                winningTeam = team2Players;
                losingTeam = team1Players;
            }
        }

        try {
            const batch = writeBatch(db);
            const playersToUpdate = new Set();
            const matchId = doc(collection(db, MATCHES_COLLECTION_PATH)).id; // Generate a new match ID

            let matchData = {
                date: matchDate,
                gameType: gameType,
                timestamp: serverTimestamp(),
                players: [], // To store all players involved for easy lookup
                winner: null,
                loser: null,
                winningTeam: [],
                losingTeam: []
            };

            if (gameType === '1v1') {
                playersToUpdate.add(winnerName);
                playersToUpdate.add(loserName);
                matchData.winner = winnerName;
                matchData.loser = loserName;
                matchData.players = [winnerName, loserName];
            } else { // 2v2
                winningTeam.forEach(p => playersToUpdate.add(p));
                losingTeam.forEach(p => playersToUpdate.add(p));
                matchData.winningTeam = winningTeam;
                matchData.losingTeam = losingTeam;
                matchData.players = [...winningTeam, ...losingTeam];
            }

            // Set the match document
            batch.set(doc(db, MATCHES_COLLECTION_PATH, matchId), matchData);

            // Fetch current data for all involved players to calculate new stats
            const playersData = new Map();
            for (const playerName of playersToUpdate) {
                const playerRef = doc(db, PLAYERS_COLLECTION_PATH, playerName);
                const playerDoc = await getDoc(playerRef);
                if (playerDoc.exists()) {
                    playersData.set(playerName, playerDoc.data());
                } else {
                    // Initialize new player if they don't exist
                    playersData.set(playerName, { 
                        name: playerName,
                        wins1v1: 0, losses1v1: 0, games1v1: 0, winRate1v1: 0,
                        wins2v2: 0, losses2v2: 0, games2v2: 0, winRate2v2: 0,
                        totalWins: 0, totalLosses: 0, totalGamesPlayed: 0, overallWinRate: 0,
                        currentStreak: 0, // Initialize streak
                        avatarUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(playerName)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffeedc,f4d15b&size=64`
                    });
                    // Also add a set call for new players in the batch
                    batch.set(playerRef, playersData.get(playerName));
                }
            }

            // Update stats for each player
            for (const playerName of playersToUpdate) {
                const playerRef = doc(db, PLAYERS_COLLECTION_PATH, playerName);
                const currentData = playersData.get(playerName);

                let newWins1v1 = currentData.wins1v1;
                let newLosses1v1 = currentData.losses1v1;
                let newWins2v2 = currentData.wins2v2;
                let newLosses2v2 = currentData.losses2v2;
                let newCurrentStreak = currentData.currentStreak;

                if (gameType === '1v1') {
                    if (playerName === winnerName) {
                        newWins1v1++;
                        newCurrentStreak = (newCurrentStreak > 0 ? newCurrentStreak : 0) + 1;
                    } else { // Loser
                        newLosses1v1++;
                        newCurrentStreak = (newCurrentStreak < 0 ? newCurrentStreak : 0) - 1;
                    }
                } else { // 2v2
                    if (winningTeam.includes(playerName)) {
                        newWins2v2++;
                        newCurrentStreak = (newCurrentStreak > 0 ? newCurrentStreak : 0) + 1;
                    } else { // Losing team
                        newLosses2v2++;
                        newCurrentStreak = (newCurrentStreak < 0 ? newCurrentStreak : 0) - 1;
                    }
                }

                // Calculate derived stats
                const newGames1v1 = newWins1v1 + newLosses1v1;
                const newWinRate1v1 = calculateWinRate(newWins1v1, newLosses1v1);

                const newGames2v2 = newWins2v2 + newLosses2v2;
                const newWinRate2v2 = calculateWinRate(newWins2v2, newLosses2v2);

                const newTotalWins = newWins1v1 + newWins2v2;
                const newTotalLosses = newLosses1v1 + newLosses2v2;
                const newTotalGamesPlayed = newTotalWins + newTotalLosses;
                const newOverallWinRate = calculateWinRate(newTotalWins, newTotalLosses);

                batch.update(playerRef, {
                    wins1v1: newWins1v1,
                    losses1v1: newLosses1v1,
                    games1v1: newGames1v1,
                    winRate1v1: newWinRate1v1,
                    wins2v2: newWins2v2,
                    losses2v2: newLosses2v2,
                    games2v2: newGames2v2,
                    winRate2v2: newWinRate2v2,
                    totalWins: newTotalWins,
                    totalLosses: newTotalLosses,
                    totalGamesPlayed: newTotalGamesPlayed,
                    overallWinRate: newOverallWinRate,
                    currentStreak: newCurrentStreak,
                    lastPlayed: serverTimestamp()
                });
            }

            await batch.commit();
            showMessage('matchErrorMessage', 'Match added successfully and player stats updated!', 'success');

            // Clear form and re-render leaderboard
            player1Input.value = '';
            player2Input.value = '';
            player3Input.value = '';
            player4Input.value = '';
            matchDateInput.value = '';
            
            // This is crucial: Uncheck all radio buttons after a successful submission
            // Since all now share the 'name="winner"', we can select all and uncheck.
            document.querySelectorAll('input[name="winner"]').forEach(radio => {
                radio.checked = false;
            });

            updateWinnerLabels(); // Clear labels after clearing inputs
            await fetchAndRenderLeaderboard(); // Refresh leaderboard
        } catch (error) {
            console.error("Error adding match or updating player stats:", error);
            showMessage('matchErrorMessage', `Error adding match: ${error.message}`, 'error');
        }
    }

    // Function to fetch and render leaderboard
    async function fetchAndRenderLeaderboard() {
        try {
            const playersCol = collection(db, PLAYERS_COLLECTION_PATH);
            const q = query(
                playersCol,
                orderBy('overallWinRate', 'desc'),
                orderBy('totalGamesPlayed', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const players = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                players.push({
                    name: data.name,
                    avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(data.name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffeedc,f4d15b&size=64`,
                    wins1v1: data.wins1v1 || 0,
                    losses1v1: data.losses1v1 || 0,
                    games1v1: data.games1v1 || 0,
                    wins2v2: data.wins2v2 || 0,
                    losses2v2: data.losses2v2 || 0,
                    games2v2: data.games2v2 || 0,
                    totalWins: data.totalWins || 0,
                    totalLosses: data.totalLosses || 0,
                    totalGamesPlayed: data.totalGamesPlayed || 0,
                    overallWinRate: data.overallWinRate || 0,
                    currentStreak: data.currentStreak || 0,
                    lastPlayed: data.lastPlayed
                });
            });

            const leaderboardBody = document.getElementById('leaderboardTableBody');
            leaderboardBody.innerHTML = '';

            if (players.length === 0) {
                leaderboardBody.innerHTML = '<tr><td colspan="9" class="py-3 px-4 text-center text-sm text-gray-400">No players to display yet. Play some matches!</td></tr>';
                return;
            }

            players.forEach((player, index) => {
                const row = leaderboardBody.insertRow();
                row.className = 'border-b border-gray-600 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500';

                // 1. Rank
                const rankCell = row.insertCell();
                rankCell.className = 'py-3 px-4 text-left whitespace-nowrap';
                rankCell.textContent = index + 1;

                // 2. Player Name and Avatar (MADE CLICKABLE)
                const playerCell = row.insertCell();
                playerCell.className = 'py-3 px-4 text-left whitespace-nowrap';
                // Encode the player name to safely use it in a URL
                const encodedPlayerName = encodeURIComponent(player.name);
                playerCell.innerHTML = `
                    <a href="playerProfile.html?playerName=${encodedPlayerName}" class="flex items-center text-blue-300 hover:text-blue-200 transition duration-150 ease-in-out">
                        <img src="${player.avatarUrl}" alt="${player.name}" class="w-8 h-8 rounded-full mr-3 border-2 border-purple-500">
                        <span>${player.name}</span>
                    </a>
                `;

                // 3. Total 1v1 Games played
                const games1v1Cell = row.insertCell();
                games1v1Cell.className = 'py-3 px-4 text-center whitespace-nowrap';
                games1v1Cell.textContent = player.games1v1;

                // 4. 1v1 Win Rate (e.g., 3W - 2L)
                const winRate1v1Cell = row.insertCell();
                winRate1v1Cell.className = 'py-3 px-4 text-center whitespace-nowrap';
                winRate1v1Cell.textContent = `${player.wins1v1}W - ${player.losses1v1}L`;

                // 5. Total 2v2 Games played
                const games2v2Cell = row.insertCell();
                games2v2Cell.className = 'py-3 px-4 text-center whitespace-nowrap';
                games2v2Cell.textContent = player.games2v2;

                // 6. 2v2 Win Rate (e.g., 3W - 2L)
                const winRate2v2Cell = row.insertCell();
                winRate2v2Cell.className = 'py-3 px-4 text-center whitespace-nowrap';
                winRate2v2Cell.textContent = `${player.wins2v2}W - ${player.losses2v2}L`;

                // 7. Overall Win Rate (%)
                const overallWinRateCell = row.insertCell();
                overallWinRateCell.className = 'py-3 px-4 text-center whitespace-nowrap';
                overallWinRateCell.textContent = `${player.overallWinRate.toFixed(2)}%`;

                // 8. Current Streak
                const streakCell = row.insertCell();
                streakCell.className = 'py-3 px-4 text-center whitespace-nowrap';
                const streakText = player.currentStreak > 0 ? `+${player.currentStreak}` : player.currentStreak.toString();
                streakCell.textContent = streakText;
                streakCell.classList.add(player.currentStreak > 0 ? 'text-green-400' : (player.currentStreak < 0 ? 'text-red-400' : 'text-gray-400'));

                // 9. Last Played Date
                const lastPlayedCell = row.insertCell();
                lastPlayedCell.className = 'py-3 px-4 text-left whitespace-nowrap';
                lastPlayedCell.textContent = formatDate(player.lastPlayed);
            });

        } catch (error) {
            console.error("Error fetching or rendering leaderboard:", error);
            showMessage('leaderboardErrorMessage', `Error loading leaderboard: ${error.message}`, 'error');
        }
    }

    // --- Clear All Data Functions ---
    function initiateClearAllData() {
        if (clearConfirmationMessage) {
            clearConfirmationMessage.classList.remove('hidden');
            showMessage('clearDataMessage', 'Confirming will delete all player and match data. This cannot be undone!', 'error');
        }
    }

    async function clearAllDataConfirmed() {
        try {
            // Disable buttons to prevent double-clicks
            confirmClearButton.disabled = true;
            cancelClearButton.disabled = true;
            showMessage('clearDataMessage', 'Clearing data, please wait...', 'info');

            const playersRef = collection(db, PLAYERS_COLLECTION_PATH);
            const matchesRef = collection(db, MATCHES_COLLECTION_PATH);

            // Fetch all player documents
            const playerDocs = await getDocs(playersRef);
            const playerBatch = writeBatch(db);
            playerDocs.forEach(doc => {
                playerBatch.delete(doc.ref);
            });
            await playerBatch.commit();
            console.log("All player data deleted.");

            // Fetch all match documents
            const matchDocs = await getDocs(matchesRef);
            const matchBatch = writeBatch(db);
            matchDocs.forEach(doc => {
                matchBatch.delete(doc.ref);
            });
            await matchBatch.commit();
            console.log("All match data deleted.");

            showMessage('clearDataMessage', 'All leaderboard data has been successfully cleared.', 'success');
            await fetchAndRenderLeaderboard(); // Refresh leaderboard after clearing
        } catch (error) {
            console.error("Error clearing all data:", error);
            showMessage('leaderboardErrorMessage', `Error clearing data: ${error.message}`, 'error');
        } finally {
            if (clearConfirmationMessage) { 
                clearConfirmationMessage.classList.add('hidden');
            }
            if (clearDataMessage) { 
                clearDataMessage.textContent = ''; 
            }
            confirmClearButton.disabled = false;
            cancelClearButton.disabled = false;
        }
    }

    function cancelClearAllData() {
        if (clearConfirmationMessage) { 
            clearConfirmationMessage.classList.add('hidden');
        }
        if (clearDataMessage) { 
            clearDataMessage.textContent = ''; 
        }
    }


    // Event Listeners
    gameTypeRadios.forEach(radio => radio.addEventListener('change', updateGameTypeDisplay));
    player1Input.addEventListener('input', updateWinnerLabels);
    player2Input.addEventListener('input', updateWinnerLabels);
    player3Input.addEventListener('input', updateWinnerLabels);
    player4Input.addEventListener('input', updateWinnerLabels);
    addMatchButton.addEventListener('click', handleAddMatch);

    // Clear All Data Event Listeners
    clearAllDataButton.addEventListener('click', initiateClearAllData);
    confirmClearButton.addEventListener('click', clearAllDataConfirmed); 
    cancelClearButton.addEventListener('click', cancelClearAllData); 

    // Initial display update
    updateGameTypeDisplay();
});