# 🔍 ErrorLens — AI-Powered Console Error Explainer

> **Codex Instructions:** This is your complete build specification. Read every section before writing a single line of code. Follow the implementation order in Section 12 exactly. The entire MVP can be shipped in 2–3 days — stay focused on what's described here and nothing else.

---

## 📋 Table of Contents

1. [Product Overview](#1-product-overview)
2. [How It Works — User Flow](#2-how-it-works)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Chrome Extension — Build Spec](#5-chrome-extension)
6. [Backend API — Build Spec (Render)](#6-backend-api)
7. [Gemini AI Integration](#7-gemini-ai-integration)
8. [UI / UX Specification](#8-uiux)
9. [Freemium & Usage System](#9-freemium)
10. [Database Schema](#10-database-schema)
11. [Environment Variables](#11-environment-variables)
12. [Implementation Order](#12-implementation-order)
13. [Deployment — Render.com](#13-deployment)
14. [Testing Checklist](#14-testing)

---

## 1. Product Overview <a name="1-product-overview"></a>

**Product Name:** ErrorLens  
**Type:** Chrome Extension (Manifest V3) + Node.js backend on Render.com  
**AI Model:** Google Gemini 2.5 Flash (`gemini-2.5-flash`)  
**Purpose:** Inject an "Explain this error ↗" button into Chrome DevTools' Console panel. When clicked, it sends the error message + stack trace to Gemini 2.5 Flash and streams a plain-English explanation + step-by-step fix back to the developer — without leaving the browser.

**Core Problem Solved:**  
Developers copy-paste console errors into ChatGPT/Google 50+ times per day. ErrorLens makes that 1 click, inline, in 3 seconds.

**Target Users:** Frontend developers, full-stack developers, junior engineers learning to debug.

**Monetization:**
- Free: 20 explanations/day
- Pro ($8/month): unlimited explanations + history + team sharing

---

## 2. How It Works — User Flow <a name="2-how-it-works"></a>

```
1. Developer opens Chrome DevTools → Console tab
2. An error appears in the console (e.g. "TypeError: Cannot read properties of undefined")
3. ErrorLens injects an "Explain ↗" button next to that error line
4. Developer clicks "Explain ↗"
5. Extension captures: error message + stack trace + current page URL + browser/OS info
6. Extension sends payload to ErrorLens backend (Render.com)
7. Backend calls Gemini 2.5 Flash API with a structured prompt
8. Gemini streams response back to backend
9. Backend streams response back to extension via SSE (Server-Sent Events)
10. Extension renders the explanation in a styled panel BELOW the error line in DevTools
11. Panel shows: plain-English explanation + root cause + step-by-step fix + code snippet
12. Developer can: copy fix, thumbs up/down, open full history in popup
```

**Key design rule:** Everything happens inside DevTools. The developer never needs to open a new tab.

---

## 3. Tech Stack <a name="3-tech-stack"></a>

```
Chrome Extension:
  - Manifest V3
  - Vanilla TypeScript (no framework — keeps the extension lightweight)
  - Chrome DevTools Protocol (CDP) via chrome.debugger API for console interception
  - Vite for bundling

Backend (hosted on Render.com):
  - Node.js 20 + Express 4
  - TypeScript
  - Google Generative AI SDK (@google/generative-ai)
  - Redis (Render Key Value — free tier) for rate limiting + usage counters
  - PostgreSQL (Render Postgres — free tier) for user accounts + history
  - Prisma ORM
  - Server-Sent Events (SSE) for streaming Gemini responses to the extension

Auth:
  - JWT (jsonwebtoken) — stateless, no session store needed
  - Google OAuth 2.0 (sign in with Google — fits the dev audience)

Deployment:
  - Render.com (free tier for MVP — web service + postgres + redis)
  - UptimeRobot pings /healthz every 5 min to prevent Render free tier sleep
```

---

## 4. Project Structure <a name="4-project-structure"></a>

```
errorlens/
├── extension/                          # Chrome Extension (MV3)
│   ├── manifest.json
│   ├── src/
│   │   ├── devtools/
│   │   │   ├── devtools.html           # DevTools page entry point
│   │   │   ├── devtools.ts             # Registers the panel + listens to console
│   │   │   └── panel.html             # The ErrorLens side panel inside DevTools
│   │   ├── panel/
│   │   │   ├── panel.ts               # Panel logic: renders explanations, history
│   │   │   ├── explainer.ts           # Calls backend, handles SSE stream
│   │   │   └── ui.ts                  # DOM helpers: inject buttons, render markdown
│   │   ├── background/
│   │   │   └── service-worker.ts      # Auth token management, message routing
│   │   ├── popup/
│   │   │   ├── popup.html             # Extension popup (usage stats, settings, login)
│   │   │   └── popup.ts
│   │   └── utils/
│   │       ├── api.ts                 # Typed fetch wrapper for backend calls
│   │       ├── auth.ts                # Token storage + refresh
│   │       ├── storage.ts             # chrome.storage.local wrapper
│   │       └── types.ts               # Shared TypeScript types
│   ├── public/
│   │   └── icons/                     # icon16.png, icon32.png, icon48.png, icon128.png
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── index.ts                   # Express app entry point
│   │   ├── routes/
│   │   │   ├── explain.ts             # POST /explain — main AI endpoint
│   │   │   ├── auth.ts                # POST /auth/google, POST /auth/refresh
│   │   │   ├── usage.ts               # GET /usage — credit balance
│   │   │   └── history.ts             # GET /history, DELETE /history/:id
│   │   ├── services/
│   │   │   ├── gemini.ts              # Gemini 2.5 Flash integration + streaming
│   │   │   ├── rateLimit.ts           # Redis-based per-user rate limiter
│   │   │   └── prompt.ts              # Prompt builder (assembles context for Gemini)
│   │   ├── middleware/
│   │   │   ├── auth.ts                # JWT verification middleware
│   │   │   └── errorHandler.ts        # Global error handler
│   │   └── lib/
│   │       ├── prisma.ts              # Prisma client singleton
│   │       └── redis.ts               # Redis client singleton
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env.example
│   ├── tsconfig.json
│   ├── package.json
│   └── render.yaml                    # Render deployment config
│
└── README.md                          # ← You are here
```

---

## 5. Chrome Extension — Build Spec <a name="5-chrome-extension"></a>

### 5.1 manifest.json

```json
{
  "manifest_version": 3,
  "name": "ErrorLens — AI Console Error Explainer",
  "version": "1.0.0",
  "description": "One-click AI explanations for any console error. Powered by Gemini 2.5 Flash.",
  "permissions": [
    "storage",
    "identity",
    "debugger"
  ],
  "host_permissions": [
    "https://errorlens-api.onrender.com/*",
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "devtools_page": "devtools/devtools.html",
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### 5.2 DevTools Page Architecture

Chrome Extensions cannot directly inject into DevTools. The correct architecture is:

```
devtools.html  →  devtools.ts
  └── chrome.devtools.panels.create()  →  creates a panel INSIDE DevTools
  └── chrome.devtools.console.onMessage.addListener()  →  intercepts console messages
```

**devtools.ts — implement exactly this:**

```typescript
// devtools.ts
// This script runs in the special DevTools context

// Step 1: Create the ErrorLens panel inside DevTools
chrome.devtools.panels.create(
  "ErrorLens",                    // Panel tab title
  "/icons/icon16.png",            // Panel tab icon
  "/panel/panel.html",            // Panel HTML content
  (panel) => {
    console.log("ErrorLens panel created");
  }
);

// Step 2: Listen for ALL console messages (errors, warnings, logs)
chrome.devtools.console.onMessage.addListener((message, level) => {
  // Only process errors and warnings
  if (level === "error" || level === "warning") {
    // Forward to the panel via chrome.runtime messaging
    chrome.runtime.sendMessage({
      type: "CONSOLE_MESSAGE",
      payload: {
        text: message,
        level: level,
        timestamp: Date.now(),
        url: chrome.devtools.inspectedWindow.tabId
      }
    });
  }
});
```

**IMPORTANT NOTE FOR CODEX:** `chrome.devtools.console.onMessage` gives us the console message text but NOT the stack trace. To get the full stack trace, we also need to use the Chrome Debugger API. See Section 5.3 below.

### 5.3 Stack Trace Capture via Chrome Debugger API

To get full stack traces (not just the error text), use `chrome.debugger`:

```typescript
// background/service-worker.ts

// Attach debugger to the inspected tab when DevTools opens
async function attachDebugger(tabId: number) {
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    await chrome.debugger.sendCommand({ tabId }, "Runtime.enable");
    await chrome.debugger.sendCommand({ tabId }, "Console.enable");
  } catch (e) {
    console.error("Debugger attach failed:", e);
  }
}

// Listen for console API calls (which include stack traces)
chrome.debugger.onEvent.addListener((source, method, params: any) => {
  if (method === "Runtime.consoleAPICalled" && params.type === "error") {
    const errorData = {
      type: "DEBUGGER_ERROR",
      payload: {
        message: params.args?.[0]?.value || "Unknown error",
        stackTrace: params.stackTrace?.callFrames?.map((frame: any) => ({
          functionName: frame.functionName,
          url: frame.url,
          lineNumber: frame.lineNumber,
          columnNumber: frame.columnNumber
        })) || [],
        timestamp: Date.now(),
        tabId: source.tabId
      }
    };
    // Store in chrome.storage for the panel to read
    chrome.storage.session.set({ latestError: errorData });
    // Also notify the panel
    chrome.runtime.sendMessage(errorData);
  }
});

// Handle exceptions too
chrome.debugger.onEvent.addListener((source, method, params: any) => {
  if (method === "Runtime.exceptionThrown") {
    const exception = params.exceptionDetails;
    const errorData = {
      type: "UNCAUGHT_EXCEPTION",
      payload: {
        message: exception.exception?.description || exception.text,
        stackTrace: exception.stackTrace?.callFrames?.map((frame: any) => ({
          functionName: frame.functionName,
          url: frame.url,
          lineNumber: frame.lineNumber,
          columnNumber: frame.columnNumber
        })) || [],
        url: exception.url,
        lineNumber: exception.lineNumber,
        timestamp: Date.now(),
        tabId: source.tabId
      }
    };
    chrome.storage.session.set({ latestError: errorData });
    chrome.runtime.sendMessage(errorData);
  }
});
```

### 5.4 Panel UI (panel.ts)

The panel renders inside the DevTools window. It has three views:

**View 1: Waiting State** — shows when no error is selected
```
┌─────────────────────────────────────────┐
│  🔍 ErrorLens                           │
│                                         │
│  Watching for console errors...         │
│  Click "Explain ↗" on any error above   │
│                                         │
│  [20 free explanations today] ⚡        │
└─────────────────────────────────────────┘
```

**View 2: Loading State** — after clicking Explain, while streaming
```
┌─────────────────────────────────────────┐
│  🔍 ErrorLens                  [✕ Close]│
│─────────────────────────────────────────│
│  TypeError: Cannot read properties...   │
│                                         │
│  ⣾ Analyzing with Gemini 2.5 Flash...  │
│                                         │
└─────────────────────────────────────────┘
```

**View 3: Result State** — streamed explanation renders progressively
```
┌─────────────────────────────────────────┐
│  🔍 ErrorLens            [Copy] [✕]    │
│─────────────────────────────────────────│
│  ❌ TypeError: Cannot read properties   │
│     of undefined (reading 'map')        │
│─────────────────────────────────────────│
│  📖 What happened                       │
│  You're calling .map() on a variable    │
│  that is undefined. This usually means  │
│  your data hasn't loaded yet when the   │
│  component renders.                     │
│                                         │
│  🔎 Root cause                          │
│  Line 47 in UserList.jsx — `users` is   │
│  undefined on the first render because  │
│  the API call is async.                 │
│                                         │
│  ✅ How to fix                          │
│  Add a null check before mapping:       │
│                                         │
│  const list = users?.map(u => ...)      │
│  // or                                  │
│  if (!users) return <Loading />;        │
│                                         │
│  👍  👎  [View history]                 │
└─────────────────────────────────────────┘
```

**panel.ts — key implementation details:**

```typescript
// panel.ts

// Listen for errors forwarded from the service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "DEBUGGER_ERROR" || message.type === "UNCAUGHT_EXCEPTION") {
    addErrorToQueue(message.payload);
    renderInjectButton(message.payload);
  }
});

// When "Explain ↗" is clicked:
async function handleExplainClick(errorPayload: ErrorPayload) {
  showLoadingState();
  
  const token = await getAuthToken();       // From chrome.storage
  const usageOk = await checkUsage(token);  // Check credit balance first
  
  if (!usageOk) {
    showUpgradePrompt();
    return;
  }
  
  // Start streaming from backend
  const response = await fetch("https://errorlens-api.onrender.com/explain", {
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

  // Handle SSE stream — render tokens as they arrive
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  clearLoadingState();
  startStreamingPanel();
  
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
          appendToPanel(parsed.text);  // Append each token to the panel
        } catch {}
      }
    }
  }
  
  finishStreamingPanel();  // Show thumbs up/down, copy button
}
```

### 5.5 "Explain ↗" Button Injection

There are TWO ways to inject the button — implement BOTH:

**Method A: Via DevTools Panel** (primary)
- The panel always shows the latest error with an "Explain" button at the top
- This is the most reliable method since panels are first-class DevTools citizens

**Method B: Toast notification** (enhancement)
- When a new error fires, show a subtle toast at the bottom of the DevTools window
- Toast shows: error text truncated to 60 chars + "Explain ↗" button
- Toast auto-dismisses after 8 seconds if not clicked

### 5.6 Popup (popup.ts)

The extension popup (clicking the toolbar icon) shows:

```
┌─────────────────────────────────────────┐
│  🔍 ErrorLens                           │
│─────────────────────────────────────────│
│  Hi, John 👋            [Sign out]      │
│                                         │
│  Today's usage                          │
│  ████████░░  16 / 20 free              │
│                                         │
│  [⚡ Upgrade to Pro — unlimited]        │
│─────────────────────────────────────────│
│  Recent explanations                    │
│  • TypeError: Cannot read...   2m ago   │
│  • ReferenceError: x is...    14m ago   │
│  • 404 /api/users not found   1h ago    │
│                                         │
│  [View all history →]                   │
│─────────────────────────────────────────│
│  Settings                               │
│  [■] Auto-explain errors               │
│  [■] Show in DevTools panel            │
│  [ ] Dark theme override               │
└─────────────────────────────────────────┘
```

If not logged in, show:
```
┌─────────────────────────────────────────┐
│  🔍 ErrorLens                           │
│                                         │
│  [Sign in with Google]                  │
│                                         │
│  Or use as guest (20/day limit)         │
└─────────────────────────────────────────┘
```

---

## 6. Backend API — Build Spec <a name="6-backend-api"></a>

### 6.1 Express App Setup (index.ts)

```typescript
// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import { explainRouter } from './routes/explain';
import { authRouter } from './routes/auth';
import { usageRouter } from './routes/usage';
import { historyRouter } from './routes/history';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors({
  origin: [
    'chrome-extension://*',        // Allow all Chrome extensions (needed for MV3)
    'http://localhost:5173'        // Local dev
  ],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/explain', explainRouter);
app.use('/auth', authRouter);
app.use('/usage', usageRouter);
app.use('/history', historyRouter);

// Health check — REQUIRED for UptimeRobot to keep Render free tier alive
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ErrorLens API running on port ${PORT}`));

export default app;
```

### 6.2 Main Explain Route (routes/explain.ts)

This is the core route. It:
1. Validates the JWT
2. Checks rate limit (Redis)
3. Calls `gemini.ts` streaming function
4. Pipes the Gemini stream to the HTTP response as SSE
5. Saves the explanation to PostgreSQL (async, non-blocking)

```typescript
// backend/src/routes/explain.ts
import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { checkAndDecrementRateLimit } from '../services/rateLimit';
import { streamExplanation } from '../services/gemini';
import { buildPrompt } from '../services/prompt';
import { prisma } from '../lib/prisma';

const router = Router();

router.post('/', verifyToken, async (req: Request, res: Response) => {
  const { error, stackTrace, url, userAgent } = req.body;
  const userId = req.user?.id || req.ip;  // Use IP for guest users

  // Validate input
  if (!error || typeof error !== 'string') {
    return res.status(400).json({ error: 'error field is required' });
  }

  // Check rate limit
  const allowed = await checkAndDecrementRateLimit(userId, req.user?.plan || 'free');
  if (!allowed) {
    return res.status(429).json({
      error: 'Daily limit reached',
      message: 'You have used all 20 free explanations today. Upgrade to Pro for unlimited access.',
      upgradeUrl: 'https://errorlens.dev/upgrade'
    });
  }

  // Set SSE headers — keeps the connection open for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // Disable Nginx buffering on Render
  res.flushHeaders();

  // Build the prompt
  const prompt = buildPrompt({ error, stackTrace, url, userAgent });

  // Stream Gemini response
  let fullResponse = '';
  
  try {
    const stream = streamExplanation(prompt);
    
    for await (const chunk of stream) {
      const text = chunk.text();
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    
    res.write(`data: [DONE]\n\n`);
    res.end();

    // Save to history async — non-blocking
    if (req.user?.id) {
      prisma.explanation.create({
        data: {
          userId: req.user.id,
          errorText: error.slice(0, 500),
          stackTrace: JSON.stringify(stackTrace || []),
          explanation: fullResponse,
          pageUrl: url || '',
        }
      }).catch(console.error);
    }

  } catch (err: any) {
    console.error('Gemini stream error:', err);
    res.write(`data: ${JSON.stringify({ error: 'AI service error. Please try again.' })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
});

export { router as explainRouter };
```

### 6.3 Auth Route (routes/auth.ts)

```typescript
// backend/src/routes/auth.ts
// Implement three endpoints:

// POST /auth/google
// Body: { idToken: string }  ← Google OAuth ID token from chrome.identity
// - Verify the Google ID token using google-auth-library
// - Find or create user in PostgreSQL
// - Return: { accessToken, refreshToken, user }

// POST /auth/refresh
// Body: { refreshToken: string }
// - Verify refresh token
// - Return new accessToken
// accessToken expires in 1 hour, refreshToken expires in 30 days

// POST /auth/guest
// No body required
// - Create a temporary guest session tied to IP
// - Return: { guestToken } — grants 20 free uses/day (IP rate limited via Redis)
```

### 6.4 Rate Limit Service (services/rateLimit.ts)

```typescript
// backend/src/services/rateLimit.ts
// Uses Redis to track per-user daily usage

// Key pattern: ratelimit:{userId}:{YYYY-MM-DD}
// Value: integer (number of uses today)
// TTL: 86400 seconds (24 hours, auto-resets daily)

const DAILY_LIMITS = {
  free: 20,
  pro: Infinity,
  team: Infinity
};

export async function checkAndDecrementRateLimit(
  userId: string,
  plan: 'free' | 'pro' | 'team'
): Promise<boolean> {
  if (plan !== 'free') return true;  // Pro/Team users have no limit
  
  const today = new Date().toISOString().split('T')[0];
  const key = `ratelimit:${userId}:${today}`;
  
  const current = await redis.get(key);
  const count = parseInt(current || '0');
  
  if (count >= DAILY_LIMITS.free) return false;
  
  await redis.set(key, count + 1, 'EX', 86400);
  return true;
}

export async function getRemainingUsage(userId: string, plan: string): Promise<number> {
  if (plan !== 'free') return -1;  // -1 = unlimited
  
  const today = new Date().toISOString().split('T')[0];
  const key = `ratelimit:${userId}:${today}`;
  const current = await redis.get(key);
  return Math.max(0, 20 - parseInt(current || '0'));
}
```

---

## 7. Gemini AI Integration <a name="7-gemini-ai-integration"></a>

### 7.1 Model Configuration

```typescript
// backend/src/services/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Use gemini-2.5-flash — best price/performance, low latency, strong at code reasoning
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.2,        // Low temperature = consistent, factual debugging answers
    maxOutputTokens: 1024,   // Cap at 1024 tokens — explanations should be concise
    topP: 0.8,
  },
  safetySettings: [
    // Allow code-related content (security discussion is legitimate in debugging)
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
  ]
});

export async function* streamExplanation(prompt: string) {
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    yield chunk;
  }
}
```

### 7.2 Prompt Builder (services/prompt.ts)

The prompt is the most important part of this product. A well-structured prompt returns a well-structured explanation. Do not modify this prompt without testing.

```typescript
// backend/src/services/prompt.ts

interface PromptContext {
  error: string;
  stackTrace: StackFrame[];
  url?: string;
  userAgent?: string;
}

interface StackFrame {
  functionName?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export function buildPrompt(ctx: PromptContext): string {
  const stackTraceText = ctx.stackTrace?.length > 0
    ? ctx.stackTrace
        .slice(0, 8)  // Max 8 frames to keep prompt concise
        .map(f => `  at ${f.functionName || '<anonymous>'} (${f.url}:${f.lineNumber}:${f.columnNumber})`)
        .join('\n')
    : 'No stack trace available';

  return `You are ErrorLens, an expert debugging assistant built into Chrome DevTools. A developer has encountered a JavaScript/browser error and needs help understanding and fixing it.

## Error Details
\`\`\`
${ctx.error}
\`\`\`

## Stack Trace
\`\`\`
${stackTraceText}
\`\`\`

${ctx.url ? `## Page URL\n${ctx.url}\n` : ''}

## Your Task
Explain this error clearly and help the developer fix it. Your response MUST follow this exact structure using these exact markdown headings:

### 📖 What happened
Write 2-3 sentences in plain English explaining what the error means. No jargon. Imagine explaining to a junior developer.

### 🔎 Root cause
1 sentence identifying the most likely root cause based on the error message and stack trace. Be specific — reference file names and line numbers from the stack trace if available.

### ✅ How to fix
Provide the fix as a numbered list. Include a code snippet showing the fix if relevant. Keep it practical and copy-pasteable.

### 💡 Pro tip (optional)
Include ONE short pro tip that helps avoid this type of error in future. Only include if genuinely useful — skip this section if the fix is already self-explanatory.

## Rules
- Be concise. Total response should be under 300 words.
- Code snippets should use the same language as the error context (usually JavaScript/TypeScript).
- Do not repeat the error message back verbatim.
- Do not say "I" or "As an AI" — just give the answer.
- Use backticks for inline code.
- Never suggest "reinstall node_modules" as a first step unless there is strong evidence of a dependency issue.`;
}
```

### 7.3 Error Handling & Fallback

```typescript
// Handle common Gemini API errors gracefully in gemini.ts:

// 429 Rate limit: retry once after 2 seconds, then return friendly error
// 503 High demand: return "AI is busy right now, please try again in a moment"
// Network error: return fallback Google search link for the error

export function getFallbackResponse(error: string): string {
  const searchQuery = encodeURIComponent(error.split('\n')[0].slice(0, 100));
  return `**ErrorLens couldn't reach the AI right now.**\n\nSearch for this error: [${error.slice(0, 60)}...](https://www.google.com/search?q=${searchQuery}+site:stackoverflow.com)`;
}
```

---

## 8. UI / UX Specification <a name="8-uiux"></a>

### 8.1 Design Principles
- Match Chrome DevTools aesthetic — white/light gray in light mode, dark in dark mode
- No heavy branding — the panel should feel like a native DevTools feature
- Text streams in progressively — don't wait for the full response before showing anything
- The Explain button must be visually subtle (not distracting when you don't need it)

### 8.2 Color Tokens

```css
/* Match DevTools colors exactly */
--error-color: #d93025;      /* Red — for error header */
--warning-color: #f29900;    /* Amber — for warning */
--success-color: #1e8e3e;    /* Green — for fix section */
--code-bg: #f1f3f4;          /* Light gray — code blocks */
--border: #dadce0;           /* Divider color */

/* Dark mode (auto via prefers-color-scheme) */
@media (prefers-color-scheme: dark) {
  --code-bg: #303134;
  --border: #3c4043;
}
```

### 8.3 "Explain ↗" Button Style

```css
/* Subtle — only noticeable when you look for it */
.errorlens-explain-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  margin-left: 8px;
  font-size: 11px;
  font-family: monospace;
  color: #1a73e8;
  background: transparent;
  border: 1px solid #1a73e8;
  border-radius: 3px;
  cursor: pointer;
  vertical-align: middle;
  transition: background 0.15s;
}
.errorlens-explain-btn:hover {
  background: rgba(26, 115, 232, 0.08);
}
```

### 8.4 Markdown Rendering

Gemini returns markdown. Render it in the panel using lightweight libraries:

```typescript
// Use 'marked' library (small, fast) — npm install marked
import { marked } from 'marked';

function renderMarkdown(text: string): string {
  return marked.parse(text, { breaks: true, gfm: true }) as string;
}

// Syntax highlight code blocks with highlight.js — npm install highlight.js
// Use the 'github' theme (matches DevTools aesthetic)
```

---

## 9. Freemium & Usage System <a name="9-freemium"></a>

### Free vs Pro

| Feature | Free | Pro ($8/mo) |
|---|---|---|
| Explanations per day | 20 | Unlimited |
| History saved | Last 10 only | Full history |
| Auto-explain on error | ❌ | ✅ |
| Team sharing | ❌ | ✅ |
| Priority AI response | ❌ | ✅ |
| Custom prompt settings | ❌ | ✅ |

### Guest vs Signed In

| Feature | Guest (no account) | Signed in (free) |
|---|---|---|
| Daily limit | 20 (IP-based) | 20 (account-based) |
| History | ❌ None | ✅ Last 10 |
| Syncs across devices | ❌ | ✅ |
| Thumbs up/down feedback | ❌ | ✅ |

### Billing (Stripe — implement after MVP)
- `POST /billing/create-checkout` — creates Stripe checkout session
- `POST /billing/webhook` — handles subscription created/cancelled events
- Update `user.plan` in PostgreSQL on successful subscription
- Keep billing minimal for MVP — just the webhook + plan update is enough

---

## 10. Database Schema <a name="10-database-schema"></a>

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id               String   @id @default(cuid())
  googleId         String?  @unique
  email            String?  @unique
  name             String?
  avatarUrl        String?
  plan             Plan     @default(FREE)
  stripeCustomerId String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  explanations     Explanation[]
  feedback         Feedback[]
  
  @@index([googleId])
  @@index([email])
}

model Explanation {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  errorText   String   @db.VarChar(500)   // First 500 chars of error message
  stackTrace  String?  @db.Text           // JSON stringified stack frames
  explanation String   @db.Text           // Full Gemini response
  pageUrl     String?  @db.VarChar(500)
  
  tokensUsed  Int?                        // Track Gemini token usage for cost monitoring
  latencyMs   Int?                        // How long the full stream took
  
  createdAt   DateTime @default(now())
  
  feedback    Feedback?
  
  @@index([userId, createdAt])
}

model Feedback {
  id            String      @id @default(cuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  explanationId String      @unique
  explanation   Explanation @relation(fields: [explanationId], references: [id])
  
  rating        Rating      // THUMBS_UP or THUMBS_DOWN
  comment       String?     // Optional text feedback
  createdAt     DateTime    @default(now())
}

enum Plan   { FREE PRO TEAM }
enum Rating { THUMBS_UP THUMBS_DOWN }
```

---

## 11. Environment Variables <a name="11-environment-variables"></a>

```bash
# backend/.env  (copy from .env.example — NEVER commit .env to git)

# Server
NODE_ENV=production
PORT=3000

# Database (provided automatically by Render Postgres)
DATABASE_URL="postgresql://user:password@host/errorlens_db"

# Cache / Rate Limiting (provided automatically by Render Key Value)
REDIS_URL="redis://user:password@host:6379"

# Gemini AI — get from https://aistudio.google.com/apikey
GEMINI_API_KEY=""

# Auth
JWT_SECRET=""               # Generate with: openssl rand -base64 32
JWT_REFRESH_SECRET=""       # Generate with: openssl rand -base64 32
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="30d"

# Google OAuth — from Google Cloud Console → Credentials
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Stripe (for Pro billing — leave empty for MVP)
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRO_PRICE_ID=""

# App URL (set to your Render service URL after deploy)
APP_URL="https://errorlens-api.onrender.com"
```

```bash
# extension/.env.local  (local development only)
VITE_API_BASE_URL="http://localhost:3000"
VITE_GOOGLE_CLIENT_ID=""    # Same as backend GOOGLE_CLIENT_ID
```

---

## 12. Implementation Order <a name="12-implementation-order"></a>

Build in this exact order. Each step produces a working, testable increment.

### Phase 1: Core MVP (Day 1)
**Goal: Extension works, Gemini responds, no auth needed yet**

```
Step 1: Backend skeleton
  - Set up Express + TypeScript project in /backend
  - POST /explain endpoint (no auth for now — open endpoint for testing)
  - Gemini 2.5 Flash streaming integration (gemini.ts)
  - Prompt builder (prompt.ts)
  - SSE response piping
  - GET /healthz endpoint
  - Test with curl:
    curl -X POST localhost:3000/explain \
      -H "Content-Type: application/json" \
      -H "Accept: text/event-stream" \
      -d '{"error":"TypeError: Cannot read properties of undefined (reading map)"}'

Step 2: Extension skeleton
  - manifest.json
  - devtools.html + devtools.ts (panel creation only)
  - panel.html + panel.ts (basic UI shell — hardcode API to localhost:3000)
  - Load extension in Chrome: chrome://extensions → Developer Mode → Load Unpacked → extension/dist/

Step 3: Chrome Debugger integration
  - service-worker.ts: attach chrome.debugger to active tab
  - Capture Runtime.consoleAPICalled errors with stack traces
  - Capture Runtime.exceptionThrown
  - Forward both to panel via chrome.runtime.sendMessage
  - Test: open any page, open DevTools, throw an error in console, verify panel receives it

Step 4: Wire together end-to-end
  - Panel receives error → shows "Explain ↗" button
  - Button click → calls POST /explain → SSE stream → renders in panel
  - Test all 5 error types from Section 14

✅ MVP milestone: Full flow working locally, no auth, no rate limiting
```

### Phase 2: Auth + Rate Limiting (Day 2)
**Goal: Users can sign in, free tier enforced**

```
Step 5: Database setup
  - Prisma schema (User, Explanation, Feedback)
  - npx prisma migrate dev
  - Verify tables created

Step 6: Redis setup
  - Connect Redis client (lib/redis.ts)
  - Implement checkAndDecrementRateLimit()
  - Implement getRemainingUsage()
  - Unit test: call checkAndDecrementRateLimit 21 times, verify 21st returns false

Step 7: JWT auth middleware
  - verifyToken middleware (extracts + verifies JWT from Authorization header)
  - POST /auth/google (verify Google ID token → find/create user → return JWT)
  - POST /auth/refresh (verify refresh token → return new accessToken)
  - POST /auth/guest (IP-based guest token)

Step 8: Add auth + rate limiting to /explain
  - Add verifyToken middleware
  - Add checkAndDecrementRateLimit before calling Gemini
  - Save explanation to DB after streaming completes (async, non-blocking)
  - GET /usage → returns { remaining: number, plan: string }

Step 9: Extension auth flow
  - chrome.identity.getAuthToken() for Google OAuth
  - Store JWT + refreshToken in chrome.storage.local
  - Pass Bearer token in all /explain requests
  - Handle 401 response → call /auth/refresh → retry original request
  - Handle 403/token expired → redirect to popup login

Step 10: Popup UI
  - Sign in with Google button → triggers chrome.identity.getAuthToken()
  - Usage counter (GET /usage on popup open)
  - Recent history (GET /history — last 5 items)
  - Settings toggles (save to chrome.storage.local)
```

### Phase 3: Polish + Deploy (Day 3)
**Goal: Production-ready on Render**

```
Step 11: Markdown rendering
  - npm install marked highlight.js in extension
  - Render Gemini markdown response as styled HTML
  - Code blocks with GitHub-theme syntax highlighting
  - Ensure dark mode works correctly

Step 12: Feedback
  - Thumbs up/down buttons appear after explanation finishes rendering
  - POST /feedback { explanationId, rating } endpoint
  - Save to Feedback table
  - One feedback per explanation (unique constraint)

Step 13: Error handling
  - 429 from backend → show upgrade prompt panel with Stripe checkout link
  - Backend unreachable → show "connecting..." with retry button (cold start UX)
  - Gemini error → show fallback Google/StackOverflow search link
  - Token expired → silent refresh, retry

Step 14: Deploy to Render
  - Push to GitHub
  - Create Render Web Service (connect repo, set root dir to backend/)
  - Add Render Postgres (free tier)
  - Add Render Key Value / Redis (free tier)
  - Set all secret env vars in Render dashboard (GEMINI_API_KEY, JWT secrets, etc.)
  - Run: npx prisma migrate deploy in Render shell
  - Update extension VITE_API_BASE_URL to Render URL
  - Rebuild extension: npm run build
  - Set up UptimeRobot: ping https://errorlens-api.onrender.com/healthz every 5 min

Step 15: Chrome Web Store prep
  - Generate icons: 16px, 32px, 48px, 128px (use a magnifying glass + lightning bolt design)
  - Write store listing: 132 char description, full description, category = Developer Tools
  - Take 4 screenshots: (1) panel with explanation, (2) popup, (3) error being explained, (4) history
  - Build production bundle: npm run build in /extension
  - Zip extension/dist/ folder
  - Submit to Chrome Web Store
```

---

## 13. Deployment — Render.com <a name="13-deployment"></a>

### render.yaml

```yaml
# backend/render.yaml
services:
  - type: web
    name: errorlens-api
    env: node
    region: oregon
    plan: free
    rootDir: backend
    buildCommand: npm install && npx prisma generate && npm run build
    startCommand: node dist/index.js
    healthCheckPath: /healthz
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: errorlens-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: errorlens-redis
          type: keyValue
          property: connectionString
      - key: GEMINI_API_KEY
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: JWT_REFRESH_SECRET
        sync: false
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET
        sync: false

databases:
  - name: errorlens-db
    plan: free
    databaseName: errorlens
    user: errorlens_user
```

### ⚠️ Render Free Tier Sleep — MUST HANDLE

Render free tier services sleep after 15 minutes of inactivity, causing a 30-60 second cold start on the next request. Fix this with UptimeRobot:

1. Create free account at uptimerobot.com
2. Add HTTP(S) monitor: `https://errorlens-api.onrender.com/healthz`
3. Check interval: 5 minutes
4. This keeps the service alive 24/7 at zero cost

Also add a "cold start" UX in the extension — if the first request takes >3s, show "Warming up AI... (first request takes a moment)" instead of a generic spinner.

### One-time Deploy Commands

```bash
# Push backend to GitHub
cd errorlens
git init
git add .
git commit -m "Initial commit: ErrorLens MVP"
git remote add origin https://github.com/YOUR_USERNAME/errorlens.git
git push -u origin main

# After Render deploys, run migrations via Render Shell:
npx prisma migrate deploy

# Build extension for production
cd extension
npm run build
# Output in extension/dist/ — zip this for Chrome Web Store
```

---

## 14. Testing Checklist <a name="14-testing"></a>

Before submitting to Chrome Web Store, manually verify every item:

### Extension Core Behavior
- [ ] "ErrorLens" tab appears in Chrome DevTools after installing the extension
- [ ] Panel shows "Watching for errors..." on initial open
- [ ] Throwing `throw new Error("test")` in the console triggers the panel
- [ ] "Explain ↗" button appears and is clickable
- [ ] Loading spinner shows immediately on click
- [ ] Response streams progressively — first text appears within 2 seconds
- [ ] Full explanation renders with correct markdown formatting (headers, code blocks)
- [ ] Copy button copies full explanation text to clipboard
- [ ] Thumbs up / thumbs down saves feedback successfully
- [ ] Popup shows correct remaining usage count
- [ ] Count decrements by 1 after each explanation

### Auth & Limits
- [ ] "Sign in with Google" works in popup and persists across browser restarts
- [ ] After 20 free uses, next click shows upgrade prompt (not an error)
- [ ] Guest mode (no sign-in) works with IP-based rate limiting
- [ ] Signed-in users start fresh at 20/20 each day at midnight UTC

### Backend API
- [ ] `GET /healthz` returns `{ status: "ok" }` with 200
- [ ] `POST /explain` streams SSE response correctly
- [ ] `GET /usage` returns correct remaining count
- [ ] `GET /history` returns last 10 explanations for the user
- [ ] 21st request returns 429 with the upgrade message

### Error Scenarios
- [ ] Gemini API down → shows fallback message with StackOverflow search link
- [ ] Render service cold start → shows "warming up" message, then retries automatically
- [ ] No internet connection → shows offline error message
- [ ] Invalid JWT → silently refreshes token and retries

### Five Standard Errors to Test

Copy each of these into any webpage's browser console:

```javascript
// Test 1 — TypeError (most common error type)
const obj = null; obj.property;

// Test 2 — ReferenceError
console.log(undeclaredVariable);

// Test 3 — Async/Fetch error
fetch('https://this-domain-does-not-exist-xyz.com/api');

// Test 4 — Promise rejection
Promise.reject(new Error('Something went wrong in async code'));

// Test 5 — TypeError on array method
const data = undefined;
data.map(item => item.name);
```

All five must produce clear, useful explanations. If any explanation is confusing or wrong, adjust the prompt in `services/prompt.ts`.

---

## 🚀 Post-MVP Roadmap (Do NOT build in v1.0)

Ship v1.0 first. These are future features only:

- Auto-explain mode: automatically explain every error without clicking (Pro only)
- Multi-error context: send the last 3 related errors together for better root cause analysis
- VS Code deep link: "Open in VS Code" button that jumps to the exact error line
- Team workspace: share error history and fixes across a dev team
- Custom AI persona: let teams tune the explanation style and verbosity
- Slack integration: send error + explanation to a Slack channel automatically
- Error frequency analytics: track which errors appear most in your codebase

---

*ErrorLens — Debugging shouldn't require a Google search. It should take 1 click.*
