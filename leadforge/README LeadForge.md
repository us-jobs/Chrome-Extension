# 🔍 LeadForge — AI-Powered Lead Generation Chrome Extension

> **Codex Instructions:** This README is your complete build specification. Read it fully before writing any code. Follow every section in order. Ask for clarification only if a requirement is ambiguous — otherwise, implement exactly as described.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Problem Statement — What We're Fixing](#problem-statement)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Core Features & Functionality](#core-features)
6. [Architecture & Data Flow](#architecture)
7. [Module-by-Module Build Instructions](#modules)
8. [Database Schema](#database-schema)
9. [API Integrations](#api-integrations)
10. [UI/UX Specifications](#uiux)
11. [Security & Compliance](#security)
12. [Testing Requirements](#testing)
13. [Build & Deployment](#build-deployment)
14. [Environment Variables](#environment-variables)

---

## 1. Project Overview <a name="project-overview"></a>

**Product Name:** LeadForge  
**Type:** Chrome Extension (Manifest V3)  
**Purpose:** A lead generation and prospecting extension that works on LinkedIn, any company website, GitHub, Crunchbase, AngelList, and custom-scraped pages — with built-in email verification, phone validation, CRM sync, multi-channel outreach sequences, and GDPR compliance built from the ground up.

**Target Users:** SDRs, BDRs, Account Executives, Founders, Recruiters, Marketing teams in the US and EU.

**Core Promise:** One extension that replaces Apollo + Hunter + Lusha + Kaspr + ContactOut + Thunderbit — with better data accuracy, no monthly credit cliffs, transparent pricing, and full compliance.

---

## 2. Problem Statement — What We're Fixing <a name="problem-statement"></a>

The following are confirmed drawbacks from competitive research. Every item below MUST be directly addressed by a feature in this extension.

### ❌ Apollo.io Drawbacks → ✅ Our Fix
| Apollo Weakness | LeadForge Solution |
|---|---|
| Phone data outdated, low accuracy | Real-time phone validation via Twilio Lookup API on every number before surfacing it |
| Overwhelming UI, steep onboarding | Guided onboarding wizard (5-step), progressive feature disclosure, contextual tooltips |
| Only 5 free phone credits/month | Generous free tier: 50 lookups/day; credits roll over up to 90 days |
| Weak European data | Dedicated EU data partner integration (Kaspr API fallback for EU contacts) |
| CRM sync creates duplicates | Deduplication engine runs before every CRM write — matches on email + domain + name fuzzy match |
| Bulk sequences trigger spam filters | Built-in warm-up scheduler, send-time optimization, per-mailbox daily caps |

### ❌ Hunter.io Drawbacks → ✅ Our Fix
| Hunter Weakness | LeadForge Solution |
|---|---|
| Doesn't work on LinkedIn | Full LinkedIn + Sales Navigator + Recruiter support via DOM parsing |
| No phone numbers | Phone lookup integrated alongside email on every contact card |
| Only 10 search filters | 70+ filters including intent signals, tech stack, funding round, headcount growth |
| Guessed email patterns returned | Every email verified via SMTP + MX check before showing to user (no unverified emails surfaced) |
| No multi-step outreach sequences | Full sequence builder: email + LinkedIn DM + call tasks + SMS steps |

### ❌ Lusha Drawbacks → ✅ Our Fix
| Lusha Weakness | LeadForge Solution |
|---|---|
| $36+/user/month, very expensive | Transparent flat pricing: $29/user/month all-inclusive, no per-credit upsells |
| No email sequencing | Outreach sequences built directly into the extension — no external tool needed |
| Credits don't roll over | Credits roll over for 90 days; unused credits never expire on annual plans |
| Fewer integrations | 15+ native CRM integrations out of the box (see API Integrations section) |
| Smaller database (100M contacts) | Aggregates from 5 data sources: Clearbit, PDL, Datagma, Hunter, + scraping = 300M+ records |

### ❌ Kaspr Drawbacks → ✅ Our Fix
| Kaspr Weakness | LeadForge Solution |
|---|---|
| Small database outside EU | US, EU, APAC coverage via multi-source aggregation |
| $99/month for limited credits | Unlimited email lookups on Pro plan; phone credits pooled across team |
| Few advanced search filters | 70+ filters (same as above) |
| No outreach automation | Full multi-channel sequences (email + LinkedIn + call + SMS) |
| Confusing dashboard UI | Dashboard UX tested with 20 SDRs before launch; single-screen workflow design |

### ❌ ContactOut Drawbacks → ✅ Our Fix
| ContactOut Weakness | LeadForge Solution |
|---|---|
| Hard 300 export cap/month | Unlimited exports on Pro and Team plans; Fair-use only on Free |
| Recruiter-first UX | Two modes: Sales Mode and Recruiter Mode — toggle in settings |
| 2,000 email / 1,000 phone monthly cap | Pooled team credits on Team plan; no hard per-seat caps |
| Limited CRM integrations | 15+ CRMs supported natively (see section 9) |
| No outreach automation | Full sequences built-in |

### ❌ Thunderbit Drawbacks → ✅ Our Fix
| Thunderbit Weakness | LeadForge Solution |
|---|---|
| Steep learning curve | One-click "Smart Scrape" mode — AI detects columns automatically, no prompts needed |
| No built-in contact database | Scraped data is instantly enriched against LeadForge's aggregated database |
| Scraped emails unverified | Every email auto-verified before saving to contacts list |
| Few CRM integrations | All scraped data exports to CRM natively |
| Blocked by Cloudflare/bot protection | Stealth scraping mode with randomized request patterns and delay injection |

---

## 3. Tech Stack <a name="tech-stack"></a>

```
Extension:
  - Manifest V3 (Chrome Extension)
  - TypeScript 5.x
  - React 18 + Vite (popup & side panel UI)
  - Tailwind CSS (utility-first styling)
  - Zustand (state management)
  - React Query (async data fetching + caching)

Backend (Node.js microservices):
  - Node.js 20 + Express
  - PostgreSQL 15 (primary database)
  - Redis 7 (caching, session, rate limiting)
  - BullMQ (background job queues for scraping + verification)
  - Prisma ORM

AI / Enrichment:
  - OpenAI GPT-4o (email personalization, intent scoring, smart scrape)
  - Clearbit Enrichment API
  - People Data Labs (PDL) API
  - Twilio Lookup API (phone validation)
  - Hunter.io API (email verification fallback)

Infrastructure:
  - Docker + Docker Compose (local dev)
  - AWS (production): ECS Fargate, RDS, ElastiCache, SQS
  - Cloudflare Workers (edge caching for extension API calls)

Testing:
  - Vitest (unit tests)
  - Playwright (E2E for popup and side panel)
  - Jest + Supertest (API tests)
```

---

## 4. Project Structure <a name="project-structure"></a>

```
leadforge/
├── extension/                        # Chrome Extension (MV3)
│   ├── manifest.json
│   ├── src/
│   │   ├── background/
│   │   │   ├── service-worker.ts     # MV3 service worker
│   │   │   ├── scraper.ts            # DOM scraping logic
│   │   │   ├── enrichment.ts         # Data enrichment pipeline
│   │   │   └── crm-sync.ts           # CRM write operations
│   │   ├── content/
│   │   │   ├── linkedin.ts           # LinkedIn DOM parser
│   │   │   ├── website.ts            # Generic website scraper
│   │   │   ├── overlay.ts            # Contact card overlay injected into pages
│   │   │   └── highlight.ts          # Email/phone highlighting on pages
│   │   ├── popup/
│   │   │   ├── App.tsx               # Main popup app
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Contacts.tsx
│   │   │   │   ├── Sequences.tsx
│   │   │   │   ├── Settings.tsx
│   │   │   │   └── Onboarding.tsx
│   │   │   └── components/
│   │   │       ├── ContactCard.tsx
│   │   │       ├── SearchFilters.tsx
│   │   │       ├── SequenceBuilder.tsx
│   │   │       ├── CreditMeter.tsx
│   │   │       └── ExportPanel.tsx
│   │   ├── sidepanel/
│   │   │   └── SidePanel.tsx         # Chrome Side Panel (persistent view)
│   │   └── utils/
│   │       ├── api.ts
│   │       ├── storage.ts            # chrome.storage wrapper
│   │       ├── validators.ts
│   │       └── gdpr.ts
│   ├── public/
│   │   └── icons/
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/
│   ├── services/
│   │   ├── auth/                     # Auth service
│   │   ├── contacts/                 # Contact CRUD + enrichment
│   │   ├── verification/             # Email + phone verification
│   │   ├── sequences/                # Outreach sequence engine
│   │   ├── crm/                      # CRM integration service
│   │   ├── scrape/                   # Scraping job processor
│   │   └── billing/                  # Credits + subscription
│   ├── shared/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── types/
│   │   └── utils/
│   └── gateway/                      # API Gateway (Express)
│
├── docker-compose.yml
├── .env.example
└── README.md                         # ← You are here
```

---

## 5. Core Features & Functionality <a name="core-features"></a>

### 5.1 Contact Discovery Engine

**LinkedIn Scraping (Priority 1)**
- Parse full profile pages: name, title, company, location, connections, about, experience, education
- Parse LinkedIn Search results (bulk — up to 1,000 contacts per search)
- Parse Sales Navigator lead lists and account pages
- Parse LinkedIn Recruiter pipelines
- Inject a **LeadForge button** next to every "Connect" button on LinkedIn — one click to capture + enrich

**Website Scraping (Priority 2)**
- One-click "Smart Scrape" on any website — AI reads the page DOM and extracts all person/company data
- Detects tables, directory listings, team pages, speaker pages, board pages automatically
- Subpage crawling: follows pagination and "Load More" up to 10 pages automatically
- Scheduled recurring scrapes (set-and-forget)

**Supported Platforms (build content scripts for each):**
- LinkedIn (profiles, search, Sales Navigator, Recruiter)
- GitHub (profile pages — for developer targeting)
- Crunchbase (founders, executives, funding data)
- AngelList / Wellfound (startup team pages)
- Any generic website (smart scrape fallback)

### 5.2 Data Enrichment Pipeline

Every captured contact goes through this pipeline automatically (async, non-blocking):

```
1. Deduplicate against existing contacts (email + domain + fuzzy name)
2. Email enrichment:
   a. Check LeadForge database cache first
   b. Query Clearbit Enrichment API
   c. Fallback to People Data Labs
   d. Fallback to pattern generation + SMTP verification
3. Phone enrichment:
   a. Check LeadForge database cache
   b. Query PDL for phone
   c. Validate EVERY phone number via Twilio Lookup API before storing
   d. Store: number, type (mobile/direct/office), carrier, country, validity status
4. Company enrichment:
   a. Clearbit Company API: size, industry, tech stack, funding, revenue range
   b. LinkedIn company page scrape (if available)
5. Intent scoring:
   a. GPT-4o analyzes recent LinkedIn activity, job postings, tech stack
   b. Score 1-100: "How likely is this account to buy right now?"
6. GDPR check:
   a. Flag EU contacts automatically (by country)
   b. Apply consent workflow if required by user's settings
7. Store enriched contact in PostgreSQL
8. Push real-time update to extension UI via WebSocket
```

### 5.3 Email & Phone Verification

**Email Verification (run before every export/outreach):**
- Syntax check
- MX record lookup
- SMTP handshake (without sending)
- Disposable email detection (blocklist of 3,000+ domains)
- Role-based detection (info@, admin@, support@ flagged as low-quality)
- Confidence score: Valid / Risky / Invalid — only show Valid and Risky to users
- Bulk re-verification on demand (re-verify all contacts older than 30 days)

**Phone Validation:**
- Every phone number validated via Twilio Lookup before being surfaced to user
- Returns: validity, number type (mobile/landline/VoIP), carrier, country
- Color coding: green (mobile direct), yellow (landline/office), red (invalid/disconnected)
- Never show unvalidated phone numbers

### 5.4 Search & Filtering (70+ Filters)

Group filters into collapsible sections in the UI:

```
Person Filters:
  - Name, Title (exact + fuzzy), Seniority Level
  - Department, Function
  - Years in current role
  - Years of total experience
  - Education (university, degree)
  - Skills (from LinkedIn)
  - Location (country, state, city, radius)
  - Connection degree (1st, 2nd, 3rd+)
  - Languages spoken
  - Recently changed jobs (30/60/90 days toggle)
  - Currently hiring team (signals growth)

Company Filters:
  - Company name, domain
  - Industry (multi-select, 200+ industries)
  - Company size (headcount ranges)
  - Headcount growth rate (% in last 6 months)
  - Revenue range
  - Funding stage (Seed, Series A-F, Public, PE-backed)
  - Funding amount raised
  - Founded year range
  - Technologies used (tech stack — 500+ tech tags)
  - Hiring activity (job postings in last 30 days)
  - News mentions (recent press coverage)
  - Location (HQ country, state, city)

Intent Filters:
  - LeadForge Intent Score (1-100 slider)
  - Visiting your website (requires pixel install)
  - Recently liked/commented on competitor content
  - Job posting keywords (e.g., "Salesforce implementation")

Data Quality Filters:
  - Has verified email
  - Has validated phone
  - Has LinkedIn URL
  - Data freshness (last verified within X days)
  - Completeness score (% of fields filled)
```

### 5.5 Outreach Sequence Builder

Build multi-step, multi-channel sequences without leaving the extension:

**Supported Steps:**
- Email (via Gmail or Outlook OAuth — user's own mailbox, NOT shared sending infrastructure)
- LinkedIn Connection Request (with custom note)
- LinkedIn Direct Message
- Phone Call Task (creates reminder with script)
- SMS (via Twilio, opt-in required)
- Manual Task (custom reminder — "send gift", "attend webinar")
- Wait Step (delay: 1 hour to 30 days)
- Condition Branch (if opened → go to step A; if not → go to step B)

**Sequence Settings:**
- Per-step send window (e.g., email only sent Mon-Fri 9am-5pm in recipient's timezone)
- Auto-pause on reply detection
- Auto-unsubscribe on opt-out keyword detection ("unsubscribe", "remove me", "not interested")
- Per-mailbox daily sending cap (default: 50 emails/day, configurable)
- A/B testing: 2 variants per step, auto-optimizes toward higher open/reply rate after 50 sends

**AI Personalization:**
- GPT-4o generates personalized opening lines per contact using their LinkedIn activity, recent news, and company data
- User approves or edits AI suggestions before sending
- Tone selector: Professional / Friendly / Direct / Casual

### 5.6 CRM Sync Engine

**Native integrations (build OAuth flows for all):**
- Salesforce
- HubSpot
- Pipedrive
- Zoho CRM
- Close.io
- Copper
- Monday.com CRM
- Notion (via API)
- Airtable
- Google Sheets (lightweight CRM)

**For each CRM integration:**
- Field mapping UI: drag-and-drop LeadForge fields → CRM fields
- Deduplication: before every write, check for existing record by email + domain
- Conflict resolution: choose "LeadForge wins" or "CRM wins" per field
- Bi-directional sync: changes in CRM reflect in LeadForge and vice versa
- Sync log: full history of every create/update/skip with reason
- Webhook support: trigger sync on specific events (contact added, sequence replied, etc.)

### 5.7 Smart Scrape (AI Web Scraper)

**One-click scraping from any webpage:**
1. User clicks the LeadForge extension icon on any webpage
2. GPT-4o vision analyzes the page structure
3. AI suggests columns to extract (name, title, email, phone, company, LinkedIn URL, etc.)
4. User confirms or adjusts column suggestions
5. Extension scrapes the page + follows pagination automatically
6. Scraped data goes through the full enrichment pipeline (section 5.2)
7. User exports to CRM, Google Sheets, or CSV

**Stealth Mode (to avoid bot detection):**
- Randomize request timing (200ms–2s between actions)
- Rotate user-agent strings
- Respect robots.txt by default (option to override with user acknowledgement)
- Exponential backoff on 429 errors

### 5.8 Credit & Usage System

**Free Plan:**
- 50 contact lookups/day
- 5 email sequences/month
- 1 CRM integration
- Credits roll over for 7 days

**Pro Plan ($29/user/month):**
- Unlimited email lookups
- 500 phone validations/month (pool shared on team plans)
- Unlimited sequences
- All CRM integrations
- Credits roll over for 90 days

**Team Plan ($22/user/month, min 3 seats):**
- Everything in Pro
- Shared credit pool across team
- Team analytics dashboard
- Admin controls (user permissions, domain restrictions)
- Credits never expire on annual plan

**Credit rollover logic:**
```typescript
// Rollover credits up to 90 days (Pro) or never (Team annual)
// Run nightly via cron job
async function rolloverCredits(userId: string) {
  const account = await getAccount(userId);
  const unused = account.creditsRemaining;
  const rolloverCap = account.plan === 'team_annual' ? Infinity : account.monthlyCredits * 3;
  const newBalance = Math.min(account.creditsCarriedOver + unused, rolloverCap);
  await updateCreditBalance(userId, { carried: newBalance });
}
```

---

## 6. Architecture & Data Flow <a name="architecture"></a>

```
┌─────────────────────────────────────────────────────┐
│                  Chrome Browser                      │
│  ┌──────────────┐    ┌─────────────────────────┐    │
│  │ Content      │    │  Popup / Side Panel      │    │
│  │ Scripts      │    │  (React + Tailwind)      │    │
│  │              │    │                          │    │
│  │ - LinkedIn   │    │  - Contact list          │    │
│  │ - Websites   │◄──►│  - Sequence builder      │    │
│  │ - GitHub     │    │  - Settings              │    │
│  │ - Crunchbase │    │  - Dashboard             │    │
│  └──────┬───────┘    └────────────┬─────────────┘    │
│         │                         │                   │
│  ┌──────▼─────────────────────────▼─────────────┐    │
│  │           MV3 Service Worker                  │    │
│  │  - Message routing                            │    │
│  │  - Background enrichment queue                │    │
│  │  - Auth token management                      │    │
│  │  - CRM sync scheduling                        │    │
│  └──────────────────────┬────────────────────────┘    │
└─────────────────────────┼───────────────────────────┘
                          │ HTTPS (all calls authenticated + encrypted)
                          ▼
┌─────────────────────────────────────────────────────┐
│              LeadForge API Gateway                   │
│         (Express + Cloudflare Workers edge)          │
│                                                      │
│  /contacts    /enrich    /verify    /sequences       │
│  /crm-sync    /scrape    /billing   /auth            │
└────┬──────────┬──────────┬──────────┬───────────────┘
     │          │          │          │
     ▼          ▼          ▼          ▼
  Contacts   Enrich    Verify     Sequences
  Service    Service   Service    Service
  (CRUD)     (PDL,     (SMTP,     (BullMQ
             Clearbit, Twilio)    queue)
             GPT-4o)
     │          │          │          │
     └──────────┴──────────┴──────────┘
                     │
              ┌──────▼──────┐
              │ PostgreSQL  │    Redis (cache + queues)
              │  (primary)  │
              └─────────────┘
```

---

## 7. Module-by-Module Build Instructions <a name="modules"></a>

### Module 1: manifest.json

```json
{
  "manifest_version": 3,
  "name": "LeadForge — AI Lead Generation",
  "version": "1.0.0",
  "description": "Find, enrich, and reach out to leads on LinkedIn, any website, GitHub and more.",
  "permissions": [
    "activeTab",
    "storage",
    "identity",
    "sidePanel",
    "alarms",
    "notifications"
  ],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://sales.linkedin.com/*",
    "https://recruiter.linkedin.com/*",
    "https://github.com/*",
    "https://www.crunchbase.com/*",
    "https://wellfound.com/*",
    "https://*/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/index.html",
    "default_icon": { "32": "icons/icon32.png", "128": "icons/icon128.png" }
  },
  "side_panel": {
    "default_path": "sidepanel/index.html"
  },
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/*", "https://sales.linkedin.com/*"],
      "js": ["content/linkedin.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["<all_urls>"],
      "js": ["content/website.js"],
      "run_at": "document_idle",
      "exclude_matches": ["https://www.linkedin.com/*"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### Module 2: Background Service Worker

```typescript
// background/service-worker.ts
// Handles: message routing, auth refresh, enrichment queue, CRM sync

// Message types the service worker handles:
type MessageType =
  | 'SCRAPE_PROFILE'           // From LinkedIn content script
  | 'SCRAPE_PAGE'              // From website content script
  | 'ENRICH_CONTACT'           // Trigger enrichment pipeline
  | 'VERIFY_EMAIL'             // Verify single email
  | 'SYNC_TO_CRM'              // Push contact to CRM
  | 'START_SEQUENCE'           // Start outreach sequence
  | 'GET_CREDITS'              // Fetch credit balance
  | 'AUTH_CHECK'               // Validate session token

// Key behaviors to implement:
// 1. On SCRAPE_PROFILE: extract data from message payload, call /contacts/create API, trigger ENRICH_CONTACT
// 2. On ENRICH_CONTACT: add to BullMQ-style local queue, process sequentially to avoid rate limits
// 3. Token refresh: check token expiry every 30 minutes via chrome.alarms, refresh silently
// 4. CRM sync: batch writes every 60 seconds, max 50 contacts per batch
// 5. Show badge count (chrome.action.setBadgeText) for contacts pending review
```

### Module 3: LinkedIn Content Script

```typescript
// content/linkedin.ts
// DO NOT use LinkedIn's private APIs — parse DOM only

// Implement these parsers:
// 1. parseProfilePage(): Extract name, headline, location, company, about, experience, education, skills, connections
// 2. parseSearchResults(): Extract all contact cards from search result pages (handle lazy loading)
// 3. parseSalesNavigator(): Handle Sales Navigator's different DOM structure
// 4. injectLeadForgeButton(): Add "Save to LeadForge" button next to LinkedIn's "Connect" button
//    - Button style: matches LinkedIn's design language (don't look out of place)
//    - On click: trigger SCRAPE_PROFILE message to service worker
//    - Show loading spinner → success checkmark → credit count update
// 5. Mutation observer: re-inject buttons when LinkedIn's SPA navigates between pages

// IMPORTANT: LinkedIn's DOM changes frequently. 
// Use data-* attributes and aria labels as selectors, NOT CSS class names (they are hashed and change)
// Example: document.querySelector('[data-view-name="profile-card"]') instead of '.pv-top-card'
```

### Module 4: Contact Card Overlay

```typescript
// content/overlay.ts
// Injects a floating contact card when LeadForge finds a person on any page

// The overlay component must show:
// - Name, title, company (from page + enrichment)
// - Email (with verification badge: ✅ Valid / ⚠️ Risky / ❌ Invalid)
// - Phone (with type badge: 📱 Mobile / ☎️ Office / 🔴 Invalid)
// - LinkedIn URL (clickable)
// - Intent score (colored bar: 0-100)
// - "Save Contact" button
// - "Start Sequence" button
// - "Add to CRM" dropdown (shows connected CRMs)
// - Credit cost indicator ("1 credit")

// Overlay behavior:
// - Appears on hover over detected names/emails on any webpage
// - Draggable (user can reposition)
// - Persists on side panel even after navigating away
// - Keyboard shortcut: Escape to dismiss
```

### Module 5: React Popup App

```typescript
// popup/App.tsx
// Main popup UI — 400px wide × 600px tall

// Pages/Routes (use React Router):
// / → Dashboard: today's activity, credits remaining, recent contacts
// /contacts → Contact list with search + filters
// /sequences → Active sequences, draft sequences, sequence builder
// /settings → CRM connections, account settings, billing, GDPR settings

// Dashboard must show:
// - Contacts saved today / this week / this month
// - Credits used / remaining (with visual progress bar)
// - Rollover credits balance (shown separately)
// - Recent activity feed (last 10 actions)
// - Quick actions: "Smart Scrape this page", "Search LinkedIn", "New Sequence"
// - Onboarding progress checklist (first 7 days only)
```

### Module 6: Sequence Builder

```typescript
// popup/components/SequenceBuilder.tsx

// The sequence builder is a drag-and-drop step editor.
// Use @dnd-kit/core for drag-and-drop.

// Each step card must include:
// - Step type selector (Email / LinkedIn / Call / SMS / Wait / Condition)
// - Step number + channel icon
// - For Email steps: subject line, body (rich text editor — use TipTap)
//   + AI personalization toggle
//   + A/B variant button
//   + Send window picker (days + hours)
// - For Wait steps: duration picker (hours/days)
// - For Condition steps: if/else branch visual

// AI Personalization flow:
// 1. User enables AI toggle on an email step
// 2. System calls GPT-4o with: [contact's LinkedIn data, company news, email template]
// 3. GPT returns: personalized opening line + suggested subject line
// 4. Show in editable preview — user must approve before sending
// 5. Never auto-send AI-generated content without user approval
```

### Module 7: Deduplication Engine

```typescript
// backend/services/contacts/deduplication.ts

// Run this BEFORE every contact create/update in the database
// Matching strategy (in order of confidence):
// 1. Exact email match → definite duplicate
// 2. LinkedIn URL match → definite duplicate
// 3. Name + Company domain fuzzy match (Levenshtein distance < 3) → probable duplicate
// 4. Phone number match (normalized E.164) → definite duplicate

// If duplicate found:
// - Merge: take most recently verified data for each field
// - Log merge in audit trail
// - Return existing contact ID (don't create new record)
// - Notify user: "Updated existing contact: [Name]" instead of "Saved new contact"

// The deduplication must run in under 200ms for single contacts
// For bulk imports (1,000+ contacts), run async via BullMQ queue
```

### Module 8: GDPR Compliance Module

```typescript
// extension/utils/gdpr.ts + backend/services/contacts/gdpr.ts

// EU Detection:
// - Flag contact as EU_SUBJECT if country is in EU27 + UK, Norway, Switzerland
// - Store flag: contact.gdpr_subject = true

// Consent Workflow (configurable in settings):
// Mode 1: "Legitimate Interest" (default for B2B) — no consent email required, 
//         but must honor opt-out requests immediately
// Mode 2: "Explicit Consent" — send consent email before adding to any sequence
//         Track: consent_requested_at, consent_granted_at, consent_method

// Data Rights:
// - Right to erasure: DELETE /contacts/:id/erase — wipes all personal data, keeps anonymized stats
// - Right to access: GET /contacts/:id/export — returns full data as JSON
// - Data retention: auto-delete contacts not interacted with in 2 years (configurable)

// Audit Log:
// - Every data access, export, enrichment logged with: timestamp, action, user_id, contact_id
// - Retention: 3 years (GDPR requirement)
// - Log is immutable — no deletes allowed on audit table

// Privacy by Design:
// - Minimum data principle: only collect fields the user explicitly requests
// - No selling or sharing contact data with third parties
// - All data encrypted at rest (AES-256) and in transit (TLS 1.3)
```

---

## 8. Database Schema <a name="database-schema"></a>

```prisma
// backend/shared/prisma/schema.prisma

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  plan          Plan     @default(FREE)
  credits       Int      @default(50)
  creditsCarriedOver Int @default(0)
  createdAt     DateTime @default(now())
  contacts      Contact[]
  sequences     Sequence[]
  crmConnections CrmConnection[]
  auditLogs     AuditLog[]
}

model Contact {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  
  // Identity
  firstName         String
  lastName          String
  fullName          String
  title             String?
  seniority         String?  // C-Suite, VP, Director, Manager, IC
  
  // Contact Info
  email             String?
  emailStatus       EmailStatus @default(UNVERIFIED)
  emailVerifiedAt   DateTime?
  phone             String?      // E.164 format
  phoneType         PhoneType?   // MOBILE, LANDLINE, VOIP
  phoneValidatedAt  DateTime?
  phoneValid        Boolean?
  
  // Company
  company           String?
  companyDomain     String?
  companySize       String?
  companyIndustry   String?
  companyTechStack  String[]
  companyFunding    String?
  companyRevenue    String?
  
  // Social
  linkedinUrl       String?
  githubUrl         String?
  twitterUrl        String?
  
  // Location
  city              String?
  state             String?
  country           String?
  gdprSubject       Boolean  @default(false)
  
  // Intelligence
  intentScore       Int?     // 0-100
  intentUpdatedAt   DateTime?
  
  // Source
  source            ContactSource  // LINKEDIN, WEBSITE, MANUAL, IMPORT
  sourceUrl         String?
  
  // Consent (GDPR)
  consentStatus     ConsentStatus @default(LEGITIMATE_INTEREST)
  consentGrantedAt  DateTime?
  optedOutAt        DateTime?
  
  // Meta
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  lastEnrichedAt    DateTime?
  completenessScore Int      @default(0)  // 0-100
  
  sequenceEnrollments SequenceEnrollment[]
  crmSyncs            CrmSync[]
  auditLogs           AuditLog[]
  
  @@index([userId, email])
  @@index([userId, companyDomain])
  @@index([userId, linkedinUrl])
}

model Sequence {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String
  status      SequenceStatus @default(DRAFT)
  steps       SequenceStep[]
  enrollments SequenceEnrollment[]
  createdAt   DateTime @default(now())
}

model SequenceStep {
  id           String   @id @default(cuid())
  sequenceId   String
  sequence     Sequence @relation(fields: [sequenceId], references: [id])
  order        Int
  type         StepType  // EMAIL, LINKEDIN_DM, LINKEDIN_CONNECT, CALL, SMS, WAIT, CONDITION
  delayHours   Int       @default(0)
  subject      String?
  body         String?
  aiPersonalize Boolean @default(false)
  sendWindowStart Int?  // Hour in day (0-23)
  sendWindowEnd   Int?
  sendOnWeekends  Boolean @default(false)
  variantB     Json?     // A/B test variant
}

model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  contactId   String?
  contact     Contact? @relation(fields: [contactId], references: [id])
  action      String   // VIEWED, EXPORTED, ENRICHED, DELETED, OPTED_OUT, etc.
  metadata    Json?
  ipAddress   String?
  createdAt   DateTime @default(now())
  
  @@index([userId, createdAt])
}

enum Plan { FREE PRO TEAM ENTERPRISE }
enum EmailStatus { UNVERIFIED VALID RISKY INVALID }
enum PhoneType { MOBILE LANDLINE VOIP UNKNOWN }
enum ContactSource { LINKEDIN WEBSITE GITHUB CRUNCHBASE MANUAL IMPORT }
enum ConsentStatus { LEGITIMATE_INTEREST CONSENT_PENDING CONSENTED OPTED_OUT }
enum SequenceStatus { DRAFT ACTIVE PAUSED COMPLETED ARCHIVED }
enum StepType { EMAIL LINKEDIN_DM LINKEDIN_CONNECT CALL SMS WAIT CONDITION }
```

---

## 9. API Integrations <a name="api-integrations"></a>

### External APIs Required

| Service | Purpose | Env Var | Free Tier |
|---|---|---|---|
| OpenAI GPT-4o | Smart scrape, AI personalization, intent scoring | `OPENAI_API_KEY` | No |
| Clearbit | Company + person enrichment | `CLEARBIT_API_KEY` | 20 lookups/month |
| People Data Labs | Contact database enrichment | `PDL_API_KEY` | 100 lookups/month |
| Twilio Lookup | Phone number validation | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Pay per lookup |
| Hunter.io | Email verification fallback | `HUNTER_API_KEY` | 25 lookups/month |
| SendGrid | Transactional emails (app emails, not outreach) | `SENDGRID_API_KEY` | 100 emails/day |
| Stripe | Billing + subscriptions | `STRIPE_SECRET_KEY` | No |

### CRM OAuth Flows

For each CRM, implement:
1. OAuth 2.0 authorization flow (store tokens encrypted in PostgreSQL, never in chrome.storage)
2. Token refresh handler (silent refresh 5 minutes before expiry)
3. Field mapping configuration UI
4. Sync status indicator in Settings page

---

## 10. UI/UX Specifications <a name="uiux"></a>

### Design Principles
- **Progressive disclosure**: Show basic features first, reveal advanced on demand
- **Zero friction capture**: Saving a contact must be 1 click, never more
- **Inline feedback**: Every action shows immediate feedback (loading → success/error) within 500ms
- **Dark mode**: Support system dark mode via `prefers-color-scheme`

### Color System
```css
--primary: #2563EB;       /* Blue — primary actions */
--success: #16A34A;       /* Green — verified, valid */
--warning: #D97706;       /* Amber — risky, needs attention */
--danger:  #DC2626;       /* Red — invalid, error */
--neutral-900: #111827;   /* Primary text */
--neutral-500: #6B7280;   /* Secondary text */
--neutral-100: #F3F4F6;   /* Background */
```

### Onboarding Wizard (5 steps — shown on first install)
1. **Connect your email** (Gmail/Outlook OAuth) — required for sequences
2. **Connect your CRM** (optional — can skip) — choose from list
3. **Set your ICP** (Ideal Customer Profile) — industry, company size, title — pre-populates filters
4. **Try it on LinkedIn** — guided walkthrough: navigate to any LinkedIn profile, click the button
5. **Done** — show credit balance, link to tutorial video

---

## 11. Security & Compliance <a name="security"></a>

### Authentication
- JWT access tokens (15 min expiry) + refresh tokens (30 days, rotated on use)
- Tokens stored in `chrome.storage.session` (cleared on browser close) — NOT localStorage
- All API calls require `Authorization: Bearer <token>` header
- Rate limiting: 100 requests/minute per user via Redis sliding window

### Data Security
- All PII encrypted at rest: AES-256-GCM via AWS KMS
- TLS 1.3 for all connections
- No PII in logs — use contact IDs only in log messages
- Secrets never in code — all via environment variables

### LinkedIn Terms of Service
- Only scrape data visible to the logged-in user (no private data access)
- Respect LinkedIn's rate limits: max 100 profile views/day automated, configurable lower
- Include "Scraped by LeadForge — user-initiated" in audit logs
- Provide users with option to set manual delays between scrapes

---

## 12. Testing Requirements <a name="testing"></a>

### Unit Tests (Vitest) — minimum 80% coverage
- All utility functions (validators, normalizers, deduplication logic)
- Enrichment pipeline steps (mock external APIs)
- Credit calculation and rollover logic
- GDPR flag detection

### Integration Tests (Jest + Supertest)
- All API endpoints (happy path + error cases)
- CRM sync flows (mock CRM APIs)
- Sequence enrollment and step execution

### E2E Tests (Playwright)
- LinkedIn content script: inject button, scrape profile, show overlay
- Popup: save contact → enrich → export to CRM
- Sequence: create → enroll contact → simulate reply → auto-pause
- Onboarding wizard: complete all 5 steps

### Test Data
- Create seed scripts for: 100 sample contacts (mix of valid/invalid emails, US/EU), 3 sample sequences
- Mock all external API calls in test environment (never hit real APIs in CI)

---

## 13. Build & Deployment <a name="build-deployment"></a>

### Local Development

```bash
# Prerequisites: Node 20+, Docker, pnpm

# 1. Clone and install
git clone https://github.com/your-org/leadforge
cd leadforge
pnpm install

# 2. Start backend services
docker-compose up -d  # PostgreSQL + Redis

# 3. Run database migrations
cd backend && pnpm prisma migrate dev

# 4. Start backend in watch mode
pnpm run dev:backend

# 5. Build extension in watch mode
cd extension && pnpm run dev

# 6. Load extension in Chrome:
#    chrome://extensions → Developer Mode ON → Load Unpacked → select extension/dist/
```

### Production Build

```bash
# Build extension for Chrome Web Store submission
cd extension && pnpm run build
# Output: extension/dist/ — zip this folder for submission

# Build + deploy backend
cd backend && pnpm run build
docker build -t leadforge-api .
# Deploy to ECS Fargate via CI/CD pipeline
```

---

## 14. Environment Variables <a name="environment-variables"></a>

```bash
# backend/.env (copy from .env.example)

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/leadforge"
REDIS_URL="redis://localhost:6379"

# Auth
JWT_SECRET="your-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"

# Enrichment APIs
OPENAI_API_KEY=""
CLEARBIT_API_KEY=""
PDL_API_KEY=""
HUNTER_API_KEY=""

# Phone Validation
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""

# Email (app emails only)
SENDGRID_API_KEY=""

# Billing
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

# AWS (production)
AWS_REGION="us-east-1"
AWS_KMS_KEY_ID=""

# Extension
VITE_API_BASE_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:3000"
```

---

## 🚀 Implementation Priority Order

Codex: Build in this exact order to ensure each module has its dependencies ready.

1. **Database schema + migrations** (Prisma)
2. **Auth service** (JWT + refresh tokens)
3. **Contact CRUD API** (basic create/read/update/delete)
4. **LinkedIn content script** (DOM parsing only, no API calls yet)
5. **Background service worker** (message routing)
6. **React popup skeleton** (routing + layout, no data yet)
7. **Enrichment pipeline** (connect external APIs one at a time: Clearbit → PDL → Hunter)
8. **Email + phone verification**
9. **Deduplication engine**
10. **Contact card overlay** (inject into LinkedIn + websites)
11. **Search + filters UI**
12. **CRM integrations** (HubSpot first, then Salesforce, then others)
13. **Sequence builder UI**
14. **Sequence execution engine** (BullMQ jobs)
15. **Smart Scrape** (GPT-4o integration)
16. **GDPR compliance module**
17. **Onboarding wizard**
18. **Billing + credit system**
19. **Dashboard analytics**
20. **Tests** (unit + integration + E2E)

---

*LeadForge — Built to replace the entire lead gen stack. One extension. No compromises.*
