document.getElementById('sendBtn').addEventListener('click', sendMessage);
document.getElementById('userInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

function sendMessage() {
  let inputElem = document.getElementById('userInput');
  let userText = inputElem.value.trim();
  if (userText === '') return;
  
  // Add user's message to the chat log
  addMessage(userText, 'user');
  inputElem.value = '';
  
  // Simulate bot response after a short delay
  setTimeout(function() {
    let botResponse = getBotResponse(userText);
    addMessage(botResponse, 'bot');
  }, 1000);
}

function addMessage(text, sender) {
  let chatlog = document.getElementById('chatlog');
  let messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender);
  messageDiv.innerText = text;
  chatlog.appendChild(messageDiv);
  chatlog.scrollTop = chatlog.scrollHeight;
}

// Simulated chatbot logic
function getBotResponse(input) {
  input = input.toLowerCase();
  if (input.includes("hello") || input.includes("hi")) {
    return "Hello, I'm here to help. How are you feeling today?";
  } else if (input.includes("sad") || input.includes("depressed")) {
    return "I'm sorry to hear that. Can you tell me more about what's making you feel this way?";
  } else if (input.includes("anxious") || input.includes("nervous")) {
    return "It sounds like you're feeling anxious. Sometimes deep breathing and taking a moment to relax can help. Would you like some guidance on that?";
  } else if (input.includes("help") || input.includes("support")) {
    return "I understand you're looking for support. Would you prefer some self-help tips or are you interested in connecting with a professional?";
  } else {
    return "Could you please elaborate on that?";
  }
}
