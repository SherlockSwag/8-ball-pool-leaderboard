// playerList.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, query, getDocs, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import your local firebase-config.js
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js'; 

let db;
let auth;

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

// Firestore collection path for public data (players)
const PLAYERS_COLLECTION_PATH = `artifacts/${appId}/public/data/players`;

// Helper function to show messages (errors, success, loading)
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `col-span-full mt-4 p-3 rounded-lg text-sm text-center ${
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
        const app = initializeApp(finalFirebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized in playerList.js");
    } catch (error) {
        console.error("Firebase initialization failed in playerList.js:", error);
        showMessage('playersErrorMessage', `Firebase initialization error: ${error.message}`, 'error');
        return; // Stop execution if Firebase fails to initialize
    }

    // Authenticate user anonymously
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            try {
                await signInAnonymously(auth);
                console.log("Signed in anonymously for playerList.js.");
                fetchAndRenderPlayers(); // Fetch after sign-in
            } catch (error) {
                console.error("Error signing in anonymously for playerList.js:", error);
                showMessage('playersErrorMessage', `Authentication error: ${error.message}`, 'error');
            }
        } else {
            console.log("Existing user detected for playerList.js:", user.uid);
            fetchAndRenderPlayers(); // Fetch if already signed in
        }
    });

    // Function to fetch and render players
    async function fetchAndRenderPlayers() {
        const playersGrid = document.getElementById('playersGrid');
        const playersLoadingMessage = document.getElementById('playersLoadingMessage');
        const playersErrorMessage = document.getElementById('playersErrorMessage');

        if (!playersGrid || !playersLoadingMessage || !playersErrorMessage) {
            console.error("playerList.js: Required DOM elements for player list not found.");
            return;
        }

        playersGrid.innerHTML = ''; // Clear existing cards
        playersLoadingMessage.classList.remove('hidden');
        hideMessage('playersErrorMessage');

        try {
            const playersCol = collection(db, PLAYERS_COLLECTION_PATH);
            // Order by totalGamesPlayed descending for a general player list
            const q = query(playersCol, orderBy('totalGamesPlayed', 'desc')); 
            const querySnapshot = await getDocs(q);

            playersLoadingMessage.classList.add('hidden'); // Hide loading message

            if (querySnapshot.empty) {
                playersGrid.innerHTML = `<p class="col-span-full text-center text-gray-400">No players found. Add matches to see players here!</p>`;
                return;
            }

            querySnapshot.forEach(doc => {
                const player = doc.data();
                const playerIdForLink = encodeURIComponent(doc.id); 

                // --- ADD THIS CONSOLE.LOG ---
                console.log(`Processing player: name=${player.name}, doc.id=${doc.id}, encodedId=${playerIdForLink}`);
                // -----------------------------

                const totalGames = player.totalGamesPlayed || 0;
                let winRate = (player.overallWinRate !== undefined && player.overallWinRate !== null) ? player.overallWinRate.toFixed(1) : '0'; 

                if (totalGames === 0) {
                    winRate = 'N/A';
                }

                const currentStreak = player.currentStreak !== undefined ? `${player.currentStreak > 0 ? '+' : ''}${player.currentStreak}` : 'N/A';

                const playerCard = `
                    <div class="bg-gray-700 p-6 rounded-lg shadow-lg text-center transform hover:scale-102 transition duration-200 ease-in-out border border-gray-600">
                        <div class="w-24 h-24 rounded-full mx-auto mb-4 overflow-hidden border-2 border-blue-400">
                            <img src="${player.avatarUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default&backgroundColor=b6e3f4,c0aede,d1d4f9,ffeedc,f4d15b&size=64'}" alt="${player.name}" class="w-full h-full object-cover">
                        </div>
                        <h3 class="text-xl font-semibold text-blue-300 mb-2">${player.name}</h3>
                        <p class="text-gray-200 text-sm mb-1">
                            <strong class="font-medium">Total Games:</strong> ${totalGames}
                        </p>
                        <p class="text-gray-200 text-sm mb-1">
                            <strong class="font-medium">Win Rate:</strong> ${winRate}${winRate !== 'N/A' ? '%' : ''}
                        </p>
                        <p class="text-gray-200 text-sm mb-4">
                            <strong class="font-medium">Streak:</strong> ${currentStreak}
                        </p>
                        <a href="playerProfile.html?playerName=${playerIdForLink}" 
                           class="inline-block bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition duration-150 ease-in-out transform hover:scale-105">
                            View Profile
                        </a>
                    </div>
                `;
                playersGrid.innerHTML += playerCard;
            });

        } catch (error) {
            console.error("Error fetching and rendering players:", error);
            showMessage('playersErrorMessage', `Error loading players: ${error.message}`, 'error');
            playersLoadingMessage.classList.add('hidden');
        }
    }
});