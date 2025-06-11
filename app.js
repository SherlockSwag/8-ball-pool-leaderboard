// app.js

document.addEventListener('DOMContentLoaded', () => {
    // Get references to HTML elements
    const dayInput = document.getElementById('dayOfWeekInput');
    const startTimeInput = document.getElementById('startTimeInput');
    const endTimeInput = document.getElementById('endTimeInput');
    const memberCheckbox = document.getElementById('memberCheckbox');
    const numPlayersInput = document.getElementById('numPlayersInput');
    const calculateButton = document.getElementById('calculateButton');

    // References to the new output elements and the main container
    const resultContainer = document.getElementById('resultContainer');
    const totalCostOutput = document.getElementById('totalCostOutput');
    const costPerPersonOutput = document.getElementById('costPerPersonOutput');
    const averageHourlyRateOutput = document.getElementById('averageHourlyRateOutput');
    const totalDurationOutput = document.getElementById('totalDurationOutput');
    const errorMessageDisplay = document.getElementById('errorMessage');


    /**
     * Handles the click event for the calculate button.
     * Fetches input values, calls the calculation logic, and displays the result.
     */
    function handleCalculateClick() {
        // Hide previous error messages and results
        resultContainer.classList.add('hidden');
        errorMessageDisplay.classList.add('hidden');
        errorMessageDisplay.textContent = '';


        const dayOfWeek = parseInt(dayInput.value, 10);
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;
        const isMember = memberCheckbox.checked;
        const numPlayers = parseInt(numPlayersInput.value, 10);

        // Input validation
        if (!startTime || !endTime) {
            errorMessageDisplay.textContent = "Please select both start and end times.";
            errorMessageDisplay.classList.remove('hidden');
            return;
        }

        if (isNaN(numPlayers) || numPlayers < 1) {
            errorMessageDisplay.textContent = "Number of players must be at least 1.";
            errorMessageDisplay.classList.remove('hidden');
            return;
        }

        // Call the calculation function from poolCostCalculator.js
        const calculationResult = calculatePoolCost(dayOfWeek, startTime, endTime, isMember);

        // Display the result or an error message
        if (calculationResult.error) {
            errorMessageDisplay.textContent = `Error: ${calculationResult.error}`;
            errorMessageDisplay.classList.remove('hidden');
        } else {
            const totalCost = parseFloat(calculationResult.totalCost);
            const costPerPerson = totalCost / numPlayers;

            // Update individual output spans
            totalCostOutput.textContent = `$${totalCost.toFixed(2)}`;
            costPerPersonOutput.textContent = `$${costPerPerson.toFixed(2)}`;
            averageHourlyRateOutput.textContent = `$${calculationResult.averageHourlyRate}`;
            totalDurationOutput.textContent = `${calculationResult.totalDurationHours}`;

            // Show the result container
            resultContainer.classList.remove('hidden');
        }
    }

    // ONLY attach event listener to the calculate button
    if (calculateButton) {
        calculateButton.addEventListener('click', handleCalculateClick);
    }
});
