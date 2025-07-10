// leaderboard.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, setDoc, collection, query, getDocs, increment, writeBatch, deleteDoc, getDoc,serverTimestamp,orderBy,limit} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js'; 
import { showMessage, hideMessage } from './utils.js';

let db;
let auth;
let currentUserId = null;

// --- ALL ELEMENT REFERENCES DECLARED HERE FOR GLOBAL ACCESS ---
// These will be assigned values inside DOMContentLoaded
let matchDateInput;
let player1Input; 
let player2Input; 
let player3Input; 
let player4Input; 
let gameTypeRadios; 
let team1PlayersContainer; 
let team2PlayersContainer; 
let winnerSelectionDiv; 
let winnerPlayer1RadioDiv; 
let winnerPlayer2RadioDiv; 
let winnerTeam1RadioDiv; 
let winnerTeam2RadioDiv; 
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
let clearAllDataButton; 
let clearConfirmationMessage; 
let confirmClearButton; 
let cancelClearButton; 
let clearDataMessage;
let scratchWinCheckboxContainer; // Global declaration for this container
let isScratchWinCheckbox; // NEW: for the scratch win checkbox
let remarksInput; // NEW: for the remarks textarea
let ballsLeftPlayer1Input; // NEW: for balls left player 1
let ballsLeftPlayer2Input; // NEW: for balls left player 2
let latestMatchesTableBody; // NEW: for the latest matches table body
let latestMatchesErrorMessage; // NEW: for latest matches error message

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
    }

    const app = initializeApp(finalFirebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase initialized.");

} catch (error) {
    console.error("Failed to initialize Firebase:", error);
    alert("Error initializing Firebase. Check console for details.");
}

const PLAYERS_COLLECTION_PATH = `artifacts/${appId}/public/data/players`;
const MATCHES_COLLECTION_PATH = `artifacts/${appId}/public/data/matches`;

// --- HELPER FUNCTIONS (MOVED TO GLOBAL SCOPE) ---
// NEW: Function to initialize or refresh the visual selected state of winner buttons
function initializeWinnerSelectionStyle() {
    document.querySelectorAll('.winner-button').forEach(label => {
        const radio = label.querySelector('input[type="radio"]');
        if (radio && radio.checked) {
            label.classList.add('is-selected');
        } else {
            label.classList.remove('is-selected');
        }
    });
}

async function fetchPlayersFromFirebase() {
    const players = [];
    try {
        const playersCol = collection(db, PLAYERS_COLLECTION_PATH);
        const q = query(playersCol, orderBy('name')); 
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(doc => {
            players.push(doc.data().name); 
        });
        return players;
    } catch (error) {
        console.error("Error fetching players for dropdowns:", error);
        showMessage('matchErrorMessageDisplay', `Error loading players for dropdowns: ${error.message}`, 'error', 5000);
        return [];
    }
}

function populatePlayerDropdowns(players) {
    const dropdownsToPopulate = [player1Input, player2Input, player3Input, player4Input];

    dropdownsToPopulate.forEach(selectElement => {
        const currentSelectedValue = selectElement.value;
        
        selectElement.innerHTML = '';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Player';
        selectElement.appendChild(defaultOption);
        
        const addNewOption = document.createElement('option');
        addNewOption.value = 'ADD_NEW_PLAYER';
        addNewOption.textContent = '-- Add New Player --';
        selectElement.appendChild(addNewOption);

        players.forEach(player => {
            const option = document.createElement('option');
            option.value = player;
            option.textContent = player;
            selectElement.appendChild(option);
        });

        if (players.includes(currentSelectedValue)) {
            selectElement.value = currentSelectedValue;
        } else {
            selectElement.value = '';
        }
    });
    // This call is now safe as updateMatchFormUI is globally defined
    updateMatchFormUI(); 
}

async function handleAddNewPlayer(selectElement) {
    const newPlayerName = prompt("Enter the name of the new player:");

    if (newPlayerName && newPlayerName.trim() !== '') {
        const trimmedName = newPlayerName.trim();
        
        const currentPlayers = await fetchPlayersFromFirebase(); 
        if (currentPlayers.some(player => player.toLowerCase() === trimmedName.toLowerCase())) {
            showMessage('matchErrorMessageDisplay', `Player "${trimmedName}" already exists.`, 'error', 5000);
            selectElement.value = ''; 
            updateMatchFormUI();
            return;
        }

        try {
            const playerRef = doc(db, PLAYERS_COLLECTION_PATH, trimmedName);
            await setDoc(playerRef, {
                name: trimmedName,
                wins1v1: 0, losses1v1: 0, games1v1: 0, winRate1v1: 0,
                wins2v2: 0, losses2v2: 0, games2v2: 0, winRate2v2: 0,
                totalWins: 0, totalLosses: 0, totalGamesPlayed: 0, overallWinRate: 0,
                currentStreak: 0,
                longestWinStreak: 0,
                longestLosingStreak: 0,
                avatarUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(trimmedName)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffeedc,f4d15b&size=64`
            });
            showMessage('matchErrorMessageDisplay', `Player "${trimmedName}" added successfully!`, 'success', 5000);

            const updatedPlayers = await fetchPlayersFromFirebase();
            populatePlayerDropdowns(updatedPlayers);

            selectElement.value = trimmedName;

        } catch (error) {
            console.error("Error adding new player:", error);
            showMessage('matchErrorMessageDisplay', `Failed to add new player: ${error.message}`, 'error', 5000);
            selectElement.value = ''; 
        }
    } else {
        selectElement.value = '';
    }
    updateMatchFormUI();
}

// MODIFIED: Function to update the display based on game type selection and player selections
function updateMatchFormUI() {
    const checkedGameTypeRadio = document.querySelector('input[name="gameType"]:checked');
    // Safely get the selected game type. If no radio button is checked (e.g., on initial load),
    // it will default to '1v1' to ensure a consistent starting state.
    const selectedGameType = checkedGameTypeRadio ? checkedGameTypeRadio.value : '1v1';

    const p1 = player1Input.value;
    const p2 = player2Input.value;
    const p3 = player3Input.value;
    const p4 = player4Input.value;
    
    if (selectedGameType === '2v2') {
        winnerTeam1RadioDiv.classList.remove('hidden');
        winnerTeam2RadioDiv.classList.remove('hidden');
        team2PlayersContainer.classList.remove('hidden');
        player3Input.disabled = false; 
        player4Input.disabled = false; 

        winnerPlayer1RadioDiv.classList.add('hidden');
        winnerPlayer2RadioDiv.classList.add('hidden');

        // Ensure balls left inputs are visible for 2v2 (do not hide)
        if (ballsLeftPlayer1Input) ballsLeftPlayer1Input.parentNode.classList.remove('hidden');
        if (ballsLeftPlayer2Input) ballsLeftPlayer2Input.parentNode.classList.remove('hidden');

    } else if (selectedGameType === '1v1' || selectedGameType === '') { // 1v1
        team2PlayersContainer.classList.add('hidden');
        player3Input.value = '';
        player4Input.value = '';
        player3Input.disabled = true; 
        player4Input.disabled = true; 

        winnerPlayer1RadioDiv.classList.remove('hidden');
        winnerPlayer2RadioDiv.classList.remove('hidden');
        winnerTeam1RadioDiv.classList.add('hidden');
        winnerTeam2RadioDiv.classList.add('hidden');

        // Ensure balls left inputs are visible for 1v1 (do not hide)
        if (ballsLeftPlayer1Input) ballsLeftPlayer1Input.parentNode.classList.remove('hidden');
        if (ballsLeftPlayer2Input) ballsLeftPlayer2Input.parentNode.classList.remove('hidden');
    }

    let allPlayersSelected = false;

    if (selectedGameType === '1v1') {
        if (p1 && p1 !== 'ADD_NEW_PLAYER' && p2 && p2 !== 'ADD_NEW_PLAYER') {
            allPlayersSelected = true;
        } else {
            // Safety check for null before setting 'checked'
            if (winnerPlayer1Radio) winnerPlayer1Radio.checked = false;
            if (winnerPlayer2Radio) winnerPlayer2Radio.checked = false;
        }
    } else if (selectedGameType === '2v2') {
        if (p1 && p1 !== 'ADD_NEW_PLAYER' && p2 && p2 !== 'ADD_NEW_PLAYER' &&
            p3 && p3 !== 'ADD_NEW_PLAYER' && p4 && p4 !== 'ADD_NEW_PLAYER') {
            allPlayersSelected = true;
        } else {
            // Safety check for null before setting 'checked'
            if (winnerTeam1Radio) winnerTeam1Radio.checked = false;
            if (winnerTeam2Radio) winnerTeam2Radio.checked = false;
        }
        // Always clear values when switching to 2v2, even if inputs are visible
        if (ballsLeftPlayer1Input) ballsLeftPlayer1Input.value = '';
        if (ballsLeftPlayer2Input) ballsLeftPlayer2Input.value = '';
    }
    updateWinnerLabels(); 
    // Call to ensure the correct winner button styling is applied after UI updates.
    initializeWinnerSelectionStyle();
}

// Function to update winner labels dynamically
function updateWinnerLabels() {
    winnerPlayer1Label.textContent = player1Input.value || 'Player 1';
    winnerPlayer2Label.textContent = player2Input.value || 'Player 2';
    team1Player1Label.textContent = player1Input.value || 'Player 1';
    team1Player2Label.textContent = player2Input.value || 'Player 2';
    team2Player3Label.textContent = player3Input.value || 'Player 3';
    team2Player4Label.textContent = player4Input.value || 'Player 4';

    // Clear winner selection when players change to ensure valid choice
    if (winnerPlayer1Radio) winnerPlayer1Radio.checked = false;
    if (winnerPlayer2Radio) winnerPlayer2Radio.checked = false;
    if (winnerTeam1Radio) winnerTeam1Radio.checked = false;
    if (winnerTeam2Radio) winnerTeam2Radio.checked = false;
}

function calculateWinRate(wins, losses) {
    if (wins === 0 && losses === 0) {
        return 0;
    }
    return (wins / (wins + losses)) * 100;
}

function formatDate(timestamp) {
    if (!timestamp) {
        return 'N/A'; // Handle null or undefined
    }

    let date;
    if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    }
    else if (timestamp instanceof Date) {
        date = timestamp;
    }
    else if (typeof timestamp === 'string') {
        // Assuming YYYY-MM-DD format from input date
        date = new Date(timestamp + 'T00:00:00Z'); // Append T00:00:00Z to treat as UTC and avoid timezone issues
    }
    else {
        console.warn('formatDate received an unhandled type for timestamp:', typeof timestamp, timestamp);
        return 'N/A';
    }
    if (date && !isNaN(date.getTime())) { // Check if date is a valid Date object
        // Use 'en-GB' locale for DD/MM/YYYY format
        return date.toLocaleDateString('en-GB');
    } else {
        console.error('formatDate: Invalid date object created from timestamp:', timestamp);
        return 'N/A';
    }
}

// Helper function to format time from a Date object
function formatTime(timestamp) {
    if (!timestamp) {
        return 'N/A';
    }
    let date;
    if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        return 'N/A';
    }

    if (date && !isNaN(date.getTime())) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } else {
        return 'N/A';
    }
}

async function handleAddMatch() {
    console.log("handleAddMatch called!");
    hideMessage('matchErrorMessageDisplay'); // Always hide any previous message at the start

    // Get game type first, as it dictates other requirements
    const checkedGameTypeRadio = document.querySelector('input[name="gameType"]:checked');
    if (!checkedGameTypeRadio) {
        showMessage('matchErrorMessageDisplay', 'Please select a game type (1v1 or 2v2).', 5000);
        console.error("Error: No game type selected.");
        return; // Exit if game type is not selected
    }
    const gameType = checkedGameTypeRadio.value;
    console.log("Game Type:", gameType);

    // USE the globally declared playerInput variables directly:
    const player1Name = player1Input ? player1Input.value.trim() : '';
    const player2Name = player2Input ? player2Input.value.trim() : '';
    const player3Name = player3Input ? player3Input.value.trim() : '';
    const player4Name = player4Input ? player4Input.value.trim() : '';
    const matchDate = matchDateInput ? matchDateInput.value : ''; // Assuming matchDateInput is globally assigned or needs to be retrieved here.

    // Get additional match details
    const isScratchWin = isScratchWinCheckbox ? isScratchWinCheckbox.checked : false;
    const remarks = remarksInput ? remarksInput.value.trim() : '';
    // Parse ballsLeft inputs safely, allowing null for empty strings
    const ballsLeftPlayer1 = ballsLeftPlayer1Input.value.trim() !== '' ? parseInt(ballsLeftPlayer1Input.value) : null;
    const ballsLeftPlayer2 = ballsLeftPlayer2Input.value.trim() !== '' ? parseInt(ballsLeftPlayer2Input.value) : null;

    console.log("Player 1 Name:", player1Name);
    console.log("Player 2 Name:", player2Name);
    console.log("Player 3 Name:", player3Name); // Will be '' for 1v1 if not present
    console.log("Player 4 Name:", player4Name); // Will be '' for 1v1 if not present
    console.log("Match Date:", matchDate);
    console.log("Is Scratch Win:", isScratchWin);
    console.log("Remarks:", remarks);
    console.log("Balls Left Player 1:", ballsLeftPlayer1);
    console.log("Balls Left Player 2:", ballsLeftPlayer2);


    // --- CONSOLIDATED BASIC FIELD VALIDATION ---
    let missingFields = [];

    // Check Player 1 and Player 2 for any game type
    // The 'ADD_NEW_PLAYER' value from a dropdown indicates an incomplete selection
    if (!player1Name || player1Name === 'ADD_NEW_PLAYER') {
        missingFields.push('Player 1');
    }
    if (!player2Name || player2Name === 'ADD_NEW_PLAYER') {
        missingFields.push('Player 2');
    }

    // Check Player 3 and Player 4 only if game type is 2v2
    if (gameType === '2v2') {
        if (!player3Name || player3Name === 'ADD_NEW_PLAYER') {
            missingFields.push('Player 3');
        }
        if (!player4Name || player4Name === 'ADD_NEW_PLAYER') {
            missingFields.push('Player 4');
        }
    }

    // Check Match Date
    if (!matchDate) {
        missingFields.push('Match Date');
    }

    // If any fields are missing, display a comprehensive error message
    if (missingFields.length > 0) {
        let errorMessage = 'Please fill in all required fields: ' + missingFields.join(', ') + '.';
        console.log("DEBUG: Validation failed. Attempting to show error message:", errorMessage); // <-- ADD THIS LOG
        showMessage('matchErrorMessageDisplay', errorMessage, 'error', 5000);
        console.log("DEBUG: showMessage called. Returning from handleAddMatch."); // <-- ADD THIS LOG
        return; // Stop function execution if basic fields are missing
    }
    // --- END CONSOLIDATED BASIC FIELD VALIDATION ---

    // Now proceed with more specific logical validations,
    // assuming all basic fields are filled and valid (not 'ADD_NEW_PLAYER')

    let winnerName, loserName;
    let team1Players = [];
    let team2Players = [];
    let winningTeam = []; // Initialize here
    let losingTeam = [];  // Initialize here
    let ballsLeftWinner = null;
    let ballsLeftLoser = null;

    if (gameType === '1v1') {
        // Player names cannot be the same in 1v1
        if (player1Name === player2Name) {
            showMessage('matchErrorMessageDisplay', 'Player 1 and Player 2 cannot be the same in 1v1.', 'error', 5000);
            return;
        }

        const selectedWinnerRadio = document.querySelector('input[name="winner"]:checked');
        if (!selectedWinnerRadio) {
            showMessage('matchErrorMessageDisplay', 'Please select a winner for the 1v1 match.', 5000);
            return;
        }

        if (selectedWinnerRadio.value !== 'player1' && selectedWinnerRadio.value !== 'player2') {
            showMessage('matchErrorMessageDisplay', 'Invalid winner selection for 1v1 game type. Please re-select.', 'error', 5000);
            return;
        }

        winnerName = selectedWinnerRadio.value === 'player1' ? player1Name : player2Name;
        loserName = selectedWinnerRadio.value === 'player1' ? player2Name : player1Name;

        // Assign balls left based on winner/loser
        ballsLeftWinner = selectedWinnerRadio.value === 'player1' ? ballsLeftPlayer1 : ballsLeftPlayer2;
        ballsLeftLoser = selectedWinnerRadio.value === 'player1' ? ballsLeftPlayer2 : ballsLeftPlayer1;

    } else { // 2v2
        // All four players must be unique for 2v2
        const allPlayers = [player1Name, player2Name, player3Name, player4Name];
        const uniquePlayers = new Set(allPlayers);
        if (uniquePlayers.size !== 4) {
            showMessage('matchErrorMessageDisplay', 'All four players must be unique for 2v2.', 'error', 5000);
            return;
        }

        const selectedWinnerRadio = document.querySelector('input[name="winner"]:checked');
        if (!selectedWinnerRadio) {
            showMessage('matchErrorMessageDisplay', 'Please select a winning team for the 2v2 match.', 5000);
            return;
        }

        if (selectedWinnerRadio.value !== 'team1' && selectedWinnerRadio.value !== 'team2') {
            showMessage('matchErrorMessageDisplay', 'Invalid winner selection for 2v2 game type. Please re-select.', 'error', 5000);
            return;
        }

        team1Players = [player1Name, player2Name];
        team2Players = [player3Name, player4Name];

        if (selectedWinnerRadio.value === 'team1') {
            winningTeam = team1Players;
            losingTeam = team2Players;
            ballsLeftWinner = ballsLeftPlayer1; // Assign for 2v2 winner
            ballsLeftLoser = ballsLeftPlayer2;  // Assign for 2v2 loser
        } else {
            winningTeam = team2Players;
            losingTeam = team1Players;
            ballsLeftWinner = ballsLeftPlayer2; // Assign for 2v2 winner
            ballsLeftLoser = ballsLeftPlayer1;  // Assign for 2v2 loser
        }
    }

    // If we reach here, all initial and specific validations passed.
    // Proceed with Firebase operations.
    try {
        const batch = writeBatch(db);
        const playersToUpdate = new Set();
        const matchId = doc(collection(db, MATCHES_COLLECTION_PATH)).id;

        let matchData = {
            date: matchDate,
            gameType: gameType,
            timestamp: serverTimestamp(),
            players: [],
            winner: null,
            loser: null,
            winningTeam: [],
            losingTeam: [],
            isScratchWin: isScratchWin, // NEW
            remarks: remarks, // NEW
            ballsLeftWinner: ballsLeftWinner, // NEW
            ballsLeftLoser: ballsLeftLoser // NEW
        };

        if (gameType === '1v1') {
            playersToUpdate.add(winnerName);
            playersToUpdate.add(loserName);
            matchData.winner = winnerName;
            matchData.loser = loserName;
            matchData.players = [winnerName, loserName];
        } else {
            winningTeam.forEach(p => playersToUpdate.add(p));
            losingTeam.forEach(p => playersToUpdate.add(p));
            matchData.winningTeam = winningTeam;
            matchData.losingTeam = losingTeam;
            matchData.players = [...winningTeam, ...losingTeam];
        }

        batch.set(doc(db, MATCHES_COLLECTION_PATH, matchId), matchData);

        const playersData = new Map();
        for (const playerName of playersToUpdate) {
            const playerRef = doc(db, PLAYERS_COLLECTION_PATH, playerName);
            const playerDoc = await getDoc(playerRef);
            if (playerDoc.exists()) {
                playersData.set(playerName, playerDoc.data());
            } else {
                playersData.set(playerName, {
                    name: playerName,
                    wins1v1: 0, losses1v1: 0, games1v1: 0, winRate1v1: 0,
                    wins2v2: 0, losses2v2: 0, games2v2: 0, winRate2v2: 0,
                    totalWins: 0, totalLosses: 0, totalGamesPlayed: 0, overallWinRate: 0,
                    currentStreak: 0,
                    longestWinStreak: 0,
                    longestLosingStreak: 0,
                    avatarUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(playerName)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffeedc,f4d15b&size=64`
                });
                batch.set(playerRef, playersData.get(playerName));
            }
        }

        for (const playerName of playersToUpdate) {
            const playerRef = doc(db, PLAYERS_COLLECTION_PATH, playerName);
            const currentData = playersData.get(playerName);

            let newWins1v1 = currentData.wins1v1;
            let newLosses1v1 = currentData.losses1v1;
            let newWins2v2 = currentData.wins2v2;
            let newLosses2v2 = currentData.losses2v2;
            let newCurrentStreak = currentData.currentStreak || 0;
            let newLongestWinStreak = currentData.longestWinStreak || 0;
            let newLongestLosingStreak = currentData.longestLosingStreak || 0;

            if (gameType === '1v1') {
                if (playerName === winnerName) {
                    newWins1v1++;
                    newCurrentStreak = (newCurrentStreak < 0 ? 0 : newCurrentStreak) + 1;
                } else {
                    newLosses1v1++;
                    newCurrentStreak = (newCurrentStreak > 0 ? 0 : newCurrentStreak) - 1;
                }
            } else {
                if (winningTeam.includes(playerName)) {
                    newWins2v2++;
                    newCurrentStreak = (newCurrentStreak < 0 ? 0 : newCurrentStreak) + 1;
                } else {
                    newLosses2v2++;
                    newCurrentStreak = (newCurrentStreak > 0 ? 0 : newCurrentStreak) - 1;
                }
            }

            if (newCurrentStreak > 0) {
                if (newCurrentStreak > newLongestWinStreak) {
                    newLongestWinStreak = newCurrentStreak;
                }
            } else if (newCurrentStreak < 0) {
                if (Math.abs(newCurrentStreak) > newLongestLosingStreak) {
                    newLongestLosingStreak = Math.abs(newCurrentStreak);
                }
            }

            const newGames1v1 = newWins1v1 + newLosses1v1;
            const newWinRate1v1 = calculateWinRate(newWins1v1, newWins1v1 + newLosses1v1);

            const newGames2v2 = newWins2v2 + newLosses2v2;
            const newWinRate2v2 = calculateWinRate(newWins2v2, newWins2v2 + newLosses2v2);

            const newTotalWins = newWins1v1 + newWins2v2;
            const newTotalLosses = newLosses1v1 + newLosses2v2;
            const newTotalGamesPlayed = newTotalWins + newTotalLosses;
            const newOverallWinRate = calculateWinRate(newTotalWins, newTotalWins + newTotalLosses);

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
                longestWinStreak: newLongestWinStreak,
                longestLosingStreak: newLongestLosingStreak,
                lastPlayed: matchData.date
            });

            if (gameType === '1v1') {
                const opponentName = (playerName === winnerName) ? loserName : winnerName;
                if (opponentName) {
                    const rivalryDocRef = doc(db, PLAYERS_COLLECTION_PATH, playerName, 'rivalries', opponentName);
                    batch.set(rivalryDocRef, {
                        wins: increment(playerName === winnerName ? 1 : 0),
                        losses: increment(playerName === loserName ? 1 : 0)
                    }, { merge: true });
                }
            } else {
                const currentTeam = winningTeam.includes(playerName) ? winningTeam : losingTeam;
                const opposingTeam = (currentTeam === winningTeam) ? losingTeam : winningTeam; // Fixed: Ensure opposingTeam is correctly assigned based on currentTeam

                for (const opponent of opposingTeam) {
                    const rivalryDocRef = doc(db, PLAYERS_COLLECTION_PATH, playerName, 'rivalries', opponent);
                    batch.set(rivalryDocRef, {
                        wins: increment(currentTeam === winningTeam ? 1 : 0),
                        losses: increment(currentTeam === losingTeam ? 1 : 0)
                    }, { merge: true });
                }

                const teammate = currentTeam.find(p => p !== playerName);
                if (teammate) {
                    batch.update(playerRef, {
                        [`partnerships.${teammate}.wins`]: increment(currentTeam === winningTeam ? 1 : 0),
                        [`partnerships.${teammate}.losses`]: increment(currentTeam === losingTeam ? 1 : 0)
                    });
                }
            }
        }

        await batch.commit();
        // Call showMessage with duration for success message
        showMessage('matchErrorMessageDisplay', 'Match added successfully and player stats updated!', 'success', 5000); // Display for 5 seconds

        // Clear inputs after successful submission
        player1Input.value = '';
        player2Input.value = '';
        player3Input.value = '';
        player4Input.value = '';
        isScratchWinCheckbox.checked = false; // NEW
        remarksInput.value = ''; // NEW
        ballsLeftPlayer1Input.value = ''; // NEW
        ballsLeftPlayer2Input.value = ''; // NEW

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        matchDateInput.value = `${year}-${month}-${day}`;

        document.querySelectorAll('input[name="winner"]').forEach(radio => {
            radio.checked = false;
        });

        updateWinnerLabels();
        await fetchAndRenderLeaderboard();
        await fetchAndRenderLatestMatches(); // NEW: Refresh latest matches table
    } catch (error) {
        console.error("Error adding match or updating player stats:", error);
        showMessage('matchErrorMessageDisplay', `Error adding match: ${error.message}`, 'error', 5000); // Added duration
    }
}

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
                longestWinStreak: data.longestWinStreak || 0,
                longestLosingStreak: 0,
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

            const rankCell = row.insertCell();
            rankCell.className = 'py-3 px-4 text-left whitespace-nowrap';
            rankCell.textContent = index + 1;

            const playerCell = row.insertCell();
            playerCell.className = 'py-3 px-4 text-left whitespace-nowrap';
            const encodedPlayerName = encodeURIComponent(player.name);
            playerCell.innerHTML = `
                <a href="playerProfile.html?playerName=${encodedPlayerName}" class="flex items-center text-blue-300 hover:text-blue-200 font-medium transition duration-150 ease-in-out">
                    <img src="${player.avatarUrl}" alt="${player.name}" class="w-8 h-8 rounded-full mr-3 border-2 border-purple-500">
                    <span>${player.name}</span>
                </a>
            `;

            const games1v1Cell = row.insertCell();
            games1v1Cell.className = 'py-3 px-4 text-center whitespace-nowrap';
            games1v1Cell.textContent = player.games1v1;

            const winRate1v1Cell = row.insertCell();
            winRate1v1Cell.className = 'py-3 px-4 text-center whitespace-nowrap';
            winRate1v1Cell.textContent = `${player.wins1v1}W - ${player.losses1v1}L`;

            const games2v2Cell = row.insertCell();
            games2v2Cell.className = 'py-3 px-4 text-center whitespace-nowrap';
            games2v2Cell.textContent = player.games2v2;

            const winRate2v2Cell = row.insertCell();
            winRate2v2Cell.className = 'py-3 px-4 text-center whitespace-nowrap';
            winRate2v2Cell.textContent = `${player.wins2v2}W - ${player.losses2v2}L`;

            const overallWinRateCell = row.insertCell();
            overallWinRateCell.className = 'py-3 px-4 text-center whitespace-nowrap';
            overallWinRateCell.textContent = `${player.overallWinRate.toFixed(2)}%`;

            const streakCell = row.insertCell();
            streakCell.className = 'py-3 px-4 text-center whitespace-nowrap';

            let streakText;
            if (player.currentStreak > 0) {
                streakText = `+${player.currentStreak}`; 
            } else if (player.currentStreak < 0) {
                streakText = `${player.currentStreak}`; 
            } else {
                streakText = '0'; 
            }

            streakCell.textContent = streakText;
            streakCell.classList.add(player.currentStreak > 0 ? 'text-green-400' : (player.currentStreak < 0 ? 'text-red-400' : 'text-gray-400'));

            const lastPlayedCell = row.insertCell();
            lastPlayedCell.className = 'py-3 px-4 text-left whitespace-nowrap';
            lastPlayedCell.textContent = formatDate(player.lastPlayed);
        });

    } catch (error) {
        console.error("Error fetching or rendering leaderboard:", error);
        showMessage('matchErrorMessageDisplay', `Error loading leaderboard: ${error.message}`, 'error');
    }
}

// UPDATED: Function to fetch and render the latest 6 matches
async function fetchAndRenderLatestMatches() {
    try {
        const matchesCol = collection(db, MATCHES_COLLECTION_PATH);
        const q = query(
            matchesCol,
            orderBy('timestamp', 'desc'), // Order by timestamp descending for latest matches
            limit(6) // Limit to the latest 6 matches
        );

        const querySnapshot = await getDocs(q);
        const matches = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            // Ensure timestamp is a Date object for formatting, if it's a Firestore Timestamp
            if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                data.timestamp = data.timestamp.toDate();
            }
            matches.push(data);
        });

        latestMatchesTableBody.innerHTML = ''; // Clear existing rows

        if (matches.length === 0) {
            latestMatchesTableBody.innerHTML = '<tr><td colspan="8" class="py-3 px-4 text-center text-sm text-gray-400">No matches played yet. Add a match!</td></tr>';
            return;
        }

        matches.forEach(match => {
            const row = latestMatchesTableBody.insertRow();
            row.className = 'border-b border-gray-600 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500';

            // Date
            const dateCell = row.insertCell();
            dateCell.className = 'py-3 px-4 text-left whitespace-nowrap border-r border-gray-500'; // Added border
            // Use match.timestamp for full date/time consistency if match.date is just "YYYY-MM-DD"
            dateCell.textContent = formatDate(match.timestamp); 

            // Time
            const timeCell = row.insertCell();
            timeCell.className = 'py-3 px-4 text-center whitespace-nowrap border-r border-gray-500'; // Added border
            timeCell.textContent = formatTime(match.timestamp);

            // Game Type
            const typeCell = row.insertCell();
            typeCell.className = 'py-3 px-4 text-center whitespace-nowrap border-r border-gray-500'; // Added border
            typeCell.textContent = match.gameType.toUpperCase();

            // Winner(s)
            const winnerCell = row.insertCell();
            winnerCell.className = 'py-3 px-4 text-left whitespace-nowrap text-green-400 border-r border-gray-500'; // Added border
            if (match.gameType === '1v1') {
                winnerCell.textContent = match.winner;
            } else {
                winnerCell.textContent = match.winningTeam.join(' & ');
            }

            // Balls Potted (Winner) - Now applies to all game types if values exist
            const ballsPottedWinnerCell = row.insertCell();
            ballsPottedWinnerCell.className = 'py-3 px-4 text-center whitespace-nowrap border-r border-gray-500'; 
            const winnerBallsLeft = parseInt(match.ballsLeftWinner);
            if (!isNaN(winnerBallsLeft) && winnerBallsLeft !== null) { 
                ballsPottedWinnerCell.textContent = 7 - winnerBallsLeft;
            } else {
                ballsPottedWinnerCell.textContent = 'N/A';
            }

            // Loser(s)
            const loserCell = row.insertCell();
            loserCell.className = 'py-3 px-4 text-left whitespace-nowrap text-red-400 border-r border-gray-500'; // Added border
            if (match.gameType === '1v1') {
                loserCell.textContent = match.loser;
            } else {
                loserCell.textContent = match.losingTeam.join(' & ');
            }

            // Balls Potted (Loser) - Now applies to all game types if values exist
            const ballsPottedLoserCell = row.insertCell();
            ballsPottedLoserCell.className = 'py-3 px-4 text-center whitespace-nowrap border-r border-gray-500';
            const loserBallsLeft = parseInt(match.ballsLeftLoser);
            if (!isNaN(loserBallsLeft) && loserBallsLeft !== null) { 
                ballsPottedLoserCell.textContent = 7 - loserBallsLeft;
            } else {
                ballsPottedLoserCell.textContent = 'N/A';
            }

            // Scratch Win
            const scratchWinCell = row.insertCell();
            scratchWinCell.className = 'py-3 px-4 text-center whitespace-nowrap'; // No border-r for the last column
            scratchWinCell.textContent = match.isScratchWin ? 'Yes' : 'No';

            // Removed: Comments column
        });

    } catch (error) {
        console.error("Error fetching or rendering latest matches:", error);
        showMessage('latestMatchesErrorMessage', `Error loading latest matches: ${error.message}`, 'error');
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
        confirmClearButton.disabled = true;
        cancelClearButton.disabled = true;
        showMessage('clearDataMessage', 'Clearing data, please wait...', 'info');

        const playersRef = collection(db, PLAYERS_COLLECTION_PATH);
        const matchesRef = collection(db, MATCHES_COLLECTION_PATH);

        const playerDocs = await getDocs(playersRef);
        const playerBatch = writeBatch(db);

        // --- Step 1: Delete Rivalries Subcollections for each player ---
        // This is necessary because deleting a parent document does not delete its subcollections
        for (const playerDoc of playerDocs.docs) { // Iterate over player documents
            const rivalrySubcollectionRef = collection(db, PLAYERS_COLLECTION_PATH, playerDoc.id, 'rivalries'); // Assuming 'rivalries' is the subcollection name
            const rivalryDocs = await getDocs(rivalrySubcollectionRef);

            // Add each rivalry document to the current batch for deletion
            rivalryDocs.forEach(rivalryDoc => {
                playerBatch.delete(rivalryDoc.ref);
            });
            console.log(`Rivalries for player ${playerDoc.id} added to batch for deletion.`);
        }
        
        // --- Step 2: Delete Player Documents themselves ---
        playerDocs.forEach(doc => {
            playerBatch.delete(doc.ref);
        });
        
        // Commit the batch containing both rivalries and player document deletions
        await playerBatch.commit();
        console.log("All player data (including rivalries) deleted.");

        // --- Delete Match Documents (remains the same) ---
        const matchDocs = await getDocs(matchesRef);
        const matchBatch = writeBatch(db); // Create a new batch for matches or add to the existing if size permits
        matchDocs.forEach(doc => {
            matchBatch.delete(doc.ref);
        });
        await matchBatch.commit();
        console.log("All match data deleted.");

        showMessage('clearDataMessage', 'All leaderboard data has been successfully cleared.', 'success', 3000);
        await fetchAndRenderLeaderboard();
        await fetchAndRenderLatestMatches(); // Refresh latest matches table after clear
        const playersAfterClear = await fetchPlayersFromFirebase();
        populatePlayerDropdowns(playersAfterClear);
    } catch (error) {
        console.error("Error clearing all data:", error);
        showMessage('matchErrorMessageDisplay', `Error clearing data: ${error.message}`, 'error', 5000); // Added duration
    } finally {
        if (clearConfirmationMessage) {
            clearConfirmationMessage.classList.add('hidden');
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

// --- DOMContentLoaded Block ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded fired.");

    // --- ASSIGNMENTS TO ELEMENT REFERENCES ---
    // (All your existing assignments here are correct and should remain)
    gameTypeRadios = document.querySelectorAll('input[name="gameType"]');
    team1PlayersContainer = document.getElementById('team1PlayersContainer'); 
    team2PlayersContainer = document.getElementById('team2PlayersContainer'); 

    player1Input = document.getElementById('player1'); 
    player2Input = document.getElementById('player2'); 
    player3Input = document.getElementById('player3'); 
    player4Input = document.getElementById('player4'); 
    matchDateInput = document.getElementById('matchDate');

    scratchWinCheckboxContainer = document.getElementById('scratchWinCheckboxContainer');
    isScratchWinCheckbox = document.getElementById('isScratchWin'); // NEW
    remarksInput = document.getElementById('remarks'); // NEW
    ballsLeftPlayer1Input = document.getElementById('ballsLeftPlayer1'); // NEW
    ballsLeftPlayer2Input = document.getElementById('ballsLeftPlayer2'); // NEW

    winnerSelectionDiv = document.getElementById('winnerSelection');
    winnerPlayer1RadioDiv = document.getElementById('winner_player1_radio_div'); 
    winnerPlayer2RadioDiv = document.getElementById('winner_player2_radio_div'); 
    winnerTeam1RadioDiv = document.getElementById('winner_team1_radio_div'); 
    winnerTeam2RadioDiv = document.getElementById('winner_team2_radio_div'); 

    winnerPlayer1Radio = document.querySelector('#winner_player1_radio_div input'); 
    winnerPlayer2Radio = document.querySelector('#winner_player2_radio_div input'); 
    winnerTeam1Radio = document.querySelector('#winner_team1_radio_div input'); 
    winnerTeam2Radio = document.querySelector('#winner_team2_radio_div input'); 

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
    matchErrorMessageDisplay = document.getElementById('matchErrorMessageDisplay'); 
    latestMatchesTableBody = document.getElementById('latestMatchesTableBody'); // NEW
    latestMatchesErrorMessage = document.getElementById('latestMatchesErrorMessage'); // NEW

    clearAllDataButton = document.getElementById('clearAllDataButton'); 
    clearConfirmationMessage = document.getElementById('clearConfirmationMessage'); 
    confirmClearButton = document.getElementById('confirmClearButton'); 
    cancelClearButton = document.getElementById('cancelClearButton'); 
    clearDataMessage = document.getElementById('clearDataMessage'); 
    // --- END ASSIGNMENTS ---

    // --- Set current date ---
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); 
    const day = String(today.getDate()).padStart(2, '0');
    matchDateInput.value = `${year}-${month}-${day}`;

    // Authenticate user
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            console.log("User signed in anonymously with UID:", currentUserId);
            await fetchAndRenderLeaderboard();
            await fetchAndRenderLatestMatches(); // Fetch and render latest matches on auth
            const players = await fetchPlayersFromFirebase(); 
            populatePlayerDropdowns(players); 
            
            // --- ADD THIS LINE: Update labels AFTER dropdowns are populated ---
            updateWinnerLabels(); 
        } else {
            try {
                await signInAnonymously(auth);
                console.log("Signed in anonymously.");
            } catch (error) {
                console.error("Error signing in anonymously:", error);
                showMessage('matchErrorMessageDisplay', `Authentication error: ${error.message}`, 'error', 5000); // Added duration
            }
        }
    });

    // --- Event Listeners ---
    gameTypeRadios.forEach(radio => radio.addEventListener('change', updateMatchFormUI));

    const playerSelects = [player1Input, player2Input, player3Input, player4Input];
    playerSelects.forEach(selectElement => {
        selectElement.addEventListener('change', (event) => {
            if (event.target.value === 'ADD_NEW_PLAYER') {
                handleAddNewPlayer(event.target);
            } else {
                updateMatchFormUI(); // This will call updateWinnerLabels() when a player is manually changed
            }
        });
    });

    addMatchButton.addEventListener('click', handleAddMatch); // handleAddMatch also calls updateWinnerLabels()

    clearAllDataButton.addEventListener('click', initiateClearAllData);
    confirmClearButton.addEventListener('click', clearAllDataConfirmed); 
    cancelClearButton.addEventListener('click', cancelClearAllData); 

    // Initial display update based on default selections
    // This initial call will likely set 'Player 1' placeholders,
    // but the call inside onAuthStateChanged will correct it later.
    updateMatchFormUI(); 
});