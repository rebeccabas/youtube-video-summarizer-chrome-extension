function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }
  
  // Inject the chat interface
  function injectChatInterface() {
    const container = document.createElement('div');
    container.id = 'yt-lecture-assistant';
    container.innerHTML = `
      <div class="assistant-toggle">AI Assistant</div>
      <div class="assistant-panel">
        <div class="chat-messages"></div>
        <div class="input-container">
          <textarea placeholder="Ask about the lecture..."></textarea>
          <button>Send</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(container);
    
    // Add event listeners
    const toggle = container.querySelector('.assistant-toggle');
    const panel = container.querySelector('.assistant-panel');
    const sendButton = container.querySelector('button');
    const textarea = container.querySelector('textarea');
    
    toggle.addEventListener('click', () => {
      panel.classList.toggle('open');
    });
    
    sendButton.addEventListener('click', async () => {
      const message = textarea.value.trim();
      if (!message) return;
      
      const videoId = getVideoId();
      if (!videoId) {
        showError('Could not determine video ID');
        return;
      }
      
      try {
        await sendMessage(message, videoId);
        textarea.value = '';
      } catch (error) {
        showError('Failed to send message');
        console.error(error);
      }
    });
  }
  
  async function sendMessage(message, videoId) {
    const chatMessages = document.querySelector('.chat-messages');
    
    // Add user message
    const userDiv = document.createElement('div');
    userDiv.className = 'message user-message';
    userDiv.textContent = message;
    chatMessages.appendChild(userDiv);
    
    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          video_id: videoId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add assistant message
      const assistantDiv = document.createElement('div');
      assistantDiv.className = 'message assistant-message';
      assistantDiv.textContent = data.response;
      chatMessages.appendChild(assistantDiv);
      
      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
    } catch (error) {
      console.error('Error:', error);
      showError('Failed to get response from assistant');
    }
  }
  
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.chat-messages').appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }
  
  // Initialize when on a YouTube video page
  if (window.location.hostname === 'www.youtube.com' && window.location.pathname === '/watch') {
    injectChatInterface();
  }