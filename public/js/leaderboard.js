// leaderboard.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, setDoc, collection, query, getDocs, increment, writeBatch, deleteDoc, getDoc,serverTimestamp,orderBy} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js'; 

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

function hideMessage(elementId) {
    const displayElement = document.getElementById(elementId);
    if (displayElement) {
        displayElement.classList.add('hidden');
        displayElement.textContent = ''; 
    }
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
        showMessage('matchErrorMessageDisplay', `Error loading players for dropdowns: ${error.message}`, 'error');
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
            showMessage('matchErrorMessageDisplay', `Player "${trimmedName}" already exists.`, 'error');
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
            showMessage('matchErrorMessageDisplay', `Player "${trimmedName}" added successfully!`, 'success');

            const updatedPlayers = await fetchPlayersFromFirebase();
            populatePlayerDropdowns(updatedPlayers);

            selectElement.value = trimmedName;

        } catch (error) {
            console.error("Error adding new player:", error);
            showMessage('matchErrorMessageDisplay', `Failed to add new player: ${error.message}`, 'error');
            selectElement.value = ''; 
        }
    } else {
        selectElement.value = '';
    }
    updateMatchFormUI();
}

// Function to update the display based on game type selection and player selections
function updateMatchFormUI() {
    const selectedGameType = document.querySelector('input[name="gameType"]:checked').value;

    const p1 = player1Input.value;
    const p2 = player2Input.value;
    const p3 = player3Input.value; 
    const p4 = player4Input.value; 

    if (selectedGameType === '2v2') {
        team2PlayersContainer.classList.remove('hidden');
        player3Input.disabled = false; 
        player4Input.disabled = false; 

        winnerPlayer1RadioDiv.classList.add('hidden');
        winnerPlayer2RadioDiv.classList.add('hidden');
        winnerTeam1RadioDiv.classList.remove('hidden');
        winnerTeam2RadioDiv.classList.remove('hidden');
    } else { // 1v1
        team2PlayersContainer.classList.add('hidden');
        player3Input.value = '';
        player4Input.value = '';
        player3Input.disabled = true; 
        player4Input.disabled = true; 

        winnerPlayer1RadioDiv.classList.remove('hidden');
        winnerPlayer2RadioDiv.classList.remove('hidden');
        winnerTeam1RadioDiv.classList.add('hidden');
        winnerTeam2RadioDiv.classList.add('hidden');
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
    }

    if (allPlayersSelected) {
        if (scratchWinCheckboxContainer) { 
            scratchWinCheckboxContainer.classList.remove('hidden');
        }
    } else {
        if (scratchWinCheckboxContainer) { 
            scratchWinCheckboxContainer.classList.add('hidden');
            // Safe access to scratchWinCheckbox
            const scratchCheckbox = document.getElementById('scratchWinCheckbox');
            if (scratchCheckbox) { // Check if the element exists before trying to set its property
                scratchCheckbox.checked = false; 
            }
        }
    }

    updateWinnerLabels(); 
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
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) {
        const date = timestamp.toDate();
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    return 'N/A'; 
}

async function handleAddMatch() {
    hideMessage('matchErrorMessageDisplay'); 

    const gameType = document.querySelector('input[name="gameType"]:checked').value;
    const player1Name = player1Input.value.trim();
    const player2Name = player2Input.value.trim();
    const player3Name = player3Input.value.trim(); 
    const player4Name = player4Input.value.trim(); 
    const matchDate = matchDateInput.value;

    if (player1Name === 'ADD_NEW_PLAYER' || player2Name === 'ADD_NEW_PLAYER' ||
        (gameType === '2v2' && (player3Name === 'ADD_NEW_PLAYER' || player4Name === 'ADD_NEW_PLAYER'))) {
        showMessage('matchErrorMessageDisplay', 'Please select existing players or add new players before submitting a match.', 'error');
        return;
    }

    let winnerName, loserName;
    let team1Players = [];
    let team2Players = [];
    let winningTeam, losingTeam;

    if (!player1Name || !player2Name || !matchDate) {
        showMessage('matchErrorMessageDisplay', 'Player 1, Player 2, and Match Date are required.', 'error');
        return;
    }

    if (gameType === '1v1') {
        const selectedWinnerRadio = document.querySelector('input[name="winner"]:checked');
        
        if (!selectedWinnerRadio) {
            showMessage('matchErrorMessageDisplay', 'Please select a winner.', 'error');
            return;
        }
        
        if (selectedWinnerRadio.value !== 'player1' && selectedWinnerRadio.value !== 'player2') {
            showMessage('matchErrorMessageDisplay', 'Invalid winner selection for 1v1 game type. Please re-select.', 'error');
            return;
        }

        if (player1Name === player2Name) {
            showMessage('matchErrorMessageDisplay', 'Player 1 and Player 2 cannot be the same in 1v1.', 'error');
            return;
        }
        winnerName = selectedWinnerRadio.value === 'player1' ? player1Name : player2Name;
        loserName = selectedWinnerRadio.value === 'player1' ? player2Name : player1Name;

    } else { // 2v2
        if (!player3Name || !player4Name) {
            showMessage('matchErrorMessageDisplay', 'All four player names are required for 2v2.', 'error');
            return;
        }
        const allPlayers = [player1Name, player2Name, player3Name, player4Name];
        const uniquePlayers = new Set(allPlayers);
        if (uniquePlayers.size !== 4) {
            showMessage('matchErrorMessageDisplay', 'All four players must be unique for 2v2.', 'error');
            return;
        }

        const selectedWinnerRadio = document.querySelector('input[name="winner"]:checked');
        
        if (!selectedWinnerRadio) {
            showMessage('matchErrorMessageDisplay', 'Please select a winning team.', 'error');
            return;
        }

        if (selectedWinnerRadio.value !== 'team1' && selectedWinnerRadio.value !== 'team2') {
            showMessage('matchErrorMessageDisplay', 'Invalid winner selection for 2v2 game type. Please re-select.', 'error');
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
        const matchId = doc(collection(db, MATCHES_COLLECTION_PATH)).id; 

        let matchData = {
            date: matchDate,
            gameType: gameType,
            timestamp: serverTimestamp(),
            players: [], 
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
                longestWinStreak: newLongestWinStreak,
                longestLosingStreak: newLongestLosingStreak,
                lastPlayed: serverTimestamp()
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
                const opposingTeam = winningTeam.includes(playerName) ? losingTeam : winningTeam;

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
        showMessage('matchErrorMessageDisplay', 'Match added successfully and player stats updated!', 'success');

        player1Input.value = '';
        player2Input.value = '';
        player3Input.value = '';
        player4Input.value = '';

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
    } catch (error) {
        console.error("Error adding match or updating player stats:", error);
        showMessage('matchErrorMessageDisplay', `Error adding match: ${error.message}`, 'error');
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
                longestLosingStreak: data.longestLosingStreak || 0,
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
                <a href="playerProfile.html?playerName=${encodedPlayerName}" class="flex items-center text-blue-300 hover:text-blue-200 transition duration-150 ease-in-out">
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
        playerDocs.forEach(doc => {
            playerBatch.delete(doc.ref);
        });
        await playerBatch.commit();
        console.log("All player data deleted.");

        const matchDocs = await getDocs(matchesRef);
        const matchBatch = writeBatch(db);
        matchDocs.forEach(doc => {
            matchBatch.delete(doc.ref);
        });
        await matchBatch.commit();
        console.log("All match data deleted.");

        showMessage('clearDataMessage', 'All leaderboard data has been successfully cleared.', 'success');
        await fetchAndRenderLeaderboard(); 
        const playersAfterClear = await fetchPlayersFromFirebase();
        populatePlayerDropdowns(playersAfterClear);
    } catch (error) {
        console.error("Error clearing all data:", error);
        showMessage('matchErrorMessageDisplay', `Error clearing data: ${error.message}`, 'error'); 
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

// --- DOMContentLoaded Block ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded fired.");

    // --- ASSIGNMENTS TO ELEMENT REFERENCES ---
    // All these assignments MUST be inside DOMContentLoaded
    gameTypeRadios = document.querySelectorAll('input[name="gameType"]');
    team1PlayersContainer = document.getElementById('team1PlayersContainer'); 
    team2PlayersContainer = document.getElementById('team2PlayersContainer'); 

    player1Input = document.getElementById('player1'); 
    player2Input = document.getElementById('player2'); 
    player3Input = document.getElementById('player3'); 
    player4Input = document.getElementById('player4'); 
    matchDateInput = document.getElementById('matchDate');

    scratchWinCheckboxContainer = document.getElementById('scratchWinCheckboxContainer'); // Ensure this ID exists in HTML

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
            const players = await fetchPlayersFromFirebase(); 
            populatePlayerDropdowns(players); 
        } else {
            try {
                await signInAnonymously(auth);
                console.log("Signed in anonymously.");
            } catch (error) {
                console.error("Error signing in anonymously:", error);
                showMessage('matchErrorMessageDisplay', `Authentication error: ${error.message}`, 'error');
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
                updateMatchFormUI();
            }
        });
    });

    addMatchButton.addEventListener('click', handleAddMatch);

    clearAllDataButton.addEventListener('click', initiateClearAllData);
    confirmClearButton.addEventListener('click', clearAllDataConfirmed); 
    cancelClearButton.addEventListener('click', cancelClearAllData); 

    // Initial display update based on default selections
    updateMatchFormUI(); 
});