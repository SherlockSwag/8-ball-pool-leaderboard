// poolCostCalculator.js

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
    console.log(`[getRateForTime] Checking dayType: ${dayType}, hour: ${hour}, isMember: ${isMember}`);
    const dayRates = HOURLY_RATES[dayType];
    if (!dayRates) {
        console.log(`[getRateForTime] No rates found for dayType: ${dayType}`);
        return 0;
    }

    for (const slot /*: {startHour: number, endHour: number, public: number, member: number}*/ of dayRates) {
        console.log(`[getRateForTime]   Checking slot: ${slot.startHour}-${slot.endHour}`);
        if (slot.startHour === 0 && slot.endHour === 1) {
            // This slot is for the very early hours of the day.
            // If the current hour is 0, apply this rate.
            if (hour === 0) {
                const rate = isMember ? slot.member : slot.public;
                console.log(`[getRateForTime]   Matched 0-1 slot, rate: ${rate}`);
                return rate;
            }
        } else {
            // Standard day slots
            if (hour >= slot.startHour && hour < slot.endHour) {
                const rate = isMember ? slot.member : slot.public;
                console.log(`[getRateForTime]   Matched standard slot, rate: ${rate}`);
                return rate;
            }
        }
    }
    console.log(`[getRateForTime] No rate found for hour: ${hour} on dayType: ${dayType}`);
    return 0; // No rate found for this hour
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
    console.log(`[calculatePoolCost] Input: Day ${dayOfWeek}, Start ${startTimeStr}, End ${endTimeStr}, Member ${isMember}`);

    const [startHour, startMinute] = startTimeStr.split(':').map(Number);
    const [endHour, endMinute] = endTimeStr.split(':').map(Number);

    // Create dummy Date objects for easy time calculation.
    // Use a fixed date (e.g., 2025-01-01) for consistent day of week (Wednesday)
    // We adjust the day for the actual dayOfWeek from input.
    const baseDate = new Date('2025-01-01T00:00:00'); // This is a Wednesday

    let startDateTime = new Date(baseDate);
    startDateTime.setDate(baseDate.getDate() + (dayOfWeek - baseDate.getDay() + 7) % 7); // Adjust to the correct day of week
    startDateTime.setHours(startHour, startMinute, 0, 0);

    let endDateTime = new Date(baseDate);
    endDateTime.setDate(baseDate.getDate() + (dayOfWeek - baseDate.getDay() + 7) % 7); // Adjust to the correct day of week
    endDateTime.setHours(endHour, endMinute, 0, 0);

    // Handle bookings that cross midnight
    // If end time is earlier than start time, it means it's on the next day
    if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
        console.log("[calculatePoolCost] Booking spans midnight, adjusted end time.");
    }

    let totalCost = 0;
    let currentMoment = new Date(startDateTime);
    let totalDurationMinutes = 0;

    console.log(`[calculatePoolCost] Starting calculation loop from ${currentMoment.toLocaleString()} to ${endDateTime.toLocaleString()}`);

    while (currentMoment < endDateTime) {
        const currentDayOfWeek = currentMoment.getDay(); // 0-6
        const currentHour = currentMoment.getHours();    // 0-23
        const currentMinute = currentMoment.getMinutes(); // 0-59

        let effectiveDayType = getDayType(currentDayOfWeek);
        console.log(`[calculatePoolCost] Current moment: ${currentMoment.toLocaleString()}, DayType: ${effectiveDayType}, Hour: ${currentHour}, Minute: ${currentMinute}`);

        const hourlyRate = getRateForTime(effectiveDayType, currentHour, isMember);

        if (hourlyRate === 0) {
            console.error(`[calculatePoolCost] Error: No rate defined for ${effectiveDayType} at ${currentHour}:00`);
            return { totalCost: 0, totalDurationHours: 0, averageHourlyRate: 0, error: `No rate defined for ${effectiveDayType} at ${currentHour}:00` };
        }

        const currentDayRates = HOURLY_RATES[effectiveDayType];
        let currentSlotEndHour = 24; // Default to end of day or next rate change
        for (const slot /*: {startHour: number, endHour: number, public: number, member: number}*/ of currentDayRates) {
             // Check if currentHour falls within this slot or is the start of an overnight slot
            if ((currentHour >= slot.startHour && currentHour < slot.endHour) || (slot.startHour === 0 && currentHour === 0 && slot.endHour === 1)) {
                currentSlotEndHour = slot.endHour;
                break;
            }
        }
        
        // Calculate the next boundary for the segment
        let nextBoundaryMoment;
        if (currentSlotEndHour === 24) { // Current slot goes to midnight
            nextBoundaryMoment = new Date(currentMoment);
            nextBoundaryMoment.setHours(24, 0, 0, 0); // Next day's midnight
        } else {
            nextBoundaryMoment = new Date(currentMoment);
            nextBoundaryMoment.setHours(currentSlotEndHour, 0, 0, 0); // End of current slot
        }

        // The segment should end at the earliest of: booking end, current rate slot end, or next full hour
        let segmentEnd = new Date(Math.min(endDateTime.getTime(), nextBoundaryMoment.getTime()));
        
        // If currentMoment is 17:30 and segmentEnd was 18:00, this is fine.
        // If currentMoment is 17:00 and segmentEnd was 17:00 (e.g. if startTime is exactly an hour mark and no rate is defined until next hour)
        // this should not happen if rates are defined continuously.
        // The condition `currentMoment.getTime() === segmentEnd.getTime()` indicates no progress,
        // which could happen if `currentMinute` is not 0 and the `segmentEnd` calculation rounds to the current hour.
        // Ensure we advance by at least a minute if at the same time and not exactly on the hour.
        if (currentMoment.getTime() === segmentEnd.getTime() && currentMinute > 0 && currentHour < 23) { // Avoid infinite loop at 23:xx
             segmentEnd = new Date(currentMoment.getTime() + 60 * 1000); // Advance by 1 minute to avoid stuck loop
        }
        // Fallback to advance by 1 hour if stuck
        if (currentMoment.getTime() === segmentEnd.getTime() && currentMinute === 0 && currentHour < 23) {
            segmentEnd = new Date(currentMoment.getTime() + 60 * 60 * 1000); // Advance by 1 hour
        }
        // And always ensure it doesn't go past endDateTime
        segmentEnd = new Date(Math.min(segmentEnd.getTime(), endDateTime.getTime()));


        const segmentDurationMinutes = (segmentEnd.getTime() - currentMoment.getTime()) / (1000 * 60);
        console.log(`[calculatePoolCost]   Segment from ${currentMoment.toLocaleTimeString()} to ${segmentEnd.toLocaleTimeString()}. Duration: ${segmentDurationMinutes} mins. Rate: $${hourlyRate}`);

        if (segmentDurationMinutes > 0) {
            totalCost += (hourlyRate / 60) * segmentDurationMinutes;
            totalDurationMinutes += segmentDurationMinutes;
        }

        currentMoment = segmentEnd; // Move to the end of the current segment
    }

    const totalDurationHours = totalDurationMinutes / 60;
    const averageHourlyRate = totalDurationHours > 0 ? totalCost / totalDurationHours : 0;

    console.log(`[calculatePoolCost] Final: Total Cost: ${totalCost.toFixed(2)}, Avg Rate: ${averageHourlyRate.toFixed(2)}, Total Hours: ${totalDurationHours.toFixed(2)}`);

    return {
        totalCost: totalCost.toFixed(2),
        averageHourlyRate: averageHourlyRate.toFixed(2),
        totalDurationHours: totalDurationHours.toFixed(2),
        error: null
    };
}
