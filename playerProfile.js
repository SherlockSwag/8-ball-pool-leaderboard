// playerProfile.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
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

// Helper function to show messages (errors, success)
function showMessage(elementId, message, type = 'error') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `mt-4 p-3 rounded-lg text-sm ${type === 'error' ? 'bg-red-700 text-white' : 'bg-green-700 text-white'}`;
        element.classList.remove('hidden');
    }
}

// Function to hide messages
function hideMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('hidden');
        element.textContent = ''; // Clear content when hidden
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
        console.log("Firebase initialized in playerProfile.js.");
    } catch (error) {
        console.error("Error initializing Firebase in playerProfile.js:", error);
        showMessage('profileErrorMessage', `Failed to initialize Firebase: ${error.message}. Please check console for details.`, 'error');
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
            // Get player name from URL
            const urlParams = new URLSearchParams(window.location.search);
            currentPlayerName = urlParams.get('playerName');
            if (currentPlayerName) {
                document.getElementById('playerNameDisplay').textContent = decodeURIComponent(currentPlayerName);
                await fetchAndRenderPlayerProfile(currentPlayerName);
            } else {
                showMessage('profileErrorMessage', 'Player name not found in URL. Please go back to the leaderboard and select a player.', 'error');
            }
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
                 // After sign-in, check for player name in URL and fetch profile
                const urlParams = new URLSearchParams(window.location.search);
                currentPlayerName = urlParams.get('playerName');
                if (currentPlayerName) {
                    document.getElementById('playerNameDisplay').textContent = decodeURIComponent(currentPlayerName);
                    await fetchAndRenderPlayerProfile(currentPlayerName);
                } else {
                    showMessage('profileErrorMessage', 'Player name not found in URL. Please go back to the leaderboard and select a player.', 'error');
                }
            } catch (error) {
                console.error("Firebase authentication failed in playerProfile.js:", error);
                showMessage('profileErrorMessage', 'Authentication failed. Player data might not load. Check console for details.', 'error');
            }
        }
    });

    /**
     * Calculates the current win/loss streak for a player based on their match history.
     * The 'outcome' field in each match object directly reflects the outcome for the player whose history this is.
     * @param {Array<Object>} matches - An array of match objects for the player, sorted by timestamp descending.
     * @returns {string} The current streak (e.g., "3 Wins", "2 Losses", "No Streak").
     */
    function calculateCurrentStreak(matches) {
        if (!matches || matches.length === 0) {
            return "No Streak";
        }

        let streakCount = 0;
        let streakType = null; // 'win' or 'loss'

        // Matches are already sorted by timestamp descending, so process from most recent.
        for (const match of matches) {
            const currentMatchOutcome = match.outcome; // 'win' or 'loss' for this player

            if (currentMatchOutcome !== 'win' && currentMatchOutcome !== 'loss') {
                console.warn("Invalid outcome in match history, skipping:", match);
                continue; 
            }
            
            if (streakType === null) {
                streakType = currentMatchOutcome;
                streakCount = 1;
            } else if (currentMatchOutcome === streakType) {
                streakCount++;
            } else {
                // Streak broken, stop here
                break; 
            }
        }

        if (streakType === 'win') {
            return `${streakCount} Win(s)`;
        } else if (streakType === 'loss') {
            return `${streakCount} Loss(es)`;
        }
        return "No Streak";
    }

    /**
     * Fetches and displays a single player's profile data.
     * @param {string} playerName - The name of the player to fetch.
     */
    async function fetchAndRenderPlayerProfile(playerName) {
        hideMessage('profileErrorMessage'); // Hide any previous messages
        document.getElementById('profileErrorMessage').textContent = 'Loading player profile...';
        document.getElementById('profileErrorMessage').classList.remove('hidden');
        document.getElementById('profileErrorMessage').classList.remove('bg-red-700', 'bg-green-700'); // Clear old type classes
        document.getElementById('profileErrorMessage').classList.add('bg-blue-700'); // Set loading color

        if (!db) {
            showMessage('profileErrorMessage', 'Firebase database not initialized. Cannot load profile.', 'error');
            return;
        }

        try {
            const playerDocRef = doc(db, PLAYERS_COLLECTION_PATH, playerName);
            const playerDocSnap = await getDoc(playerDocRef);

            if (!playerDocSnap.exists()) {
                showMessage('profileErrorMessage', `Player "${playerName}" not found.`, 'error');
                // Clear existing stats if player not found
                document.getElementById('totalGamesPlayed').textContent = 'N/A';
                document.getElementById('totalWinsLosses').textContent = 'N/A';
                document.getElementById('overallWinRate').textContent = 'N/A';
                document.getElementById('longestWinStreak').textContent = 'N/A';
                document.getElementById('longestLosingStreak').textContent = 'N/A';
                document.getElementById('currentStreak').textContent = 'N/A';
                document.getElementById('games1v1').textContent = 'N/A';
                document.getElementById('winsLosses1v1').textContent = 'N/A';
                document.getElementById('winRate1v1').textContent = 'N/A';
                document.getElementById('games2v2').textContent = 'N/A';
                document.getElementById('winsLosses2v2').textContent = 'N/A';
                document.getElementById('winRate2v2').textContent = 'N/A';
                document.getElementById('rivalriesTableBody').innerHTML = '';
                document.getElementById('noRivalriesMessage').classList.remove('hidden');
                document.getElementById('partnershipsTableBody').innerHTML = '';
                document.getElementById('noPartnershipsMessage').classList.remove('hidden');

                // Set placeholder image to '?'
                const playerAvatarElement = document.getElementById('playerAvatar');
                if (playerAvatarElement) {
                    playerAvatarElement.src = `https://placehold.co/96x96/4299E1/FFFFFF?text=?`;
                    playerAvatarElement.alt = "Player Avatar Not Found";
                }

                return;
            }

            const playerData = playerDocSnap.data();
            
            // Set player avatar image based on the first letter of the name
            const playerAvatarElement = document.getElementById('playerAvatar');
            if (playerAvatarElement) {
                const firstLetter = playerName.charAt(0).toUpperCase();
                playerAvatarElement.src = `https://placehold.co/96x96/4299E1/FFFFFF?text=${firstLetter}`;
                playerAvatarElement.alt = `${playerName} Avatar`;
            }


            // Fetch match history for streak and detailed stats calculation
            const matchesRef = collection(playerDocRef, 'matches');
            const matchesQuery = query(matchesRef, orderBy('timestamp', 'desc')); // Order by timestamp descending for streaks
            const matchesSnapshot = await getDocs(matchesQuery);

            const playerMatches = [];
            matchesSnapshot.forEach(matchDoc => {
                playerMatches.push(matchDoc.data());
            });


            // Calculate derived stats
            const stats = {
                totalGamesPlayed: (playerData.wins1v1 || 0) + (playerData.losses1v1 || 0) + (playerData.wins2v2 || 0) + (playerData.losses2v2 || 0),
                wins1v1: playerData.wins1v1 || 0,
                losses1v1: playerData.losses1v1 || 0,
                wins2v2: playerData.wins2v2 || 0,
                losses2v2: playerData.losses2v2 || 0,
                rivalries: [],
                partnerships: []
            };

            const totalWins = stats.wins1v1 + stats.wins2v2;
            const totalLosses = stats.losses1v1 + stats.losses2v2;
            stats.totalWinsLosses = `${totalWins} Wins / ${totalLosses} Losses`;
            stats.overallWinRate = stats.totalGamesPlayed > 0 ? ((totalWins / stats.totalGamesPlayed) * 100).toFixed(2) + '%' : 'N/A';

            const totalGames1v1 = stats.wins1v1 + stats.losses1v1;
            stats.winRate1v1 = totalGames1v1 > 0 ? ((stats.wins1v1 / totalGames1v1) * 100).toFixed(2) + '%' : 'N/A';
            const totalGames2v2 = stats.wins2v2 + stats.losses2v2;
            stats.winRate2v2 = totalGames2v2 > 0 ? ((stats.wins2v2 / totalGames2v2) * 100).toFixed(2) + '%' : 'N/A';


            // Calculate streaks and partnerships/rivalries based on playerMatches
            let currentWinStreak = 0;
            let currentLossStreak = 0;
            let longestWinStreak = 0;
            let longestLosingStreak = 0;
            let tempCurrentStreakType = null; // 'win' or 'loss'
            let tempCurrentStreakCount = 0;

            const opponentStatsMap = {}; // { 'opponentName': { wins: N, losses: M } }
            const teammateStatsMap = {}; // { 'teammateName': { wins: N, losses: M } }

            for (const match of playerMatches) {
                // Determine streak for current player
                const playerOutcomeForStreak = match.outcome; // 'win' or 'loss' for THIS player
                if (tempCurrentStreakType === null) {
                    tempCurrentStreakType = playerOutcomeForStreak;
                    tempCurrentStreakCount = 1;
                } else if (playerOutcomeForStreak === tempCurrentStreakType) {
                    tempCurrentStreakCount++;
                } else {
                    // Streak broken, update longest streaks
                    if (tempCurrentStreakType === 'win') {
                        longestWinStreak = Math.max(longestWinStreak, tempCurrentStreakCount);
                    } else if (tempCurrentStreakType === 'loss') {
                        longestLosingStreak = Math.max(longestLosingStreak, tempCurrentStreakCount);
                    }
                    tempCurrentStreakType = playerOutcomeForStreak;
                    tempCurrentStreakCount = 1;
                }

                // Update rivalries and partnerships
                if (match.gameType === '1v1') {
                    const opponentName = match.opponents[0]; // Assuming only one opponent in 1v1
                    if (opponentName) {
                        if (!opponentStatsMap[opponentName]) {
                            opponentStatsMap[opponentName] = { wins: 0, losses: 0 };
                        }
                        if (match.outcome === 'win') {
                            opponentStatsMap[opponentName].wins++;
                        } else {
                            opponentStatsMap[opponentName].losses++;
                        }
                    }
                } else if (match.gameType === '2v2') {
                    // Current player's teammates
                    match.teamMates.forEach(teammate => {
                        if (!teammateStatsMap[teammate]) {
                            teammateStatsMap[teammate] = { wins: 0, losses: 0 };
                        }
                        if (match.outcome === 'win') {
                            teammateStatsMap[teammate].wins++;
                        } else {
                            teammateStatsMap[teammate].losses++;
                        }
                    });

                    // Current player's opponents in 2v2
                    match.opponents.forEach(opponent => {
                        if (!opponentStatsMap[opponent]) {
                            opponentStatsMap[opponent] = { wins: 0, losses: 0 };
                        }
                        if (match.outcome === 'win') { // If player's team won, opponents lost against this player
                            opponentStatsMap[opponent].losses++;
                        } else { // If player's team lost, opponents won against this player
                            opponentStatsMap[opponent].wins++;
                        }
                    });
                }
            }

            // Final update for current streak after loop
            if (tempCurrentStreakType === 'win') {
                longestWinStreak = Math.max(longestWinStreak, tempCurrentStreakCount);
                currentWinStreak = tempCurrentStreakCount;
                currentLossStreak = 0; // Not on a loss streak
            } else if (tempCurrentStreakType === 'loss') {
                longestLosingStreak = Math.max(longestLosingStreak, tempCurrentStreakCount);
                currentLossStreak = tempCurrentStreakCount;
                currentWinStreak = 0; // Not on a win streak
            }

            stats.longestWinStreak = longestWinStreak;
            stats.longestLosingStreak = longestLosingStreak;
            stats.currentStreak = calculateCurrentStreak(playerMatches); // Use the dedicated function for current streak display


            // Populate Rivalries array
            for (const opponent in opponentStatsMap) {
                stats.rivalries.push({
                    opponent: opponent,
                    wins: opponentStatsMap[opponent].wins,
                    losses: opponentStatsMap[opponent].losses
                });
            }
            // Sort rivalries by total matches played (descending) then by opponent name
            stats.rivalries.sort((a, b) => {
                const totalMatchesA = a.wins + a.losses;
                const totalMatchesB = b.wins + b.losses;
                if (totalMatchesA !== totalMatchesB) {
                    return totalMatchesB - totalMatchesA;
                }
                return a.opponent.localeCompare(b.opponent);
            });

            // Populate Partnerships array
            for (const teammate in teammateStatsMap) {
                stats.partnerships.push({
                    teammate: teammate,
                    wins: teammateStatsMap[teammate].wins,
                    losses: teammateStatsMap[teammate].losses
                });
            }
            // Sort partnerships by wins together (descending) then by teammate name
            stats.partnerships.sort((a, b) => {
                if (a.wins !== b.wins) {
                    return b.wins - a.wins;
                }
                return a.teammate.localeCompare(b.teammate);
            });


            // Update HTML elements with fetched and calculated data
            document.getElementById('totalGamesPlayed').textContent = stats.totalGamesPlayed;
            document.getElementById('totalWinsLosses').textContent = stats.totalWinsLosses;
            document.getElementById('overallWinRate').textContent = stats.overallWinRate;
            document.getElementById('longestWinStreak').textContent = stats.longestWinStreak;
            document.getElementById('longestLosingStreak').textContent = stats.longestLosingStreak;
            document.getElementById('currentStreak').textContent = stats.currentStreak;
            document.getElementById('games1v1').textContent = totalGames1v1;
            document.getElementById('winsLosses1v1').textContent = `${stats.wins1v1} Wins / ${stats.losses1v1} Losses`;
            document.getElementById('winRate1v1').textContent = stats.winRate1v1;
            document.getElementById('games2v2').textContent = totalGames2v2;
            document.getElementById('winsLosses2v2').textContent = `${stats.wins2v2} Wins / ${stats.losses2v2} Losses`;
            document.getElementById('winRate2v2').textContent = stats.winRate2v2;


            // Render Rivalries Table
            const rivalriesTableBody = document.getElementById('rivalriesTableBody');
            const noRivalriesMessage = document.getElementById('noRivalriesMessage');
            rivalriesTableBody.innerHTML = ''; // Clear existing rows
            if (stats.rivalries.length === 0) {
                noRivalriesMessage.classList.remove('hidden');
            } else {
                noRivalriesMessage.classList.add('hidden');
                stats.rivalries.forEach(rivalry => {
                    const totalRivalMatches = rivalry.wins + rivalry.losses;
                    const rivalryWinRate = totalRivalMatches > 0 ? ((rivalry.wins / totalRivalMatches) * 100).toFixed(2) : 'N/A';
                    const row = `
                        <tr class="border-b border-gray-700 bg-gray-800 hover:bg-gray-700">
                            <td class="py-2 px-4 text-left text-sm text-blue-300">
                                <a href="playerProfile.html?playerName=${encodeURIComponent(rivalry.opponent)}" class="hover:underline">
                                    ${rivalry.opponent}
                                </a>
                            </td>
                            <td class="py-2 px-4 text-center text-sm text-gray-50">${rivalry.wins}</td>
                            <td class="py-2 px-4 text-center text-sm text-gray-50">${rivalry.losses}</td>
                            <td class="py-2 px-4 text-center text-sm text-gray-50">${rivalryWinRate}%</td>
                        </tr>
                    `;
                    rivalriesTableBody.innerHTML += row;
                });
            }

            // Render Partnerships Table
            const partnershipsTableBody = document.getElementById('partnershipsTableBody');
            const noPartnershipsMessage = document.getElementById('noPartnershipsMessage');
            partnershipsTableBody.innerHTML = ''; // Clear existing rows
            if (stats.partnerships.length === 0) {
                noPartnershipsMessage.classList.remove('hidden');
            } else {
                noPartnershipsMessage.classList.add('hidden');
                stats.partnerships.forEach(partnership => {
                    const row = `
                        <tr class="border-b border-gray-700 bg-gray-800 hover:bg-gray-700">
                            <td class="py-2 px-4 text-left text-sm text-blue-300">
                                <a href="playerProfile.html?playerName=${encodeURIComponent(partnership.teammate)}" class="hover:underline">
                                    ${partnership.teammate}
                                </a>
                            </td>
                            <td class="py-2 px-4 text-center text-sm text-gray-50">${partnership.wins}</td>
                            <td class="py-2 px-4 text-center text-sm text-gray-50">${partnership.losses}</td>
                        </tr>
                    `;
                    partnershipsTableBody.innerHTML += row;
                });
            }

            document.getElementById('profileErrorMessage').classList.add('hidden'); // Hide loading/error message on success

        } catch (error) {
            console.error("Error fetching and rendering player profile:", error);
            showMessage('profileErrorMessage', `Error loading profile: ${error.message}`, 'error');
        }
    }

    // Event listener for "View All Match History" link
    const viewMatchHistoryLink = document.getElementById('viewMatchHistoryLink');
    if (viewMatchHistoryLink) {
        viewMatchHistoryLink.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default link behavior
            if (currentPlayerName) {
                console.log(`Navigating to match history for ${currentPlayerName}`);
                // Remove the "Feature not implemented" message, or change it to a navigation message
                showMessage('profileErrorMessage', `Navigating to match history for ${currentPlayerName}.`, 'info'); 
                // In a real app, you'd navigate:
                window.location.href = `matchHistory.html?playerName=${encodeURIComponent(currentPlayerName)}`; // <--- UNCOMMENT THIS LINE
            } else {
                showMessage('profileErrorMessage', 'No player selected to view match history.', 'error');
            }
        });
    }
});
