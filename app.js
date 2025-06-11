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

function loadHistory() {
    const historyList = document.getElementById("history");
    firebase.firestore()
        .collection("calculations")
        .orderBy("timestamp", "desc")
        .limit(5)
        .onSnapshot(snapshot => {
            historyList.innerHTML = ""; // Clear previous items
            snapshot.forEach(doc => {
                const data = doc.data();
                const item = document.createElement("li");
                item.textContent = `${data.hours} hour(s) - $${data.cost.toFixed(2)}`;
                historyList.appendChild(item);
            });
        });
}

window.onload = loadHistory;
