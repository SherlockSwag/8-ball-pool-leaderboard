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
    serverTimestamp // Ensure serverTimestamp is imported here
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import your local firebase-config.js
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js'; 

let db;
let auth;
let currentUserId = null;

// Determine the final firebaseConfig to use: Canvas-provided or local fallback
let finalFirebaseConfig = {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'local-pool-tracker-app'; 

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


// Helper function to show messages (errors, success, loading)
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `mt-2 p-2 rounded text-center text-sm ${
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
        showMessage('leaderboardErrorMessage', `Failed to initialize Firebase: ${error.message}. Please check console for details.`, 'error');
        return;
    }

    // Firestore collection path for public data (leaderboard)
    const PLAYERS_COLLECTION_PATH = `artifacts/${appId}/public/data/players`;
    console.log("Firestore Players Collection Path:", PLAYERS_COLLECTION_PATH);


    // Authenticate user
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            console.log("Authenticated with Firebase UID:", currentUserId);
            hideMessage('authMessage'); 
            await fetchAndRenderLeaderboard(); // Fetch and render leaderboard after auth
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
                showMessage('leaderboardErrorMessage', 'Authentication failed. Leaderboard might not update. Check console for details.', 'error');
            }
        }
    });

    // Get elements for Game Type selection
    const gameTypeRadios = document.querySelectorAll('input[name="gameType"]');
    const team1PlayersContainer = document.getElementById('team1PlayersContainer'); 
    const team2PlayersContainer = document.getElementById('team2PlayersContainer'); 

    // Get elements for Player Inputs
    const player1Input = document.getElementById('player1'); 
    const player2Input = document.getElementById('player2'); 
    const player3Input = document.getElementById('player3'); 
    const player4Input = document.getElementById('player4'); 

    // Get elements for Winner Selection
    const winnerSelectionDiv = document.getElementById('winnerSelection');
    const winnerPlayer1RadioDiv = document.getElementById('winner_player1_radio_div'); 
    const winnerPlayer2RadioDiv = document.getElementById('winner_player2_radio_div'); 
    const winnerTeam1RadioDiv = document.getElementById('winner_team1_radio_div'); 
    const winnerTeam2RadioDiv = document.getElementById('winner_team2_radio_div'); 

    // Get the actual radio buttons themselves for setting checked state
    const winnerPlayer1Radio = document.getElementById('winner_player1'); 
    const winnerPlayer2Radio = document.getElementById('winner_player2'); 
    const winnerTeam1Radio = document.getElementById('winner_team1'); 
    const winnerTeam2Radio = document.getElementById('winner_team2'); 

    const gameType1v1Radio = document.getElementById('gameType1v1'); // Assuming 'gameType1v1' is the ID of the radio input
    const gameType2v2Radio = document.getElementById('gameType2v2'); // Assuming 'gameType2v2' is the ID of the radio input

    const winnerPlayer1Label = document.getElementById('winner_player1_label'); 
    const winnerPlayer2Label = document.getElementById('winner_player2_label'); 
    const team1Player1Label = document.getElementById('team1_player1_label'); 
    const team1Player2Label = document.getElementById('team1_player2_label'); 
    const team2Player3Label = document.getElementById('team2_player3_label'); 
    const team2Player4Label = document.getElementById('team2_player4_label'); 

    const addMatchButton = document.getElementById('addMatchButton');
    const leaderboardTableBody = document.getElementById('leaderboardTableBody');
    const matchErrorMessageDisplay = document.getElementById('matchErrorMessage');

    // Elements for Clear All Data
    const clearAllDataButton = document.getElementById('clearAllDataButton');
    const clearConfirmationMessage = document.getElementById('clearConfirmationMessage');
    const confirmClearButton = document.getElementById('confirmClearButton');
    const cancelClearButton = document.getElementById('cancelClearButton');
    const clearDataMessage = document.getElementById('clearDataMessage');


    /**
     * Updates the visibility of player input fields and winner selection
     * based on the selected game type (1v1 or 2v2).
     */
    function updateGameTypeDisplay() {
        const selectedGameType = document.querySelector('input[name="gameType"]:checked').value;
        hideMessage('matchErrorMessage'); 

        if (selectedGameType === '1v1') {
            team1PlayersContainer.classList.remove('hidden'); 
            team2PlayersContainer.classList.add('hidden');   

            winnerPlayer1RadioDiv.classList.remove('hidden');
            winnerPlayer2RadioDiv.classList.remove('hidden');
            winnerTeam1RadioDiv.classList.add('hidden');
            winnerTeam2RadioDiv.classList.add('hidden');

            // Set the default winner radio button for 1v1
            if (winnerPlayer1Radio) winnerPlayer1Radio.checked = true;
            if (winnerPlayer2Radio) winnerPlayer2Radio.checked = false;

        } else { // 2v2
            team1PlayersContainer.classList.remove('hidden'); 
            team2PlayersContainer.classList.remove('hidden'); 

            winnerPlayer1RadioDiv.classList.add('hidden');
            winnerPlayer2RadioDiv.classList.add('hidden');
            winnerTeam1RadioDiv.classList.remove('hidden');
            winnerTeam2RadioDiv.classList.remove('hidden');

            // Set the default winner radio button for 2v2
            if (winnerTeam1Radio) winnerTeam1Radio.checked = true;
            if (winnerTeam2Radio) winnerTeam2Radio.checked = false;
        }
        updateWinnerLabels(); 
    }

    /**
     * Updates the winner selection labels with current player names.
     */
    function updateWinnerLabels() {
        winnerPlayer1Label.textContent = player1Input.value.trim() || 'Player 1';
        winnerPlayer2Label.textContent = player2Input.value.trim() || 'Player 2';
        
        team1Player1Label.textContent = player1Input.value.trim() || 'Player 1';
        team1Player2Label.textContent = player2Input.value.trim() || 'Player 2'; 
        team2Player3Label.textContent = player3Input.value.trim() || 'Player 3';
        team2Player4Label.textContent = player4Input.value.trim() || 'Player 4';
    }

    /**
     * Clears all input fields in the "Add Match" form.
     * This function is now defined within the DOMContentLoaded scope.
     */
    function clearMatchInputs() {
        player1Input.value = '';
        player2Input.value = '';
        player3Input.value = '';
        player4Input.value = '';

        // Reset winner selection radio buttons to default 1v1 state
        if (winnerPlayer1Radio) winnerPlayer1Radio.checked = true;
        if (winnerPlayer2Radio) winnerPlayer2Radio.checked = false;
        if (winnerTeam1Radio) winnerTeam1Radio.checked = false;
        if (winnerTeam2Radio) winnerTeam2Radio.checked = false;

        // Reset game type selection back to 1v1
        if (gameType1v1Radio) gameType1v1Radio.checked = true;
        if (gameType2v2Radio) gameType2v2Radio.checked = false;

        // Call display update functions to ensure UI reflects the reset state
        updateWinnerLabels(); 
        updateGameTypeDisplay(); 
        
        hideMessage('matchErrorMessage'); // Also hide any lingering match messages
    }

    /**
     * Handles adding a match to Firestore and updating leaderboard.
     */
    async function handleAddMatch() {
        hideMessage('matchErrorMessage'); 
        showMessage('matchErrorMessage', 'Adding match...', 'info');

        if (!db || !auth.currentUser) {
            showMessage('matchErrorMessage', 'Error: Firebase not ready or not authenticated. Please wait or refresh the page.', 'error');
            return;
        }
        if (!currentUserId) {
            showMessage('matchErrorMessage', 'Error: User ID not available. Please refresh the page.', 'error');
            return;
        }

        const gameType = document.querySelector('input[name="gameType"]:checked').value;
        let winnerPlayerNames = [];
        let loserPlayerNames = [];

        try {
            if (gameType === '1v1') {
                const p1 = player1Input.value.trim();
                const p2 = player2Input.value.trim();

                if (!p1 || !p2) {
                    showMessage('matchErrorMessage', 'Please enter names for both Player 1 and Player 2.', 'error');
                    return;
                }
                if (p1 === p2) {
                    showMessage('matchErrorMessage', 'Player names must be different in 1v1 match.', 'error');
                    return;
                }
                
                const selectedWinnerValue = document.querySelector('input[name="winner"]:checked')?.value;
                if (!selectedWinnerValue) {
                    showMessage('matchErrorMessage', 'Please select a winner.', 'error');
                    return;
                }

                if (selectedWinnerValue === 'player1') { 
                    winnerPlayerNames.push(p1);
                    loserPlayerNames.push(p2);
                } else { 
                    winnerPlayerNames.push(p2);
                    loserPlayerNames.push(p1);
                }

            } else { // 2v2
                const p1 = player1Input.value.trim();
                const p2 = player2Input.value.trim();
                const p3 = player3Input.value.trim();
                const p4 = player4Input.value.trim();

                if (!p1 || !p2 || !p3 || !p4) {
                    showMessage('matchErrorMessage', 'Please enter names for all four players.', 'error');
                    return;
                }
                const allPlayers = [p1, p2, p3, p4];
                const uniquePlayers = new Set(allPlayers);
                if (uniquePlayers.size !== 4) {
                    showMessage('matchErrorMessage', 'All four player names must be unique for a 2v2 match.', 'error');
                    return;
                }
                
                const selectedWinnerValue = document.querySelector('input[name="winner"]:checked')?.value;
                if (!selectedWinnerValue) {
                    showMessage('matchErrorMessage', 'Please select a winning team.', 'error');
                    return;
                }

                if (selectedWinnerValue === 'team1') {
                    winnerPlayerNames.push(p1, p2); 
                    loserPlayerNames.push(p3, p4);   
                } else { // team2
                    winnerPlayerNames.push(p3, p4);   
                    loserPlayerNames.push(p1, p2); 
                }
            }

            const batch = writeBatch(db);

            // Generate a unique ID for this match that will be used for all player's match history entries
            const matchId = doc(collection(db, 'dummyCollectionForIDGeneration')).id; 

            // Function to ensure player document exists and update stats and match history
            // This function now takes the batch and matchId as arguments
            async function updatePlayerStatsInBatch(playerName, gameType, outcome, opponents = [], teammates = []) {
                const playerDocRef = doc(db, PLAYERS_COLLECTION_PATH, playerName);
                
                // Update player's general stats (wins, losses, games played)
                const updates = {
                    name: playerName, // Ensure name is always set
                    [`gamesPlayed${gameType.replace('v', '')}`]: increment(1),
                    [`${outcome}${gameType.replace('v', '')}`]: increment(1)
                };
                batch.set(playerDocRef, updates, { merge: true }); 

                // Record the match in the player's match history subcollection
                const playerMatchRecord = {
                    gameId: matchId, // Unique ID for this match
                    gameType: gameType,
                    outcome: outcome, 
                    opponents: opponents, 
                    teamMates: teammates, 
                    timestamp: serverTimestamp() // Correctly using serverTimestamp()
                };
                batch.set(doc(playerDocRef, 'matches', matchId), playerMatchRecord); 

                // Update rivalries and partnerships
                if (gameType === '1v1') {
                    const rivalryRef = doc(playerDocRef, 'rivalries', opponents[0]);
                    batch.set(rivalryRef, {
                        wins: increment(outcome === 'win' ? 1 : 0),
                        losses: increment(outcome === 'loss' ? 1 : 0)
                    }, { merge: true });
                } else if (gameType === '2v2') {
                    // Partnerships
                    for (const teammate of teammates) { // Iterate over actual teammates, not all winning/losing team members
                        const partnershipRef = doc(playerDocRef, 'partnerships', teammate);
                        batch.set(partnershipRef, {
                            wins: increment(outcome === 'win' ? 1 : 0),
                            losses: increment(outcome === 'loss' ? 1 : 0)
                        }, { merge: true });
                    }
                    // Rivalries
                    for (const opponent of opponents) {
                        const rivalryRef = doc(playerDocRef, 'rivalries', opponent);
                        batch.set(rivalryRef, {
                            wins: increment(outcome === 'win' ? 1 : 0),
                            losses: increment(outcome === 'loss' ? 1 : 0)
                        }, { merge: true });
                    }
                }
            }

            // Prepare batch updates for all players involved
            if (gameType === '1v1') {
                await updatePlayerStatsInBatch(winnerPlayerNames[0], '1v1', 'win', loserPlayerNames); // Opponent is the loser
                await updatePlayerStatsInBatch(loserPlayerNames[0], '1v1', 'loss', winnerPlayerNames); // Opponent is the winner
            } else { // 2v2
                // For winners
                for (const winnerName of winnerPlayerNames) {
                    const teammates = winnerPlayerNames.filter(p => p !== winnerName);
                    await updatePlayerStatsInBatch(winnerName, '2v2', 'win', loserPlayerNames, teammates);
                }
                // For losers
                for (const loserName of loserPlayerNames) {
                    const teammates = loserPlayerNames.filter(p => p !== loserName);
                    await updatePlayerStatsInBatch(loserName, '2v2', 'loss', winnerPlayerNames, teammates);
                }
            }
            
            await batch.commit();
            showMessage('matchErrorMessage', 'Match added successfully!', 'success');

            // Clear inputs and refresh UI
            clearMatchInputs(); // Call the now accessible clearMatchInputs
            await fetchAndRenderLeaderboard(); 

        } catch (error) {
            console.error("Error adding match:", error);
            showMessage('matchErrorMessage', `Error adding match: ${error.message}`, 'error');
        }
    }

    /**
     * Initiates the clear all data confirmation flow.
     */
    function initiateClearAllData() {
        console.log("initiateClearAllData called. Hiding clearAllDataButton, showing clearConfirmationMessage.");
        hideMessage('clearDataMessage'); // Hide any previous clear messages
        clearConfirmationMessage.classList.remove('hidden'); // Show the confirmation prompt
        clearAllDataButton.classList.add('hidden'); // Temporarily hide the main clear button
    }

    /**
     * Executes the deletion of all player data from Firestore.
     */
    async function clearAllDataConfirmed() {
        console.log("clearAllDataConfirmed called. Hiding clearConfirmationMessage, showing clearDataMessage.");
        hideMessage('clearConfirmationMessage'); // Hide confirmation prompt
        showMessage('clearDataMessage', 'Clearing all data...', 'info');
        clearAllDataButton.classList.remove('hidden'); // Show main clear button again

        if (!db || !auth.currentUser) {
            showMessage('clearDataMessage', 'Error: Firebase not ready or not authenticated. Cannot clear data.', 'error');
            return;
        }

        try {
            const playersRef = collection(db, PLAYERS_COLLECTION_PATH);
            const querySnapshot = await getDocs(query(playersRef));
            
            if (querySnapshot.empty) {
                showMessage('clearDataMessage', 'No player data to clear.', 'info');
                await fetchAndRenderLeaderboard(); // Ensure leaderboard is updated to show empty state
                return;
            }

            // Batch delete main player documents and their subcollections
            const deleteBatch = writeBatch(db);
            for (const playerDoc of querySnapshot.docs) {
                deleteBatch.delete(playerDoc.ref); // Delete main player document
                
                // Delete all documents in the 'matches' subcollection for this player
                const matchesSnapshot = await getDocs(collection(playerDoc.ref, 'matches'));
                matchesSnapshot.docs.forEach(matchDoc => {
                    deleteBatch.delete(matchDoc.ref);
                });
            }

            await deleteBatch.commit();
            showMessage('clearDataMessage', 'All player data cleared successfully!', 'success');
            await fetchAndRenderLeaderboard(); // Refresh leaderboard to show empty state
        } catch (error) {
            console.error("Error clearing all data:", error);
            showMessage('clearDataMessage', `Error clearing data: ${error.message}`, 'error');
        }
    }

    /**
     * Cancels the clear all data operation.
     */
    function cancelClearAllData() {
        console.log("cancelClearAllData called. Hiding confirmation messages, showing clearAllDataButton.");
        hideMessage('clearConfirmationMessage'); // Hide confirmation prompt
        hideMessage('clearDataMessage'); // Hide any messages related to clear process
        clearAllDataButton.classList.remove('hidden'); // Show the main clear button
    }


    /**
     * Fetches player data from Firestore and renders the leaderboard table.
     */
    async function fetchAndRenderLeaderboard() {
        showMessage('leaderboardErrorMessage', 'Loading leaderboard...', 'info');
        try {
            if (!db) {
                showMessage('leaderboardErrorMessage', 'Firebase database not initialized. Cannot load leaderboard.', 'error');
                return;
            }
            const playersRef = collection(db, PLAYERS_COLLECTION_PATH);
            const q = query(playersRef);
            const querySnapshot = await getDocs(q);

            const players = [];
            querySnapshot.forEach((doc) => {
                players.push(doc.data());
            });

            // Sort players: primarily by overall win rate (desc), then total wins (desc)
            players.sort((a, b) => {
                const aTotalWins = (a.wins1v1 || 0) + (a.wins2v2 || 0);
                const aTotalLosses = (a.losses1v1 || 0) + (a.losses2v2 || 0);
                const aTotalGames = aTotalWins + aTotalLosses;
                const aWinRate = aTotalGames > 0 ? (aTotalWins / aTotalGames) : 0;

                const bTotalWins = (b.wins1v1 || 0) + (b.wins2v2 || 0);
                const bTotalLosses = (b.losses1v1 || 0) + (b.losses2v2 || 0);
                const bTotalGames = bTotalWins + bTotalLosses;
                const bWinRate = bTotalGames > 0 ? (bTotalWins / bTotalGames) : 0;

                if (bWinRate !== aWinRate) {
                    return bWinRate - aWinRate; // Sort by win rate descending
                }
                return bTotalWins - aTotalWins; // Then by total wins descending
            });

            leaderboardTableBody.innerHTML = ''; // Clear existing rows

            if (players.length === 0) {
                leaderboardTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="py-3 px-4 text-center text-sm text-gray-400">No players yet. Add a match to get started!</td>
                    </tr>
                `;
            } else {
                players.forEach((player, index) => { // Added index for rank
                    const totalWins = (player.wins1v1 || 0) + (player.wins2v2 || 0);
                    const totalLosses = (player.losses1v1 || 0) + (player.losses2v2 || 0);
                    const totalGames = totalWins + totalLosses;
                    const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(2) : 'N/A';

                    const row = `
                        <tr class="border-b border-gray-600 bg-gray-800 hover:bg-gray-700"> <!-- Removed odd: and even: classes -->
                            <td class="py-3 px-4 text-left text-sm text-gray-50">${index + 1}</td> <!-- Rank column -->
                            <td class="py-3 px-4 text-left text-sm font-medium text-blue-300">
                                <a href="playerProfile.html?playerName=${encodeURIComponent(player.name)}" class="hover:underline">
                                    ${player.name}
                                </a>
                            </td>
                            <td class="py-3 px-4 text-center text-sm text-gray-50">${player.wins1v1 || 0}</td>
                            <td class="py-3 px-4 text-center text-sm text-gray-50">${player.losses1v1 || 0}</td>
                            <td class="py-3 px-4 text-center text-sm text-gray-50">${player.wins2v2 || 0}</td>
                            <td class="py-3 px-4 text-center text-sm text-gray-50">${player.losses2v2 || 0}</td>
                            <td class="py-3 px-4 text-center text-sm text-gray-50">${winRate}%</td>
                        </tr>
                    `;
                    leaderboardTableBody.innerHTML += row;
                });
            }
            hideMessage('leaderboardErrorMessage'); // Hide loading message
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
            showMessage('leaderboardErrorMessage', `Error loading leaderboard: ${error.message}`, 'error');
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

    // Initial display update (triggered after auth state is determined)
    updateGameTypeDisplay();
});
