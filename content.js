// Constants
const PROMPTS = {
  BULLET_POINTS: 'Summarize the YouTube video transcript in 5 bullet points with emojis.',
  SUMMARY: 'Provide a concise summary of the YouTube video transcript. Don\'t use big headings.',
  DETAILED: 'Provide a detailed summary of the YouTube video transcript. Don\'t use big headings.',
};

const OPENAI_CONFIG = {
  MODEL: 'gpt-4o-mini',
  MAX_TOKENS: 500,
  TEMPERATURE: 0.7,
  API_URL: 'https://api.openai.com/v1/chat/completions',
};

const UI_STYLES = {
  BUTTON: {
    DEFAULT: {
      backgroundColor: '#ff4500',
      cursor: 'pointer',
    },
    DISABLED: {
      backgroundColor: '#ccc',
      cursor: 'not-allowed',
    },
    HOVER: {
      backgroundColor: '#e03c00',
    },
    SUCCESS: {
      backgroundColor: '#4CAF50',
    },
    PROCESSING: {
      backgroundColor: '#808080',
    },
  },
  SUMMARY: `
    margin-top: 15px;
    padding: 10px;
    padding-inline: 3rem;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 12px;
    font-size: 1.4rem;
    line-height: 1.5;
  `,
  ANIMATIONS: `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes highlight {
      0% { background-color: rgba(255, 69, 0, 0.2); }
      100% { background-color: rgba(0, 0, 0, 0.05); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
};

// Global state
let apiKey = null;
let summarizedVideos = new Set();

// Initialize API key
chrome.storage.sync.get(['apiKey', 'summaryStyle'], async (data) => {
  apiKey = data.apiKey || null;
  if (!apiKey) {
    console.warn('API key not set. Please add your OpenAI API key in the extension settings.');
  }
});

// API key change listener
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.apiKey) {
    apiKey = changes.apiKey.newValue || null;
    console.log('API key updated');
    updateButtonState();
  }
});

// Helper functions
async function hasTranscriptions(videoId) {
  try {
    await window.YoutubeTranscript.fetchTranscript(videoId);
    return true;
  } catch (error) {
    console.warn(`No transcription available for video ID: ${videoId}`, error);
    return false;
  }
}

async function updateButtonState() {
  const videoId = new URLSearchParams(window.location.search).get('v');
  const summarizeButton = document.querySelector('#summarize-button');

  if (!summarizeButton || !videoId) return;

  if (summarizedVideos.has(videoId)) {
    summarizeButton.innerHTML = getButtonContent('Summarized', true);
    summarizeButton.style.backgroundColor = UI_STYLES.BUTTON.SUCCESS.backgroundColor;
    summarizeButton.disabled = true;
  } else {
    summarizeButton.disabled = false;
    summarizeButton.innerHTML = getButtonContent('Summarize');
    summarizeButton.style.backgroundColor = UI_STYLES.BUTTON.DEFAULT.backgroundColor;

    const hasTranscripts = await hasTranscriptions(videoId);
    if (!hasTranscripts) {
      summarizeButton.disabled = true;
      summarizeButton.title = 'Transcriptions are not available for this video.';
      Object.assign(summarizeButton.style, UI_STYLES.BUTTON.DISABLED);
    }
  }
}

function getButtonContent(text, isSuccess = false) {
  const icon = isSuccess ? getCheckmarkIcon() : getBotIcon();
  return `
    <span style="display: inline-flex; align-items: center; justify-content: center; height: 100%;">
      ${icon}
      ${text}
    </span>
  `;
}

function getBotIcon() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" 
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
      style="margin-right: 3px;">
      <path d="M12 8V4H8"/>
      <rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2"/>
      <path d="M20 14h2"/>
      <path d="M15 13v2"/>
      <path d="M9 13v2"/>
    </svg>
  `;
}

function getCheckmarkIcon() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" 
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  `;
}

// Core functionality
async function fetchSummary(transcript) {
  const { summaryStyle, preferredLanguage } = await chrome.storage.sync.get(['summaryStyle', 'preferredLanguage']);

  if (!apiKey) {
    alert('API key not set. Please set it in the extension popup.');
    throw new Error('API key not set.');
  }

  const systemPrompt = getSystemPrompt(summaryStyle, preferredLanguage);
  console.log(systemPrompt)
  const response = await fetch(OPENAI_CONFIG.API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_CONFIG.MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript },
      ],
      max_tokens: OPENAI_CONFIG.MAX_TOKENS,
      temperature: OPENAI_CONFIG.TEMPERATURE,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to summarize using OpenAI.');
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

function getSystemPrompt(style, language) {
  const prompt = style === 'bullet-points' ? PROMPTS.BULLET_POINTS
    : style === 'summary' ? PROMPTS.SUMMARY
      : style === 'detailed-summary' ? PROMPTS.DETAILED
        : PROMPTS.BULLET_POINTS;

  return `${prompt} Send back only HTML tags, without 'html' and ''. Use ${language} as the response language, where ${language} is a variable (e.g., 'russian', 'english'). If ${language} is empty or undefined, detect the most relevant language based on context..`
}

// UI Components
function addSummarizeButton() {
  injectStyles();

  const intervalId = setInterval(async () => {
    const actionsContainer = document.querySelector('#actions');
    if (!actionsContainer || document.querySelector('#summarize-button')) return;

    clearInterval(intervalId);
    const button = createSummarizeButton();
    actionsContainer.appendChild(button);
    await updateButtonState();
    console.log('Summarize button added!');
  }, 500);
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = UI_STYLES.ANIMATIONS;
  document.head.appendChild(style);
}

function createSummarizeButton() {
  const button = document.createElement('button');
  button.id = 'summarize-button';
  button.innerHTML = getButtonContent('Summarize');
  Object.assign(button.style, getButtonStyles());

  addButtonEventListeners(button);
  return button;
}

function getButtonStyles() {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 10px',
    ...UI_STYLES.BUTTON.DEFAULT,
    color: 'white',
    border: 'none',
    borderRadius: '18px',
    fontSize: '14px',
    marginInline: '6px',
    height: '36px',
    lineHeight: 'normal',
    transition: 'background-color 0.2s ease',
  };
}

function addButtonEventListeners(button) {
  button.addEventListener('mouseenter', () => handleButtonHover(button, true));
  button.addEventListener('mouseleave', () => handleButtonHover(button, false));
  button.addEventListener('click', () => handleButtonClick(button));
}

function handleButtonHover(button, isEnter) {
  if (!button.disabled) {
    const currentColor = button.style.backgroundColor;
    if (currentColor === 'rgb(255, 69, 0)' || currentColor === '#ff4500') {
      button.style.backgroundColor = isEnter ? '#e03c00' : '#ff4500';
    } else if (currentColor === 'rgb(128, 128, 128)' || currentColor === '#808080') {
      button.style.backgroundColor = isEnter ? '#666666' : '#808080';
    }
  }
}

async function getTranscript(videoId) {
  try {
    const transcript = await window.YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map(entry => entry.text).join(' ');
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw new Error('Failed to fetch transcript.');
  }
}

async function handleButtonClick(button) {
  const videoId = new URLSearchParams(window.location.search).get('v');
  if (!videoId) {
    alert('Could not retrieve video ID.');
    return;
  }

  if (summarizedVideos.has(videoId)) {
    const existingSummary = document.querySelector('#summary-div');
    if (existingSummary) {
      existingSummary.scrollIntoView({ behavior: 'smooth', block: 'center' });
      existingSummary.style.animation = 'highlight 1s ease';
    }
    return;
  }

  const existingSummary = document.querySelector('#summary-div');
  if (existingSummary) {
    existingSummary.remove();
  }

  button.disabled = true;
  const originalContent = button.innerHTML;
  button.innerHTML = `
    <span style="
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 100%;
    ">
      <div class="spinner" style="
        width: 10px;
        height: 10px;
        border: 2px solid white;
        border-top: 2px solid transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 8px;
      "></div>
      Summarizing...
    </span>
  `;
  button.style.backgroundColor = UI_STYLES.BUTTON.PROCESSING.backgroundColor;

  try {
    const transcript = await getTranscript(videoId);
    const summary = await fetchSummary(transcript);
	
    button.innerHTML = getButtonContent('Summarized', true);
    button.style.backgroundColor = UI_STYLES.BUTTON.SUCCESS.backgroundColor;
    displaySummary(summary);
    summarizedVideos.add(videoId);
  } catch (error) {
    console.error('Error fetching or summarizing:', error);
    alert('Failed to fetch or summarize the transcript.');
    button.innerHTML = originalContent;
    button.style.backgroundColor = UI_STYLES.BUTTON.DEFAULT.backgroundColor;
    button.disabled = false;
  }
}

function displaySummary(summary) {
  const summaryDiv = document.createElement('div');
  summaryDiv.id = 'summary-div';
  summaryDiv.style = UI_STYLES.SUMMARY;
  summaryDiv.innerHTML = '<b>Summary</b><br/>';
  summaryDiv.innerHTML += summary;

  const actionsContainer = document.querySelector('#middle-row');
  if (actionsContainer) {
    actionsContainer.appendChild(summaryDiv);
  }
}

// Initialize the button and observe page changes
addSummarizeButton();