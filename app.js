// app.js
console.log("app.js: Script loaded.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: DOMContentLoaded fired.");

    // Function to initialize the Cost Calculator
    function initializeCostCalculator() {
        console.log("app.js: initializeCostCalculator called.");

        // Get references to HTML elements for the COST CALCULATOR
        const dayInput = document.getElementById('cost_dayOfWeekInput');
        const startTimeInput = document.getElementById('cost_startTimeInput');
        const endTimeInput = document.getElementById('cost_endTimeInput');
        const memberCheckbox = document.getElementById('cost_memberCheckbox');
        const numPlayersInput = document.getElementById('cost_numPlayersInput');
        const calculateButton = document.getElementById('cost_calculateButton');

        // References to the new output elements and the main container
        const resultContainer = document.getElementById('cost_resultContainer');
        const totalCostOutput = document.getElementById('cost_totalCostOutput');
        const costPerPersonOutput = document.getElementById('cost_costPerPersonOutput');
        const averageHourlyRateOutput = document.getElementById('cost_averageHourlyRateOutput');
        const totalDurationOutput = document.getElementById('cost_totalDurationOutput');
        const errorMessageDisplay = document.getElementById('cost_errorMessage');

        // Check if all essential elements are found
        if (!dayInput || !startTimeInput || !endTimeInput || !memberCheckbox || !numPlayersInput || !calculateButton || !resultContainer || !totalCostOutput || !costPerPersonOutput || !averageHourlyRateOutput || !totalDurationOutput || !errorMessageDisplay) {
            console.error("Cost Calculator: One or more essential HTML elements not found. Check IDs in index.html and app.js.", {dayInput, startTimeInput, endTimeInput, memberCheckbox, numPlayersInput, calculateButton, resultContainer, totalCostOutput, costPerPersonOutput, averageHourlyRateOutput, totalDurationOutput, errorMessageDisplay});
            return; // Exit if elements are missing
        }
        console.log("app.js: All essential HTML elements found.");


        /**
         * Handles the click event for the calculate button.
         * Fetches input values, calls the calculation logic, and displays the result.
         */
        function handleCalculateClick() {
            console.log("app.js: handleCalculateClick triggered.");

            // --- Always clear previous outputs and show the result container initially ---
            resultContainer.classList.remove('hidden'); // Ensure the container is visible
            errorMessageDisplay.classList.add('hidden'); // Hide previous error
            errorMessageDisplay.textContent = ''; // Clear previous error text
            totalCostOutput.textContent = ''; // Clear previous success output
            costPerPersonOutput.textContent = '';
            averageHourlyRateOutput.textContent = '';
            totalDurationOutput.textContent = '';
            console.log("app.js: Cleared previous outputs and showed result container.");


            const dayOfWeek = parseInt(dayInput.value, 10);
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;
            const isMember = memberCheckbox.checked;
            const numPlayers = parseInt(numPlayersInput.value, 10);

            // Input validation (basic HTML-level validation is also good for UX)
            if (!startTime || !endTime) {
                errorMessageDisplay.textContent = "Please select both start and end times.";
                errorMessageDisplay.classList.remove('hidden');
                console.log("app.js: Validation Error - Start/End times missing.");
                return;
            }

            if (isNaN(numPlayers) || numPlayers < 1) {
                errorMessageDisplay.textContent = "Number of players must be at least 1.";
                errorMessageDisplay.classList.remove('hidden');
                console.log("app.js: Validation Error - Num players invalid.");
                return;
            }

            const [startHour, startMinute] = startTime.split(':').map(Number);
            // New: Check if the pool is open at the selected start time
            // This relies on isPoolOpenAtTime from poolCostCalculator.js
            if (!isPoolOpenAtTime(startHour, startMinute)) {
                errorMessageDisplay.textContent = `Error: Pool House is not open at ${startTime}. Operating hours are from 10:00 AM to 01:00 AM (next day).`;
                errorMessageDisplay.classList.remove('hidden');
                console.log("app.js: Validation Error - Pool house closed at start time.");
                return;
            }


            // Call the calculation function from poolCostCalculator.js
            const calculationResult = calculatePoolCost(dayOfWeek, startTime, endTime, isMember);
            console.log("app.js: Calculation result received:", calculationResult);

            // Display the result or an error message
            if (calculationResult.error) {
                errorMessageDisplay.textContent = `Error: ${calculationResult.error}`;
                errorMessageDisplay.classList.remove('hidden'); // Show error message span
                console.log("app.js: Displaying calculation error: " + calculationResult.error);
            } else {
                const totalCost = parseFloat(calculationResult.totalCost);
                const costPerPerson = totalCost / numPlayers;

                // Update individual output spans
                totalCostOutput.textContent = `$${totalCost.toFixed(2)}`;
                costPerPersonOutput.textContent = `$${costPerPerson.toFixed(2)}`;
                averageHourlyRateOutput.textContent = `$${calculationResult.averageHourlyRate}`;
                totalDurationOutput.textContent = `${calculationResult.totalDurationHours}`;

                errorMessageDisplay.classList.add('hidden'); // Ensure error message is hidden on success
                errorMessageDisplay.textContent = ''; // Clear error text on success
                console.log("app.js: Displaying success result.");
            }
        }

        // Attach event listener to the calculate button
        calculateButton.addEventListener('click', handleCalculateClick);
        console.log("app.js: Event listener attached to calculateButton.");
    }

    initializeCostCalculator(); // Call the initializer function
});
