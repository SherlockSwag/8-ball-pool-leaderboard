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