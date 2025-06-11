// poolCostCalculator.js (or a new dedicated rates.js file if you prefer)

const HOURLY_RATES = {
    'monday-thursday': [
        { time: { start: '10:00', end: '18:00' }, public: 10.80, member: 8.60 },
        { time: { start: '18:00', end: '01:00' }, public: 13.80, member: 11.00 } // Note: '01:00' is next day
    ],
    'friday-saturday': [
        { time: { start: '10:00', end: '14:00' }, public: 11.80, member: 9.40 },
        { time: { start: '14:00', end: '01:00' }, public: 14.80, member: 11.80 } // Note: '01:00' is next day
    ],
    'sunday': [
        { time: { start: '10:00', end: '14:00' }, public: 11.80, member: 9.40 },
        { time: { start: '14:00', end: '01:00' }, public: 13.80, member: 11.00 } // Note: '01:00' is next day
    ]
};

// poolCostCalculator.js (assuming you have a function like calculatePoolCost)

// Helper to convert time strings to minutes from midnight for easier comparison
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Function to get the rate for a specific day type and time
function getRate(dayType, bookingTimeMinutes, isMember) {
    const dayRates = HOURLY_RATES[dayType];
    if (!dayRates) {
        console.error("Invalid day type:", dayType);
        return 0; // Or throw an error
    }

    for (const slot of dayRates) {
        const slotStartMinutes = timeToMinutes(slot.time.start);
        let slotEndMinutes = timeToMinutes(slot.time.end);

        // Handle times crossing midnight (e.g., 1 AM is 25:00 for comparison if start is prev day)
        // If the end time is '01:00' and start is '18:00', it implies 01:00 is on the next day.
        // We can treat 01:00 as 25:00 for a consistent 24-hour scale comparison *within* the calculation logic.
        if (slotEndMinutes < slotStartMinutes) {
            slotEndMinutes += 24 * 60; // Add 24 hours in minutes
        }

        // Adjust booking time if it's past midnight but refers to previous day's slot
        // For example, if bookingTimeMinutes is 30 (00:30) and we're checking a 6pm-1am slot
        let effectiveBookingTimeMinutes = bookingTimeMinutes;
        if (bookingTimeMinutes < slotStartMinutes && bookingTimeMinutes < timeToMinutes('06:00') && slotStartMinutes > timeToMinutes('12:00')) {
             effectiveBookingTimeMinutes += 24 * 60; // Assume it's the next day for comparison against overnight slot
        }


        if (effectiveBookingTimeMinutes >= slotStartMinutes && effectiveBookingTimeMinutes < slotEndMinutes) {
            return isMember ? slot.member : slot.public;
        }
    }
    // If no slot matches (e.g., outside 10am-1am range)
    return 0; // Or a default rate, or indicate an error/unavailability
}


// Modified calculatePoolCost function (example)
function calculatePoolCost(dayOfWeek, startTime, endTime, isMember) {
    // 1. Determine day type (e.g., 'monday-thursday', 'friday-saturday', 'sunday')
    let dayType;
    if (dayOfWeek >= 1 && dayOfWeek <= 4) { // Monday (1) to Thursday (4)
        dayType = 'monday-thursday';
    } else if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday (5) or Saturday (6)
        dayType = 'friday-saturday';
    } else if (dayOfWeek === 0) { // Sunday (0)
        dayType = 'sunday';
    } else {
        return { totalCost: 0, hourlyRate: 0, error: "Invalid day of week" };
    }

    // 2. Parse times (assuming startTime and endTime are in "HH:MM" format)
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    let totalCost = 0;
    let totalDurationHours = 0;

    // Handle bookings that span across different rate periods or midnight
    // This is the most complex part. For simplicity, let's assume a continuous rate for now,
    // or you'll need to break the booking into segments.
    // For a simple calculator that just needs the STARTING hourly rate:
    const hourlyRate = getRate(dayType, startMinutes, isMember);

    // If you need to calculate cost across varying rates within the booking:
    // This would involve looping minute by minute or hour by hour, determining the rate for each segment.
    // This is significantly more complex than a simple "get starting rate" approach.

    // For a fixed rate based on the *start time* of the booking:
    if (hourlyRate === 0) {
        return { totalCost: 0, hourlyRate: 0, error: "No rate found for the given time/day." };
    }

    // Assuming you have a way to get duration (e.g., from app.js inputs)
    // For simplicity, let's just use a dummy duration or calculate it directly if times are within same day
    let durationInMinutes = endMinutes - startMinutes;
    if (durationInMinutes < 0) { // Booking spans midnight
        durationInMinutes += 24 * 60; // Add 24 hours to duration
    }
    totalDurationHours = durationInMinutes / 60;
    totalCost = hourlyRate * totalDurationHours;

    return { totalCost, hourlyRate, totalDurationHours };
}