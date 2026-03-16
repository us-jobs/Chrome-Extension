import { marked } from 'marked';
import { getAuthToken, checkUsage } from '../utils/auth';

interface ErrorPayload {
  message: string;
  stackTrace: any[];
  url?: string;
  tabId?: number;
}

let latestError: ErrorPayload | null = null;

// UI Elements
const waitingState = document.getElementById('state-waiting')!;
const loadingState = document.getElementById('state-loading')!;
const resultState = document.getElementById('state-result')!;

const loadingErrorEl = document.getElementById('loading-error')!;
const loadingStreamEl = document.getElementById('loading-stream')!;
const resultErrorEl = document.getElementById('result-error')!;
const explanationContentEl = document.getElementById('explanation-content')!;
const latestErrorPreview = document.getElementById('latest-error-preview')!;
const feedbackActionsEl = document.getElementById('feedback-actions')!;

function switchState(state: 'waiting' | 'loading' | 'result') {
  waitingState.classList.remove('active');
  loadingState.classList.remove('active');
  resultState.classList.remove('active');
  
  if (state === 'waiting') waitingState.classList.add('active');
  if (state === 'loading') loadingState.classList.add('active');
  if (state === 'result') resultState.classList.add('active');
}

document.getElementById('btn-cancel')?.addEventListener('click', () => switchState('waiting'));
document.getElementById('btn-close')?.addEventListener('click', () => switchState('waiting'));

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "DEBUGGER_ERROR" || message.type === "UNCAUGHT_EXCEPTION") {
    latestError = message.payload;
    renderInjectButton(latestError!);
  }
});

function renderInjectButton(payload: ErrorPayload) {
  latestErrorPreview.innerHTML = `
    <div class="error-card">
      <strong style="color: var(--error-color)">[New Error Detected]</strong><br/><br/>
      ${payload.message.slice(0, 150)}${payload.message.length > 150 ? '...' : ''}
      <br />
      <button id="btn-explain-latest" class="errorlens-explain-btn">Explain ↗</button>
    </div>
  `;
  document.getElementById('btn-explain-latest')?.addEventListener('click', () => handleExplainClick(payload));
}

async function handleExplainClick(errorPayload: ErrorPayload) {
  switchState('loading');
  loadingErrorEl.textContent = errorPayload.message;
  loadingStreamEl.innerHTML = '';
  explanationContentEl.innerHTML = '';
  feedbackActionsEl.style.display = 'none';
  
  // Try dummy token for phase 1 testing
  const token = await getAuthToken();
  const usageOk = await checkUsage(token);
  
  if (!usageOk) {
    switchState('result');
    explanationContentEl.innerHTML = `<p style="color:red;">Daily limit reached. Please upgrade to Pro.</p>`;
    return;
  }
  
  try {
    const response = await fetch("http://localhost:3000/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, 
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({
        error: errorPayload.message,
        stackTrace: errorPayload.stackTrace,
        url: errorPayload.url,
        userAgent: navigator.userAgent
      })
    });

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    switchState('result');
    resultErrorEl.textContent = errorPayload.message;
    
    let markdownAcc = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              markdownAcc += parsed.text;
              explanationContentEl.innerHTML = marked.parse(markdownAcc) as string;
            } else if (parsed.error) {
              explanationContentEl.innerHTML += `<br/><b style="color:red">Error:</b> ${parsed.error}`;
            }
          } catch (e) {}
        }
      }
    }
    
    // Finished streaming
    feedbackActionsEl.style.display = 'block';

  } catch (err) {
    console.error(err);
    switchState('result');
    resultErrorEl.textContent = errorPayload.message;
    explanationContentEl.innerHTML = `<p style="color: var(--error-color);">Failed to connect to ErrorLens API. Ensure local server is running on port 3000.</p>`;
  }
}

// Copy button
document.getElementById('btn-copy')?.addEventListener('click', () => {
    navigator.clipboard.writeText(explanationContentEl.innerText);
    const btn = document.getElementById('btn-copy')!;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
});

// Initial check for session data
if (chrome.storage && chrome.storage.session) {
  chrome.storage.session.get(['latestError'], (result) => {
    if (result.latestError) {
      latestError = result.latestError.payload;
      renderInjectButton(latestError!);
    }
  });
}

// Feedback buttons
document.getElementById('btn-thumbs-up')?.addEventListener('click', () => sendFeedback('THUMBS_UP'));
document.getElementById('btn-thumbs-down')?.addEventListener('click', () => sendFeedback('THUMBS_DOWN'));

async function sendFeedback(rating: 'THUMBS_UP' | 'THUMBS_DOWN') {
  const btnUp = document.getElementById('btn-thumbs-up') as HTMLButtonElement;
  const btnDown = document.getElementById('btn-thumbs-down') as HTMLButtonElement;
  btnUp.disabled = true;
  btnDown.disabled = true;
  
  if (rating === 'THUMBS_UP') {
    btnUp.textContent = '✅ Thanks!';
  } else {
    btnDown.textContent = '❌ Noted';
  }
}

