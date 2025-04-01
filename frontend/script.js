// --- Configuration ---
// IMPORTANT: Replace with the actual URL where your Python backend is running
// For local development:
const BACKEND_URL = 'http://127.0.0.1:5000';
// For deployment (e.g., on Heroku):
// const BACKEND_URL = 'https://your-backend-app-name.herokuapp.com';

let currentChatMode = null; // 'text', 'voice', 'video'
let mediaRecorder = null; // For voice recording
let audioChunks = [];
let videoStream = null; // For video feed

// --- UI Element References ---
const onboardingSection = document.getElementById('onboarding-section');
const modeSelection = document.getElementById('mode-selection');
const chatInterface = document.getElementById('chat-interface');
const chatOutput = document.getElementById('chat-output');
const textInput = document.getElementById('text-input');
const micButton = document.getElementById('mic-button');
const statusIndicator = document.getElementById('status-indicator');
const chatModeIndicator = document.getElementById('chat-mode-indicator');
const videoFeed = document.getElementById('video-feed');
const predictionResultsDiv = document.getElementById('prediction-results');
const reportSection = document.getElementById('report-section');
const sessionReportDiv = document.getElementById('session-report');


// --- Onboarding Logic ---
function submitOnboarding() {
    const form = document.getElementById('onboarding-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Basic validation example (add more as needed)
    if (!data.age || !data.gender) {
        alert('Please fill in at least age and gender, or skip.');
        return;
    }

    console.log('Submitting onboarding data:', data);
    predictionResultsDiv.innerHTML = '<i>Analyzing...</i>';

    fetch(`${BACKEND_URL}/predict/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
     })
    .then(result => {
        console.log('Prediction Result:', result);
        let resultsHtml = `<strong>Potential Areas based on Input:</strong><br>`;
        if (result.issues && result.issues.length > 0) {
            result.issues.forEach(issue => {
                resultsHtml += `- ${issue.name} (Likelihood: ${(issue.probability * 100).toFixed(0)}%)<br>`;
            });
            resultsHtml += `<p><small>${result.message || 'Remember, this is not a diagnosis.'}</small></p>`;
        } else {
             resultsHtml += 'No specific areas flagged based on input, or analysis incomplete.';
        }
        predictionResultsDiv.innerHTML = resultsHtml;
        // Proceed to next step after showing results
        showModeSelection();
    })
    .catch(error => {
        console.error('Error submitting onboarding:', error);
        predictionResultsDiv.innerHTML = `<p style="color: red;">Error analyzing data. ${error.message}. Please check if the backend server is running.</p>`;
        // Still allow proceeding
        showModeSelection();
    });
}

function skipOnboarding() {
    console.log('Skipping onboarding');
    showModeSelection();
}

function showModeSelection() {
    onboardingSection.style.display = 'none';
    modeSelection.style.display = 'block';
    chatInterface.style.display = 'none';
    reportSection.style.display = 'none';
}


// --- Chat Logic ---
function startChat(mode) {
    currentChatMode = mode;
    console.log(`Starting chat in ${mode} mode.`);
    modeSelection.style.display = 'none';
    chatInterface.style.display = 'block';
    chatModeIndicator.textContent = mode;

    // Reset chat
    chatOutput.innerHTML = '';
    addMessageToChat("Hello! How can I assist you today?", 'bot');

    // Configure UI based on mode
    if (mode === 'text') {
        micButton.style.display = 'none';
        videoFeed.style.display = 'none';
        stopVideoStream(); // Ensure video is off
    } else if (mode === 'voice') {
        micButton.style.display = 'inline-block';
        textInput.placeholder = "Or type here...";
        videoFeed.style.display = 'none';
        stopVideoStream();
        // We'll request mic permission when the button is first clicked
    } else if (mode === 'video') {
        micButton.style.display = 'inline-block'; // For voice input during video
        videoFeed.style.display = 'block';
        textInput.placeholder = "Or type here...";
        startVideoStream(); // Request camera access
        // TODO: Add logic to periodically send video frames to backend
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function sendMessage() {
    const messageText = textInput.value.trim();
    if (!messageText) return; // Don't send empty messages

    addMessageToChat(messageText, 'user');
    textInput.value = '';

    // --- Send to Backend ---
    sendToBackend({ message: messageText, mode: currentChatMode });
}

function sendToBackend(payload) {
    console.log('Sending to backend:', payload);
    // Optionally add a 'Thinking...' indicator
    addMessageToChat("...", 'bot', true); // Add a temporary thinking message

     fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), // Send text message and mode
    })
    .then(response => {
         if (!response.ok) {
             // Attempt to read error message from backend if possible
             return response.json().then(err => {
                 throw new Error(`HTTP error! status: ${response.status}, message: ${err.error || 'Unknown backend error'}`);
             }).catch(() => {
                 // If backend didn't send JSON error, use status text
                 throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
             });
         }
         return response.json();
     })
    .then(data => {
        console.log('Received from backend:', data);
        removeThinkingMessage(); // Remove the "..."
        addMessageToChat(data.reply || "Sorry, I didn't get a response.", 'bot');
        // TODO: Potentially use data.detected_emotions to update UI or logs
    })
    .catch(error => {
        console.error('Error sending/receiving chat message:', error);
        removeThinkingMessage();
        addMessageToChat(`Error: Could not connect or backend error. ${error.message}`, 'bot');
    });
}


function addMessageToChat(text, sender, isTemporary = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
    messageDiv.textContent = text;
    if (isTemporary) {
        messageDiv.id = 'thinking-message'; // Assign an ID to remove it later
    }
    chatOutput.appendChild(messageDiv);
    chatOutput.scrollTop = chatOutput.scrollHeight; // Scroll to bottom
}

function removeThinkingMessage() {
    const thinkingMsg = document.getElementById('thinking-message');
    if (thinkingMsg) {
        thinkingMsg.remove();
    }
}

// --- Voice Input (Web Speech API - Simple Version) ---
// NOTE: More robust audio handling (sending blobs to backend) is complex.
// This uses browser's built-in speech recognition. Quality varies.
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; // Process single utterances
    recognition.lang = 'en-US';
    recognition.interimResults = false; // We want final results

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        console.log('Voice recognized:', transcript);
        statusIndicator.textContent = `Recognized: "${transcript}"`;
        textInput.value = transcript; // Put recognized text in input box
        sendMessage(); // Send it as a regular message
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        statusIndicator.textContent = `Error: ${event.error}`;
    };

    recognition.onend = () => {
        console.log('Speech recognition ended.');
        if (micButton.textContent.includes('Stop')) { // Keep listening if not manually stopped
             micButton.textContent = '🎤 Start Talking';
             statusIndicator.textContent = 'Click mic to speak.';
        }
    };

} else {
    console.warn("Speech Recognition API not supported in this browser.");
    micButton.disabled = true;
    micButton.textContent = 'Mic Not Supported';
}

function toggleVoiceInput() {
    if (!recognition) return;

    if (micButton.textContent.includes('Start')) {
        recognition.start();
        micButton.textContent = '🛑 Stop Listening';
        statusIndicator.textContent = 'Listening...';
    } else {
        recognition.stop();
        micButton.textContent = '🎤 Start Talking';
        statusIndicator.textContent = 'Stopped. Click mic to speak.';
    }
}


// --- Video Input (Basic Camera Access) ---
function startVideoStream() {
    stopVideoStream(); // Ensure previous stream is stopped
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: false }) // Request video only here (audio handled separately)
            .then(stream => {
                videoStream = stream;
                videoFeed.srcObject = stream;
                videoFeed.play();
                console.log("Camera access granted.");
                // --- TODO: Implement Frame Sending Logic ---
                // This is complex: You'd need to grab frames periodically (e.g., using canvas),
                // potentially encode them (e.g., base64), and send them to a specific backend endpoint
                // for Model 1 analysis. This significantly increases complexity.
                // Example placeholder:
                // startSendingFrames();
            })
            .catch(err => {
                console.error("Error accessing camera:", err);
                addMessageToChat("Could not access camera. Video features disabled.", 'bot');
                videoFeed.style.display = 'none';
            });
    } else {
        console.error("getUserMedia not supported in this browser.");
        addMessageToChat("Camera API not supported. Video features disabled.", 'bot');
        videoFeed.style.display = 'none';
    }
}

function stopVideoStream() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        videoFeed.srcObject = null;
        console.log("Camera stream stopped.");
        // TODO: Stop sending frames if implemented
        // stopSendingFrames();
    }
}

// --- Session End / Report (Placeholder) ---
function showReport() {
    chatInterface.style.display = 'none';
    reportSection.style.display = 'block';
    // --- TODO: Fetch or compile report data ---
    // This might involve another backend call or summarizing frontend data
    sessionReportDiv.innerHTML = `
        <p>Session Mode: ${currentChatMode}</p>
        <p>Summary of interaction will go here.</p>
        <p>Detected issues (example): Stress, Anxiety.</p>
        <p>Next steps suggested: Consider talking to a professional.</p>
        <!-- Add professional referral options here -->
    `;
}

function endSession() {
     // In a real app, you'd call a backend endpoint to clear server-side session data if needed.
     console.log("Ending session and clearing data (frontend).")
     // Reset UI to the beginning
     reportSection.style.display = 'none';
     onboardingSection.style.display = 'block'; // Or a 'Thank You' screen
     modeSelection.style.display = 'none';
     chatInterface.style.display = 'none';
     predictionResultsDiv.innerHTML = '';
     chatOutput.innerHTML = '';
     textInput.value = '';
     currentChatMode = null;
     stopVideoStream();
     // Potentially clear local storage if you stored user info there
}

// --- Initial Setup ---
// Start with the onboarding section visible
onboardingSection.style.display = 'block';
modeSelection.style.display = 'none';
chatInterface.style.display = 'none';
reportSection.style.display = 'none';
