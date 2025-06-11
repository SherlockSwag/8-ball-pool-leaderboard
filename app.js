document.addEventListener('DOMContentLoaded', () => {
    const dayInput = document.getElementById('dayOfWeekInput'); // e.g., a select dropdown
    const startTimeInput = document.getElementById('startTimeInput');
    const endTimeInput = document.getElementById('endTimeInput');
    const memberCheckbox = document.getElementById('memberCheckbox');
    const calculateButton = document.getElementById('calculateButton');
    const resultDisplay = document.getElementById('result');

    if (calculateButton) {
        calculateButton.addEventListener('click', () => {
            const dayOfWeek = parseInt(dayInput.value, 10); // Make sure your dropdown values are 0-6 (Sun-Sat)
            const startTime = startTimeInput.value; // e.g., "10:00"
            const endTime = endTimeInput.value;   // e.g., "12:00"
            const isMember = memberCheckbox.checked;

            const calculationResult = calculatePoolCost(dayOfWeek, startTime, endTime, isMember);

            if (calculationResult.error) {
                resultDisplay.textContent = `Error: ${calculationResult.error}`;
            } else {
                resultDisplay.textContent = `Hourly Rate: $${calculationResult.hourlyRate.toFixed(2)} | Total Cost: $${calculationResult.totalCost.toFixed(2)} for ${calculationResult.totalDurationHours.toFixed(2)} hours`;
            }
        });
    }
});

function showCost() {
    const hoursInput = document.getElementById("hours").value;
    const output = document.getElementById("output");

    try {
        const cost = calculatePoolCost(parseFloat(hoursInput));
        output.textContent = `Total Cost: $${cost.toFixed(2)}`;

        // ✅ Save to Firestore
        firebase.firestore().collection('calculations').add({
            hours: parseFloat(hoursInput),
            cost: cost,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        output.textContent = error.message;
    }
}