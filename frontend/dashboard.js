// Dashboard Controller - National Disaster Response & Rescue Navigation System

document.addEventListener('DOMContentLoaded', () => {
    // Start live clock
    initClock();
});

// Real-time Clock
function initClock() {
    const timeElement = document.getElementById('current-time');
    if (!timeElement) return;
    
    function updateClock() {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    
    updateClock();
    setInterval(updateClock, 1000);
}
