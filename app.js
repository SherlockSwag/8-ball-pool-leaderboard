// app.js

document.addEventListener('DOMContentLoaded', () => {
    // Get references to HTML elements
    const dayInput = document.getElementById('dayOfWeekInput');
    const startTimeInput = document.getElementById('startTimeInput');
    const endTimeInput = document.getElementById('endTimeInput');
    const memberCheckbox = document.getElementById('memberCheckbox');
    const numPlayersInput = document.getElementById('numPlayersInput'); // New: Number of Players input
    const calculateButton = document.getElementById('calculateButton');
    const resultDisplay = document.getElementById('result');

    /**
     * Handles the click event for the calculate button.
     * Fetches input values, calls the calculation logic, and displays the result.
     */
    function handleCalculateClick() {
        const dayOfWeek = parseInt(dayInput.value, 10); // Day of week (0-6)
        const startTime = startTimeInput.value;         // e.g., "10:00"
        const endTime = endTimeInput.value;             // e.g., "12:00"
        const isMember = memberCheckbox.checked;        // true/false
        const numPlayers = parseInt(numPlayersInput.value, 10); // New: Number of players

        // Basic input validation
        if (!startTime || !endTime) {
            resultDisplay.classList.remove('bg-gray-50', 'text-gray-800');
            resultDisplay.classList.add('bg-red-100', 'text-red-700');
            resultDisplay.textContent = "Error: Please select both start and end times.";
            return;
        }

        if (isNaN(numPlayers) || numPlayers < 1) {
            resultDisplay.classList.remove('bg-gray-50', 'text-gray-800');
            resultDisplay.classList.add('bg-red-100', 'text-red-700');
            resultDisplay.textContent = "Error: Number of players must be at least 1.";
            return;
        }

        // Call the calculation function from poolCostCalculator.js
        const calculationResult = calculatePoolCost(dayOfWeek, startTime, endTime, isMember);

        // Display the result or an error message
        if (calculationResult.error) {
            resultDisplay.classList.remove('bg-gray-50', 'text-gray-800');
            resultDisplay.classList.add('bg-red-100', 'text-red-700');
            resultDisplay.textContent = `Error: ${calculationResult.error}`;
        } else {
            const totalCost = parseFloat(calculationResult.totalCost); // Convert back to number for division
            const costPerPerson = totalCost / numPlayers;

            resultDisplay.classList.remove('bg-red-100', 'text-red-700');
            resultDisplay.classList.add('bg-gray-50', 'text-gray-800');
            resultDisplay.innerHTML = `
                Total Cost: $${totalCost.toFixed(2)}<br>
                Cost per Person: $${costPerPerson.toFixed(2)}<br>
                (Average Hourly Rate: $${calculationResult.averageHourlyRate} over ${calculationResult.totalDurationHours} hours)
            `;
        }
    }

    // Attach event listeners
    if (calculateButton) {
        calculateButton.addEventListener('click', handleCalculateClick);
    }

    dayInput.addEventListener('change', handleCalculateClick);
    startTimeInput.addEventListener('change', handleCalculateClick);
    endTimeInput.addEventListener('change', handleCalculateClick);
    memberCheckbox.addEventListener('change', handleCalculateClick);
    numPlayersInput.addEventListener('change', handleCalculateClick); // New: Listener for players input

    // Initial calculation when the page loads with default values
    handleCalculateClick();
});
