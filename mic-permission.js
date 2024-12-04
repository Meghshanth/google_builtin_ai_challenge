document.getElementById('requestPermission').addEventListener('click', async () => {
    try {
        // Explicitly request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Send message to background script to store access state
        chrome.runtime.sendMessage({ type: 'MIC_ACCESS_GRANTED' }, (response) => {
            if (response.success) {
                // Close the current tab
                window.close();
            }
        });

        // Stop the stream immediately after getting access
        stream.getTracks().forEach(track => track.stop());
    } catch (error) {
        console.error('Microphone access denied:', error);
        alert('Microphone access was denied. Please try again.');
    }
});