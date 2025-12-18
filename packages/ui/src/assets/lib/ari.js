(function () {
  /**
   * ARI Chatbox - UI Only Component
   * 
   * This file handles ONLY the UI rendering and user interactions.
   * All data persistence is handled by the backend orchestration API:
   * - Chat headers are created automatically on first message
   * - User messages are saved as chat lines automatically
   * - Assistant responses are saved as chat lines automatically
   * - History is loaded from backend API only (no localStorage fallbacks)
   * 
   * NO explicit saving is done in this file - backend handles everything.
   */

  // --- 1 CONFIG HANDLING ---
  const currentScript = document.currentScript;
  const defaultConfig = {
    position: "bottom-right",
    theme: "light",
    size: "medium",
    // Orchestration API configuration
    baseUrl: "",
    userId: null,
    orgId: null,
    sessionId: null
  };

  // Secure config storage (closure - not exposed to window)
  let secureConfig = {
    baseUrl: "",
    userId: null,
    orgId: null,
    sessionId: null
  };

  // Store current sessionId to reuse across calls (maintains conversation)
  let currentSessionId = null;

  let config = { ...defaultConfig };

  // Priority 1: Secure initialization function (recommended - set by Angular app)
  // This function stores sensitive data in closure, not on window object
  // Retry mechanism: Angular might set this up after ari.js loads
  function tryInitializeSecureConfig() {
    if (window.initializeAriConfig && typeof window.initializeAriConfig === 'function') {
      try {
        const secureData = window.initializeAriConfig();
        if (secureData) {
          secureConfig.baseUrl = secureData.baseUrl || "";
          secureConfig.userId = secureData.userId || null;
          secureConfig.orgId = secureData.orgId || null;
          secureConfig.sessionId = secureData.sessionId || null;

          // Merge into config (sensitive data stays in closure)
          config.baseUrl = secureConfig.baseUrl;
          config.userId = secureConfig.userId;
          config.orgId = secureConfig.orgId;
          config.sessionId = secureConfig.sessionId;

          return true;
        }
      } catch (err) {
        console.warn("Error initializing secure ARI config:", err);
      }
    }
    return false;
  }

  // Try immediately
  tryInitializeSecureConfig();

  // Listen for custom event from Angular when config is ready
  window.addEventListener('ariConfigReady', () => {
    tryInitializeSecureConfig();
  });

  // Fallback: Check again after a delay (for frameworks that load late)
  setTimeout(() => {
    if (!secureConfig.baseUrl && window.initializeAriConfig && typeof window.initializeAriConfig === 'function') {
      if (!tryInitializeSecureConfig()) {
        console.warn("⚠️ ARI config not initialized. Please check app.component.ts initializeAriChatbox()");
      }
    }
  }, 2000);

  // Priority 2: window.ariConfig (fallback - less secure, for backward compatibility)
  if (window.ariConfig) {
    // Only use non-sensitive config from window
    config.position = window.ariConfig.position || config.position;
    config.theme = window.ariConfig.theme || config.theme;
    config.size = window.ariConfig.size || config.size;

    // Only use sensitive data if secure initialization wasn't used
    if (!secureConfig.baseUrl && window.ariConfig.baseUrl) {
      console.warn("⚠️ Using window.ariConfig for sensitive data is not recommended. Use initializeAriConfig() function instead.");
      secureConfig.baseUrl = window.ariConfig.baseUrl;
      secureConfig.userId = window.ariConfig.userId;
      secureConfig.orgId = window.ariConfig.orgId;
      secureConfig.sessionId = window.ariConfig.sessionId;

      config.baseUrl = secureConfig.baseUrl;
      config.userId = secureConfig.userId;
      config.orgId = secureConfig.orgId;
      config.sessionId = secureConfig.sessionId;
    }
  }

  // Priority 3: window.ChatboxConfig (legacy support - non-sensitive only)
  if (window.ChatboxConfig) {
    config.position = window.ChatboxConfig.position || config.position;
    config.theme = window.ChatboxConfig.theme || config.theme;
    config.size = window.ChatboxConfig.size || config.size;
  }

  // Priority 4: data-config attribute (inline script config - non-sensitive only)
  if (currentScript && currentScript.dataset.config) {
    try {
      const inlineConfig = JSON.parse(currentScript.dataset.config);
      config.position = inlineConfig.position || config.position;
      config.theme = inlineConfig.theme || config.theme;
      config.size = inlineConfig.size || config.size;
    } catch (err) {
      console.warn("Invalid data-config JSON:", err);
    }
  }

  // --- 2 STYLES ---
  const style = document.createElement("style");
  style.textContent = `
    .chatbot-toggle {
      position: fixed;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #fff;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10003;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      user-select: none;
      transition: all 0.25s ease-in-out;
    }

    .chatbot-toggle:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }

    .chatbot-toggle.dragging {
      opacity: 0.8;
      transform: scale(0.95);
      cursor: grabbing;
    }

    .chatbot-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.3);
      z-index: 10000;
      display: none;
      backdrop-filter: blur(2px);
    }

    .chatbot-container {
      position: fixed;
      width: 80%;
      max-width: 95vw;
      height: 92vh;
      display: none;
      border-radius: 4px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      background: #fff;
      overflow: hidden;
      z-index: 10002;
      flex-direction: column;
      transition: all 0.3s ease;
      border: 1px solid #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    .chatbot-container.minimized {
      width: 40%;
      height: 80px;
      max-height: 80px;
    }

    .chatbot-container.minimized .chat-main-div,
    .chatbot-container.minimized .chatbot-main-header {
      display: none;
    }

    .chatbot-container.minimized .minimized-prompt {
      display: flex;
    }

    .minimized-prompt {
      display: none;
      align-items: center;
      padding: 16px 20px;
      gap: 12px;
      height: 100%;
    }

    .minimized-prompt-input {
      flex: 1;
      display: flex;
      align-items: center;
      border-radius: 500px;
      background: #e8f0fe;
      padding-left: 8px;
      position: relative;
      box-shadow: 0 0 0 2px transparent;
      border: 4px solid transparent;
    }
    .minimized-prompt-input:focus-within {
      background: transparent  !important;
      box-shadow: 0 0 0 2px #EFF2FF !important;
      border: 4px solid #EFF2FF !important;
    }

    .minimized-prompt-input input,
    .minimized-prompt-input textarea {
      flex: 1  !important;
      border: none  !important;
      outline: none  !important;
      background: transparent  !important;
      padding: 10px 8px  !important;
      font-size: 14px  !important;
      color: #333  !important;
      box-shadow: none !important;
      font-family: inherit  !important;
      line-height: 1.5  !important;
      resize: none  !important;
      overflow-y: auto  !important;
      max-height: 200px  !important;
    }

    .minimized-prompt-input textarea {
      min-height: 24px  !important;
    }

    .minimized-prompt-input input::placeholder,
    .minimized-prompt-input textarea::placeholder {
      color: #999  !important;
    }

    .minimized-prompt-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      transition: all 0.2s;
      border-radius: 50%;
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      margin-right: 5px;
      rotate:45deg;
    }

    .minimized-prompt-btn:hover {
      background: #e5e7eb;
      color: #374151;
    }

    .minimized-prompt-btn svg {
      width: 20px;
      height: 20px;
    }

    .chatbot-header-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #374151;
      transition: all 0.2s;
      width: 30px;
      height: 30px;
      border-radius: 10px;
      background: #f3f4f6;
    }

    .chatbot-header-btn:hover {
    
    }

    .chatbot-header-btn svg {
      width: 14px;
      height: 14px;
    }

    .chat-main-div {
      display: flex;
      height: 100%;
      overflow: hidden;
      flex: 1;
    }

    .chat-sidebar {
      width: 260px;
      background: #f9fafb;
      display: flex;
      flex-direction: column;
      border-right: 1px solid #e5e7eb;
      overflow: hidden;
      overflow-x: hidden;
      transition: transform 0.3s ease, opacity 0.3s ease;
    }

    .chatbot-container.sidebar-hidden .chat-sidebar {
      transform: translateX(-100%);
      opacity: 0;
      width: 0;
      border-right: none;
    }

    .chatbot-container.sidebar-hidden .chatbot-main {
      width: 100%;
    }

    .sidebar-header {
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 5px;
      background: #f9fafb;
      flex-shrink: 0;
    }

    .sidebar-header-left {
      display: flex;
      align-items: center;
      gap: 5px;
      flex: 1;
    }

    .sidebar-avatar {
      width: 50px;
      height: 30px;
      border-radius: 0;
      overflow: hidden;
      flex-shrink: 0;
    }

    .sidebar-avatar img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .sidebar-name {
      font-size: 14px;
      font-weight: 600;
      color: #454567;
    }

    .sidebar-content {
      flex: 1;
      padding: 10px 12px;
    }

    .new-chat-btn {
      width: 100%;
      padding: 10px 5px;
      background: transparent;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      color: #676767;
      display: flex;
      gap: 5px;
      transition: all 0.2s;
      margin-bottom: 10px;
      border: none;
    }


    .new-chat-btn svg {
      width: 16px;
      height: 16px;
    }

    .folders-section {
      margin: 6px;
      display:none;
    }

    .folders-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      cursor: pointer;
      user-select: none;
      font-size: 12px;
      font-weight: 600;
      color: #333;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 15px;
    }

    .folders-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .folders-header svg {
      width: 14px;
      height: 14px;
      color: #5F80F9;
    }

    .folders-chevron {
      transition: transform 0.2s;
      width: 12px;
      height: 12px;
    }

    .folders-header.active .folders-chevron {
      transform: rotate(180deg);
    }

    .search-bar {
      position: relative;
      margin-bottom: 16px;
      box-shadow: 0px 1px 2px -1px #b1b1b1;
      border-radius: 8px;
    }

    .search-bar input {
      width: 100%  !important;
      box-sizing: border-box;
      padding: 8px 12px 8px 36px  !important;
      border: 1px solid #e5e7eb  !important;
      border-radius: 8px  !important;
      font-size: 13px  !important;
      background: #fff  !important;
      color: #333  !important;
      outline: none  !important;
      transition: all 0.2s  !important;
      box-shadow: none !important;
    }

    .search-bar input::placeholder {
      color: #999  !important;
    }

    .search-bar input:focus {
      border-color: #EFF2FF  !important;
      box-shadow: 0 0 0 2px rgba(0, 120, 215, 0.1)  !important;
    }

    .search-bar svg {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      color: #9ca3af;
      pointer-events: none;
    }

    .recents-section {
      margin-top: 8px;
    }

    .recents-title {
      font-size: 12px;
      font-weight: 600;
      color: #333;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      padding: 0 4px;
    }
    .recents-list{
      overflow-y: auto;
      overflow-x: hidden;
      max-height: calc(100vh - 300px);
    }
    .recent-item {
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 4px;
      height: 40px;
      display: flex;
      align-items: center;
    }

    .recent-item:hover {
      background: #f3f4f6;
    }

    .recent-item.active {
      background: #e8f0fe;
    }

    .recent-item-header {
     width: 100%;
    }

    .recent-item-title {
      font-size: 14px;
      color: #333;
      font-weight: 500;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .recent-item-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .recent-item-star {
      width: 16px;
      height: 16px;
      color: #000;
      flex-shrink: 0;
    }

    .recent-item-delete {
      display: none;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      color: #666;
      transition: all 0.2s;
      width: 20px;
      height: 20px;
      align-items: center;
      justify-content: center;
    }

    .recent-item-delete:hover {
      background: #fee2e2;
      color: #dc2626;
    }

    .recent-item:hover .recent-item-delete {
      display: flex;
    }

    .recent-item-time {
      font-size: 12px;
      color: #999;
      padding: 2px 0px; 
    }

    .chatbot-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #fff;
    }

    .chatbot-main-header {
      background: #fff;
      padding: 0px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 48px;
      flex-shrink: 0;
    }

    /* When sidebar is open, ensure header-actions stays on the right */
    .chatbot-main-header:not(.sidebar-hidden) .header-actions {
      margin-left: auto;
    }

    .header-menu-toggle {
      display: flex;
      align-items: center;
    }

    .header-menu-toggle .chatbot-header-btn {
      padding: 8px 12px;
      border-radius: 8px;
      transition: background-color 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0;
      width: auto;
      height: auto;
      min-width: auto;
      background: transparent;
    }

    .header-menu-toggle .chatbot-header-btn:hover {
      background-color: #f3f4f6;
    }

    .menu-toggle-content {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0;
    }

    .menu-toggle-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .menu-toggle-icon svg {
      width: 18px;
      height: 18px;
      color: #6b7280;
    }

    .menu-toggle-avatar {
      width: 50px;
      height: 30px;
      border-radius: 0;
      overflow: hidden;
      flex-shrink: 0;
      border: none;
      box-sizing: border-box;
    }

    .menu-toggle-avatar img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .menu-toggle-name {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      line-height: 1;
      white-space: nowrap;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    .header-new-chat-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 8px;
      transition: background-color 0.2s ease;
      width: auto;
      height: auto;
      min-width: auto;
      background: transparent;
    }

    .header-new-chat-btn:hover {
      background-color: #f3f4f6;
    }

    .header-new-chat-btn svg {
      width: 16px;
      height: 16px;
    }

    .header-new-chat-text {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
      white-space: nowrap;
    }

    .chatbot-container.sidebar-hidden .header-menu-toggle {
      display: flex !important;
    }

    .chatbot-container.sidebar-hidden .header-new-chat-btn {
      display: flex !important;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
      overflow-x: hidden;
      padding: 10px 50px;
    }

    .chat-messages:empty::before {
      content: '';
      display: block;
      margin: auto;
    }

    .chat-message-initial .chat-input-container{
      text-align: center;
      justify-content: center;
      display: flex;
    }

    .chat-message-initial .chat-input{
      width: 75%;
    }

    .welcome-message {
      text-align: center;
      color: #333;
      margin: auto;
    }

    .welcome-message h2 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: #333;
    }

    .welcome-message p {
      font-size: 16px;
      color: #333;
      margin: 0;
    }

    .chat-messages .message {
      display: flex;
      flex-direction: column;
      max-width: 75%;
    }

    .chat-messages .message.user {
      align-self: flex-end;
      align-items: flex-end;
      flex-direction: row;
      justify-content: flex-end;
    }

    .chat-messages .message.bot {
      align-self: flex-start;
      align-items: flex-start;
      flex-direction: row;
      justify-content: flex-start;
    }

    .chat-messages .message-content {
      padding: 10px 20px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
      max-width: 100%;
    }

    .chat-messages .message.user .message-content {
      background: #e5e7eb;
      color: #333;
      border-bottom-right-radius: 4px;
      text-align: right;
    }

    .chat-messages .message.bot .message-content {
      background: #f3f4f6;
      color: #333;
      border-bottom-left-radius: 4px;
      text-align: left;
    }
    
    /* Fix for long messages - prevent border-radius from causing issues */
    .chat-messages .message-content > * {
      max-width: 100%;
      overflow-wrap: break-word;
    }
    
    /* For HTML content with tables/schemas, ensure proper display */
    .chat-messages .message-content .universal-response,
    .chat-messages .message-content .schema-response,
    .chat-messages .message-content .message-table {
      border-radius: 0;
      margin: 0;
    }

    .message-table {
      margin-top: 12px;
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .message-table th {
      background: #f9fafb;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: #333;
      border-bottom: 1px solid #e5e7eb;
      font-size: 12px;
    }

    .message-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f3f4f6;
      color: #333;
    }

    .message-table tr:last-child td {
      border-bottom: none;
    }

    .message-table tr:hover {
      background: #f9fafb;
    }

    .email-link {
      color: #0078d7;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .email-link:hover {
      text-decoration: underline;
    }

    .email-link svg {
      width: 12px;
      height: 12px;
    }

    .chat-input-container,.chat-afterinput-container {
      padding: 16px 20px;
      background: #fff;
    }

    .chat-input {
      display: flex;
      align-items: center;
      background: #EFF2FF;
      border-radius: 24px;
      padding: 1px 4px 1px 16px;
      position: relative;
      transition: all 0.2s;
      box-shadow: 0 0 0 2px transparent;
      border: 4px solid transparent;
    }

    .chat-input:focus-within {
      background: #ffffff;
      box-shadow: 0 0 0 2px #EFF2FF;
      border: 4px solid #EFF2FF;
    }

    .chat-input input,
    .chat-input textarea {
      flex: 1  !important;
      border: none  !important;
      outline: none  !important;
      background: transparent  !important;
      padding: 10px 8px  !important;
      font-size: 14px  !important;
      color: #333  !important;
      box-shadow: none !important;
      font-family: inherit  !important;
      line-height: 1.5  !important;
      resize: none  !important;
      overflow-y: auto  !important;
      max-height: 200px  !important;
    }

    .chat-input textarea {
      min-height: 24px  !important;
    }

    .chat-input input::placeholder,
    .chat-input textarea::placeholder {
      color: #999 !important;
    }

    .chat-input-btn,.chat-afterinput-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      transition: all 0.2s;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      rotate:45deg;
    }

    .chat-input-btn:hover,.chat-afterinput-btn:hover {
      background: #e5e7eb;
      color: #374151;
    }

    .chat-input-btn svg,.chat-afterinput-btn svg {
      width: 20px;
      height: 20px;
    }

    /* Scrollbar styling */
    .chat-messages::-webkit-scrollbar,
    .recents-list::-webkit-scrollbar {
      width: 6px;
    }

    .chat-messages::-webkit-scrollbar-track,
    .recents-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .chat-messages::-webkit-scrollbar-thumb,
    .recents-list::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 3px;
    }

    .chat-messages::-webkit-scrollbar-thumb:hover,
    .recents-list::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }
    .filled-star{
      display: none;
    }

    .recent-item-star{
      margin-left: auto;
      display: none;
    }

    .recent-item-star:hover .filled-star{
      display: inline;
    }
    .recent-item-star:hover .normal-star{
      display: none;
    }
    .recent-item-star.active .filled-star{
      display: inline;
    }
    .recent-item-star.active .normal-star{
      display: none;
    }
    .recent-item:hover .recent-item-star{
      display: inline;
    }
    .recent-item-star.active{
      display: inline;
    }
    
   .thinkingimg{
      height:35px;
      width:35px;
      object-fit: cover;
   } 

   .loading-dots {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .loading-dots span {
      width: 8px;
      height: 8px;
      background-color: #c0c3d1; /* change color as needed */
      border-radius: 50%;
      animation: loadingDots 1.2s infinite ease-in-out;
    }

    .loading-dots span:nth-child(1) {
      animation-delay: 0s;
    }
    .loading-dots span:nth-child(2) {
      animation-delay: 0.3s;
    }
    .loading-dots span:nth-child(3) {
      animation-delay: 0.6s;
    }

    @keyframes loadingDots {
      0%, 80%, 100% {
        transform: scale(0);
        opacity: 0.3;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }

    /* Response Type Styles */
    .response-text {
      margin-bottom: 12px;
      line-height: 1.6;
      color: #333;
    }

    .universal-response {
      margin-top: 12px;
    }

    /* JSON Response Styles */
    .json-response {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      overflow-x: auto;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.5;
    }

    .json-response code {
      color: #333;
      white-space: pre;
    }

    /* HTML Response Styles */
    .html-response {
      margin: 8px 0;
      line-height: 1.6;
    }

    .html-response :first-child {
      margin-top: 0;
    }

    .html-response :last-child {
      margin-bottom: 0;
    }

    /* Text Response Styles */
    .text-response {
      margin: 8px 0;
      line-height: 1.6;
      color: #333;
      white-space: pre-wrap;
    }

    /* Error Response Styles */
    .error-response {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 12px 16px;
      margin: 8px 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .error-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .error-message {
      color: #dc2626;
      font-weight: 500;
      flex: 1;
    }

    .error-text {
      color: #dc2626;
      font-weight: 500;
      margin: 8px 0;
    }

    /* Schema Response Styles - Table Format */
    .schema-response {
      border: 1px solid #e1e5e9;
      border-radius: 8px;
      background-color: #ffffff;
      overflow: hidden;
      margin: 8px 0;
    }


    .schema-table-container {
      overflow-x: auto;
    }

    .schema-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      background-color: #ffffff;
    }

    .schema-table th {
      background-color: transparent;
      color: #495057;
      font-weight: 600;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
      text-transform: none;
      letter-spacing: normal;
    }

    .schema-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f3f4;
      vertical-align: top;
    }

    .schema-table tr.even-row {
      background-color: #ffffff;
    }

    .schema-table tr.odd-row {
      background-color: #ffffff;
    }

    .schema-table tr:hover {
      background-color: #f9fafb;
    }

    .schema-table .field-name {
      font-weight: 500;
      color: #111827;
      min-width: 150px;
    }

    .schema-table .field-type {
      min-width: 150px;
    }

    .type-badge {
      padding: 0;
      border-radius: 0;
      font-size: 14px;
      font-weight: 400;
      text-transform: none;
      display: inline;
      background-color: transparent;
      color: #111827;
    }

    /* Remove colored backgrounds for type badges - keep it clean like ChatGPT */
    .type-badge.type-autonumber,
    .type-badge.type-text,
    .type-badge.type-textarea,
    .type-badge.type-currency,
    .type-badge.type-number,
    .type-badge.type-boolean,
    .type-badge.type-date,
    .type-badge.type-dropdown {
      background-color: transparent;
      color: #111827;
    }

    .field-required {
      text-align: left;
      min-width: 100px;
    }

    .required-text {
      color: #111827;
      font-weight: 400;
      font-size: 14px;
    }

    .optional-text {
      color: #111827;
      font-weight: 400;
      font-size: 14px;
    }

    .schema-table .field-description {
      min-width: 250px;
      color: #111827;
      font-size: 14px;
      line-height: 1.5;
      font-weight: 400;
    }


    /* History Error Styles */
    .history-error {
      padding: 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      margin: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .history-error .error-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .history-error .error-text {
      flex: 1;
      color: #dc2626;
      font-size: 14px;
      font-weight: 500;
    }

    .history-error .retry-btn {
      padding: 6px 12px;
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: background 0.2s;
    }

    .history-error .retry-btn:hover {
      background: #b91c1c;
    }

    .no-history {
      padding: 16px;
      text-align: center;
      color: #6c757d;
      font-size: 14px;
      font-style: italic;
    }

  `;
  document.head.appendChild(style);

  // --- 3 SVG ICONS ---
  const icons = {
    plus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    folder: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3h5l2 2h5v7H2V3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    chevron: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="7" cy="7" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M10 10l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    star: '<svg class="normal-star" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.3L9.65 5.5C9.75 5.8 10.05 6 10.35 6H14L11 8.2C10.75 8.35 10.65 8.65 10.75 8.95L11.9 13L8.4 10.7C8.15 10.55 7.85 10.55 7.6 10.7L4.1 13L5.25 8.95C5.35 8.65 5.25 8.35 5 8.2L2 6H5.65C5.95 6 6.25 5.8 6.35 5.5L8 1.3Z" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round" stroke-linecap="round"></path></svg>',
    selectedStar: '<svg class="filled-star" style="color: #F59E0B;" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.3C8.2 1.3 8.4 1.4 8.5 1.6L10.4 5.2C10.5 5.4 10.7 5.5 10.9 5.5H14.8C15.2 5.5 15.3 6 15 6.2L11.7 8.9C11.5 9.1 11.4 9.4 11.5 9.6L12.7 13.5C12.8 13.9 12.4 14.2 12 14L8.4 11.9C8.2 11.8 7.8 11.8 7.6 11.9L4 14C3.6 14.2 3.2 13.9 3.3 13.5L4.5 9.6C4.6 9.4 4.5 9.1 4.3 8.9L1 6.2C0.7 6 0.8 5.5 1.2 5.5H5.1C5.3 5.5 5.5 5.4 5.6 5.2L7.5 1.6C7.6 1.4 7.8 1.3 8 1.3Z" fill="currentColor"></path></svg>',
    minimize: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V14H4V10H0V8H6ZM10 0V4H14V6H8V0H10Z" fill="black"></path></svg>',
    maximize: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 14V8H2V12H6V14H0ZM12 6V2H8V0H14V6H12Z" fill="black"/></svg>',
    send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    link: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 7l2-2m0 0l2-2m-2 2L5 5m2 2l2 2M3 9l-1-1a2 2 0 010-2.83l4-4a2 2 0 012.83 0L11 4M9 8l1 1a2 2 0 002.83 0l4-4a2 2 0 000-2.83l-4-4a2 2 0 00-2.83 0L7 4" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // --- 4 ELEMENTS ---
  const backdrop = document.createElement("div");
  backdrop.className = "chatbot-backdrop";
  if (document.body.querySelector(".chatbot-backdrop") == null) {
    document.body.appendChild(backdrop);
  }

  // Helper function to get correct asset path (handles base href and context path)
  function getAssetPath(relativePath) {
    // Remove leading slash if present
    let cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;

    // Use relative path (./) to work with any context path
    // This ensures assets load correctly regardless of base href or context path
    // Relative paths resolve from the current page location
    return './' + cleanPath;
  }

  const toggleBtn = document.createElement("div");
  toggleBtn.className = "chatbot-toggle";
  toggleBtn.innerHTML = `<img src="${getAssetPath('assets/img/ari/kodivian-logo.png')}" alt="Kodivian" width="50" height="30" style="object-fit: contain;">`;
  if (document.body.querySelector(".chatbot-toggle") == null) {
    document.body.appendChild(toggleBtn);

    // Initialize video after it's added to DOM
    setTimeout(() => {
      const video = toggleBtn.querySelector('video');
      if (video) {
        videoElem = video; // Update global reference

        // Ensure video plays (autoplay might be blocked)
        video.addEventListener('loadeddata', () => {
          safePlayVideo(video).catch(() => {
            // Autoplay might be blocked - that's okay, video will play on user interaction
          });
        });

        // Try to play immediately if already loaded
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA
          safePlayVideo(video).catch(() => { });
        }

        // Handle video errors gracefully
        video.addEventListener('error', () => {
          // Hide video on error, show fallback
          video.style.display = 'none';
        });
      }
    }, 100);
  }

  const wrapper = document.createElement("div");
  wrapper.className = "chatbot-container";
  wrapper.innerHTML = `
    <div class="minimized-prompt">
      <div class="minimized-prompt-input">
        <textarea placeholder="Ask anything." rows="1"></textarea>
        <button class="minimized-prompt-btn" title="Send">
          ${icons.send}
        </button>
      </div>
      <button class="chatbot-header-btn maximize-btn-minimized" title="Maximize/Restore">
        ${icons.maximize}
      </button>
    </div>
    <div class="chat-main-div">
      <div class="chat-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-header-left">
          <div class="sidebar-avatar">
              <img src="${getAssetPath('assets/img/ari/kodivian-logo.png')}" alt="Kodivian"> 
          </div>
          <div class="sidebar-name">Kodivian</div>
          </div>
          <button class="chatbot-header-btn sidebar-close-btn" title="Close Sidebar">
            ${icons.close}
          </button>
        </div>
        <div class="sidebar-content">
          <button class="new-chat-btn">
            ${icons.plus}
            <span>New Chat</span>
          </button>
          <div class="folders-section">
            <div class="folders-header">
              <div class="folders-header-left">
                ${icons.folder}
               <span style="font-weight: 700;font-size: 11px;">FOLDERS</span>
              </div>
              <span class="folders-chevron">${icons.chevron}</span>
            </div>
          </div>
          <div class="search-bar">
            ${icons.search}
            <input type="text" placeholder="Search chat..." />
          </div>
          <div class="recents-section">
            <div class="recents-title">RECENTS</div>
            <div class="recents-list">
            </div>
          </div>
        </div>
      </div>
      <div class="chatbot-main">
        <div class="chatbot-main-header">
          <div class="header-menu-toggle" style="display: none;">
            <button class="chatbot-header-btn sidebar-toggle-btn" title="Open Sidebar">
              <div class="menu-toggle-content">
                <div class="menu-toggle-icon">
                  ${icons.menu}
                </div>
                <div class="menu-toggle-avatar">
                  <img src="${getAssetPath('assets/img/ari/kodivian-logo.png')}" alt="Kodivian">
                </div>
                <span class="menu-toggle-name">Kodivian</span>
              </div>
            </button>
          </div>
          <div class="header-actions">
            <button class="chatbot-header-btn header-new-chat-btn" title="New Chat" style="display: none;">
              ${icons.plus}
              <span class="header-new-chat-text">New Chat</span>
            </button>
           <button class="chatbot-header-btn maximize-btn" title="Minimize/Restore">
            ${icons.minimize}
          </button>
          </div>
        </div>
        <div class="chat-messages">
          <div class="chat-message-initial" style="margin: auto 0px;/* align-items: center; *//* justify-content: center; */">
            <div class="welcome-message">
              <h2>Hi Welcome !</h2>
              <p>What are you looking for?</p>
            </div>
            <div class="chat-input-container">
              <div class="chat-input">
                  <textarea placeholder="Ask anything." rows="1"></textarea>
                  <button class="chat-input-btn" title="Send">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                  </button>
              </div>
            </div>
          </div>
        </div>
        <div class="chat-afterinput-container">
        <div class="chat-input">
            <textarea placeholder="Ask anything." rows="1"></textarea>
            <button class="chat-afterinput-btn" title="Send">
              ${icons.send}
            </button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrapper);

  const maximizeBtn = wrapper.querySelector(".maximize-btn");
  const maximizeBtnMinimized = wrapper.querySelector(".maximize-btn-minimized");
  const sidebarToggleBtn = wrapper.querySelector(".sidebar-toggle-btn");
  const sidebarCloseBtn = wrapper.querySelector(".sidebar-close-btn");
  const headerNewChatBtn = wrapper.querySelector(".header-new-chat-btn");
  const messages = wrapper.querySelector(".chat-messages");
  let input = wrapper.querySelector(".chat-input textarea") || wrapper.querySelector(".chat-input input");
  const minimizedInput = wrapper.querySelector(".minimized-prompt-input textarea") || wrapper.querySelector(".minimized-prompt-input input");
  const afterinput = wrapper.querySelector(".chat-afterinput-container textarea") || wrapper.querySelector(".chat-afterinput-container input");
  let sendBtn = wrapper.querySelector(".chat-input-btn");
  let aftersendBtn = wrapper.querySelector(".chat-afterinput-btn");
  let minimizedSendBtn = wrapper.querySelector(".minimized-prompt-btn");
  const newChatBtn = wrapper.querySelector(".new-chat-btn");
  let favoritebtns = wrapper.querySelectorAll(".recent-item-star");
  const foldersHeader = wrapper.querySelector(".folders-header");
  const recentItems = wrapper.querySelectorAll(".recent-item");
  wrapper.querySelector(".chat-afterinput-container").style.display = "none"; // Hide after input initially
  let isOpen = false;
  let isMinimized = false;
  let hasBeenExpanded = false; // Track if user has ever expanded the chatbox
  let isFirstOpen = true; // Track if this is the first time opening

  // Check if config is ready
  function isConfigReady() {
    const baseUrl = secureConfig.baseUrl || config.baseUrl || '';
    const userId = secureConfig.userId || config.userId || '';
    const orgId = secureConfig.orgId !== null ? secureConfig.orgId : (config.orgId !== null ? config.orgId : null);
    return !!(baseUrl && userId && orgId !== null);
  }

  // Load chat history list from backend (CouchDB) on initialization - do NOT auto-load latest chat
  // User should see a fresh new chat when first opening, and can click on history items to load old chats
  async function initializeChatHistory() {
    // Wait for config to be ready (with timeout)
    let attempts = 0;
    const maxAttempts = 20; // Wait up to 10 seconds (20 * 500ms)

    while (!isConfigReady() && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    if (!isConfigReady()) {
      console.error('ARI: Config not ready after waiting. Cannot load chat history.');
      showError('Configuration not available. Please refresh the page.', true);
      return;
    }

    try {
      // Only load history list from backend (sidebar) - do NOT auto-load latest chat
      // This ensures user sees a fresh new chat when first opening
      await displayChatHistory();

      // Reset to new chat state
      currentSessionId = null;
      currentMessages = [];
    } catch (err) {
      // Errors are already shown in the respective functions
      console.error('ARI: Error initializing chat history:', err);
    }
  }

  // Initialize chat history when config is ready
  let historyInitialized = false;
  function tryInitializeHistory() {
    if (historyInitialized) return;
    if (isConfigReady()) {
      historyInitialized = true;
      initializeChatHistory();
    }
  }

  // Try immediately after DOM is ready
  setTimeout(() => {
    tryInitializeHistory();
    // Initialize search functionality
    initializeSearch();
  }, 500);

  // Also listen for config ready event
  window.addEventListener('ariConfigReady', () => {
    if (tryInitializeSecureConfig()) {
      tryInitializeHistory();
    }
    // Initialize search functionality
    initializeSearch();
  });

  // Initialize search input functionality
  let searchInitialized = false;
  function initializeSearch() {
    // Prevent duplicate initialization
    if (searchInitialized) return;

    const searchInput = wrapper.querySelector('.search-bar input');
    if (!searchInput) {
      // Retry if search input not found yet
      setTimeout(() => initializeSearch(), 200);
      return;
    }

    // Mark as initialized to prevent duplicate listeners
    searchInitialized = true;

    let searchTimeout = null;

    // Add input event listener for search
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();

      // Clear previous timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      // Debounce search - wait 300ms after user stops typing
      searchTimeout = setTimeout(() => {
        displayChatHistory(query);
      }, 300);
    });

    // Add Enter key support for immediate search
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Clear timeout and search immediately
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        const query = e.target.value.trim();
        displayChatHistory(query);
      } else if (e.key === 'Escape') {
        // Clear search on Escape
        e.target.value = '';
        displayChatHistory('');
      }
    });
  }

  // Poll for config and initialize when ready
  let historyCheckInterval = setInterval(() => {
    if (isConfigReady() && !historyInitialized) {
      clearInterval(historyCheckInterval);
      tryInitializeHistory();
    }
  }, 500);

  // Stop polling after 15 seconds
  setTimeout(() => {
    clearInterval(historyCheckInterval);
    if (!historyInitialized && !isConfigReady()) {
      console.error('ARI: Config not ready after 15 seconds. Cannot load chat history.');
      showError('Configuration not available. Please refresh the page.', true);
      showChatError('Configuration not available. Please refresh the page.');
    }
  }, 15000);

  // --- 5 MINIMIZE / MAXIMIZE ---
  function toggleMinimize() {
    isMinimized = !isMinimized;
    wrapper.classList.toggle("minimized", isMinimized);

    // If expanding, mark that user has expanded it
    if (!isMinimized) {
      hasBeenExpanded = true;
    }

    // Reposition dialog based on button location
    positionDialogNearButton();
  }

  maximizeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMinimize();
  });

  maximizeBtnMinimized.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMinimize();
  });

  // --- SIDEBAR TOGGLE ---
  // Close button in sidebar
  sidebarCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    wrapper.classList.add("sidebar-hidden");
  });

  // Menu toggle button in main header (when sidebar is closed)
  sidebarToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    wrapper.classList.remove("sidebar-hidden");
  });

  // Header new chat button (when sidebar is closed)
  if (headerNewChatBtn) {
    headerNewChatBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Trigger new chat functionality
      if (newChatBtn) {
        newChatBtn.click();
      }
    });
  }

  // --- 6 OPEN / CLOSE ---
  function openChatbox() {
    isOpen = true;
    wrapper.style.display = "flex";
    backdrop.style.display = "block";

    // Ensure search is initialized when chatbox opens
    if (!searchInitialized) {
      initializeSearch();
    }

    // On first open, start minimized and ensure fresh new chat is shown
    if (isFirstOpen) {
      isFirstOpen = false;
      isMinimized = true;
      wrapper.classList.add("minimized");

      // Ensure we show a fresh new chat (not an old one that might have been auto-loaded)
      // Only if there are no current messages, show welcome message
      if (currentMessages.length === 0) {
        // Clear any messages that might have been loaded
        messages.innerHTML = '';
        currentSessionId = null;
        currentMessages = [];

        // Recreate welcome message HTML
        messages.innerHTML = `
          <div class="chat-message-initial" style="margin: auto 0px;/* align-items: center; *//* justify-content: center; */">
            <div class="welcome-message">
              <h2>Hi Welcome !</h2>
              <p>What are you looking for?</p>
            </div>
            <div class="chat-input-container">
              <div class="chat-input">
                  <textarea placeholder="Ask anything." rows="1"></textarea>
                  <button class="chat-input-btn" title="Send">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                  </button>
              </div>
            </div>
          </div>
        `;

        // Re-query input elements after recreating HTML
        input = wrapper.querySelector(".chat-input textarea") || wrapper.querySelector(".chat-input input");
        sendBtn = wrapper.querySelector(".chat-input-btn");
        if (sendBtn) {
          sendBtn.addEventListener("click", sendMessage);
        }
        // Textarea will auto-resize via the input event listener

        // Hide after-input container
        const afterInputContainer = wrapper.querySelector(".chat-afterinput-container");
        if (afterInputContainer) {
          afterInputContainer.style.display = "none";
        }

        // Remove active class from all history items
        const recentItems = wrapper.querySelectorAll(".recent-item");
        recentItems.forEach(item => item.classList.remove("active"));
      }
    } else if (hasBeenExpanded) {
      // After user has expanded once, always open full size
      isMinimized = false;
      wrapper.classList.remove("minimized");
    } else {
      // If user hasn't expanded yet, keep current state (minimized)
      // This handles the case if user closes and reopens before expanding
    }

    // Position dialog based on toggle button location
    positionDialogNearButton();
  }

  function positionDialogNearButton() {
    const btnRect = toggleBtn.getBoundingClientRect();
    const btnCenterX = btnRect.left + btnRect.width / 2;
    const btnCenterY = btnRect.top + btnRect.height / 2;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get dialog dimensions based on state
    const dialogWidth = isMinimized ? 500 : 900;
    const dialogHeight = isMinimized ? 80 : 700;
    const offset = 20; // Gap between button and dialog

    // Determine horizontal position
    let left, right, transformX;
    if (btnCenterX > viewportWidth / 2) {
      // Button is on right side - position dialog to the left
      right = Math.max(20, viewportWidth - btnRect.left + offset);
      left = "auto";
      transformX = "0";
      // Ensure dialog doesn't go off screen
      if (right > viewportWidth - dialogWidth - 20) {
        right = viewportWidth - dialogWidth - 20;
      }
    } else {
      // Button is on left side - position dialog to the right
      left = Math.min(btnRect.right + offset, viewportWidth - dialogWidth - 20);
      right = "auto";
      transformX = "0";
      // Ensure dialog doesn't go off screen
      if (left < 20) {
        left = 20;
      }
    }

    // Determine vertical position - center vertically relative to button, but keep within viewport
    let top, bottom, transformY;
    const dialogTop = btnCenterY - dialogHeight / 2;
    const dialogBottom = btnCenterY + dialogHeight / 2;

    if (dialogTop < 20) {
      // Dialog would go above viewport
      top = 20;
      bottom = "auto";
      transformY = "0";
    } else if (dialogBottom > viewportHeight - 20) {
      // Dialog would go below viewport
      bottom = 20;
      top = "auto";
      transformY = "0";
    } else {
      // Center vertically relative to button
      top = btnCenterY;
      bottom = "auto";
      transformY = "-50%";
    }

    // Apply positioning
    wrapper.style.left = typeof left === "number" ? left + "px" : left;
    wrapper.style.right = typeof right === "number" ? right + "px" : right;
    wrapper.style.top = typeof top === "number" ? top + "px" : top;
    wrapper.style.bottom = typeof bottom === "number" ? bottom + "px" : bottom;
    wrapper.style.transform = `translate(${transformX}, ${transformY})`;
  }

  function closeChatbox() {
    isOpen = false;
    wrapper.style.display = "none";
    backdrop.style.display = "none";
  }

  backdrop.addEventListener("click", () => {
    closeChatbox();
  });

  // --- 7 NEW CHAT ---
  newChatBtn.addEventListener("click", () => {
    // Reset sessionId and headerId for new chat (fresh conversation)
    // Backend handles all persistence - no need to save before resetting
    currentSessionId = null;
    currentHeaderId = null; // Reset headerId for new chat
    currentMessages = []; // Clear current messages array
    window._ariCurrentSidebarEntry = null; // Clear sidebar entry reference
    // Re-enable inputs when starting new chat (in case previous query was still processing)
    setInputsEnabled(true);

    messages.innerHTML = `
      <div class="chat-message-initial" style="margin: auto 0px;/* align-items: center; *//* justify-content: center; */">
            <div class="welcome-message">
              <h2>Hi Welcome !</h2>
              <p>What are you looking for?</p>
            </div>
            <div class="chat-input-container">
              <div class="chat-input">
                  <textarea placeholder="Ask anything." rows="1"></textarea>
                  <button class="chat-input-btn" title="Send">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                  </button>
              </div>
            </div>
          </div>
    `;
    input.value = "";
    // Update active state
    recentItems.forEach(item => item.classList.remove("active"));
    wrapper.querySelector(".chat-afterinput-container").style.display = "none"; // Hide after input
    sendBtn = wrapper.querySelector(".chat-input-btn");
    sendBtn.addEventListener("click", sendMessage);
  });

  // --- 8 FOLDERS TOGGLE ---
  foldersHeader.addEventListener("click", () => {
    foldersHeader.classList.toggle("active");
  });

  // --- 9 RECENT ITEMS ---
  // Event listeners are attached dynamically in attachRecentItemListeners()

  // --- ≡ƒöƒ MESSAGES ---
  // Helper functions for HTML sanitization
  function escapeHTML(str) {
    if (typeof str !== 'string') str = String(str);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function sanitizeHTML(html) {
    if (typeof html !== 'string') html = String(html);
    // Remove script tags
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // Remove event handlers
    html = html.replace(/on\w+="[^"]*"/gi, '');
    // Remove javascript: protocol
    html = html.replace(/javascript:/gi, '');
    return html;
  }

  function removeWelcomeMessage() {
    const welcomeMsg = messages.querySelector(".chat-message-initial");
    if (welcomeMsg) {
      welcomeMsg.remove();
    }
  }

  // Helper function to create message icon
  function createMessageIcon(type) {
    const iconImg = document.createElement("img");
    if (type === 'user') {
      iconImg.src = getAssetPath('assets/img/user.png');
      iconImg.alt = 'User';
      iconImg.className = 'message-icon user-icon';
      iconImg.style.width = '30px';
      iconImg.style.height = '30px';
      iconImg.style.marginLeft = '10px';
      iconImg.style.marginRight = '0';
      iconImg.style.marginTop = '10px';
      iconImg.style.flexShrink = '0';
      iconImg.style.borderRadius = '1rem';
      iconImg.style.objectFit = 'cover';
    } else {
      iconImg.src = getAssetPath('assets/img/ari/kodivian-logo.png');
      iconImg.alt = 'Kodivian';
      iconImg.className = 'message-icon bot-icon';
      iconImg.style.width = '30px';
      iconImg.style.height = '30px';
      iconImg.style.marginRight = '10px';
      iconImg.style.marginLeft = '0';
      iconImg.style.marginTop = '10px';
      iconImg.style.flexShrink = '0';
      iconImg.style.borderRadius = '1rem';
      iconImg.style.objectFit = 'cover';
    }
    return iconImg;
  }

  function addMessage(from, text, isStepAppend, htmlContent = null) {
    removeWelcomeMessage();
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${from}`;

    // Create icon element
    const iconImg = createMessageIcon(from);

    const msgContent = document.createElement("div");
    msgContent.className = "message-content";

    if (htmlContent) {
      msgContent.innerHTML = sanitizeHTML(htmlContent);
    } else {
      if (isStepAppend) {
        let i = 0;
        let interval = setInterval(() => {
          if (i < text.length) {
            msgContent.textContent += text.charAt(i);
            i++;
          } else {
            clearInterval(interval);
            changeVideoSource("assets/img/ari/kodivian-logo.png");
          }
        }, 60);
      }
      else {

        msgContent.textContent = text;
      }
    }

    // For user messages: content first, then icon on right
    // For bot messages: icon first, then content on left
    if (from === 'user') {
      msgDiv.appendChild(msgContent);
      msgDiv.appendChild(iconImg);
    } else {
      msgDiv.appendChild(iconImg);
      msgDiv.appendChild(msgContent);
    }

    messages.appendChild(msgDiv);
    messages.scrollTop = messages.scrollHeight;

    // Add message to current conversation (for UI display only - backend handles persistence)
    const message = {
      type: from === 'user' ? 'user' : 'bot',
      content: text || '',
      htmlContent: htmlContent || null,
      text: text || '',
      timestamp: Date.now()
    };
    currentMessages.push(message);
    // Backend automatically saves all messages to CouchDB - no explicit save needed
  }


  // Helper function to generate session ID
  function generateSessionId() {
    return `ari-session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  // Renderer functions for different universal response types
  function renderTable(tableData) {
    if (!tableData || !tableData.headers || !tableData.rows) {
      return '';
    }

    let html = '<table class="message-table">';

    // Header
    html += '<thead><tr>';
    tableData.headers.forEach(header => {
      html += `<th>${escapeHTML(header)}</th>`;
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    tableData.rows.forEach(row => {
      html += '<tr>';
      row.forEach((cell, index) => {
        const header = tableData.headers[index];
        if (header && header.toLowerCase() === 'email' && cell && String(cell).includes('@')) {
          html += `<td><a href="mailto:${escapeHTML(cell)}" class="email-link">${escapeHTML(cell)}</a></td>`;
        } else {
          html += `<td>${escapeHTML(cell)}</td>`;
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    return html;
  }

  function renderJSON(jsonData) {
    try {
      const jsonString = typeof jsonData === 'string'
        ? jsonData
        : JSON.stringify(jsonData, null, 2);

      return `<pre class="json-response"><code>${escapeHTML(jsonString)}</code></pre>`;
    } catch (err) {
      return `<div class="error-text">Invalid JSON data</div>`;
    }
  }

  function renderHTML(htmlData) {
    const html = typeof htmlData === 'string'
      ? htmlData
      : htmlData?.content || String(htmlData || '');

    return `<div class="html-response">${sanitizeHTML(html)}</div>`;
  }

  function renderText(textData) {
    const text = typeof textData === 'string'
      ? textData
      : textData?.content || String(textData || '');

    return `<div class="text-response">${escapeHTML(text).replace(/\n/g, '<br>')}</div>`;
  }

  function renderError(errorData) {
    const error = typeof errorData === 'string'
      ? errorData
      : errorData?.message || errorData?.error || String(errorData || '');

    return `<div class="error-response">
      <div class="error-icon">⚠️</div>
      <div class="error-message">${escapeHTML(error)}</div>
    </div>`;
  }

  function renderSchema(schemaData) {
    const schema = schemaData?.fields ? schemaData : schemaData?.content || schemaData;

    if (!schema || !schema.fields || !Array.isArray(schema.fields)) {
      return '';
    }

    let html = '<div class="schema-response">';
    html += '<div class="schema-table-container">';
    html += '<table class="schema-table">';
    html += '<thead><tr>';
    html += '<th>Field Name</th>';
    html += '<th>Type</th>';
    html += '<th>Required</th>';
    html += '<th>Description</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    schema.fields.forEach((field, index) => {
      const rowClass = index % 2 === 0 ? 'even-row' : 'odd-row';
      html += `<tr class="${rowClass}">`;

      // Field Name
      html += `<td class="field-name"><strong>${escapeHTML(field.name || '')}</strong></td>`;

      // Type - format nicely (e.g., "string / uuid" or "string (long)")
      let typeDisplay = field.type || '';
      // Handle type variations like "string / uuid" or add qualifiers
      if (field.typeQualifier) {
        typeDisplay = `${typeDisplay} (${field.typeQualifier})`;
      }
      const typeLower = typeDisplay.toLowerCase();
      const typeClass = `type-badge type-${typeLower.split(' ')[0]}`;
      html += `<td class="field-type"><span class="${typeClass}">${escapeHTML(typeDisplay)}</span></td>`;

      // Required - show "yes" or "optional" (matching ChatGPT format)
      const isRequired = field.required !== undefined ? field.required : (
        field.constraints && field.constraints.some(c =>
          c.toLowerCase().includes('required') ||
          c.toLowerCase().includes('not null') ||
          c.toLowerCase().includes('not-null')
        )
      );
      html += `<td class="field-required">${isRequired ? '<span class="required-text">yes</span>' : '<span class="optional-text">optional</span>'}</td>`;

      // Description - use field.description if available, otherwise generate from field name/type
      let description = field.description || '';
      if (!description && field.name) {
        // Generate a basic description if none provided
        const fieldName = field.name.toLowerCase();
        if (fieldName.includes('id')) {
          description = `unique identifier${fieldName.includes('category') ? ' for category' : ''}${fieldName.includes('product') ? ' for product' : ''}`;
        } else if (fieldName.includes('name') || fieldName.includes('title')) {
          description = `${fieldName.includes('product') ? 'product ' : ''}name/title`;
        } else if (fieldName.includes('description')) {
          description = fieldName.includes('short') ? 'small summary for listing cards' : 'detailed description';
        } else if (fieldName.includes('slug')) {
          description = 'URL-friendly identifier (unique)';
        } else if (fieldName.includes('sku')) {
          description = 'stock keeping unit code';
        } else if (fieldName.includes('brand')) {
          description = 'brand name';
        } else {
          description = `${field.type || ''} field for ${field.name}`;
        }
      }
      html += `<td class="field-description">${escapeHTML(description)}</td>`;

      html += '</tr>';
    });

    html += '</tbody></table>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // Main universal response renderer
  function renderUniversalResponse(envelope) {
    if (!envelope || !envelope.type) {
      return '';
    }

    const content = envelope.content;

    switch (envelope.type) {
      case 'table':
        return renderTable(content);

      case 'json':
        return renderJSON(content);

      case 'html':
        return renderHTML(content);

      case 'text':
      case 'greeting':
      case 'markdown':
      case 'code':
        // All text-based types render as text
        // If content is a string, use it directly; if it's an object, try to extract text
        const textContent = typeof content === 'string' ? content : (content?.text || content?.content || JSON.stringify(content));
        return renderText(textContent);

      case 'error':
        return renderError(content);

      case 'schema':
        return renderSchema(content);

      default:
        // For unknown types, just render as text instead of showing metadata UI
        // This prevents the "Unknown response type" warning from appearing
        if (content) {
          return renderText(content);
        }
        // If no content, return empty (don't show metadata)
        return '';
    }
  }

  // Parse orchestration response and return HTML
  function parseOrchestrationResponse(response) {
    if (!response) {
      return "⚠️ No response received from the server.";
    }

    let html = '';
    let hasSchema = false;

    // Priority 1: Check for schema in universalResponse (type === 'schema')
    if (response.universalResponse) {
      // If universalResponse is schema type, render it as table
      if (response.universalResponse.type === 'schema') {
        // Extract schema from content - handle various structures
        const schemaContent = response.universalResponse.content || response.universalResponse;
        // If content has a schema property, use it; otherwise check if content itself has fields
        let schemaData = schemaContent;
        if (schemaContent?.schema && schemaContent.schema.fields) {
          schemaData = schemaContent.schema;
        } else if (!schemaContent?.fields && schemaContent) {
          // Content might be the schema itself, renderSchema will handle it
          schemaData = schemaContent;
        }
        const schemaHtml = renderSchema(schemaData);
        if (schemaHtml && schemaHtml.trim()) {
          html += `<div class="universal-response">${schemaHtml}</div>`;
          hasSchema = true;
        }
      } else {
        // For other universalResponse types, render normally
        const universalHtml = renderUniversalResponse(response.universalResponse);
        if (universalHtml && universalHtml.trim()) {
          html += `<div class="universal-response">${universalHtml}</div>`;
        }
      }
    }

    // Priority 2: Check for schema at root level (for object creation responses)
    if (!hasSchema && response.schema && response.schema.fields && Array.isArray(response.schema.fields) && response.schema.fields.length > 0) {
      const schemaHtml = renderSchema(response.schema);
      if (schemaHtml && schemaHtml.trim()) {
        html += `<div class="schema-response">${schemaHtml}</div>`;
        hasSchema = true;
      }
    }

    // Priority 3: Check for schema in nested locations (result.schema, data.schema, etc.)
    if (!hasSchema) {
      const nestedSchema = response.result?.schema || response.data?.schema || response.content?.schema;
      if (nestedSchema && nestedSchema.fields && Array.isArray(nestedSchema.fields) && nestedSchema.fields.length > 0) {
        const schemaHtml = renderSchema(nestedSchema);
        if (schemaHtml && schemaHtml.trim()) {
          html += `<div class="schema-response">${schemaHtml}</div>`;
          hasSchema = true;
        }
      }
    }

    // Only show text response if we don't have a schema (schema takes priority)
    // For object creation, we want to show the table, not the markdown text
    if (!hasSchema && response.response && !response.universalResponse) {
      const responseText = typeof response.response === 'string'
        ? response.response
        : JSON.stringify(response.response);
      if (responseText && responseText.trim()) {
        html += `<div class="response-text">${escapeHTML(responseText)}</div>`;
      }
    }

    // If we have html content, return it
    if (html && html.trim()) {
      return html;
    }

    // Fallback: try to extract any text content from response
    if (typeof response === 'string') {
      return response;
    }

    // Try to find any text in the response object
    const fallbackText = response.text || response.content || response.message || response.data;
    if (fallbackText && typeof fallbackText === 'string' && fallbackText.trim()) {
      return `<div class="response-text">${escapeHTML(fallbackText)}</div>`;
    }

    return "⚠️ No response received from the server.";
  }

  // Poll query status until completion
  async function pollQueryStatus(queryId, baseUrl, userId, orgId, sessionId, maxAttempts = 30, intervalMs = 2000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Wait before first attempt (except for attempt 0)
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }

      try {
        const res = await fetch(`${baseUrl}/orchestration/query/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: 'include',
          body: JSON.stringify({
            queryId: queryId,
            context: {
              userId: String(userId),
              orgId: Number(orgId),
              sessionId: sessionId
            }
          })
        });

        if (!res.ok) {
          console.warn(`⚠️ ARI: Polling attempt ${attempt + 1} failed: ${res.status}`);
          continue;
        }

        const statusData = await res.json();
        const status = statusData?.status;

        if (status === 'completed' && statusData?.result) {
          return statusData.result;
        }

        if (status === 'failed' || status === 'not_found') {
          console.error(`❌ ARI: Query failed or not found: ${status}`);
          return null;
        }

        // Continue polling if queued or processing - update UI to show status
        if (status === 'queued' || status === 'processing') {
          // Update thinking message to show current status
          const statusMessage = status === 'queued'
            ? '⏳ Request queued, waiting to be processed...'
            : '🔄 Processing your request...';
          updateThinkingMessage(statusMessage);
          // Keep inputs disabled during queued/processing
          setInputsEnabled(false);
          continue;
        }

      } catch (err) {
        console.warn(`⚠️ ARI: Polling error on attempt ${attempt + 1}:`, err);
        // Continue polling on error
      }
    }

    console.warn(`⚠️ ARI: Polling timeout after ${maxAttempts} attempts`);
    return null;
  }

  // Main orchestration API function
  async function askOrchestration(prompt) {
    // Get configuration from secure closure (not from window)
    const baseUrl = secureConfig.baseUrl || config.baseUrl || '';
    const userId = secureConfig.userId || config.userId || '';
    const orgId = secureConfig.orgId !== null ? secureConfig.orgId : (config.orgId !== null ? config.orgId : null);

    // Reuse existing sessionId if available, otherwise generate new one
    // This maintains conversation continuity across calls
    if (!currentSessionId) {
      currentSessionId = secureConfig.sessionId || config.sessionId || generateSessionId();
    }

    const sessionId = currentSessionId;

    if (!baseUrl || !userId || orgId === null) {
      const errorMsg = `⚠️ Configuration missing. baseUrl: ${baseUrl ? 'set' : 'MISSING'}, userId: ${userId ? 'set' : 'MISSING'}, orgId: ${orgId !== null ? 'set' : 'MISSING'}`;
      console.error("ARI Configuration Error:", errorMsg);
      return errorMsg;
    }

    // Prepare request - include headerId if available (so backend reuses existing header)
    const requestBody = {
      query: prompt,
      context: {
        userId: String(userId),
        orgId: Number(orgId),
        sessionId: sessionId
        // No history - start fresh
      }
    };

    // Include headerId in request if we have one (backend will reuse existing header)
    if (currentHeaderId) {
      requestBody.headerId = currentHeaderId;
    }

    try {
      const res = await fetch(`${baseUrl}/orchestration/process/llm/public`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error: ${res.status} ${res.statusText}. ${errorText}`);
      }

      const data = await res.json();

      // Handle nested response structure
      const response = data?.data || data?.result || data;
      const queryId = data?.queryId || response?.queryId;

      // Extract headerId from response (for CouchDB chat header tracking)
      // Backend automatically creates header on first message and saves all messages
      const headerId = data?.headerId || response?.headerId || response?.metadata?.headerId || data?.metadata?.headerId;
      if (headerId) {
        currentHeaderId = headerId;

        // Update sidebar entry with headerId if this is the first message
        updateSidebarEntryWithHeaderId(headerId);
      }

      // Check if queued - start polling
      const isQueued = (
        data?.status === 'queued' ||
        response?.status === 'queued' ||
        response?.universalResponse?.meta?.status === 'queued' ||
        response?.response === 'Request queued for processing' ||
        response?.response === 'Query queued for LangGraph processing with enhanced features' ||
        response?.metadata?.executionStatus === 'pending' ||
        data?.status === 'queued'
      );

      if (isQueued && queryId) {
        // Update thinking message to show queue status
        updateThinkingMessage("⏳ Request queued, processing...");
        // Keep inputs disabled during queued/processing
        setInputsEnabled(false);

        // Start polling for the result
        const polledResult = await pollQueryStatus(queryId, baseUrl, userId, orgId, sessionId);

        if (polledResult) {
          // Extract headerId from polled result as well
          const polledHeaderId = polledResult?.headerId || polledResult?.metadata?.headerId;
          if (polledHeaderId) {
            currentHeaderId = polledHeaderId;

            // Update sidebar entry with headerId if this is the first message
            updateSidebarEntryWithHeaderId(polledHeaderId);
          }

          // Parse and render the polled result
          const parsedResponse = parseOrchestrationResponse(polledResult);
          if (parsedResponse && parsedResponse.trim() && !parsedResponse.includes("No response received")) {
            return parsedResponse;
          } else {
            // If parsing failed, try to get response text from various possible locations
            const fallbackResponse = polledResult?.response
              || polledResult?.universalResponse?.content
              || polledResult?.data?.response
              || polledResult?.result?.response
              || (typeof polledResult === 'string' ? polledResult : null);

            if (fallbackResponse && typeof fallbackResponse === 'string' && fallbackResponse.trim()) {
              return `<div class="response-text">${escapeHTML(fallbackResponse)}</div>`;
            }

            return "⚠️ Response received but could not be parsed. Please try again.";
          }
        } else {
          return "⏳ Your request is still being processed. Please wait...";
        }
      }

      // If response is immediate (not queued), parse and render
      if (response) {
        const parsedResponse = parseOrchestrationResponse(response);
        if (parsedResponse && parsedResponse.trim() && !parsedResponse.includes("No response received")) {
          return parsedResponse;
        } else {
          // If parsing failed, try to get response text from various possible locations
          const fallbackResponse = response?.response
            || response?.universalResponse?.content
            || response?.data?.response
            || response?.result?.response
            || (typeof response === 'string' ? response : null);

          if (fallbackResponse && typeof fallbackResponse === 'string' && fallbackResponse.trim()) {
            return `<div class="response-text">${escapeHTML(fallbackResponse)}</div>`;
          }
        }
      }

      // Fallback - check if we have any data at all
      if (data) {
        // Try to extract any response text from the data structure
        const fallbackResponse = data?.response
          || data?.result?.response
          || data?.data?.response
          || data?.result?.data?.response
          || (typeof data === 'string' ? data : null);

        if (fallbackResponse && typeof fallbackResponse === 'string' && fallbackResponse.trim()) {
          return `<div class="response-text">${escapeHTML(fallbackResponse)}</div>`;
        }
      }

      console.error('ARI: No response content found in:', { data, response });
      return "⚠️ No response received from the server.";

    } catch (err) {
      console.error('Orchestration API Error:', err);

      // User-friendly error messages
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        return "⚠️ Unable to connect to the server. Please check your internet connection and try again.";
      }
      if (err.message.includes('401') || err.message.includes('403')) {
        return "⚠️ Authentication failed. Please refresh the page and try again.";
      }
      if (err.message.includes('429')) {
        return "⚠️ Too many requests. Please wait a moment and try again.";
      }
      if (err.message.includes('500')) {
        return "⚠️ Server error occurred. Please try again later.";
      }

      return `⚠️ An error occurred: ${err.message || 'Unknown error'}. Please try again.`;
    }
  }
  // Current conversation messages (for UI display only - backend handles all persistence)
  let currentMessages = [];

  // Current chat headerId (CouchDB _id) - tracks the conversation header
  // First message creates header, subsequent messages use same headerId
  let currentHeaderId = null;

  // Helper function to format time (relative or absolute)
  function formatTime(timestamp) {
    if (!timestamp) return 'Just now';

    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      // Show absolute date for older items
      const options = { month: 'short', day: 'numeric', year: time.getFullYear() !== now.getFullYear() ? 'numeric' : undefined };
      return time.toLocaleDateString('en-US', options);
    }
  }

  // NOTE: All persistence is handled by backend API - no localStorage operations
  // Backend automatically saves:
  // - Chat headers (on first message)
  // - User messages (as chat lines)
  // - Assistant responses (as chat lines)

  // Render chat history item
  function renderChatHistoryItem(chat) {
    const escapedTitle = escapeHTML(chat.title || 'Untitled');
    const timeStr = formatTime(chat.timestamp);
    return `<div class="recent-item" data-session-id="${escapeHTML(chat.sessionId || '')}" data-header-id="${escapeHTML(chat.headerId || chat.id || '')}">
                          <div class="recent-item-header">
                <div class="recent-item-title" title="${escapedTitle}">${escapedTitle}</div>
                <div class="recent-item-time">${escapeHTML(timeStr)}</div>
                          </div>
              <div class="recent-item-actions">
                          <div class="recent-item-star">
                </div>
                <button class="recent-item-delete" title="Delete chat" data-session-id="${escapeHTML(chat.sessionId || '')}" data-header-id="${escapeHTML(chat.headerId || chat.id || '')}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                          </div>
                        </div>`;
  }

  // Show error message in UI
  function showError(message, isRetryable = false) {
    const recentsList = wrapper.querySelector(".recents-list");
    if (!recentsList) return;

    const errorHtml = `<div class="history-error">
      <div class="error-icon">⚠️</div>
      <div class="error-text">${escapeHTML(message)}</div>
      ${isRetryable ? '<button class="retry-btn" onclick="location.reload()">Retry</button>' : ''}
    </div>`;
    recentsList.innerHTML = errorHtml;
  }

  // Load chat history from backend API (CouchDB) - same as orchestration chat
  async function loadChatHistoryFromBackend() {
    const baseUrl = secureConfig.baseUrl || config.baseUrl || '';
    const userId = secureConfig.userId || config.userId || '';
    const orgId = secureConfig.orgId !== null ? secureConfig.orgId : (config.orgId !== null ? config.orgId : null);

    // Get sessionId from secure config or config
    if (!currentSessionId) {
      currentSessionId = secureConfig.sessionId || config.sessionId || generateSessionId();
    }
    const sessionId = currentSessionId;

    if (!baseUrl || !userId || orgId === null) {
      // Don't show error here - let initializeChatHistory handle it
      throw new Error('Configuration missing');
    }

    try {
      const response = await fetch(`${baseUrl}/orchestration/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: String(userId),
          orgId: Number(orgId),
          sessionId: sessionId,
          page: 1,
          limit: 50
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to load chat history (${response.status})`;
        if (response.status === 401 || response.status === 403) {
          errorMessage = 'Authentication failed. Please refresh the page.';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        showError(errorMessage, true);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.success && data.data) {
        return data.data.map(chat => ({
          id: chat.id || chat.headerId, // Store headerId (CouchDB _id)
          headerId: chat.headerId || chat.id, // Also store as headerId for clarity
          sessionId: chat.sessionId,
          title: chat.title || 'Untitled Chat',
          timestamp: chat.lastmodifiedon || chat.createdon || Date.now()
        }));
      } else {
        showError('No chat history found.');
        return [];
      }
    } catch (err) {
      if (err.message && err.message !== 'Configuration missing') {
        // Error already shown
        throw err;
      }
      const errorMessage = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')
        ? 'Unable to connect to server. Please check your internet connection.'
        : `Error loading chat history: ${err.message || 'Unknown error'}`;
      showError(errorMessage, true);
      throw err;
    }
  }

  // Show error in chat messages area
  function showChatError(message) {
    removeWelcomeMessage();
    const errorDiv = document.createElement("div");
    errorDiv.className = "message bot";
    const errorContent = document.createElement("div");
    errorContent.className = "message-content";
    errorContent.innerHTML = `<div class="error-response">
      <div class="error-icon">⚠️</div>
      <div class="error-message">${escapeHTML(message)}</div>
    </div>`;
    // Create and add bot icon for error messages
    const iconImg = createMessageIcon('bot');
    errorDiv.appendChild(iconImg);
    errorDiv.appendChild(errorContent);
    messages.appendChild(errorDiv);
    messages.scrollTop = messages.scrollHeight;
  }


  // Store full history for client-side filtering (fallback)
  let fullHistoryCache = [];

  // Load and display chat history list (sidebar) - from backend only, show error on failure
  async function displayChatHistory(searchQuery = '') {
    const recentsList = wrapper.querySelector(".recents-list");
    if (!recentsList) return;

    try {
      let history = [];

      // If search query provided, use client-side filtering for partial matching
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();

        // First, ensure we have full history cached
        if (fullHistoryCache.length === 0) {
          const backendHistory = await loadChatHistoryFromBackend();
          fullHistoryCache = backendHistory || [];
        }

        // Apply client-side filtering for partial matching (includes letter matching)
        // This allows "creat" to match "create", "creation", "creating", etc.
        history = fullHistoryCache.filter(chat => {
          const title = (chat.title || '').toLowerCase();
          // Check if title contains the search query (partial/substring matching)
          return title.includes(query);
        });

        // Also try backend search to get additional results (exact word matches)
        // Then merge and deduplicate
        try {
          const searchResults = await searchChatHistoryFromBackend(query);
          if (searchResults && searchResults.length > 0) {
            // Merge backend results with client-side filtered results
            // Use a Set to deduplicate by headerId
            const resultMap = new Map();

            // Add client-side filtered results first
            history.forEach(chat => {
              const key = chat.headerId || chat.id || chat.sessionId;
              if (key) resultMap.set(key, chat);
            });

            // Add backend search results (may have exact matches client-side missed)
            searchResults.forEach(chat => {
              const key = chat.headerId || chat.id || chat.sessionId;
              if (key) resultMap.set(key, chat);
            });

            // Convert back to array
            history = Array.from(resultMap.values());
          }
        } catch (err) {
          // If backend search fails, that's OK - we already have client-side results
        }
      } else {
        // Load from backend (CouchDB) - no fallback
        const backendHistory = await loadChatHistoryFromBackend();
        history = backendHistory || [];
        // Cache full history for client-side filtering
        fullHistoryCache = history;
      }

      recentsList.innerHTML = '';
      if (history.length === 0) {
        const noResultsMessage = searchQuery
          ? `<div class="no-history">No chats found matching "${escapeHTML(searchQuery)}"</div>`
          : '<div class="no-history">No chat history found</div>';
        recentsList.innerHTML = noResultsMessage;
      } else {
        history.forEach(chat => {
          recentsList.innerHTML += renderChatHistoryItem(chat);
        });
        // Re-attach event listeners to new items
        attachRecentItemListeners();
      }
    } catch (err) {
      // Error already shown in loadChatHistoryFromBackend or searchChatHistoryFromBackend
      console.error('ARI: Failed to display chat history:', err);
    }
  }

  // Search chat history from backend API
  async function searchChatHistoryFromBackend(query) {
    const baseUrl = secureConfig.baseUrl || config.baseUrl || '';
    const userId = secureConfig.userId || config.userId || '';
    const orgId = secureConfig.orgId !== null ? secureConfig.orgId : (config.orgId !== null ? config.orgId : null);

    // Get sessionId from secure config or config
    if (!currentSessionId) {
      currentSessionId = secureConfig.sessionId || config.sessionId || generateSessionId();
    }
    const sessionId = currentSessionId;

    if (!baseUrl || !userId || orgId === null) {
      showError('Configuration missing. Cannot search chat history.', false);
      throw new Error('Configuration missing');
    }

    try {
      const response = await fetch(`${baseUrl}/orchestration/history/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: String(userId),
          orgId: Number(orgId),
          sessionId: sessionId,
          query: query,
          page: 1,
          limit: 50 // Get more results for search
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to search chat history (${response.status})`;
        if (response.status === 401 || response.status === 403) {
          errorMessage = 'Authentication failed. Please refresh the page.';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        showError(errorMessage, true);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.success && data.data) {
        return data.data.map(chat => ({
          id: chat.id || chat.headerId,
          headerId: chat.headerId || chat.id,
          sessionId: chat.sessionId,
          title: chat.title || 'Untitled Chat',
          timestamp: chat.lastmodifiedon || chat.createdon || Date.now()
        }));
      } else {
        return [];
      }
    } catch (err) {
      if (err.message && err.message !== 'Configuration missing') {
        // Error already shown
        throw err;
      }
      const errorMessage = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')
        ? 'Unable to connect to server. Please check your internet connection.'
        : `Error searching chat history: ${err.message || 'Unknown error'}`;
      showError(errorMessage, true);
      throw err;
    }
  }

  // Attach event listeners to recent items
  function attachRecentItemListeners() {
    const recentItems = wrapper.querySelectorAll(".recent-item");
    recentItems.forEach(item => {
      // Handle click on item (but not on delete button)
      item.addEventListener("click", (e) => {
        // Don't trigger if clicking on delete button
        if (e.target.closest('.recent-item-delete')) {
          return;
        }

        // Remove active class from all items
        recentItems.forEach(i => i.classList.remove("active"));
        // Add active class to clicked item
        item.classList.add("active");

        // Load full chat messages from storage (same as orchestration chat)
        // Use headerId if available (preferred), fallback to sessionId
        const headerId = item.getAttribute('data-header-id');
        const sessionId = item.getAttribute('data-session-id');
        if (headerId) {
          loadChatByHeaderId(headerId);
        } else if (sessionId) {
          loadChatBySessionId(sessionId);
        }
      });
    });

    // Attach delete button listeners
    const deleteButtons = wrapper.querySelectorAll(".recent-item-delete");
    deleteButtons.forEach(button => {
      // Remove any existing listeners to prevent duplicates
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);

      newButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering item click
        const sessionId = newButton.getAttribute('data-session-id');
        const headerId = newButton.getAttribute('data-header-id');
        deleteChat(sessionId, headerId, newButton);
      });
    });
  }

  // Delete chat from backend and UI - matches orchestration chat implementation
  async function deleteChat(sessionId, headerId, buttonElement) {
    // Show confirmation dialog (same as orchestration chat)
    if (!confirm('Are you sure you want to delete this chat?')) {
      return;
    }

    const baseUrl = secureConfig.baseUrl || config.baseUrl || '';
    const userId = secureConfig.userId || config.userId || '';
    const orgId = secureConfig.orgId !== null ? secureConfig.orgId : (config.orgId !== null ? config.orgId : null);

    if (!baseUrl || !userId || orgId === null) {
      alert('Configuration missing. Cannot delete chat.');
      return;
    }

    // Ensure we have sessionId (required by backend API)
    if (!sessionId) {
      console.warn('ARI: No sessionId available for deletion. Cannot delete chat.');
      alert('Cannot delete chat: session ID not found.');
      return;
    }

    try {
      // Disable button during deletion
      buttonElement.disabled = true;
      buttonElement.style.opacity = '0.5';

      // Use exact same request format as orchestration chat service
      // Request body: { sessionId, userId, orgId }
      const request = {
        sessionId: sessionId,
        userId: String(userId),
        orgId: Number(orgId)
      };

      const response = await fetch(`${baseUrl}/orchestration/history/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to delete chat (${response.status})`;
        if (response.status === 401 || response.status === 403) {
          errorMessage = 'Authentication failed. Please refresh the page.';
        } else if (response.status === 404) {
          errorMessage = 'Chat not found or delete endpoint not available.';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        alert(errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.success) {
        // Remove from UI
        const itemElement = buttonElement.closest('.recent-item');
        const recentsList = wrapper.querySelector(".recents-list");

        if (itemElement) {
          itemElement.remove();
        }

        // Check if list is now empty and show "No chat history found" message
        if (recentsList && recentsList.children.length === 0) {
          recentsList.innerHTML = '<div class="no-history">No chat history found</div>';
        }

        // Remove from cache
        fullHistoryCache = fullHistoryCache.filter(chat => {
          return chat.sessionId !== sessionId && chat.headerId !== headerId && chat.id !== headerId;
        });

        // If this was the currently open chat, clear it and show welcome message
        const deletedHeaderId = headerId || (itemElement ? itemElement.getAttribute('data-header-id') : null);
        const deletedSessionId = sessionId || (itemElement ? itemElement.getAttribute('data-session-id') : null);

        if ((deletedHeaderId && currentHeaderId === deletedHeaderId) ||
          (deletedSessionId && currentSessionId === deletedSessionId)) {
          // Clear current chat
          currentSessionId = null;
          currentHeaderId = null;
          currentMessages = [];
          messages.innerHTML = '';

          // Show welcome message
          const afterInputContainer = wrapper.querySelector(".chat-afterinput-container");
          const initialInputContainer = wrapper.querySelector(".chat-message-initial");
          if (afterInputContainer) {
            afterInputContainer.style.display = "none";
          }
          if (initialInputContainer) {
            initialInputContainer.style.display = "block";
          } else {
            // Recreate welcome message if it doesn't exist
            messages.innerHTML = `
              <div class="chat-message-initial" style="margin: auto 0px;">
                <div class="welcome-message">
                  <h2>Hi Welcome !</h2>
                  <p>What are you looking for?</p>
                </div>
                <div class="chat-input-container">
                  <div class="chat-input">
                      <textarea placeholder="Ask anything." rows="1"></textarea>
                      <button class="chat-input-btn" title="Send">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                      </button>
                  </div>
                </div>
              </div>
            `;

            // Re-query input elements
            input = wrapper.querySelector(".chat-input textarea") || wrapper.querySelector(".chat-input input");
            sendBtn = wrapper.querySelector(".chat-input-btn");
            if (sendBtn) {
              sendBtn.addEventListener("click", sendMessage);
            }
          }

          // Remove active class from all items
          const recentItems = wrapper.querySelectorAll(".recent-item");
          recentItems.forEach(item => item.classList.remove("active"));
        }
      } else {
        alert('Failed to delete chat. Please try again.');
      }
    } catch (err) {
      console.error('ARI: Failed to delete chat:', err);
      alert('Failed to delete chat. Please try again.');
    } finally {
      // Re-enable button
      buttonElement.disabled = false;
      buttonElement.style.opacity = '1';
    }
  }

  // Load full chat conversation by headerId from backend API (CouchDB) - same as orchestration chat
  async function loadChatByHeaderIdFromBackend(headerId) {
    const baseUrl = secureConfig.baseUrl || config.baseUrl || '';
    const userId = secureConfig.userId || config.userId || '';
    const orgId = secureConfig.orgId !== null ? secureConfig.orgId : (config.orgId !== null ? config.orgId : null);

    if (!baseUrl || !userId || orgId === null) {
      showChatError('Configuration missing. Cannot load chat session.');
      throw new Error('Configuration missing');
    }

    try {
      const response = await fetch(`${baseUrl}/orchestration/chat/by-header`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          headerId: headerId,
          userId: String(userId),
          orgId: Number(orgId)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to load chat session (${response.status})`;
        if (response.status === 401 || response.status === 403) {
          errorMessage = 'Authentication failed. Please refresh the page.';
        } else if (response.status === 404) {
          errorMessage = 'Chat session not found.';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        showChatError(errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.success) {
        showChatError(data.chat === null ? 'Chat session not found.' : 'Failed to load chat session.');
        return null;
      }

      if (!data.chat) {
        showChatError('Chat session not found.');
        return null;
      }

      if (!data.chat.messages || data.chat.messages.length === 0) {
        showChatError('No messages found for this chat session.');
        return {
          messages: [],
          sessionId: data.chat.sessionId || null,
          headerId: data.chat.headerId || headerId
        };
      }

      // Convert orchestration messages to ARI format
      const convertedMessages = data.chat.messages.map(msg => {
        // Extract schema from metadata if it exists (backend stores it in metadata.schema)
        const schema = msg.schema || msg.metadata?.schema;
        const responseType = msg.responseType || msg.metadata?.responseType;

        // Reconstruct universalResponse from available data
        let universalResponse = msg.universalResponse;

        // If no universalResponse but we have schema, create it
        if (!universalResponse && schema && schema.fields) {
          universalResponse = {
            type: 'schema',
            content: schema
          };
        }

        // If no universalResponse but we have responseType, create appropriate universalResponse
        if (!universalResponse && responseType && msg.type === 'assistant') {
          // For greeting responses, create a greeting universalResponse
          if (responseType === 'greeting') {
            universalResponse = {
              type: 'greeting',
              content: msg.content
            };
          }
          // For other response types, we can create text-based universalResponse
          else if (responseType !== 'text') {
            universalResponse = {
              type: responseType,
              content: msg.content
            };
          }
        }

        // Build response object with all available data for proper parsing
        const responseObj = {
          universalResponse: universalResponse || null,
          response: msg.content || msg.text || '',
          schema: schema || null
        };

        // Parse response to get HTML content (includes schema table rendering)
        // Only parse for assistant messages (bot responses)
        const htmlContent = (msg.type === 'assistant' && (universalResponse || schema))
          ? parseOrchestrationResponse(responseObj)
          : null;

        return {
          type: msg.type === 'user' ? 'user' : 'bot',
          content: msg.content || msg.text || '',
          htmlContent: htmlContent,
          text: msg.content || msg.text || '',
          timestamp: msg.createdon || Date.now()
        };
      });

      return {
        messages: convertedMessages,
        sessionId: data.chat.sessionId,
        headerId: data.chat.headerId || headerId // Include headerId from response or use parameter
      };
    } catch (err) {
      console.error('❌ ARI: Error loading chat by headerId from backend:', err);
      if (err.message && !err.message.includes('Configuration missing') && !err.message.includes('Authentication failed') && !err.message.includes('Server error') && !err.message.includes('not found')) {
        const errorMessage = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')
          ? 'Unable to connect to server. Please check your internet connection.'
          : `Error loading chat session: ${err.message || 'Unknown error'}`;
        showChatError(errorMessage);
      }
      throw err;
    }
  }

  // Load full chat conversation by sessionId from backend API (CouchDB) - fallback method
  async function loadChatSessionFromBackend(sessionId) {
    const baseUrl = secureConfig.baseUrl || config.baseUrl || '';
    const userId = secureConfig.userId || config.userId || '';
    const orgId = secureConfig.orgId !== null ? secureConfig.orgId : (config.orgId !== null ? config.orgId : null);

    if (!baseUrl || !userId || orgId === null) {
      showChatError('Configuration missing. Cannot load chat session.');
      throw new Error('Configuration missing');
    }

    try {
      const response = await fetch(`${baseUrl}/orchestration/history/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: sessionId,
          userId: String(userId),
          orgId: Number(orgId)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to load chat session (${response.status})`;
        if (response.status === 401 || response.status === 403) {
          errorMessage = 'Authentication failed. Please refresh the page.';
        } else if (response.status === 404) {
          errorMessage = 'Chat session not found.';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        showChatError(errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data && data.messages) {
        // Convert orchestration messages to ARI format
        return data.messages.map(msg => {
          // Reconstruct universalResponse if we have schema but no universalResponse
          let universalResponse = msg.universalResponse;
          if (!universalResponse && msg.schema && msg.schema.fields) {
            // Reconstruct universalResponse from schema for proper rendering
            universalResponse = {
              type: 'schema',
              content: msg.schema
            };
          }

          // Build response object with all available data for proper parsing
          const responseObj = {
            universalResponse: universalResponse || null,
            response: msg.content || msg.text || '',
            schema: msg.schema || null
          };

          // Parse response to get HTML content (includes schema table rendering)
          const htmlContent = (universalResponse || msg.schema)
            ? parseOrchestrationResponse(responseObj)
            : null;

          return {
            type: msg.type === 'user' ? 'user' : 'bot',
            content: msg.content || msg.text || '',
            htmlContent: htmlContent,
            text: msg.content || msg.text || '',
            timestamp: msg.createdon || Date.now()
          };
        });
      }
      showChatError('Chat session has no messages.');
      return null;
    } catch (err) {
      if (err.message && !err.message.includes('Configuration missing') && !err.message.includes('Authentication failed') && !err.message.includes('Server error') && !err.message.includes('not found')) {
        const errorMessage = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')
          ? 'Unable to connect to server. Please check your internet connection.'
          : `Error loading chat session: ${err.message || 'Unknown error'}`;
        showChatError(errorMessage);
      }
      throw err;
    }
  }

  // Load full chat conversation by headerId (same pattern as orchestration chat) - backend only, show error on failure
  async function loadChatByHeaderId(headerId) {
    if (!headerId || headerId.trim() === '') {
      showChatError('Invalid chat session ID.');
      return;
    }

    try {
      // Load from backend (CouchDB) only - no fallback
      const result = await loadChatByHeaderIdFromBackend(headerId);

      if (!result) {
        showChatError('Chat session not found.');
        return;
      }

      if (!result.messages || result.messages.length === 0) {
        showChatError('No messages found for this chat session.');
        return;
      }

      // Set current sessionId and headerId from response
      if (result.sessionId) {
        currentSessionId = result.sessionId;
      }
      if (result.headerId || headerId) {
        currentHeaderId = result.headerId || headerId;
      }

      // Clear current messages
      currentMessages = [];

      // Clear UI
      messages.innerHTML = '';

      // Remove welcome message and show input bar (since we have messages)
      removeWelcomeMessage();
      const afterInputContainer = wrapper.querySelector(".chat-afterinput-container");
      const initialInputContainer = wrapper.querySelector(".chat-message-initial");
      if (afterInputContainer) {
        afterInputContainer.style.display = "block"; // Show input bar for existing chat
      }
      if (initialInputContainer) {
        initialInputContainer.style.display = "none"; // Hide initial welcome message container
      }

      // Ensure inputs are enabled when loading a chat
      setInputsEnabled(true);

      // Restore messages (without triggering save)
      result.messages.forEach(msg => {
        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${msg.type === 'user' ? 'user' : 'bot'}`;
        const msgContent = document.createElement("div");
        msgContent.className = "message-content";

        // Use htmlContent if available, otherwise use plain text content
        if (msg.htmlContent) {
          msgContent.innerHTML = sanitizeHTML(msg.htmlContent);
        } else if (msg.content || msg.text) {
          // For plain text, use textContent to prevent XSS
          msgContent.textContent = msg.content || msg.text || '';
        } else {
          // Fallback: show a placeholder if content is missing
          msgContent.textContent = '[No content]';
        }

        // Create and add icon
        const iconImg = createMessageIcon(msg.type === 'user' ? 'user' : 'bot');

        // For user messages: content first, then icon on right
        // For bot messages: icon first, then content on left
        if (msg.type === 'user') {
          msgDiv.appendChild(msgContent);
          msgDiv.appendChild(iconImg);
        } else {
          msgDiv.appendChild(iconImg);
          msgDiv.appendChild(msgContent);
        }

        messages.appendChild(msgDiv);

        // Add to current messages array (don't save, we're loading from storage)
        currentMessages.push(msg);
      });

      // Scroll to bottom
      messages.scrollTop = messages.scrollHeight;
    } catch (err) {
      // Error already shown in loadChatByHeaderIdFromBackend
      console.error('ARI: Failed to load chat by headerId:', err);
    }
  }

  // Load full chat conversation by sessionId (fallback method) - backend only, show error on failure
  async function loadChatBySessionId(sessionId) {
    try {
      // Load from backend (CouchDB) only - no fallback
      const savedMessages = await loadChatSessionFromBackend(sessionId);

      if (!savedMessages || savedMessages.length === 0) {
        showChatError('No messages found for this chat session.');
        return;
      }

      // Set current sessionId
      currentSessionId = sessionId;

      // Clear current messages
      currentMessages = [];

      // Clear UI
      messages.innerHTML = '';

      // Remove welcome message and show input bar (since we have messages)
      removeWelcomeMessage();
      const afterInputContainer = wrapper.querySelector(".chat-afterinput-container");
      const initialInputContainer = wrapper.querySelector(".chat-message-initial");
      if (afterInputContainer) {
        afterInputContainer.style.display = "block"; // Show input bar for existing chat
      }
      if (initialInputContainer) {
        initialInputContainer.style.display = "none"; // Hide initial welcome message container
      }

      // Ensure inputs are enabled when loading a chat
      setInputsEnabled(true);

      // Restore messages (without triggering save)
      savedMessages.forEach(msg => {
        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${msg.type === 'user' ? 'user' : 'bot'}`;
        const msgContent = document.createElement("div");
        msgContent.className = "message-content";

        if (msg.htmlContent) {
          msgContent.innerHTML = sanitizeHTML(msg.htmlContent);
        } else {
          msgContent.textContent = msg.content || msg.text || '';
        }

        // Create and add icon
        const iconImg = createMessageIcon(msg.type === 'user' ? 'user' : 'bot');

        // For user messages: content first, then icon on right
        // For bot messages: icon first, then content on left
        if (msg.type === 'user') {
          msgDiv.appendChild(msgContent);
          msgDiv.appendChild(iconImg);
        } else {
          msgDiv.appendChild(iconImg);
          msgDiv.appendChild(msgContent);
        }

        messages.appendChild(msgDiv);

        // Add to current messages array (don't save, we're loading from storage)
        currentMessages.push(msg);
      });

      // Scroll to bottom
      messages.scrollTop = messages.scrollHeight;
    } catch (err) {
      // Error already shown in loadChatSessionFromBackend
      console.error('ARI: Failed to load chat by sessionId:', err);
    }
  }

  // Update sidebar UI when first message is sent (UI only - backend handles persistence)
  // This adds the chat to the sidebar for immediate visual feedback
  async function addtoTracking(entertxt) {
    // Only update UI if this is the first message in the conversation
    if (currentMessages.length === 0 && entertxt.length) {
      // Use currentSessionId if available, otherwise generate new one
      if (!currentSessionId) {
        currentSessionId = generateSessionId();
      }

      // Create chat object for sidebar UI (backend will create actual header and return headerId)
      const chat = {
        sessionId: currentSessionId,
        headerId: currentHeaderId || null, // Will be set after backend response
        title: entertxt,
        timestamp: Date.now()
      };

      // Store reference to this sidebar entry so we can update it with headerId later
      window._ariCurrentSidebarEntry = {
        sessionId: currentSessionId,
        element: null // Will be set after rendering
      };

      // Render the new item in sidebar (UI only - backend handles persistence)
      const trackHtml = renderChatHistoryItem(chat);
      const recentsList = wrapper.querySelector(".recents-list");
      if (recentsList) {
        // Remove "No chat history found" message if it exists
        const noHistoryMsg = recentsList.querySelector('.no-history');
        if (noHistoryMsg) {
          noHistoryMsg.remove();
        }

        // Prepend new chat to the list
        recentsList.innerHTML = trackHtml + recentsList.innerHTML;

        // Find the newly added element and store reference
        const newItem = recentsList.querySelector(`[data-session-id="${escapeHTML(currentSessionId)}"]`);
        if (newItem && window._ariCurrentSidebarEntry) {
          window._ariCurrentSidebarEntry.element = newItem;
        }

        // Re-attach event listeners
        attachRecentItemListeners();
      }
    }
    // Backend automatically saves all messages - no explicit save needed
  }

  // Update sidebar entry with headerId after receiving it from backend
  function updateSidebarEntryWithHeaderId(headerId) {
    if (!window._ariCurrentSidebarEntry || !window._ariCurrentSidebarEntry.element) {
      return; // No sidebar entry to update
    }

    const element = window._ariCurrentSidebarEntry.element;
    const sessionId = window._ariCurrentSidebarEntry.sessionId;

    // Update data-header-id attribute
    element.setAttribute('data-header-id', headerId);

    // Clear the reference after updating
    window._ariCurrentSidebarEntry = null;
  }

  // Track if a query is currently being processed
  let isQueryInProgress = false;

  // Enable/disable input fields during query processing
  function setInputsEnabled(enabled) {
    isQueryInProgress = !enabled;

    // Get all input elements
    const inputs = [
      wrapper.querySelector(".chat-input textarea"),
      wrapper.querySelector(".chat-input input"),
      wrapper.querySelector(".minimized-prompt-input textarea"),
      wrapper.querySelector(".minimized-prompt-input input"),
      wrapper.querySelector(".chat-afterinput-container textarea"),
      wrapper.querySelector(".chat-afterinput-container input")
    ].filter(Boolean); // Remove nulls

    // Get all send buttons
    const sendButtons = [
      wrapper.querySelector(".chat-input .send-btn"),
      wrapper.querySelector(".minimized-prompt-input .send-btn"),
      wrapper.querySelector(".chat-afterinput-container .send-btn")
    ].filter(Boolean); // Remove nulls

    // Enable/disable inputs
    inputs.forEach(input => {
      input.disabled = !enabled;
      input.style.opacity = enabled ? '1' : '0.6';
      input.style.cursor = enabled ? 'text' : 'not-allowed';
    });

    // Enable/disable send buttons
    sendButtons.forEach(btn => {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? '1' : '0.6';
      btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    });

    // Note: "New Chat" button is intentionally NOT disabled - user can always start a new chat
  }

  // Update thinking message to show queue/processing status
  function updateThinkingMessage(message) {
    const thinkingElement = window._ariThinkingElement || document.getElementById('ari-thinking-message');
    if (!thinkingElement) {
      return; // No thinking element to update
    }

    const thinkingContent = thinkingElement.querySelector('.message-content');
    if (thinkingContent) {
      thinkingContent.innerHTML = `<div class="text-response">${escapeHTML(message)}</div>`;
      messages.scrollTop = messages.scrollHeight;
    }
  }
  // Initialize video element reference (will be set when toggleBtn is added to DOM)
  let videoElem = document.querySelector(".chatbot-toggle video");
  if (!videoElem) {
    // Try to get it after a short delay (in case DOM isn't ready yet)
    setTimeout(() => {
      videoElem = document.querySelector(".chatbot-toggle video");
      if (!videoElem) {
        // Create dummy object to prevent errors
        videoElem = {
          pause: () => Promise.resolve(),
          load: () => { },
          play: () => Promise.resolve()
        };
      }
    }, 200);
  }

  // Helper function to safely play video
  function safePlayVideo(videoElement) {
    if (!videoElement || typeof videoElement.play !== 'function') {
      return Promise.resolve();
    }
    try {
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        return playPromise.catch(() => {
          // Ignore errors - video will play on user interaction
        });
      }
    } catch (error) {
      // Ignore errors - video will play on user interaction
    }
    return Promise.resolve();
  }

  // Helper function to safely change video source
  function changeVideoSource(sourcePath) {
    const source = document.querySelector(".chatbot-toggle source");
    if (source && sourcePath) {
      // Convert to correct path with base href
      const fullPath = sourcePath.startsWith('/') ? getAssetPath(sourcePath.substring(1)) : getAssetPath(sourcePath);
      source.src = fullPath;
      if (videoElem && typeof videoElem.load === 'function') {
        videoElem.load();
        // Wait a bit before playing to avoid AbortError
        setTimeout(() => {
          safePlayVideo(videoElem);
        }, 50);
      }
    }
  }
  async function sendMessage(eventOrTarget) {
    // Prevent sending if a query is already in progress
    if (isQueryInProgress) {
      return;
    }

    // Re-query inputs to ensure we have the latest references
    input = wrapper.querySelector(".chat-input textarea") || wrapper.querySelector(".chat-input input");
    const currentMinimizedInput = wrapper.querySelector(".minimized-prompt-input textarea") || wrapper.querySelector(".minimized-prompt-input input");
    const currentAfterInput = wrapper.querySelector(".chat-afterinput-container textarea") || wrapper.querySelector(".chat-afterinput-container input");

    // Determine which input was used and get text FIRST (before any side effects)
    let text = "";
    if (eventOrTarget && eventOrTarget.matches && (eventOrTarget.matches(".minimized-prompt-input input") || eventOrTarget.matches(".minimized-prompt-input textarea"))) {
      text = currentMinimizedInput ? currentMinimizedInput.value.trim() : "";
    } else if (eventOrTarget && eventOrTarget.matches && (eventOrTarget.matches(".chat-afterinput-container input") || eventOrTarget.matches(".chat-afterinput-container textarea"))) {
      text = currentAfterInput ? currentAfterInput.value.trim() : "";
    } else if (isMinimized && currentMinimizedInput) {
      text = currentMinimizedInput.value.trim();
    } else if (input) {
      text = input.value.trim();
    }

    // Fallback to afterinput if main input is empty
    if (text === "" && currentAfterInput && currentAfterInput.value.trim() !== "") {
      text = currentAfterInput.value.trim();
    }

    // Validate text BEFORE any side effects (video changes, input disabling, etc.)
    if (!text) {
      return;
    }

    // Now proceed with side effects only if we have valid text
    if (videoElem && typeof videoElem.pause === 'function') {
      try {
        const pauseResult = videoElem.pause();
        if (pauseResult && typeof pauseResult.catch === 'function') {
          pauseResult.catch(() => { }); // Ignore pause errors
        }
      } catch (e) {
        // Ignore pause errors
      }
    }
    changeVideoSource("assets/img/ari/kodivian-logo.png");

    // Disable inputs immediately when sending
    setInputsEnabled(false);

    wrapper.querySelector(".chat-afterinput-container").style.display = "block"; // Show after input on first message
    // If minimized, expand first
    if (isMinimized) {
      toggleMinimize();
    }

    // Only track/create chat entry for the first message in a conversation
    // This should happen BEFORE adding the message to currentMessages
    addtoTracking(text);

    // Sync input values (if inputs exist)
    if (input) input.value = text;
    if (currentMinimizedInput) currentMinimizedInput.value = text;
    if (currentAfterInput) currentAfterInput.value = text;

    addMessage("user", text, false);

    // Clear all inputs
    if (input) input.value = "";
    if (currentMinimizedInput) currentMinimizedInput.value = "";
    if (currentAfterInput) currentAfterInput.value = "";

    // Create thinking message element (will be updated during processing)
    const thinking = document.createElement("div");
    thinking.className = "message bot";
    thinking.id = "ari-thinking-message"; // Add ID so we can update it
    const thinkingContent = document.createElement("div");
    thinkingContent.className = "message-content";
    thinkingContent.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div>`;
    thinking.appendChild(thinkingContent);
    messages.appendChild(thinking);
    messages.scrollTop = messages.scrollHeight;

    // Store reference to thinking element for updates
    window._ariThinkingElement = thinking;

    try {
      const reply = await askOrchestration(text);

      // Clear thinking element reference
      window._ariThinkingElement = null;
      if (videoElem && typeof videoElem.pause === 'function') {
        try {
          const pauseResult = videoElem.pause();
          if (pauseResult && typeof pauseResult.catch === 'function') {
            pauseResult.catch(() => { }); // Ignore pause errors
          }
        } catch (e) {
          // Ignore pause errors
        }
      }
      changeVideoSource("assets/img/ari/Ari-response.webm");
      thinking.remove();
      // Check if reply is HTML (contains HTML tags)
      const isHTML = reply && (reply.includes('<') && reply.includes('>'));
      if (isHTML) {
        addMessage("bot", "", false, reply);
      } else {
        addMessage("bot", reply, true);
      }
    } catch (error) {
      // Re-enable inputs on error
      setInputsEnabled(true);
      console.error("ARI: Error sending message:", error);
      // Remove thinking message on error
      if (thinking && thinking.parentNode) {
        thinking.remove();
      }
      window._ariThinkingElement = null;
      throw error; // Re-throw to allow error handling
    } finally {
      // Always re-enable inputs after response is received (success or error)
      setInputsEnabled(true);
    }
  }

  // Sync input values between normal and minimized inputs
  input.addEventListener("input", () => {
    minimizedInput.value = input.value;
  });

  minimizedInput.addEventListener("input", () => {
    input.value = minimizedInput.value;
  });

  sendBtn.addEventListener("click", sendMessage);
  aftersendBtn.addEventListener("click", sendMessage);
  minimizedSendBtn.addEventListener("click", sendMessage);
  favoritebtns.forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
    });
  });
  // Handle Enter key: Shift+Enter = new line, Enter alone = send (like ChatGPT)
  function handleTextareaKeydown(e) {
    const isTextarea = e.target.tagName === 'TEXTAREA';
    const isInput = e.target.tagName === 'INPUT';

    if (!isTextarea && !isInput) return;

    // Check if it's one of our chat inputs
    const isChatInput = e.target.matches(".chat-input textarea") ||
      e.target.matches(".chat-input input") ||
      e.target.matches(".minimized-prompt-input textarea") ||
      e.target.matches(".minimized-prompt-input input") ||
      e.target.matches(".chat-afterinput-container textarea") ||
      e.target.matches(".chat-afterinput-container input");

    if (!isChatInput) return;

    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Shift+Enter: Allow default behavior (new line)
        return;
      } else {
        // Enter alone: Send message
        e.preventDefault();
        sendMessage(e.target);
      }
    }
  }

  // Auto-resize textarea - expand to max height (200px), then scroll
  function autoResizeTextarea(textarea) {
    if (!textarea || textarea.tagName !== 'TEXTAREA') return;
    const maxHeight = 200; // Max height in pixels
    textarea.style.height = 'auto'; // Reset height to get accurate scrollHeight
    const newHeight = textarea.scrollHeight;

    if (newHeight <= maxHeight) {
      // Content fits within max height - expand to fit content
      textarea.style.height = newHeight + 'px';
      textarea.style.overflowY = 'hidden'; // No scrollbar needed
    } else {
      // Content exceeds max height - set to max and enable scrolling
      textarea.style.height = maxHeight + 'px';
      textarea.style.overflowY = 'auto'; // Enable scrolling
    }
  }

  document.addEventListener("keydown", handleTextareaKeydown);

  // Auto-resize textareas on input
  document.addEventListener("input", (e) => {
    if (e.target.tagName === 'TEXTAREA') {
      const isChatInput = e.target.matches(".chat-input textarea") ||
        e.target.matches(".minimized-prompt-input textarea") ||
        e.target.matches(".chat-afterinput-container textarea");
      if (isChatInput) {
        autoResizeTextarea(e.target);
      }
    }
  });


  // --- 11 DRAGGABLE BUTTON ---
  let isDragging = false, offsetX, offsetY;
  let moved = false; // track if drag happened
  let dragEndTime = 0; // Track when drag ended to prevent immediate clicks

  toggleBtn.addEventListener("mousedown", (e) => {
    if (e.target.closest('.chatbot-container')) return;

    isDragging = true;
    moved = false;
    dragEndTime = 0; // Reset drag end time
    toggleBtn.classList.add("dragging");

    const rect = toggleBtn.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    e.preventDefault();
    moved = true; // mark drag started

    toggleBtn.style.left = e.clientX - offsetX + "px";
    toggleBtn.style.top = e.clientY - offsetY + "px";
    toggleBtn.style.right = "auto";
    toggleBtn.style.bottom = "auto";
  });

  document.addEventListener("mouseup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    toggleBtn.classList.remove("dragging");

    if (moved) {
      snapToNearestCorner(toggleBtn);
      if (isOpen) {
        // Wait for snap animation to complete before repositioning dialog
        setTimeout(() => {
          positionDialogNearButton();
        }, 300);
      }
      // Record when drag ended - block clicks for 350ms (300ms animation + 50ms buffer)
      dragEndTime = Date.now();
    } else {
      // No drag happened, reset immediately
      dragEndTime = 0;
    }
    moved = false; // Reset moved flag
    e.stopPropagation();
  });

  // --- Click handler ---
  toggleBtn.addEventListener("click", (e) => {
    // Block clicks if drag just ended (within 350ms)
    // This prevents chat from opening immediately after drop, allowing position to settle
    if (moved || (dragEndTime > 0 && (Date.now() - dragEndTime) < 350)) {
      // Was a drag, ignore click
      e.stopImmediatePropagation();
      return;
    }
    e.stopPropagation();
    if (isOpen) {
      closeChatbox();
    } else {
      openChatbox();
    }
  });

  function snapToNearestCorner(btn) {
    const { innerWidth, innerHeight } = window;
    const rect = btn.getBoundingClientRect();
    const left = rect.left;
    const right = innerWidth - rect.right;
    const top = rect.top;
    const bottom = innerHeight - rect.bottom;
    const horiz = left < right ? "left" : "right";
    const vert = top < bottom ? "top" : "bottom";
    const targetX = horiz === "left" ? 20 : innerWidth - 80;
    const targetY = vert === "top" ? 20 : innerHeight - 80;

    btn.style.transition = "all 0.3s ease";
    btn.style.left = targetX + "px";
    btn.style.top = targetY + "px";
    btn.style.right = "auto";
    btn.style.bottom = "auto";
    setTimeout(() => (btn.style.transition = ""), 300);
  }

  // --- 12 INITIAL POSITION ---
  switch (config.position) {
    case "top-left":
      toggleBtn.style.top = "20px";
      toggleBtn.style.left = "20px";
      toggleBtn.style.right = "auto";
      toggleBtn.style.bottom = "auto";
      break;
    case "top-right":
      toggleBtn.style.top = "20px";
      toggleBtn.style.right = "20px";
      toggleBtn.style.left = "auto";
      toggleBtn.style.bottom = "auto";
      break;
    case "bottom-left":
      toggleBtn.style.bottom = "20px";
      toggleBtn.style.left = "20px";
      toggleBtn.style.right = "auto";
      toggleBtn.style.top = "auto";
      break;
    default:
      toggleBtn.style.bottom = "20px";
      toggleBtn.style.right = "20px";
      toggleBtn.style.left = "auto";
      toggleBtn.style.top = "auto";
  }

  // --- 13 WINDOW RESIZE HANDLER ---
  window.addEventListener("resize", () => {
    if (isOpen) {
      positionDialogNearButton();
    }
  });
})();
