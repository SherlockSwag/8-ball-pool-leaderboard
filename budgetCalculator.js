// budgetCalculator.js
console.log("budgetCalculator.js: Script loaded.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("budgetCalculator.js: DOMContentLoaded fired.");

    // Function to initialize the Budget Calculator
    function initializeBudgetCalculator() {
        console.log("budgetCalculator.js: initializeBudgetCalculator called.");

        // Get references to HTML elements for the BUDGET CALCULATOR
        const numPlayersInput = document.getElementById('budget_numPlayersInput');
        const amountPerPersonInput = document.getElementById('budget_amountPerPersonInput');
        const dayInput = document.getElementById('budget_dayOfWeekInput');
        const startTimeInput = document.getElementById('budget_startTimeInput');
        const memberCheckbox = document.getElementById('budget_memberCheckbox');
        const calculateButton = document.getElementById('budget_calculateButton');

        // References to the output elements and the main container
        const resultContainer = document.getElementById('budget_resultContainer');
        const playtimeOutput = document.getElementById('budget_playtimeOutput');
        const errorMessageDisplay = document.getElementById('budget_errorMessage');

        // Check if all essential elements are found
        if (!numPlayersInput || !amountPerPersonInput || !dayInput || !startTimeInput || !memberCheckbox || !calculateButton || !resultContainer || !playtimeOutput || !errorMessageDisplay) {
            console.error("Budget Calculator: One or more essential HTML elements not found. Check IDs in index.html and budgetCalculator.js. Debugging elements:", {numPlayersInput, amountPerPersonInput, dayInput, startTimeInput, memberCheckbox, calculateButton, resultContainer, playtimeOutput, errorMessageDisplay});
            return; // Exit if elements are missing
        }
        console.log("budgetCalculator.js: All essential HTML elements found.");


        /**
         * Calculates the allowable play time based on a given budget.
         * Iterates through time, deducting cost per minute based on changing hourly rates.
         * Reuses HOURLY_RATES, getDayType, getRateForTime from poolCostCalculator.js which is loaded globally.
         * @param {number} budget - The maximum amount the person is willing to pay.
         * @param {number} dayOfWeek - The day of the week (0 for Sunday, 1 for Monday, ..., 6 for Saturday).
         * @param {string} startTimeStr - Preferred booking start time in "HH:MM" format.
         * @param {boolean} isMember - True if the person is a member, false otherwise.
         * @returns {object} An object containing totalPlayTimeMinutes, and an error message if any.
         */
        function calculateAllowablePlayTime(budget, dayOfWeek, startTimeStr, isMember) {
            console.log("budgetCalculator.js: calculateAllowablePlayTime called.");

            if (budget <= 0) {
                return { totalPlayTimeMinutes: 0, error: "Total budget must be greater than zero." };
            }

            const [startHour, startMinute] = startTimeStr.split(':').map(Number);
            const baseDate = new Date('2025-01-01T00:00:00'); // Fixed date for consistent day of week calculation
            
            let currentMoment = new Date(baseDate);
            currentMoment.setDate(baseDate.getDate() + (dayOfWeek - baseDate.getDay() + 7) % 7);
            currentMoment.setHours(startHour, startMinute, 0, 0);

            let remainingBudget = budget;
            let totalPlayTimeMinutes = 0;
            const maxCalculationMinutes = 24 * 60 * 7; // Max 7 days of calculation to prevent infinite loops (arbitrary large limit)

            let minutesProcessed = 0;

            // Initial check for operating hours using the shared function
            if (!isPoolOpenAtTime(startHour, startMinute)) {
                return { totalPlayTimeMinutes: 0, error: `Pool House is not open at ${startTimeStr}. Operating hours are from 10:00 AM to 01:00 AM (next day).` };
            }

            while (remainingBudget > 0 && minutesProcessed < maxCalculationMinutes) {
                const currentDayOfWeek = currentMoment.getDay();
                const currentHour = currentMoment.getHours();
                const currentMinute = currentMoment.getMinutes();

                const effectiveDayType = getDayType(currentDayOfWeek);
                if (!effectiveDayType) {
                    return { totalPlayTimeMinutes: 0, error: "Internal error: Invalid day type during calculation loop." };
                }

                const hourlyRate = getRateForTime(effectiveDayType, currentHour, isMember);

                if (hourlyRate === 0) {
                    if (totalPlayTimeMinutes > 0) {
                        break;
                    }
                    return { totalPlayTimeMinutes: 0, error: `No specific rate defined for ${effectiveDayType} at ${currentHour}:00.` };
                }

                const costPerMinute = hourlyRate / 60;

                const currentDayRates = HOURLY_RATES[effectiveDayType];
                let currentSlotEndHour = 24;
                for (const slot of currentDayRates) {
                    if ((currentHour >= slot.startHour && currentHour < slot.endHour) || (slot.startHour === 0 && currentHour === 0 && slot.endHour === 1)) {
                        currentSlotEndHour = slot.endHour;
                        break;
                    }
                }
                
                let minutesUntilNextRateChange;
                if (currentSlotEndHour === 24) {
                    minutesUntilNextRateChange = (24 - currentHour) * 60 - currentMinute;
                } else if (currentSlotEndHour === 1 && currentHour === 0) {
                    minutesUntilNextRateChange = (1 - currentHour) * 60 - currentMinute;
                } else {
                    minutesUntilNextRateChange = (currentSlotEndHour - currentHour) * 60 - currentMinute;
                }

                if (minutesUntilNextRateChange <= 0 && currentMinute === 0 && currentHour !== currentSlotEndHour) {
                    minutesUntilNextRateChange = 60;
                } else if (minutesUntilNextRateChange <= 0 && currentMinute > 0) {
                    minutesUntilNextRateChange = 60 - currentMinute;
                }
                
                if (minutesUntilNextRateChange === 0) {
                    minutesUntilNextRateChange = 1;
                }


                const minutesToEvaluate = Math.min(minutesUntilNextRateChange, remainingBudget / costPerMinute);

                if (minutesToEvaluate < 0.01) {
                    break;
                }

                const costForSegment = costPerMinute * minutesToEvaluate;

                if (remainingBudget >= costForSegment) {
                    remainingBudget -= costForSegment;
                    totalPlayTimeMinutes += minutesToEvaluate;
                    currentMoment.setMinutes(currentMoment.getMinutes() + minutesToEvaluate);
                    minutesProcessed += minutesToEvaluate;
                } else {
                    const affordableMinutes = remainingBudget / costPerMinute;
                    totalPlayTimeMinutes += affordableMinutes;
                    remainingBudget = 0;
                    minutesProcessed += affordableMinutes;
                    break;
                }
            }

            const roundedTotalMinutes = Math.round(totalPlayTimeMinutes);
            const hours = Math.floor(roundedTotalMinutes / 60);
            const minutes = roundedTotalMinutes % 60;

            let playtimeString;
            if (hours > 0 && minutes > 0) {
                playtimeString = `${hours} hour(s) and ${minutes} minute(s)`;
            } else if (hours > 0) {
                playtimeString = `${hours} hour(s)`;
            } else if (minutes > 0) {
                playtimeString = `${minutes} minute(s)`;
            } else {
                playtimeString = `0 minutes`;
            }

            return {
                totalPlayTimeMinutes: totalPlayTimeMinutes,
                playtimeString: playtimeString,
                error: null
            };
        }

        /**
         * Handles the click event for the budget calculator button.
         * Fetches input values, calls the allowable playtime calculation, and displays the result.
         */
        function handleCalculateClick() {
            console.log("budgetCalculator.js: handleCalculateClick triggered.");
            // Hide previous error messages and clear content
            resultContainer.classList.add('hidden'); // Initially hide the whole container
            errorMessageDisplay.classList.add('hidden');
            errorMessageDisplay.textContent = '';
            playtimeOutput.textContent = ''; // Clear playtime output on new calculation


            const numPeople = parseInt(numPlayersInput.value, 10);
            const amountPerPerson = parseFloat(amountPerPersonInput.value);
            const totalBudget = numPeople * amountPerPerson;

            const dayOfWeek = parseInt(dayInput.value, 10);
            const startTime = startTimeInput.value;
            const isMember = memberCheckbox.checked;

            // Input validation for new fields
            if (isNaN(numPeople) || numPeople < 1) {
                errorMessageDisplay.textContent = "Number of people must be at least 1.";
                errorMessageDisplay.classList.remove('hidden');
                resultContainer.classList.remove('hidden'); // Show container for error
                console.log("Budget Calculator: Validation Error - Num people invalid.");
                return;
            }
            if (isNaN(amountPerPerson) || amountPerPerson <= 0) {
                errorMessageDisplay.textContent = "Amount per person must be greater than zero.";
                errorMessageDisplay.classList.remove('hidden');
                resultContainer.classList.remove('hidden'); // Show container for error
                console.log("Budget Calculator: Validation Error - Amount per person invalid.");
                return;
                }

            if (totalBudget <= 0) {
                 errorMessageDisplay.textContent = "Total budget must be greater than zero.";
                 errorMessageDisplay.classList.remove('hidden');
                 resultContainer.classList.remove('hidden'); // Show container for error
                 console.log("Budget Calculator: Validation Error - Total budget invalid.");
                 return;
            }


            if (!startTime) {
                errorMessageDisplay.textContent = "Please select a preferred start time.";
                errorMessageDisplay.classList.remove('hidden');
                resultContainer.classList.remove('hidden'); // Show container for error
                console.log("Budget Calculator: Validation Error - Start time missing.");
                return;
            }

            const [startHour, startMinute] = startTime.split(':').map(Number);
            // Check if the pool is open at the selected start time using the shared function
            if (!isPoolOpenAtTime(startHour, startMinute)) {
                errorMessageDisplay.textContent = `Error: Pool House is not open at ${startTime}. Operating hours are from 10:00 AM to 01:00 AM (next day).`;
                errorMessageDisplay.classList.remove('hidden');
                resultContainer.classList.remove('hidden'); // Show container for error
                console.log("Budget Calculator: Validation Error - Pool house closed at start time.");
                return;
            }


            const calculationResult = calculateAllowablePlayTime(totalBudget, dayOfWeek, startTime, isMember);
            console.log("budgetCalculator.js: Calculation result received:", calculationResult);

            if (calculationResult.error) {
                console.log("budgetCalculator.js: Displaying error:", calculationResult.error);
                errorMessageDisplay.textContent = `Error: ${calculationResult.error}`;
                errorMessageDisplay.classList.remove('hidden'); // Show error message span
                resultContainer.classList.remove('hidden'); // Show main result container
            } else {
                console.log("budgetCalculator.js: Displaying playtime:", calculationResult.playtimeString);
                playtimeOutput.textContent = calculationResult.playtimeString;
                // Clear any lingering error message content if it was previously set
                errorMessageDisplay.textContent = '';
                errorMessageDisplay.classList.add('hidden'); // Ensure error message is hidden on success
                resultContainer.classList.remove('hidden'); // Show main result container
            }
        }

        // Attach event listener to the calculate button
        calculateButton.addEventListener('click', handleCalculateClick);
        console.log("budgetCalculator.js: Event listener attached to calculateButton.");
    }

    initializeBudgetCalculator(); // Call the initializer function
});
