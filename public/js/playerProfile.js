// playerProfile.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, query, orderBy, limit, where, getDocs, updateDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js';
import { showMessage, hideMessage } from './utils.js';

// Import your local firebase-config.js
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js';

let db;
let auth;
let storage;
let currentUserId = null;
let currentPlayerName = null; // To store the player name being viewed
let currentPlayerData = {}; // Store current player's data for editing

// --- Constants for Firestore Collection Paths ---
const PLAYERS_COLLECTION_PATH = 'artifacts/local-pool-tracker-app/public/data/players';
const MATCHES_COLLECTION_PATH = 'artifacts/local-pool-tracker-app/public/data/matches';

// --- Constants for DiceBear settings ---
const DICEBEAR_STYLE = 'pixel-art';
// This list is used for the randomizer.
const DICEBEAR_BG_COLORS_POOL = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffeedc', 'f4d15b']; 
const FALLBACK_DICEBEAR_BG_COLOR = 'b6e3f4'; // A default if no color is stored

// Determine the final firebaseConfig to use: Canvas-provided or local fallback
let finalFirebaseConfig = {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'local-pool-tracker-app'; // Fallback ID for local testing

try {
    if (typeof __firebase_config === 'string' && __firebase_config.trim().length > 0) {
        finalFirebaseConfig = JSON.parse(__firebase_config);
        console.log("playerProfile.js: Using Canvas-provided Firebase config.");
    } else {
        finalFirebaseConfig = localFirebaseConfig;
        console.warn("playerProfile.js: Runtime variable '__firebase_config' is not valid or empty. Using local 'firebase-config.js'.");
        if (finalFirebaseConfig.projectId === "YOUR_FIREBASE_PROJECT_ID") {
            console.error("playerProfile.js: Firebase is using placeholder 'YOUR_FIREBASE_PROJECT_ID'. Please update firebase-config.js with your actual Firebase project ID.");
            showMessage('profileErrorMessage', 'Firebase is not correctly configured. Please check console.', 'error');
        }
    }
    const app = initializeApp(finalFirebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    console.log("playerProfile.js: Firebase initialized in playerProfile.js");
} catch (error) {
    console.error("playerProfile.js: Error initializing Firebase:", error);
    showMessage('profileErrorMessage', `Failed to initialize Firebase: ${error.message}`, 'error');
}

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        console.warn('Error formatting date string:', dateString, e);
        return dateString;
    }
}

function navigateToPlayerProfile(playerName) {
    window.location.href = `playerProfile.html?playerName=${encodeURIComponent(playerName)}`;
    console.log(`Navigating to profile of: ${playerName}`);
}

function navigateToMatchHistoryPage(playerName) {
    console.log(`Navigating to full match history for: ${playerName}`);
    window.location.href = `matchHistory.html?playerName=${encodeURIComponent(playerName)}`;
}

function getPlayersHtml(match, currentPlayerName, gameType) {
    let html = '';
    if (gameType === '1v1') {
        const opponent = match.players.find(p => p !== currentPlayerName);
        if (opponent) {
            html = `<span class="text-blue-400 cursor-pointer hover:underline" onclick="navigateToPlayerProfile('${opponent}')">${opponent}</span>`;
        } else {
            html = `<span class="text-gray-500">N/A</span>`;
        }
    } else if (gameType === '2v2') {
        const teammates = (match.winningTeam && match.winningTeam.includes(currentPlayerName)) ?
                            match.winningTeam.filter(p => p !== currentPlayerName) :
                            (match.losingTeam && match.losingTeam.includes(currentPlayerName)) ?
                            match.losingTeam.filter(p => p !== currentPlayerName) : [];

        const allMatchPlayersExceptSelf = match.players.filter(p => p !== currentPlayerName);
        const opponents = allMatchPlayersExceptSelf.filter(p => !teammates.includes(p));

        html += `<span class="text-gray-400">With: </span>`;
        if (teammates.length > 0) {
            html += teammates.map(t => `<span class="text-purple-400 cursor-pointer hover:underline" onclick="navigateToPlayerProfile('${t}')">${t}</span>`).join(', ');
        } else {
            html += `<span class="text-gray-500">N/A</span>`;
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

function renderMatchTable(matches, tableBodyElement, currentPlayerName, gameType) {
    tableBodyElement.innerHTML = '';
    if (matches.length === 0) {
        tableBodyElement.innerHTML = `<tr><td colspan="3" class="py-3 px-4 text-center text-gray-400">No ${gameType} recent matches.</td></tr>`;
        return;
    }

    matches.forEach(match => {
        const row = tableBodyElement.insertRow();
        row.className = 'border-b border-gray-600 last:border-b-0';
        const dateCell = row.insertCell();
        dateCell.className = 'py-3 px-4 text-left text-gray-300 whitespace-nowrap';
        dateCell.textContent = formatDate(match.date);
        const playersCell = row.insertCell();
        playersCell.className = 'py-3 px-4 text-left text-gray-300';
        playersCell.innerHTML = getPlayersHtml(match, currentPlayerName, gameType);
        const resultCell = row.insertCell();
        resultCell.className = 'py-3 px-4 text-center';
        const isWinner = (gameType === '1v1' && match.winner === currentPlayerName) ||
                             (gameType === '2v2' && match.winningTeam && match.winningTeam.includes(currentPlayerName));
        resultCell.innerHTML = `<span class="${isWinner ? 'text-green-400' : 'text-red-400'} font-semibold">${isWinner ? 'Win' : 'Loss'}</span>`;
    });
}

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
    recentMatchesCard.classList.remove('hidden');

    try {
        const matchesRef = collection(db, MATCHES_COLLECTION_PATH);
        const q = query(
            matchesRef,
            where('players', 'array-contains', playerName),
            orderBy('date', 'desc'),
            limit(20)
        );
        const querySnapshot = await getDocs(q);

        const allRecentMatches = [];
        querySnapshot.forEach((doc) => {
            allRecentMatches.push({ id: doc.id, ...doc.data() });
        });

        const recent1v1Matches = allRecentMatches.filter(match => match.gameType === '1v1').slice(0, 5);
        const recent2v2Matches = allRecentMatches.filter(match => match.gameType === '2v2').slice(0, 5);

        renderMatchTable(recent1v1Matches, recent1v1MatchesTableBody, playerName, '1v1');
        renderMatchTable(recent2v2Matches, recent2v2MatchesTableBody, playerName, '2v2');

        if (viewAllMatchHistoryBtn) {
            viewAllMatchHistoryBtn.onclick = () => navigateToMatchHistoryPage(playerName);
        }

    } catch (error) {
        console.error("Error fetching or rendering recent matches:", error);
        recent1v1MatchesTableBody.innerHTML = `<tr><td colspan="3" class="py-3 px-4 text-center text-red-400">Error loading 1v1 matches.</td></tr>`;
        recent2v2MatchesTableBody.innerHTML = `<tr><td colspan="3" class="py-3 px-4 text-center text-red-400">Error loading 2v2 matches.</td></tr>`;
        recentMatchesCard.classList.remove('hidden');
    }
}

function calculateStreak(matchHistory) {
    if (matchHistory.length === 0) return 'N/A';
    const sortedHistory = [...matchHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sortedHistory.length === 0) return 'N/A';
    let streakCount = 0;
    const firstResult = sortedHistory[0].isWin;
    let streakType = firstResult ? '+' : '-';
    for (let i = 0; i < sortedHistory.length; i++) {
        if (sortedHistory[i].isWin === firstResult) {
            streakCount++;
        } else {
            break;
        }
    }
    return `${streakType}${streakCount} ${firstResult ? 'Wins' : 'Losses'}`;
}

async function fetchAndRenderRivalries(playerName) {
    const rivalriesCard = document.getElementById('rivalriesCard');
    const rivalriesTableBody = document.getElementById('rivalriesTableBody');
    const noRivalriesMessage = document.getElementById('noRivalriesMessage');

    if (rivalriesCard) rivalriesCard.classList.remove('hidden');
    if (noRivalriesMessage) noRivalriesMessage.classList.add('hidden');
    if (rivalriesTableBody) {
        rivalriesTableBody.innerHTML = '<tr><td colspan="6" class="py-3 px-4 text-center text-gray-400">Loading top rivals...</td></tr>';
    }

    try {
        const q = query(
            collection(db, MATCHES_COLLECTION_PATH),
            where('players', 'array-contains', playerName),
            orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(q);

        const allPlayerMatches = [];
        querySnapshot.forEach((doc) => {
            allPlayerMatches.push({ id: doc.id, ...doc.data() });
        });

        const rivalryStats = {};
        allPlayerMatches.forEach(match => {
            if (match.gameType === '1v1' || match.gameType === '2v2') {
                let isCurrentPlayerWinner = false;
                if (match.gameType === '1v1') {
                    isCurrentPlayerWinner = (match.winner === playerName);
                } else if (match.gameType === '2v2') {
                    isCurrentPlayerWinner = (match.winningTeam && match.winningTeam.includes(playerName));
                }

                const opponentsInMatch = [];
                if (match.gameType === '1v1') {
                    const opponent = match.players.find(p => p !== playerName);
                    if (opponent) {
                        opponentsInMatch.push(opponent);
                    }
                } else if (match.gameType === '2v2') {
                    let opposingTeam = [];
                    if (match.winningTeam && !match.winningTeam.includes(playerName)) {
                        opposingTeam = match.winningTeam;
                    } else if (match.losingTeam && !match.losingTeam.includes(playerName)) {
                        opposingTeam = match.losingTeam;
                    }
                    opponentsInMatch.push(...opposingTeam);
                }

                opponentsInMatch.forEach(opponentName => {
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
                    rivalryStats[opponentName].matchHistory.push({ date: match.date, isWin: isCurrentPlayerWinner });
                });
            }
        });

        const topRivals = Object.entries(rivalryStats)
            .map(([opponentName, stats]) => {
                const total = stats.wins + stats.losses;
                const winRate = total > 0 ? (stats.wins / total) * 100 : 0;
                return { opponentName, ...stats, winRate };
            })
            .sort((a, b) => {
                if (b.totalMatches !== a.totalMatches) {
                    return b.totalMatches - a.totalMatches;
                }
                return b.winRate - a.winRate;
            })
            .slice(0, 5);

        if (rivalriesTableBody) rivalriesTableBody.innerHTML = '';

        if (topRivals.length === 0) {
            if (noRivalriesMessage) noRivalriesMessage.classList.remove('hidden');
            return;
        }

        topRivals.forEach(rival => {
            const row = rivalriesTableBody.insertRow();
            row.className = 'border-b border-gray-700 last:border-b-0 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500';
            const opponentCell = row.insertCell();
            opponentCell.className = 'py-2 px-4 text-sm text-gray-100 whitespace-nowrap';
            opponentCell.innerHTML = `
                <a href="playerProfile.html?playerName=${encodeURIComponent(rival.opponentName)}" class="flex items-center text-blue-300 hover:text-blue-200 font-semibold transition duration-150 ease-in-out">
                    <img src="${getDicebearAvatarUrl(rival.opponentName, FALLBACK_DICEBEAR_BG_COLOR)}" alt="${rival.opponentName}" class="w-8 h-8 rounded-full mr-3 border-2 border-orange-500">
                    <span>${rival.opponentName}</span>
                </a>
            `;
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
            const winsCell = row.insertCell();
            winsCell.className = 'py-2 px-4 text-center text-sm text-green-400 font-semibold';
            winsCell.textContent = `${rival.wins}W`;
            const lossesCell = row.insertCell();
            lossesCell.className = 'py-2 px-4 text-center text-sm text-red-400 font-semibold';
            lossesCell.textContent = `${rival.losses}L`;
            const winRateCell = row.insertCell();
            winRateCell.className = 'py-2 px-4 text-center text-sm text-gray-100';
            winRateCell.textContent = `${rival.winRate.toFixed(1)}%`;
            const streakCell = row.insertCell();
            streakCell.className = 'py-2 px-4 text-center text-sm';
            const currentStreak = calculateStreak(rival.matchHistory);
            streakCell.innerHTML = `<span class="${currentStreak.startsWith('+') ? 'text-green-400' : (currentStreak.startsWith('-') ? 'text-red-400' : 'text-gray-400')}">${currentStreak}</span>`;
        });
    } catch (error) {
        console.error("Error fetching or rendering rivalries:", error);
        if (rivalriesTableBody) rivalriesTableBody.innerHTML = '';
        if (noRivalriesMessage) {
            noRivalriesMessage.classList.remove('hidden');
            noRivalriesMessage.textContent = 'Error loading rivalries. Please try again.';
            noRivalriesMessage.classList.remove('text-gray-400');
            noRivalriesMessage.classList.add('text-red-400');
        }
    }
}

async function fetchAndRenderPartnerships(playerName) {
    const partnershipsCard = document.getElementById('partnershipsCard');
    const partnershipsTableBody = document.getElementById('partnershipsTableBody');
    const noPartnershipsMessage = document.getElementById('noPartnershipsMessage');

    if (partnershipsCard) partnershipsCard.classList.remove('hidden');
    if (noPartnershipsMessage) noPartnershipsMessage.classList.add('hidden');
    if (partnershipsTableBody) {
        partnershipsTableBody.innerHTML = '<tr><td colspan="6" class="py-3 px-4 text-center text-gray-400">Loading top partnerships...</td></tr>';
    }

    try {
        const q = query(
            collection(db, MATCHES_COLLECTION_PATH),
            where('players', 'array-contains', playerName),
            orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(q);

        const allPlayerMatches = [];
        querySnapshot.forEach((doc) => {
            allPlayerMatches.push({ id: doc.id, ...doc.data() });
        });

        const partnershipStats = {};
        allPlayerMatches.forEach(match => {
            if (match.gameType === '2v2') {
                let isCurrentPlayerWinner = (match.winningTeam && match.winningTeam.includes(playerName));
                
                let teammatesInMatch = [];
                if (match.winningTeam && match.winningTeam.includes(playerName)) {
                    teammatesInMatch = match.winningTeam.filter(p => p !== playerName);
                } else if (match.losingTeam && match.losingTeam.includes(playerName)) {
                    teammatesInMatch = match.losingTeam.filter(p => p !== playerName);
                }

                teammatesInMatch.forEach(teammateName => {
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
                    partnershipStats[teammateName].matchHistory.push({ date: match.date, isWin: isCurrentPlayerWinner });
                });
            }
        });

        const topPartnerships = Object.entries(partnershipStats)
            .map(([teammateName, stats]) => {
                const total = stats.wins + stats.losses;
                const winRate = total > 0 ? (stats.wins / total) * 100 : 0;
                return { teammateName, ...stats, winRate };
            })
            .sort((a, b) => {
                if (b.totalMatches !== a.totalMatches) {
                    return b.totalMatches - a.totalMatches;
                }
                return b.winRate - a.winRate;
            })
            .slice(0, 5);

        if (partnershipsTableBody) partnershipsTableBody.innerHTML = '';

        if (topPartnerships.length === 0) {
            if (noPartnershipsMessage) noPartnershipsMessage.classList.remove('hidden');
            return;
        }

        topPartnerships.forEach(partner => {
            const row = partnershipsTableBody.insertRow();
            row.className = 'border-b border-gray-700 last:border-b-0 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500';
            const teammateCell = row.insertCell();
            teammateCell.className = 'py-2 px-4 text-sm text-gray-100 whitespace-nowrap';
            teammateCell.innerHTML = `
                <a href="playerProfile.html?playerName=${encodeURIComponent(partner.teammateName)}" class="flex items-center text-blue-300 hover:text-blue-200 font-semibold transition duration-150 ease-in-out">
                    <img src="${getDicebearAvatarUrl(partner.teammateName, FALLBACK_DICEBEAR_BG_COLOR)}" alt="${partner.teammateName}" class="w-8 h-8 rounded-full mr-3 border-2 border-purple-500">
                    <span>${partner.teammateName}</span>
                </a>
            `;
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
            const winsCell = row.insertCell();
            winsCell.className = 'py-2 px-4 text-center text-sm text-green-400 font-semibold';
            winsCell.textContent = `${partner.wins}W`;
            const lossesCell = row.insertCell();
            lossesCell.className = 'py-2 px-4 text-center text-sm text-red-400 font-semibold';
            lossesCell.textContent = `${partner.losses}L`;
            const winRateCell = row.insertCell();
            winRateCell.className = 'py-2 px-4 text-center text-sm text-gray-100';
            winRateCell.textContent = `${partner.winRate.toFixed(1)}%`;
            const streakCell = row.insertCell();
            streakCell.className = 'py-2 px-4 text-center text-sm';
            const currentStreak = calculateStreak(partner.matchHistory);
            streakCell.innerHTML = `<span class="${currentStreak.startsWith('+') ? 'text-green-400' : (currentStreak.startsWith('-') ? 'text-red-400' : 'text-gray-400')}">${currentStreak}</span>`;
        });
    } catch (error) {
        console.error("Error fetching or rendering partnerships:", error);
        if (partnershipsTableBody) partnershipsTableBody.innerHTML = '';
        if (noPartnershipsMessage) {
            noPartnershipsMessage.classList.remove('hidden');
            noPartnershipsMessage.textContent = 'Error loading partnerships. Please try again.';
            noPartnershipsMessage.classList.remove('text-gray-400');
            noPartnershipsMessage.classList.add('text-red-400');
        }
    }
}

// Helper to generate a DiceBear URL
function getDicebearAvatarUrl(seed, bgColor) {
    const finalSeed = encodeURIComponent(seed && seed.trim() !== '' ? seed : 'default-player');
    const finalBgColor = bgColor || FALLBACK_DICEBEAR_BG_COLOR;
    return `https://api.dicebear.com/7.x/${DICEBEAR_STYLE}/svg?seed=${finalSeed}&backgroundColor=${finalBgColor}&size=64`;
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
            let playerData = playerDocSnap.data();
            currentPlayerData = playerData; // Store fetched data globally for modal
            console.log("playerProfile.js: Player data fetched successfully:", playerData);

            const profileNameElement = document.getElementById('profilePlayerName');
            if (profileNameElement) {
                profileNameElement.textContent = playerData.displayName || playerData.name || currentPlayerName;
                console.log(`playerProfile.js: Profile name updated to: ${profileNameElement.textContent}`);
            }

            const avatarElement = document.getElementById('playerAvatar');
            if (avatarElement) {
                if (playerData.avatarUrl && !playerData.dicebearSeed) { // Assumes if dicebearSeed is null, it's a custom URL
                    // Use custom avatar URL if available and not a DiceBear one
                    avatarElement.src = playerData.avatarUrl;
                    console.log(`playerProfile.js: Avatar src set to custom URL: ${avatarElement.src}`);
                } else {
                    // Otherwise, generate DiceBear avatar using stored seed and color, or defaults
                    const dicebearSeed = playerData.dicebearSeed || playerData.displayName || playerData.name || currentPlayerName;
                    const dicebearColor = playerData.dicebearBgColor || FALLBACK_DICEBEAR_BG_COLOR;
                    avatarElement.src = getDicebearAvatarUrl(dicebearSeed, dicebearColor);
                    console.log("playerProfile.js: Using DiceBear avatar.");
                }
            }
            
            const playerDescriptionElement = document.getElementById('playerDescription');
            if (playerDescriptionElement) {
                playerDescriptionElement.textContent = playerData.description || 'No description available.';
                console.log(`playerProfile.js: Player description updated to: ${playerDescriptionElement.textContent}`);
            }

            document.getElementById('totalGamesPlayed').textContent = playerData.totalGamesPlayed || 0;
            const totalWins = playerData.totalWins || 0;
            const totalLosses = playerData.totalLosses || 0;
            document.getElementById('overallWinsLosses').textContent = `${totalWins}W - ${totalLosses}L`;
            const overallWinRate = typeof playerData.overallWinRate === 'number' ? playerData.overallWinRate.toFixed(1) : '0.0';
            document.getElementById('overallWinRate').textContent = `${overallWinRate}%`;

            document.getElementById('games1v1').textContent = playerData.games1v1 || 0;
            const wins1v1 = playerData.wins1v1 || 0;
            const losses1v1 = playerData.losses1v1 || 0;
            document.getElementById('winsLosses1v1').textContent = `${wins1v1}W - ${losses1v1}L`;
            const winRate1v1 = typeof playerData.winRate1v1 === 'number' ? playerData.winRate1v1.toFixed(1) : '0.0';
            document.getElementById('winRate1v1').textContent = `${winRate1v1}%`;

            document.getElementById('games2v2').textContent = playerData.games2v2 || 0;
            const wins2v2 = playerData.wins2v2 || 0;
            const losses2v2 = playerData.losses2v2 || 0;
            document.getElementById('winsLosses2v2').textContent = `${wins2v2}W - ${losses2v2}L`;
            const winRate2v2 = typeof playerData.winRate2v2 === 'number' ? playerData.winRate2v2.toFixed(1) : '0.0';
            document.getElementById('winRate2v2').textContent = `${winRate2v2}%`;

            const currentStreakElement = document.getElementById('currentStreak');
            if (currentStreakElement) {
                const streak = playerData.currentStreak || 0;
                const displayedStreak = Math.abs(streak);
                const streakType = streak >= 0 ? 'Wins' : 'Losses';
                currentStreakElement.textContent = `${displayedStreak} ${streakType}`;
            }
            document.getElementById('longestWinStreak').textContent = playerData.longestWinStreak || 0;
            document.getElementById('longestLosingStreak').textContent = playerData.longestLosingStreak || 0;

            await fetchAndRenderRecentMatches(currentPlayerName);
            await fetchAndRenderRivalries(currentPlayerName);
            await fetchAndRenderPartnerships(currentPlayerName);

            hideMessage('profileErrorMessage');
        } else {
            console.warn(`playerProfile.js: No player document found for "${currentPlayerName}".`);
            showMessage('profileErrorMessage', `Player "${currentPlayerName}" not found.`, 'error');
            // If player not found, attempt to create a default one for the current user (if currentUserId is available)
            if (currentUserId && currentPlayerName) {
                console.log(`Attempting to create default profile for new player: ${currentPlayerName}`);
                try {
                    await setDoc(doc(db, PLAYERS_COLLECTION_PATH, currentPlayerName), {
                        name: currentPlayerName,
                        displayName: currentPlayerName,
                        description: 'New player - welcome!',
                        totalGamesPlayed: 0,
                        totalWins: 0,
                        totalLosses: 0,
                        overallWinRate: 0,
                        games1v1: 0,
                        wins1v1: 0,
                        losses1v1: 0,
                        winRate1v1: 0,
                        games2v2: 0,
                        wins2v2: 0,
                        losses2v2: 0,
                        winRate2v2: 0,
                        currentStreak: 0,
                        longestWinStreak: 0,
                        longestLosingStreak: 0,
                        avatarUrl: null, // No custom avatar initially
                        dicebearSeed: currentPlayerName, // Use name as initial seed
                        dicebearBgColor: FALLBACK_DICEBEAR_BG_COLOR // Default color
                    });
                    console.log(`Default profile created for ${currentPlayerName}. Re-fetching...`);
                    await fetchAndRenderPlayerProfile(); // Re-fetch to render the newly created profile
                } catch (createError) {
                    console.error("Error creating default player profile:", createError);
                    showMessage('profileErrorMessage', `Error creating new player: ${createError.message}`, 'error');
                }
            }
        }
    } catch (error) {
        console.error("playerProfile.js: Error fetching player data:", error);
        showMessage('profileErrorMessage', `Error loading player profile: ${error.message}`, 'error');
    }
}

// --- Modal and Editing Functions ---
let editProfileModal;
let editProfileBtn;
let closeEditModalBtn;
let cancelEditBtn;
let editProfileForm;
let editDisplayNameInput;
let editDescriptionTextarea;
let editAvatarFileInput; // Existing file input
let currentAvatarPreview;
let editProfileStatus;
let generateRandomAvatarBtn;

// NEW: Flag to track if "Generate Random DiceBear" was clicked in this modal session
let dicebearRandomizedThisSession = false; 
let sessionRandomDicebearSeed = null; // Store the random seed generated during the session
let sessionRandomDicebearBgColor = null; // Store the random background color generated during the session

function openEditProfileModal() {
    if (!currentPlayerData || !currentPlayerName) {
        showMessage('profileErrorMessage', 'Cannot edit profile: Player data not loaded.', 'error');
        return;
    }

    // Reset session flags and temporary storage on modal open
    dicebearRandomizedThisSession = false;
    sessionRandomDicebearSeed = null;
    sessionRandomDicebearBgColor = null;

    // Populate the form fields with current data
    editDisplayNameInput.value = currentPlayerData.displayName || currentPlayerData.name || currentPlayerName;
    editDescriptionTextarea.value = currentPlayerData.description || '';

    // Reset file input to clear any previously selected file
    editAvatarFileInput.value = '';

    // Set avatar preview based on current player data
    if (currentPlayerData.avatarUrl && !currentPlayerData.dicebearSeed) { // If it's a custom image (no DiceBear seed)
        currentAvatarPreview.src = currentPlayerData.avatarUrl;
    } else {
        // If it's a DiceBear avatar or no avatar (use current DiceBear data or defaults)
        const currentSeed = currentPlayerData.dicebearSeed || currentPlayerData.displayName || currentPlayerData.name || currentPlayerName;
        const currentBgColor = currentPlayerData.dicebearBgColor || FALLBACK_DICEBEAR_BG_COLOR;
        currentAvatarPreview.src = getDicebearAvatarUrl(currentSeed, currentBgColor);
    }
    currentAvatarPreview.style.display = 'block'; // Ensure preview is visible

    hideMessage('editProfileStatus'); // Hide any previous status messages
    editProfileModal.classList.add('open');
}

function closeEditProfileModal() {
    editProfileModal.classList.remove('open');
    hideMessage('editProfileStatus'); // Ensure message is hidden on close
}

// Function to upload avatar image to Firebase Storage
async function uploadAvatar(file) {
    // Ensure `appId` is defined globally or passed if needed for the path
    const path = `avatars/${appId}/${currentPlayerName}_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    try {
        showMessage('editProfileStatus', 'Uploading avatar...', 'info');
        const uploadTask = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(uploadTask.ref);
        console.log("Avatar uploaded, URL:", downloadURL);
        showMessage('editProfileStatus', 'Avatar uploaded successfully!', 'success');
        return downloadURL;
    } catch (error) {
        console.error("Error uploading avatar:", error);
        showMessage('editProfileStatus', `Avatar upload failed: ${error.message}`, 'error');
        throw error; // Re-throw to propagate the error
    }
}

// Function to save profile changes to Firestore
async function saveProfileChanges(event) {
    event.preventDefault(); // Prevent default form submission

    if (!currentPlayerName) {
        showMessage('editProfileStatus', 'Error: Player name not identified.', 'error');
        return;
    }

    showMessage('editProfileStatus', 'Saving profile...', 'info');

    const newDisplayName = editDisplayNameInput.value.trim();
    const newDescription = editDescriptionTextarea.value.trim();
    const avatarFile = editAvatarFileInput.files[0]; // Get the selected file

    let finalAvatarUrl = null;
    let finalDicebearSeed = null;
    let finalDicebearBgColor = null;

    if (avatarFile) {
        // Option 1: User chose to upload a custom avatar file
        try {
            finalAvatarUrl = await uploadAvatar(avatarFile);
            // If a custom avatar is uploaded, clear DiceBear preferences in Firestore
            finalDicebearSeed = null;
            finalDicebearBgColor = null;
        } catch (uploadError) {
            // Error message already shown by uploadAvatar, just return
            return;
        }
    } else {
        // Option 2: No file was uploaded. Determine DiceBear avatar.
        if (dicebearRandomizedThisSession && sessionRandomDicebearSeed && sessionRandomDicebearBgColor) {
            // User explicitly clicked "Generate Random DiceBear" during this session
            finalDicebearSeed = sessionRandomDicebearSeed;
            finalDicebearBgColor = sessionRandomDicebearBgColor;
            finalAvatarUrl = getDicebearAvatarUrl(finalDicebearSeed, finalDicebearBgColor);
        } else {
            // User did NOT upload a file and did NOT click "Generate Random".
            // Preserve existing DiceBear or create default based on name.
            if (currentPlayerData.dicebearSeed) {
                // Reuse existing DiceBear configuration
                finalDicebearSeed = currentPlayerData.dicebearSeed;
                finalDicebearBgColor = currentPlayerData.dicebearBgColor || FALLBACK_DICEBEAR_BG_COLOR;
            } else {
                // If no existing DiceBear data (e.g., old player or new), use display name as seed
                finalDicebearSeed = newDisplayName || currentPlayerName;
                finalDicebearBgColor = FALLBACK_DICEBEAR_BG_COLOR;
            }
            finalAvatarUrl = getDicebearAvatarUrl(finalDicebearSeed, finalDicebearBgColor);
        }
    }

    try {
        const playerDocRef = doc(db, PLAYERS_COLLECTION_PATH, currentPlayerName);
        await updateDoc(playerDocRef, {
            displayName: newDisplayName,
            description: newDescription,
            avatarUrl: finalAvatarUrl, // This will store either the custom URL or the DiceBear URL
            dicebearSeed: finalDicebearSeed, // Store the DiceBear seed used (null if custom avatar)
            dicebearBgColor: finalDicebearBgColor // Store the DiceBear background color used (null if custom avatar)
        });
        showMessage('editProfileStatus', 'Profile saved successfully!', 'success');
        console.log("Profile updated successfully for:", currentPlayerName);

        // Re-fetch and re-render the profile to show the updated data
        await fetchAndRenderPlayerProfile();
        closeEditProfileModal(); // Close the modal after successful save and re-render
    } catch (error) {
        console.error("Error saving profile changes:", error);
        showMessage('editProfileStatus', `Failed to save profile: ${error.message}`, 'error');
    }
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("playerProfile.js: DOMContentLoaded fired.");

    // --- Retrieve DOM elements here, AFTER DOMContentLoaded ---
    editProfileModal = document.getElementById('editProfileModal');
    editProfileBtn = document.getElementById('editProfileBtn');
    closeEditModalBtn = document.getElementById('closeEditModalBtn');
    cancelEditBtn = document.getElementById('cancelEditBtn');
    editProfileForm = document.getElementById('editProfileForm');
    editDisplayNameInput = document.getElementById('editDisplayName');
    editDescriptionTextarea = document.getElementById('editDescription');
    editAvatarFileInput = document.getElementById('editAvatarFile'); // Existing
    currentAvatarPreview = document.getElementById('currentAvatarPreview');
    editProfileStatus = document.getElementById('editProfileStatus');
    // DiceBear elements (only the button remains directly interacted with here)
    generateRandomAvatarBtn = document.getElementById('generateRandomAvatarBtn');


    // Event listener for opening the modal
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', openEditProfileModal);
    }

    // Event listeners for closing the modal
    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener('click', closeEditProfileModal);
    }
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditProfileModal);
    }
    // Close modal if clicked outside (on the overlay)
    if (editProfileModal) {
        editProfileModal.addEventListener('click', (e) => {
            if (e.target === editProfileModal) {
                closeEditProfileModal();
            }
        });
    }

    // Event listener for Custom Avatar file selection preview
    if (editAvatarFileInput) {
        editAvatarFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentAvatarPreview.src = e.target.result;
                    currentAvatarPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
                // When a file is chosen, indicate that DiceBear was NOT randomized this session
                dicebearRandomizedThisSession = false;
                sessionRandomDicebearSeed = null;
                sessionRandomDicebearBgColor = null;
            } else {
                // If file selection is cancelled (user opens, selects, then clears file),
                // revert preview to current saved avatar (DiceBear or custom)
                openEditProfileModal(); 
            }
        });
    }

    // Event listener for random DiceBear avatar generation
    if (generateRandomAvatarBtn) {
        generateRandomAvatarBtn.addEventListener('click', () => {
            // Generate a random seed and a random background color from the pool
            const randomSeed = Math.random().toString(36).substring(2, 10); 
            const randomBgColor = DICEBEAR_BG_COLORS_POOL[Math.floor(Math.random() * DICEBEAR_BG_COLORS_POOL.length)];
            
            // Update the preview
            currentAvatarPreview.src = getDicebearAvatarUrl(randomSeed, randomBgColor);
            
            // Store these temporary values and set the flag for saveProfileChanges
            sessionRandomDicebearSeed = randomSeed;
            sessionRandomDicebearBgColor = randomBgColor;
            dicebearRandomizedThisSession = true;

            // Clear file input when random DiceBear is generated
            editAvatarFileInput.value = '';
        });
    }

    // Attach event listener for form submission
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', saveProfileChanges);
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            try {
                await signInAnonymously(auth);
                console.log("playerProfile.js: Signed in anonymously for playerProfile.js.");
                fetchAndRenderPlayerProfile();
            } catch (error) {
                console.error("playerProfile.js: Error signing in anonymously for playerProfile.js:", error);
                showMessage('profileErrorMessage', `Authentication error: ${error.message}`, 'error');
            }
        } else {
            currentUserId = user.uid;
            console.log("playerProfile.js: Existing user detected for playerProfile.js:", currentUserId);
            fetchAndRenderPlayerProfile();
        }
    });

    const viewMatchHistoryLink = document.getElementById('viewMatchHistoryLink');
    if (viewMatchHistoryLink) {
        viewMatchHistoryLink.addEventListener('click', (event) => {
            event.preventDefault();
            if (currentPlayerName) {
                console.log(`playerProfile.js: Navigating to match history for ${currentPlayerName}`);
                window.location.href = `matchHistory.html?playerName=${encodeURIComponent(currentPlayerName)}`;
            } else {
                showMessage('profileErrorMessage', 'No player selected to view match history.', 'error');
            }
        });
    }
});