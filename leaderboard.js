// leaderboard.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, setDoc, collection, query, getDocs, increment, writeBatch, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import your local firebase-config.js
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js'; 

let db;
let auth;
let currentUserId = null;

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
        // Check if the local config is still placeholder
        if (finalFirebaseConfig.projectId === "YOUR_FIREBASE_PROJECT_ID") {
            console.warn("Using placeholder Firebase Project ID from local config. Firestore operations will not connect to a real project unless configured with your actual Firebase credentials in firebase-config.js.");
        }
    }
} catch (e) {
    console.error("Error parsing __firebase_config or loading local config. Using local fallback. Details:", e);
    // If parsing fails, fall back to locally imported config
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
            type === 'error' ? 'bg-red-100 text-red-700' :
            type === 'success' ? 'bg-green-100 text-green-700' :
            'bg-blue-100 text-blue-700'
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
    const player1v1_1Div = document.getElementById('player1v1_1_div');
    const player1v1_2Div = document.getElementById('player1v1_2_div');
    const player2v2_3Div = document.getElementById('player2v2_3_div');
    const player2v2_4Div = document.getElementById('player2v2_4_div');

    // Get elements for Player Inputs
    const player1v1_1Input = document.getElementById('player1v1_1');
    const player1v1_2Input = document.getElementById('player1v1_2');
    const player2v2_3Input = document.getElementById('player2v2_3');
    const player2v2_4Input = document.getElementById('player2v2_4');

    // Get elements for Winner Selection
    const winnerSelectionDiv = document.getElementById('winnerSelection');
    const winnerPlayer1v1_1Radio = winnerSelectionDiv.querySelector('input[value="player1v1_1"]');
    const winnerPlayer1v1_2Radio = winnerSelectionDiv.querySelector('input[value="player1v1_2"]');
    const winnerPlayer1v1_1Label = document.getElementById('winner_player1v1_1_label');
    const winnerPlayer1v1_2Label = document.getElementById('winner_player1v1_2_label');
    const winnerTeam1LabelDiv = document.getElementById('winner_team1_label_div');
    const winnerTeam2LabelDiv = document.getElementById('winner_team2_label_div');
    const team1Player1Label = document.getElementById('team1_player1_label');
    const team1Player3Label = document.getElementById('team1_player3_label');
    const team2Player2Label = document.getElementById('team2_player2_label');
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
        hideMessage('matchErrorMessage'); // Clear match errors on game type change

        if (selectedGameType === '1v1') {
            player1v1_1Div.classList.remove('hidden');
            player1v1_2Div.classList.remove('hidden');
            player2v2_3Div.classList.add('hidden');
            player2v2_4Div.classList.add('hidden');

            // Show 1v1 winner radios, hide 2v2 winner radios
            winnerPlayer1v1_1Radio.parentNode.classList.remove('hidden');
            winnerPlayer1v1_2Radio.parentNode.classList.remove('hidden');
            winnerTeam1LabelDiv.classList.add('hidden');
            winnerTeam2LabelDiv.classList.add('hidden');

            // Reset winner selection to 1v1 players
            winnerPlayer1v1_1Radio.checked = true;

        } else { // 2v2
            player1v1_1Div.classList.remove('hidden');
            player1v1_2Div.classList.remove('hidden');
            player2v2_3Div.classList.remove('hidden');
            player2v2_4Div.classList.remove('hidden');

            // Hide 1v1 winner radios, show 2v2 winner radios
            winnerPlayer1v1_1Radio.parentNode.classList.add('hidden');
            winnerPlayer1v1_2Radio.parentNode.classList.add('hidden');
            winnerTeam1LabelDiv.classList.remove('hidden');
            winnerTeam2LabelDiv.classList.remove('hidden');

            // Set winner radio values for teams
            winnerSelectionDiv.querySelector('input[value="team1"]').checked = true;
        }
        updateWinnerLabels(); // Update team labels immediately
    }

    /**
     * Updates the winner selection labels with current player names.
     */
    function updateWinnerLabels() {
        winnerPlayer1v1_1Label.textContent = player1v1_1Input.value.trim() || 'Player 1';
        winnerPlayer1v1_2Label.textContent = player1v1_2Input.value.trim() || 'Player 2';
        
        team1Player1Label.textContent = player1v1_1Input.value.trim() || 'Player 1';
        team1Player3Label.textContent = player2v2_3Input.value.trim() || 'Player 3';
        team2Player2Label.textContent = player1v1_2Input.value.trim() || 'Player 2';
        team2Player4Label.textContent = player2v2_4Input.value.trim() || 'Player 4';
    }

    /**
     * Handles adding a match to Firestore and updating leaderboard.
     */
    async function handleAddMatch() {
        hideMessage('matchErrorMessage'); // Clear previous errors
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
        let playersInMatch = [];
        let winnerPlayers = [];
        let loserPlayers = [];

        try {
            if (gameType === '1v1') {
                const p1 = player1v1_1Input.value.trim();
                const p2 = player1v1_2Input.value.trim();

                if (!p1 || !p2) {
                    showMessage('matchErrorMessage', 'Please enter names for both Player 1 and Player 2.', 'error');
                    return;
                }
                if (p1 === p2) {
                    showMessage('matchErrorMessage', 'Player names must be different in 1v1 match.', 'error');
                    return;
                }
                playersInMatch.push(p1, p2);

                const selectedWinnerValue = document.querySelector('input[name="winner"]:checked')?.value;
                if (!selectedWinnerValue) {
                    showMessage('matchErrorMessage', 'Please select a winner.', 'error');
                    return;
                }
                winnerPlayers.push(selectedWinnerValue === 'player1v1_1' ? p1 : p2);
                loserPlayers.push(selectedWinnerValue === 'player1v1_1' ? p2 : p1);

            } else { // 2v2
                const p1 = player1v1_1Input.value.trim();
                const p2 = player1v1_2Input.value.trim();
                const p3 = player2v2_3Input.value.trim();
                const p4 = player2v2_4Input.value.trim();

                if (!p1 || !p2 || !p3 || !p4) {
                    showMessage('matchErrorMessage', 'Please enter names for all four players.', 'error');
                    return;
                }
                const uniquePlayers = new Set([p1, p2, p3, p4]);
                if (uniquePlayers.size !== 4) {
                    showMessage('matchErrorMessage', 'All four player names must be unique for a 2v2 match.', 'error');
                    return;
                }
                playersInMatch.push(p1, p2, p3, p4);

                const selectedWinnerValue = document.querySelector('input[name="winner"]:checked')?.value;
                if (!selectedWinnerValue) {
                    showMessage('matchErrorMessage', 'Please select a winning team.', 'error');
                    return;
                }

                if (selectedWinnerValue === 'team1') {
                    winnerPlayers.push(p1, p3);
                    loserPlayers.push(p2, p4);
                } else { // team2
                    loserPlayers.push(p1, p3);
                    winnerPlayers.push(p2, p4);
                }
            }

            const batch = writeBatch(db);

            // Update winner stats
            for (const playerName of winnerPlayers) {
                const playerDocRef = doc(db, PLAYERS_COLLECTION_PATH, playerName);
                batch.set(playerDocRef, {
                    name: playerName,
                    [gameType === '1v1' ? 'wins1v1' : 'wins2v2']: increment(1)
                }, { merge: true });
            }

            // Update loser stats
            for (const playerName of loserPlayers) {
                const playerDocRef = doc(db, PLAYERS_COLLECTION_PATH, playerName);
                batch.set(playerDocRef, {
                    name: playerName,
                    [gameType === '1v1' ? 'losses1v1' : 'losses2v2']: increment(1)
                }, { merge: true });
            }

            await batch.commit();
            showMessage('matchErrorMessage', 'Match added successfully!', 'success');

            // Clear inputs
            player1v1_1Input.value = '';
            player1v1_2Input.value = '';
            player2v2_3Input.value = '';
            player2v2_4Input.value = '';
            updateWinnerLabels(); // Reset winner labels
            updateGameTypeDisplay(); // Reset to 1v1 view

            await fetchAndRenderLeaderboard(); // Refresh leaderboard
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
        console.log("Visibility after initiate: clearAllDataButton hidden?", clearAllDataButton.classList.contains('hidden'));
        console.log("Visibility after initiate: clearConfirmationMessage hidden?", clearConfirmationMessage.classList.contains('hidden'));
    }

    /**
     * Executes the deletion of all player data from Firestore.
     */
    async function clearAllDataConfirmed() {
        console.log("clearAllDataConfirmed called. Hiding clearConfirmationMessage, showing clearDataMessage.");
        hideMessage('clearConfirmationMessage'); // Hide confirmation prompt
        showMessage('clearDataMessage', 'Clearing all data...', 'info');
        clearAllDataButton.classList.remove('hidden'); // Show main clear button again
        console.log("Visibility after confirm: clearAllDataButton hidden?", clearAllDataButton.classList.contains('hidden'));
        console.log("Visibility after confirm: clearConfirmationMessage hidden?", clearConfirmationMessage.classList.contains('hidden'));
        console.log("Visibility after confirm: clearDataMessage hidden?", clearDataMessage.classList.contains('hidden'));


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

            const batch = writeBatch(db);
            querySnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
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
        console.log("Visibility after cancel: clearAllDataButton hidden?", clearAllDataButton.classList.contains('hidden'));
        console.log("Visibility after cancel: clearConfirmationMessage hidden?", clearConfirmationMessage.classList.contains('hidden'));
        console.log("Visibility after cancel: clearDataMessage hidden?", clearDataMessage.classList.contains('hidden'));
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
                return bTotalWins - aTotalWins;
            });

            leaderboardTableBody.innerHTML = ''; // Clear existing rows

            if (players.length === 0) {
                leaderboardTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-3 px-4 text-center text-sm text-gray-500">No players yet. Add a match to get started!</td>
                    </tr>
                `;
            } else {
                players.forEach((player) => {
                    const totalWins = (player.wins1v1 || 0) + (player.wins2v2 || 0);
                    const totalLosses = (player.losses1v1 || 0) + (player.losses2v2 || 0);
                    const totalGames = totalWins + totalLosses;
                    const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(2) : 'N/A';

                    const row = `
                        <tr class="border-b border-gray-200 hover:bg-gray-50">
                            <td class="py-3 px-4 text-sm text-gray-800">${player.name}</td>
                            <td class="py-3 px-4 text-center text-sm text-gray-800">${player.wins1v1 || 0}</td>
                            <td class="py-3 px-4 text-center text-sm text-gray-800">${player.losses1v1 || 0}</td>
                            <td class="py-3 px-4 text-center text-sm text-gray-800">${player.wins2v2 || 0}</td>
                            <td class="py-3 px-4 text-center text-sm text-gray-800">${player.losses2v2 || 0}</td>
                            <td class="py-3 px-4 text-center text-sm text-gray-800">${winRate}%</td>
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
    player1v1_1Input.addEventListener('input', updateWinnerLabels);
    player1v1_2Input.addEventListener('input', updateWinnerLabels);
    player2v2_3Input.addEventListener('input', updateWinnerLabels);
    player2v2_4Input.addEventListener('input', updateWinnerLabels);
    addMatchButton.addEventListener('click', handleAddMatch);

    // Clear All Data Event Listeners
    clearAllDataButton.addEventListener('click', initiateClearAllData);
    confirmClearButton.addEventListener('click', clearAllDataConfirmed);
    cancelClearButton.addEventListener('click', cancelClearAllData);

    // Initial display update (triggered after auth state is determined)
    updateGameTypeDisplay();
});
