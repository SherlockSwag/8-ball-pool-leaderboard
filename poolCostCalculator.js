const HOURLY_RATE = 15.00;

function calculatePoolCost(hours) {
    if (isNaN(hours) || hours <= 0) {
        throw new Error("Invalid number of hours");
    }
    return HOURLY_RATE * hours;
}
