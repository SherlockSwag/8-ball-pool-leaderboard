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


async function fetchAndRenderPlayerProfile() {
    console.log("playerProfile.js: fetchAndRenderPlayerProfile called.");

    // Get player name from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentPlayerName = urlParams.get('playerName');

    if (!currentPlayerName) {
        console.error("playerProfile.js: Player name not found in URL.");
        showMessage('profileErrorMessage', 'Player name not specified in URL.', 'error');
        return;
    }

    console.log(`playerProfile.js: Extracted playerName from URL: "${currentPlayerName}"`);

    const playersCollectionRef = collection(db, 'artifacts/local-pool-tracker-app/public/data/players');
    const playerDocRef = doc(playersCollectionRef, currentPlayerName);

    try {
        console.log(`playerProfile.js: Attempting to fetch player: "${currentPlayerName}" from Firestore at path: "${playersCollectionRef.path}".`);
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
                // Fallback if no avatar URL is provided
                avatarElement.src = 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Default&size=64';
                console.log("playerProfile.js: Using default avatar as avatarUrl is missing.");
            }

            // Update overall stats
            const totalGamesPlayedElement = document.getElementById('totalGamesPlayed');
            //const totalWinsElement = document.getElementById('totalWins');
            //const totalLossesElement = document.getElementById('totalLosses');
            const overallWinsLossesElement = document.getElementById('overallWinsLosses');
            const overallWinRateElement = document.getElementById('overallWinRate');

            if (totalGamesPlayedElement) {
                totalGamesPlayedElement.textContent = playerData.totalGamesPlayed || 0;
                console.log(`playerProfile.js: Total Games Played element set to: ${totalGamesPlayedElement.textContent}`);
            }
            //if (totalWinsElement) {
            //    totalWinsElement.textContent = playerData.totalWins || 0;
            //    console.log(`playerProfile.js: Total Wins element set to: ${totalWinsElement.textContent}`);
            //}
            //if (totalLossesElement) {
            //    totalLossesElement.textContent = playerData.totalLosses || 0;
            //    console.log(`playerProfile.js: Total Losses element set to: ${totalLossesElement.textContent}`);
            //}
            if (overallWinsLossesElement) {
                const totalWins = playerData.totalWins || 0;
                const totalLosses = playerData.totalLosses || 0;
                overallWinsLossesElement.textContent = `${totalWins}W - ${totalLosses}L`;
                console.log(`playerProfile.js: Overall Wins - Losses element set to: ${overallWinsLossesElement.textContent}`);
            }
            if (overallWinRateElement) {
                const overallWinRate = typeof playerData.overallWinRate === 'number' ? playerData.overallWinRate.toFixed(1) : '0.0';
                overallWinRateElement.textContent = `${overallWinRate}%`;
                console.log(`playerProfile.js: Overall Win Rate element set to: ${overallWinRateElement.textContent}`);
            }

            // Update 1v1 stats
            const games1v1Element = document.getElementById('games1v1');
            //const wins1v1Element = document.getElementById('wins1v1');
            //const losses1v1Element = document.getElementById('losses1v1');
            const winsLosses1v1Element = document.getElementById('winsLosses1v1');
            const winRate1v1Element = document.getElementById('winRate1v1');

            if (games1v1Element) {
                games1v1Element.textContent = playerData.games1v1 || 0;
                console.log(`playerProfile.js: 1v1 Games element set to: ${games1v1Element.textContent}`);
            }
            //if (wins1v1Element) {
            //    wins1v1Element.textContent = playerData.wins1v1 || 0;
            //    console.log(`playerProfile.js: 1v1 Wins element set to: ${wins1v1Element.textContent}`);
            //}
            //if (losses1v1Element) {
            //    losses1v1Element.textContent = playerData.losses1v1 || 0;
            //    console.log(`playerProfile.js: 1v1 Losses element set to: ${losses1v1Element.textContent}`);
            //}
            if (winsLosses1v1Element) {
                const wins1v1 = playerData.wins1v1 || 0;
                const losses1v1 = playerData.losses1v1 || 0;
                winsLosses1v1Element.textContent = `${wins1v1}W - ${losses1v1}L`;
                console.log(`playerProfile.js: Overall Wins - Losses element set to: ${winsLosses1v1Element.textContent}`);
            }

            if (winRate1v1Element) {
                const winRate1v1 = typeof playerData.winRate1v1 === 'number' ? playerData.winRate1v1.toFixed(1) : '0.0';
                winRate1v1Element.textContent = `${winRate1v1}%`;
                console.log(`playerProfile.js: 1v1 Win Rate element set to: ${winRate1v1Element.textContent}`);
            }

            // Update 2v2 stats
            const games2v2Element = document.getElementById('games2v2');
            //const wins2v2Element = document.getElementById('wins2v2');
            //const losses2v2Element = document.getElementById('losses2v2');
            const winsLosses2v2Element = document.getElementById('winsLosses2v2');
            const winRate2v2Element = document.getElementById('winRate2v2');

            if (games2v2Element) {
                games2v2Element.textContent = playerData.games2v2 || 0;
                console.log(`playerProfile.js: 2v2 Games element set to: ${games2v2Element.textContent}`);
            }
            //if (wins2v2Element) {
            //    wins2v2Element.textContent = playerData.wins2v2 || 0;
            //    console.log(`playerProfile.js: 2v2 Wins element set to: ${wins2v2Element.textContent}`);
            //}
            //if (losses2v2Element) {
            //    losses2v2Element.textContent = playerData.losses2v2 || 0;
            //    console.log(`playerProfile.js: 2v2 Losses element set to: ${losses2v2Element.textContent}`);
            //}
            if (winsLosses2v2Element) {
                const wins2v2 = playerData.wins2v2 || 0;
                const losses2v2 = playerData.losses2v2 || 0;
                winsLosses2v2Element.textContent = `${wins2v2}W - ${losses2v2}L`;
                console.log(`playerProfile.js: Overall Wins - Losses element set to: ${winsLosses2v2Element.textContent}`);
            }
            if (winRate2v2Element) {
                const winRate2v2 = typeof playerData.winRate2v2 === 'number' ? playerData.winRate2v2.toFixed(1) : '0.0';
                winRate2v2Element.textContent = `${winRate2v2}%`;
                console.log(`playerProfile.js: 2v2 Win Rate element set to: ${winRate2v2Element.textContent}`);
            }


            // Update streaks
            const currentStreakElement = document.getElementById('currentStreak');
            if (currentStreakElement) {
                const streak = playerData.currentStreak || 0;
                
                // Determine if it's a winning or losing streak based on its sign
                // Display the absolute value of the streak
                const displayedStreak = Math.abs(streak);
                const streakType = streak >= 0 ? 'Wins' : 'Losses'; // Keeps 'Wins' or 'Losses'
                
                currentStreakElement.textContent = `${displayedStreak} ${streakType}`;
                console.log(`playerProfile.js: Current Streak element set to: ${currentStreakElement.textContent}`);
            }

            const longestWinStreakElement = document.getElementById('longestWinStreak');
            if (longestWinStreakElement) {
                longestWinStreakElement.textContent = playerData.longestWinStreak || 0;
                console.log(`playerProfile.js: Longest Win Streak element set to: ${longestWinStreakElement.textContent}`);
            }

            const longestLosingStreakElement = document.getElementById('longestLosingStreak');
            if (longestLosingStreakElement) {
                longestLosingStreakElement.textContent = playerData.longestLosingStreak || 0;
                console.log(`playerProfile.js: Longest Losing Streak element set to: ${longestLosingStreakElement.textContent}`);
            }


            // Render Rivalries
            const rivalriesTableBody = document.getElementById('rivalriesTableBody');
            const noRivalriesMessage = document.getElementById('noRivalriesMessage');
            if (rivalriesTableBody) {
                rivalriesTableBody.innerHTML = ''; // Clear previous entries
                if (playerData.rivalries && Object.keys(playerData.rivalries).length > 0) {
                    Object.entries(playerData.rivalries).forEach(([opponent, stats]) => {
                        const row = `
                            <tr class="border-b border-gray-200 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500">
                                <td class="py-2 px-4 text-sm text-gray-200">${opponent}</td>
                                <td class="py-2 px-4 text-center text-sm text-gray-200">${stats.wins || 0}</td>
                                <td class="py-2 px-4 text-center text-sm text-gray-200">${stats.losses || 0}</td>
                            </tr>
                        `;
                        rivalriesTableBody.innerHTML += row;
                    });
                    noRivalriesMessage.classList.add('hidden');
                    console.log(`playerProfile.js: Rivalries table populated with ${Object.keys(playerData.rivalries).length} entries.`);
                } else {
                    noRivalriesMessage.classList.remove('hidden');
                    console.log("playerProfile.js: No rivalries data found or rivalries object is empty.");
                }
            }
            
            function calculateWinRate(wins, losses) {
                if (wins === 0 && losses === 0) {
                    return 0;
                }
                return (wins / (wins + losses)) * 100;
            }

            // --- Start: Fetching and Rendering Rivalries (as a subcollection) ---
            if (rivalriesTableBody) {
                rivalriesTableBody.innerHTML = ''; // Clear previous entries
                const rivalriesCollectionRef = collection(playerDocRef, 'rivalries');
                const rivalriesSnapshot = await getDocs(rivalriesCollectionRef);
                const rivalriesData = {};

                if (!rivalriesSnapshot.empty) {
                    rivalriesSnapshot.forEach(docSnap => {
                        rivalriesData[docSnap.id] = docSnap.data(); // doc.id is the opponent's name
                    });
                    console.log("playerProfile.js: Fetched rivalries from subcollection:", rivalriesData);

                    // Sort rivalries alphabetically by opponent name before rendering
                    const sortedRivalries = Object.entries(rivalriesData).sort(([nameA], [nameB]) => nameA.localeCompare(nameB));

                    if (sortedRivalries.length > 0) {
                        sortedRivalries.forEach(([opponent, stats]) => {
                            const wins = stats.wins || 0; // Ensure wins defaults to 0 if undefined
                            const losses = stats.losses || 0; // Ensure losses defaults to 0 if undefined
                            const winRate = calculateWinRate(wins, losses); // Calculate win rate

                            const row = `
                                <tr class="border-b border-gray-200 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500">
                                    <td class="py-2 px-4 text-sm text-gray-200">
                                        <a href="playerProfile.html?playerName=${encodeURIComponent(opponent)}" class="flex items-center text-blue-300 hover:text-blue-200 transition duration-150 ease-in-out">
                                            <img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(opponent)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffeedc,f4d15b&size=64" alt="${opponent}" class="w-8 h-8 rounded-full mr-3 border-2 border-orange-500">
                                            <span>${opponent}</span>
                                        </a>
                                    </td>
                                    <td class="py-2 px-4 text-center text-sm text-gray-200">${wins}</td>
                                    <td class="py-2 px-4 text-center text-sm text-gray-200">${losses}</td>
                                    <td class="py-2 px-4 text-center text-sm text-gray-200">${winRate.toFixed(2)}%</td>
                                </tr>
                            `;
                            rivalriesTableBody.innerHTML += row;
                        });
                        noRivalriesMessage.classList.add('hidden');
                        console.log(`playerProfile.js: Rivalries table populated with ${sortedRivalries.length} entries.`);
                    } else {
                        noRivalriesMessage.classList.remove('hidden');
                        console.log("playerProfile.js: No rivalries data found in subcollection.");
                    }
                } else {
                    noRivalriesMessage.classList.remove('hidden');
                    console.log("playerProfile.js: Rivalries subcollection is empty.");
                }
            }
            // --- End: Fetching and Rendering Rivalries ---


            // --- Partnerships Section Update ---
            const partnershipsTableBody = document.getElementById('partnershipsTableBody');
            const noPartnershipsMessage = document.getElementById('noPartnershipsMessage');

            if (partnershipsTableBody) {
                partnershipsTableBody.innerHTML = ''; // Clear previous entries

                // Check if playerData.partnerships exists and has entries
                if (playerData.partnerships && Object.keys(playerData.partnerships).length > 0) {
                    noPartnershipsMessage.classList.add('hidden'); // Hide "No partnerships" message

                    // Sort partnerships alphabetically by teammate name before rendering
                    const sortedPartnerships = Object.entries(playerData.partnerships).sort(([nameA], [nameB]) => nameA.localeCompare(nameB));

                    if (sortedPartnerships.length > 0) {
                        sortedPartnerships.forEach(([partner, stats]) => {
                            const row = `
                                <tr class="border-b border-gray-200 odd:bg-gray-700 even:bg-gray-600 hover:bg-gray-500">
                                    <td class="py-2 px-4 text-sm text-gray-200">
                                        <a href="playerProfile.html?playerName=${encodeURIComponent(partner)}" class="flex items-center text-blue-300 hover:text-blue-200 transition duration-150 ease-in-out">
                                            <img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(partner)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffeedc,f4d15b&size=64" alt="${partner}" class="w-8 h-8 rounded-full mr-3 border-2 border-purple-500">
                                            <span>${partner}</span>
                                        </a>
                                    </td>
                                    <td class="py-2 px-4 text-center text-sm text-gray-200">${stats.wins || 0}</td>
                                    <td class="py-2 px-4 text-center text-sm text-gray-200">${stats.losses || 0}</td>
                                </tr>
                            `;
                            partnershipsTableBody.innerHTML += row;
                        });
                        noPartnershipsMessage.classList.add('hidden');
                        console.log(`playerProfile.js: Partnerships table populated with ${sortedPartnerships.length} entries.`);
                    } else {
                        noPartnershipsMessage.classList.remove('hidden');
                        console.log("playerProfile.js: No partnerships data found in player document.");
                    }
                } else {
                    noPartnershipsMessage.classList.remove('hidden');
                    console.log("playerProfile.js: Partnerships data is empty or missing in player document.");
                }
            }
            // --- End: Fetching and Rendering Partnerships ---

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
});