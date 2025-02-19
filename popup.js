document.addEventListener('DOMContentLoaded', function () {
  // Get all DOM elements
  const toggleBtn = document.getElementById('toggle-visibility');
  const apiKeyInput = document.getElementById('api-key');
  const preferredLanguageInput = document.getElementById('preferred-language');
  const saveKeyBtn = document.getElementById('save-key');
  const statusDiv = document.getElementById('status');
  const summaryStyleSelect = document.getElementById('summary-style');
  let isVisible = false;

  // Cache SVG icons
  const eyeOpenSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
  </svg>`;

  const eyeClosedSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>`;

  // Initialize popup
  initializePopup();

  // Handle visibility toggle
  toggleBtn?.addEventListener('click', toggleVisibility);

  // Handle save button
  saveKeyBtn?.addEventListener('click', handleSaveKey);

  async function initializePopup() {
    const { apiKey, summaryStyle, preferredLanguage } = await chrome.storage.sync.get(['apiKey', 'summaryStyle', 'preferredLanguage']);
    if (apiKey) apiKeyInput.value = apiKey;
    if (summaryStyle) summaryStyleSelect.value = summaryStyle;
    if (preferredLanguage) preferredLanguageInput.value = preferredLanguage;
  }

  function toggleVisibility() {
    isVisible = !isVisible;
    apiKeyInput.type = isVisible ? 'text' : 'password';
    toggleBtn.innerHTML = isVisible ? eyeClosedSvg : eyeOpenSvg;
  }

  function handleSaveKey() {
    const apiKey = apiKeyInput.value.trim();
    const preferredLanguage = preferredLanguageInput.value.trim();
    const summaryStyle = summaryStyleSelect.value;

    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      showStatus('Invalid API key format. It should start with "sk-"', 'error');
      return;
    }

    chrome.storage.sync.set({
      apiKey,
      summaryStyle,
      preferredLanguage
    }, () => {
      showStatus('Settings saved successfully!', 'success');
    });
  }

  function showStatus(message, type) {
    requestAnimationFrame(() => {
      statusDiv.textContent = message;
      statusDiv.className = type;
      statusDiv.style.display = 'block';

      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    });
  }
});