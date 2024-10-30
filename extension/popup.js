document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('status');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    
    let currentVideoId = null;
    
    // Auto-resize textarea
    function adjustTextareaHeight() {
      userInput.style.height = 'auto';
      userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    }
    
    userInput.addEventListener('input', adjustTextareaHeight);
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.url.includes('youtube.com/watch')) {
      const url = new URL(tab.url);
      currentVideoId = url.searchParams.get('v');
      
      if (currentVideoId) {
        status.classList.remove('error');
      } else {
        status.classList.add('error');
        showError('Invalid YouTube video URL');
      }
    } else {
      status.classList.add('error');
      showError('Please open a YouTube video to use this assistant.');
      userInput.disabled = true;
      sendButton.disabled = true;
      return;
    }
    
    function addMessage(content, isUser = false) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
      
      if (!isUser) {
        const iconSpan = document.createElement('i');
        iconSpan.className = 'fas fa-robot assistant-icon';
        messageDiv.appendChild(iconSpan);
      }
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.textContent = content;
      messageDiv.appendChild(contentDiv);
      
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function addTypingIndicator() {
      const indicator = document.createElement('div');
      indicator.className = 'typing-indicator';
      indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      `;
      chatMessages.appendChild(indicator);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return indicator;
    }
    
    function showError(message) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'message assistant-message error';
      const icon = document.createElement('i');
      icon.className = 'fas fa-exclamation-circle assistant-icon';
      const content = document.createElement('div');
      content.className = 'message-content';
      content.textContent = message;
      errorDiv.appendChild(icon);
      errorDiv.appendChild(content);
      chatMessages.appendChild(errorDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    async function sendMessage() {
      const message = userInput.value.trim();
      if (!message) return;
      
      userInput.disabled = true;
      sendButton.disabled = true;
      
      addMessage(message, true);
      const typingIndicator = addTypingIndicator();
      
      try {
        const response = await fetch('http://localhost:8000/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            video_id: currentVideoId
          })
        });
        
        typingIndicator.remove();
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        addMessage(data.response);
        
        userInput.value = '';
        userInput.style.height = 'auto';
        
      } catch (error) {
        typingIndicator.remove();
        showError('Failed to get response from assistant');
        console.error('Error:', error);
      } finally {
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus();
      }
    }
    
    sendButton.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // Initial focus
    userInput.focus();
  });