// public/js/utils.js
/**
 * Displays a message in a specified HTML element.
 * Automatically hides after a duration if specified.
 * @param {string} elementId - The ID of the HTML element to display the message in.
 * @param {string} message - The message content.
 * @param {'success'|'error'|'info'} type - The type of message (determines background color).
 * @param {number} [duration=0] - Optional. Duration in milliseconds after which the message will hide. 0 means no auto-hide.
 */
export function showMessage(elementId, message, type, duration = 0) {
    const displayElement = document.getElementById(elementId);
    if (displayElement) {
        displayElement.textContent = message;
        displayElement.classList.remove('hidden', 'bg-red-800', 'bg-green-800', 'bg-blue-800');

        if (type === 'error') {
            displayElement.classList.add('bg-red-800'); // Adds red
        } else if (type === 'success') {
            displayElement.classList.add('bg-green-800'); // Adds green
        } else { // info
            displayElement.classList.add('bg-blue-800'); // Adds blue
        }

        if (duration > 0) {
            console.log(`DEBUG: Setting timeout to hide message in ${duration}ms.`);
            setTimeout(() => {
                hideMessage(elementId);
            }, duration);
        }
    } else {
        console.error(`DEBUG ERROR: Element with ID "${elementId}" not found for showMessage.`);
    }
}

/**
 * Hides a message in a specified HTML element.
 * @param {string} elementId - The ID of the HTML element to hide.
 */
export function hideMessage(elementId) {
    const displayElement = document.getElementById(elementId);
    if (displayElement) {
        displayElement.classList.add('hidden');
        displayElement.textContent = ''; 
    }
}

/**
 * Formats a given date input into a readable 'YYYY-MM-DD' format.
 * Handles Date objects, date strings, and Firebase Timestamps.
 * @param {string|Date|firebase.firestore.Timestamp} dateInput - The date to format.
 * @returns {string} Formatted date string (YYYY-MM-DD) or 'Invalid Date'/'N/A'.
 */
export function formatDate(dateInput) {
    let date;
    if (dateInput instanceof Date) {
        date = dateInput;
    } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
    } else if (dateInput && typeof dateInput.toDate === 'function') {
        // Handle Firebase Timestamp objects
        date = dateInput.toDate();
    } else {
        return 'N/A'; // Or handle as appropriate if input type is unexpected
    }

    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, '0');

    return `${day}/${month}/${year}`;
    
}
/**
 * Formats a given date/time input into a readable 'HH:MM AM/PM' format.
 * Handles Date objects, time strings, and Firebase Timestamps.
 * @param {string|Date|firebase.firestore.Timestamp} timeInput - The time to format.
 * @returns {string} Formatted time string (HH:MM AM/PM) or 'Invalid Time'/'N/A'.
 */
export function formatTime(timeInput) {
    let date;
    if (timeInput instanceof Date) {
        date = timeInput;
    } else if (typeof timeInput === 'string') {
        date = new Date(timeInput);
    } else if (timeInput && typeof timeInput.toDate === 'function') {
        // Handle Firebase Timestamp objects
        date = timeInput.toDate();
    } else {
        return 'N/A'; // Or handle as appropriate
    }

    if (isNaN(date.getTime())) {
        return 'Invalid Time';
    }

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // The hour '0' (midnight) should be '12 AM'
    return `${hours}:${minutes} ${ampm}`;
}