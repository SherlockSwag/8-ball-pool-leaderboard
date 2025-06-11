// poolCostCalculator.js
console.log("poolCostCalculator.js: Script loaded.");

// Define the hourly rates based on day, time, and membership status
// Times are in 24-hour format (e.g., 18:00 is 6 PM).
// Note: "next 1am" slots means from midnight (00:00) to 01:00 of the same effective day type.
const HOURLY_RATES = {
    // Monday (1) to Thursday (4)
    'monday-thursday': [
        { startHour: 10, endHour: 18, public: 10.80, member: 8.60 }, // 10:00 to 18:00
        { startHour: 18, endHour: 24, public: 13.80, member: 11.00 }, // 18:00 to 23:59:59
        { startHour: 0, endHour: 1, public: 13.80, member: 11.00 }   // 00:00 to 01:00 (of following day for overnight bookings)
    ],
    // Friday (5) and Saturday (6)
    'friday-saturday': [
        { startHour: 10, endHour: 14, public: 11.80, member: 9.40 }, // 10:00 to 14:00
        { startHour: 14, endHour: 24, public: 14.80, member: 11.80 }, // 14:00 to 23:59:59
        { startHour: 0, endHour: 1, public: 14.80, member: 11.80 }   // 00:00 to 01:00 (of following day for overnight bookings)
    ],
    // Sunday (0)
    'sunday': [
        { startHour: 10, endHour: 14, public: 11.80, member: 9.40 }, // 10:00 to 14:00
        { startHour: 14, endHour: 24, public: 13.80, member: 11.00 }, // 14:00 to 23:59:59
        { startHour: 0, endHour: 1, public: 13.80, member: 11.00 }   // 00:00 to 01:00 (of following day for overnight bookings)
    ]
};

/**
 * Determines the day type string based on the Date object's day of the week.
 * @param {number} dayOfWeek - The day of the week (0 for Sunday, 1 for Monday, ..., 6 for Saturday).
 * @returns {string|null} The day type string ('monday-thursday', 'friday-saturday', 'sunday') or null if invalid.
 */
function getDayType(dayOfWeek) {
    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        return 'monday-thursday';
    } else if (dayOfWeek === 5 || dayOfWeek === 6) {
        return 'friday-saturday';
    } else if (dayOfWeek === 0) {
        return 'sunday';
    }
    return null; // Invalid day
}

/**
 * Gets the hourly rate for a specific time and day type.
 * @param {string} dayType - The type of day ('monday-thursday', 'friday-saturday', 'sunday').
 * @param {number} hour - The hour (0-23).
 * @param {boolean} isMember - True if the person is a member, false otherwise.
 * @returns {number} The hourly rate. Returns 0 if no rate is found for the given time.
 */
function getRateForTime(dayType, hour, isMember) {
    const dayRates = HOURLY_RATES[dayType];
    if (!dayRates) {
        return 0; // Should not happen with valid dayType
    }

    for (const slot of dayRates) {
        if (slot.startHour === 0 && slot.endHour === 1) { // Specific 00:00 to 01:00 slot
            if (hour === 0) { // If it's hour 0 (midnight to 00:59)
                return isMember ? slot.member : slot.public;
            }
        } else { // Standard slots (e.g., 10:00-18:00, 18:00-24:00)
            if (hour >= slot.startHour && hour < slot.endHour) {
                return isMember ? slot.member : slot.public;
            }
        }
    }
    return 0; // No rate found for this hour (implies outside defined slots within a day type)
}

/**
 * Checks if the pool is open at a given time (hour and minute).
 * Operating hours: 10:00 AM to 01:00 AM (next day).
 * This function handles the logical time range across midnight.
 * @param {number} hour - The hour (0-23).
 * @param {number} minute - The minute (0-59).
 * @returns {boolean} True if open, false otherwise.
 */
function isPoolOpenAtTime(hour, minute) {
    // Closed window: from 01:00 AM (inclusive) to 09:59 AM (inclusive)
    // So, if hour is 1 AND minute is 0, it's considered boundary, but after 01:00 is closed.
    // if hour is 1 AND minute > 0, it's closed (e.g., 01:01 AM)
    // if hour is between 2 and 9 (inclusive), it's closed.
    if ((hour === 1 && minute >= 1) || (hour >= 2 && hour < 10)) {
        return false; // It's within the closed period (01:01 AM to 09:59 AM)
    }
    // All other times are considered open based on our definition (10:00 AM to 01:00 AM)
    return true;
}


/**
 * Calculates the total pool cost based on booking details.
 * Handles bookings spanning across different rates and midnight.
 *
 * @param {number} dayOfWeek - The day of the week (0 for Sunday, 1 for Monday, ..., 6 for Saturday).
 * @param {string} startTimeStr - Booking start time in "HH:MM" format.
 * @param {string} endTimeStr - Booking end time in "HH:MM" format.
 * @param {boolean} isMember - True if the person is a member, false otherwise.
 * @returns {object} An object containing totalCost, hourlyRate (average, if rates vary), totalDurationHours, and an error message if any.
 */
function calculatePoolCost(dayOfWeek, startTimeStr, endTimeStr, isMember) {
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);
    const [endHour, endMinute] = endTimeStr.split(':').map(Number);

    // Initial check for operating hours at the start of the booking (using the shared function)
    if (!isPoolOpenAtTime(startHour, startMinute)) {
        return { error: `Pool House is not open at ${startTimeStr}. Operating hours are from 10:00 AM to 01:00 AM (next day).` };
    }

    const effectiveDayType = getDayType(dayOfWeek);
    if (!effectiveDayType) {
        return { error: "Invalid day of week selected." };
    }

    // Create dummy Date objects for easy time calculation.
    const baseDate = new Date('2025-01-01T00:00:00'); // This is a Wednesday

    let startDateTime = new Date(baseDate);
    startDateTime.setDate(baseDate.getDate() + (dayOfWeek - baseDate.getDay() + 7) % 7);
    startDateTime.setHours(startHour, startMinute, 0, 0);

    let endDateTime = new Date(baseDate);
    endDateTime.setDate(baseDate.getDate() + (dayOfWeek - baseDate.getDay() + 7) % 7);
    endDateTime.setHours(endHour, endMinute, 0, 0);

    // Handle bookings that cross midnight
    if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
    }

    let totalCost = 0;
    let currentMoment = new Date(startDateTime);
    let totalDurationMinutes = 0;

    // Loop through the booking duration, minute by minute, or in segments
    while (currentMoment < endDateTime) {
        const currentDayOfWeek = currentMoment.getDay();
        const currentHour = currentMoment.getHours();
        const currentMinute = currentMoment.getMinutes();

        const currentEffectiveDayType = getDayType(currentDayOfWeek);
        if (!currentEffectiveDayType) {
            return { error: "Internal error: Invalid day type during calculation loop." };
        }

        const hourlyRate = getRateForTime(currentEffectiveDayType, currentHour, isMember);

        if (hourlyRate === 0) {
            if (totalDurationMinutes > 0) {
                // If some duration has passed, and we've hit an unpriced hour (e.g., after 01:00 AM).
                // This means the booking extends beyond operating hours.
                return { error: `Booking extends beyond operating hours at ${currentHour}:00. Pool House closes at 01:00 AM.` };
            }
            // If it's the very beginning and no rate, this scenario should ideally be caught by isPoolOpenAtTime.
            // This fallback is for internal rate definition gaps within generally open hours.
            return { error: `No specific rate defined for ${currentEffectiveDayType} at ${currentHour}:00.` };
        }

        const currentDayRates = HOURLY_RATES[currentEffectiveDayType]; // **FIXED TYPO HERE**
        let currentSlotEndHour = 24; // Default to end of day (midnight)
        for (const slot of currentDayRates) {
            if ((currentHour >= slot.startHour && currentHour < slot.endHour) || (slot.startHour === 0 && currentHour === 0 && slot.endHour === 1)) {
                currentSlotEndHour = slot.endHour;
                break;
            }
        }
        
        let nextBoundaryMoment = new Date(currentMoment);
        if (currentSlotEndHour === 1 && currentHour === 0) { // Specific 00:00-01:00 slot boundary
            nextBoundaryMoment.setHours(1, 0, 0, 0);
        } else { // Standard slot boundary
            nextBoundaryMoment.setHours(currentSlotEndHour, 0, 0, 0);
        }

        // Ensure the segment doesn't exceed the actual booking end time
        let segmentEnd = new Date(Math.min(endDateTime.getTime(), nextBoundaryMoment.getTime()));
        
        // Prevent infinite loops if segmentEnd doesn't advance (e.g., floating point inaccuracies at boundaries)
        if (currentMoment.getTime() === segmentEnd.getTime()) {
             // Advance by at least 1 minute to ensure progress
            segmentEnd = new Date(currentMoment.getTime() + 60 * 1000);
            segmentEnd = new Date(Math.min(segmentEnd.getTime(), endDateTime.getTime()));
            if (currentMoment.getTime() === segmentEnd.getTime()) { // Still stuck? Something fundamentally wrong, break.
                 break;
            }
        }

        const segmentDurationMinutes = (segmentEnd.getTime() - currentMoment.getTime()) / (1000 * 60);

        if (segmentDurationMinutes > 0) {
            totalCost += (hourlyRate / 60) * segmentDurationMinutes;
            totalDurationMinutes += segmentDurationMinutes;
        }

        currentMoment = segmentEnd;
    }

    const totalDurationHours = totalDurationMinutes / 60;
    const averageHourlyRate = totalDurationHours > 0 ? totalCost / totalDurationHours : 0;

    return {
        totalCost: totalCost.toFixed(2),
        averageHourlyRate: averageHourlyRate.toFixed(2),
        totalDurationHours: totalDurationHours.toFixed(2),
        error: null
    };
}
