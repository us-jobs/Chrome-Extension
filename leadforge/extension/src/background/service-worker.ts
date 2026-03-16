// Background Service Worker

// Types of messages we might receive
type MessageType =
  | 'SCRAPE_PROFILE'
  | 'SCRAPE_PAGE'
  | 'SCRAPE_CURRENT_PAGE'
  | 'ENRICH_CONTACT'
  | 'VERIFY_EMAIL'
  | 'SYNC_TO_CRM'
  | 'START_SEQUENCE'
  | 'GET_CREDITS'
  | 'AUTH_CHECK'
  | 'SMART_SCRAPE_INTEL'
  | 'AI_EXTRACT_PAGE'
  | 'TRIGGER_AI_EXTRACT'
  | 'INJECT_LINKEDIN';

interface MessagePayload {
  type: MessageType;
  data: any;
}

// 1. Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message: MessagePayload, sender, sendResponse) => {
  console.log(`[LeadForge Background] Received message: ${message.type}`, message.data);

  switch (message.type) {
    case 'SCRAPE_PROFILE':
      handleScrapeProfile(message.data, sendResponse);
      return true; // Keep channel open for async response
    case 'SCRAPE_CURRENT_PAGE':
      handleScrapeCurrentPage(sendResponse);
      return true;
    case 'ENRICH_CONTACT':
      handleEnrichContact(message.data, sendResponse);
      return true;
    case 'AUTH_CHECK':
      handleAuthCheck(sendResponse);
      return true;
    case 'SMART_SCRAPE_INTEL':
      handleSmartScrape(message.data, sender);
      sendResponse({ status: 'ok' });
      return false; // Sync response
    case 'AI_EXTRACT_PAGE':
      handleAiExtractPage(message.data, sender, sendResponse);
      return true;
    case 'INJECT_LINKEDIN':
      handleManualInjection(sendResponse);
      return true;
    default:
      sendResponse({ status: 'unknown_type' });
  }
});

// Fallback: ensure LinkedIn content script is injected on profile pages
const injectedTabs = new Set<number>();

function isLinkedInProfileUrl(url?: string) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname;
    const isLinkedIn = host === 'linkedin.com' || host.endsWith('.linkedin.com');
    return isLinkedIn && u.pathname.startsWith('/in/');
  } catch {
    return false;
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const url = changeInfo.url || tab.url;

  if (!isLinkedInProfileUrl(url)) {
    injectedTabs.delete(tabId);
    return;
  }

  if (injectedTabs.has(tabId)) return;

  chrome.scripting.executeScript(
    {
      target: { tabId },
      files: ['content/linkedin.js'],
    },
    () => {
      injectedTabs.add(tabId);
    }
  );
});

chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

const intelByTab: Record<number, any> = {};
const leadsByTab: Record<number, any[]> = {};
const aiErrorByTab: Record<number, string | null> = {};
const lastUrlByTab: Record<number, string> = {};

const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
const normalizePhone = (value: string) => value.replace(/[^\d+]/g, '');
const isValidPhone = (value: string) => {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value.trim())) return false;
  if (value.includes('.') && !value.startsWith('+') && !/[ \-()]/.test(value)) return false;
  const normalized = normalizePhone(value);
  const digitsOnly = normalized.replace(/\D/g, '');
  if (digitsOnly.length < 7 || digitsOnly.length > 15) return false;
  const hasSeparator = /[\s().-]/.test(value);
  const hasPlus = normalized.startsWith('+');
  if (!hasSeparator && !hasPlus) return false;
  return true;
};
const isValidEmail = (value: string) => emailRegex.test(value);

const sanitizeIntel = (intel: any) => {
  const emails = Array.from(new Set((intel.emails || []).filter((e: string) => isValidEmail(e))));
  const phones = Array.from(new Set((intel.phones || []).filter((p: string) => isValidPhone(p))));
  return { ...intel, emails, phones };
};

const sanitizeLead = (lead: any) => {
  const email = typeof lead.email === 'string' && isValidEmail(lead.email) ? lead.email.trim() : null;
  const phone = typeof lead.phone === 'string' && isValidPhone(lead.phone) ? lead.phone.trim() : null;
  return {
    name: typeof lead.name === 'string' ? lead.name.trim() : null,
    email,
    phone,
    company: typeof lead.company === 'string' ? lead.company.trim() : null,
    title: typeof lead.title === 'string' ? lead.title.trim() : null,
    sourceUrl: typeof lead.sourceUrl === 'string' ? lead.sourceUrl.trim() : null,
  };
};

function getDetailCount(data?: any) {
  if (!data) return 0;
  const emailCount = (data.emails?.length || 0) > 0 ? 1 : 0;
  const phoneCount = (data.phones?.length || 0) > 0 ? 1 : 0;
  return emailCount + phoneCount;
}

function getLeadCount(leads?: any[]) {
  if (!Array.isArray(leads)) return 0;
  return leads.filter((lead) => lead?.email || lead?.phone).length;
}

function setBadgeForTab(tabId: number | undefined, data?: any) {
  if (!tabId) return;
  const detailCount = getLeadCount(data);
  if (detailCount > 0) {
    chrome.action.setBadgeText({ text: String(detailCount), tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#2563EB', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

async function saveLeadsForTab(tabId: number, leads: any[]) {
  const sanitized = leads.map(sanitizeLead).filter((lead) => lead.email || lead.phone);
  leadsByTab[tabId] = sanitized;
  await chrome.storage.local.set({ [`leadforge_tab_leads_${tabId}`]: sanitized });
  aiErrorByTab[tabId] = null;
  await chrome.storage.local.remove(`leadforge_tab_ai_error_${tabId}`);
  await chrome.storage.local.set({
    [`leadforge_tab_ai_last_run_${tabId}`]: Date.now(),
    [`leadforge_tab_ai_last_url_${tabId}`]: lastUrlByTab[tabId] || '',
  });
  setBadgeForTab(tabId, sanitized);
}

async function handleSmartScrape(intel: any, sender: chrome.runtime.MessageSender) {
  console.log('[Background] Received generic web intel:', intel);
  const enriched = sanitizeIntel({
    ...intel,
    tabId: sender.tab?.id,
    url: intel.url || sender.tab?.url,
    title: intel.title || sender.tab?.title,
    receivedAt: Date.now(),
  });

  const existing = await chrome.storage.local.get('leadforge_last_intel');
  const prev = existing.leadforge_last_intel as any | undefined;

  const hasSignals = (data?: any) =>
    (data?.emails?.length || 0) +
    (data?.phones?.length || 0) +
    (data?.companyGuess ? 1 : 0) +
    (data?.website ? 1 : 0);

  const sameUrl = prev?.url && enriched.url && prev.url === enriched.url;
  const shouldKeepPrev =
    sameUrl && hasSignals(prev) > hasSignals(enriched);

  const nextValue = shouldKeepPrev ? { ...enriched, ...prev } : enriched;
  await chrome.storage.local.set({ leadforge_last_intel: nextValue });

  if (typeof sender.tab?.id === 'number') {
    intelByTab[sender.tab.id] = nextValue;
    await chrome.storage.local.set({ [`leadforge_tab_intel_${sender.tab.id}`]: nextValue });
  }
}

async function handleAiExtractPage(data: any, sender: chrome.runtime.MessageSender, sendResponse: (res: any) => void) {
  let tabId: number | undefined;
  try {
    tabId = sender.tab?.id;
    if (!tabId) {
      return sendResponse({ success: false, error: 'Missing tab context' });
    }

    const keyRes = await chrome.storage.local.get('leadforge_gemini_api_key');
    const apiKey = keyRes.leadforge_gemini_api_key as string | undefined;
    if (!apiKey) {
      return sendResponse({ success: false, error: 'Missing Gemini API key' });
    }

    const apiBaseUrl = 'http://localhost:3000';
    if (sender.tab?.url) {
      lastUrlByTab[tabId] = sender.tab.url;
      await chrome.storage.local.set({ [`leadforge_tab_ai_last_url_${tabId}`]: sender.tab.url });
    }
    const res = await fetch(`${apiBaseUrl}/ai/extract-leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gemini-api-key': apiKey,
      },
      body: JSON.stringify({
        text: data?.text || '',
        url: data?.url || sender.tab?.url || '',
        title: data?.title || sender.tab?.title || '',
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      aiErrorByTab[tabId] = errorText;
      await chrome.storage.local.set({
        [`leadforge_tab_ai_error_${tabId}`]: errorText,
        [`leadforge_tab_ai_last_run_${tabId}`]: Date.now(),
        [`leadforge_tab_ai_last_url_${tabId}`]: sender.tab?.url || '',
      });
      return sendResponse({ success: false, error: errorText });
    }

    const payload = await res.json();
    const leads = Array.isArray(payload?.leads) ? payload.leads : [];
    await saveLeadsForTab(tabId, leads);
    sendResponse({ success: true, count: leads.length });
  } catch (err: any) {
    console.error('[LeadForge] AI extract failed', err);
    if (tabId) {
      const msg = err?.message || 'AI extract failed';
      aiErrorByTab[tabId] = msg;
      await chrome.storage.local.set({
        [`leadforge_tab_ai_error_${tabId}`]: msg,
        [`leadforge_tab_ai_last_run_${tabId}`]: Date.now(),
        [`leadforge_tab_ai_last_url_${tabId}`]: lastUrlByTab[tabId] || '',
      });
    }
    sendResponse({ success: false, error: err?.message || 'AI extract failed' });
  }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (leadsByTab[tabId]) {
    setBadgeForTab(tabId, leadsByTab[tabId]);
  } else {
    const stored = await chrome.storage.local.get(`leadforge_tab_leads_${tabId}`);
    const data = stored[`leadforge_tab_leads_${tabId}`];
    if (Array.isArray(data)) {
      leadsByTab[tabId] = data;
    }
    setBadgeForTab(tabId, Array.isArray(data) ? data : undefined);
  }

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const currentUrl = tab?.url || '';
  const storedUrlKey = `leadforge_tab_ai_last_url_${tabId}`;
  const storedRunKey = `leadforge_tab_ai_last_run_${tabId}`;
  const storedUrl = (await chrome.storage.local.get(storedUrlKey))[storedUrlKey] as string | undefined;
  const storedRun = (await chrome.storage.local.get(storedRunKey))[storedRunKey] as number | undefined;

  if (!currentUrl) return;

  const alreadyScanned = storedRun && storedUrl === currentUrl;
  if (alreadyScanned) return;

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'TRIGGER_AI_EXTRACT' });
  } catch {
    // ignore if no content script on this tab
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    delete intelByTab[tabId];
    delete leadsByTab[tabId];
    delete aiErrorByTab[tabId];
    delete lastUrlByTab[tabId];
    chrome.storage.local.remove(`leadforge_tab_intel_${tabId}`);
    chrome.storage.local.remove(`leadforge_tab_leads_${tabId}`);
    chrome.storage.local.remove(`leadforge_tab_ai_error_${tabId}`);
    chrome.storage.local.remove(`leadforge_tab_ai_last_run_${tabId}`);
    chrome.storage.local.remove(`leadforge_tab_ai_last_url_${tabId}`);
    setBadgeForTab(tabId, undefined);
    return;
  }
  if (changeInfo.status !== 'complete') return;
  if (!intelByTab[tabId]) {
    setBadgeForTab(tabId, undefined);
  }

  chrome.tabs.sendMessage(tabId, { type: 'TRIGGER_AI_EXTRACT' }, () => {
    // ignore if no content script
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete intelByTab[tabId];
  delete leadsByTab[tabId];
  delete aiErrorByTab[tabId];
  delete lastUrlByTab[tabId];
  chrome.storage.local.remove(`leadforge_tab_intel_${tabId}`);
  chrome.storage.local.remove(`leadforge_tab_leads_${tabId}`);
  chrome.storage.local.remove(`leadforge_tab_ai_error_${tabId}`);
  chrome.storage.local.remove(`leadforge_tab_ai_last_run_${tabId}`);
  chrome.storage.local.remove(`leadforge_tab_ai_last_url_${tabId}`);
});

// 2. Handle Profile Scrapes (from LinkedIn content script)
async function handleScrapeProfile(profileData: any, sendResponse: (res: any) => void) {
  try {
    // Check if authenticated
    const token = await getAuthToken();
    if (!token) {
      return sendResponse({ success: false, error: 'Unauthorized. Please log in.' });
    }

    // Call the CRUD API we built in Phase 2
    const apiBaseUrl = 'http://localhost:3000'; // Hardcoded for local dev. Use ENV in production.
    const res = await fetch(`${apiBaseUrl}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...profileData,
        source: 'LINKEDIN',
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return sendResponse({ success: false, error: errorText });
    }

    const savedContact = await res.json();
    
    // Trigger ENRICH queue here eventually
    // ...

    // Update badge count or success
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#16A34A' }); // Success Green
    
    setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
    }, 3000);

    sendResponse({ success: true, contact: savedContact });
  } catch (err: any) {
    console.error('[LeadForge Background] Error in handleScrapeProfile:', err);
    sendResponse({ success: false, error: err.message });
  }
}

// Generic website scrape via injected script
async function handleScrapeCurrentPage(sendResponse: (res: any) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return sendResponse({ success: false, error: 'No active tab' });
    }

    const token = await getAuthToken();
    if (!token) {
      return sendResponse({ success: false, error: 'Unauthorized. Please log in.' });
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const text = document.body?.innerText || '';
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
        const emails = Array.from(new Set(text.match(emailRegex) || []));

        const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/g;
        const phones = Array.from(new Set(text.match(phoneRegex) || []));

        const mailTos = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
          .map(a => a.getAttribute('href')?.replace('mailto:', '').split('?')[0])
          .filter(Boolean) as string[];

        const combinedEmails = Array.from(new Set([...emails, ...mailTos]));

        const title = document.title || '';
        let companyGuess = '';
        if (title.includes('|')) companyGuess = title.split('|')[0].trim();
        else if (title.includes('-')) companyGuess = title.split('-')[0].trim();

        const hostname = window.location.hostname.replace(/^www\./, '');

        return {
          emails: combinedEmails,
          phones,
          companyGuess,
          url: window.location.href,
          hostname,
        };
      },
    });

    const intel = result?.result;
    if (!intel) {
      return sendResponse({ success: false, error: 'Failed to extract page data' });
    }

    const fullName = intel.companyGuess || intel.hostname || 'Website Lead';
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || 'Website';
    const lastName = parts.slice(1).join(' ') || 'Lead';

    const payload = {
      firstName,
      lastName,
      fullName,
      email: intel.emails?.[0] || null,
      phone: intel.phones?.[0] || null,
      company: intel.companyGuess || intel.hostname || null,
      companyDomain: intel.hostname || null,
      source: 'WEBSITE',
      sourceUrl: intel.url,
    };

    const apiBaseUrl = 'http://localhost:3000';
    const res = await fetch(`${apiBaseUrl}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return sendResponse({ success: false, error: errorText });
    }

    const savedContact = await res.json();
    sendResponse({ success: true, contact: savedContact });
  } catch (err: any) {
    console.error('[LeadForge] Error in handleScrapeCurrentPage:', err);
    sendResponse({ success: false, error: err?.message || 'Failed to scrape page' });
  }
}

async function handleEnrichContact(contactId: string, sendResponse: (res: any) => void) {
  // Mock enrich logic
  console.log('Enriching contact...', contactId);
  sendResponse({ success: true, status: 'queued' });
}

async function handleAuthCheck(sendResponse: (res: any) => void) {
  const token = await getAuthToken();
  if (token) {
    sendResponse({ isAuthenticated: true });
  } else {
    sendResponse({ isAuthenticated: false });
  }
}

async function handleManualInjection(sendResponse: (res: any) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return sendResponse({ success: false, error: 'No active tab' });
    }

    const exec = (details: chrome.scripting.ScriptInjection<any[], void>) =>
      new Promise<void>((resolve, reject) => {
        chrome.scripting.executeScript(details, () => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          resolve();
        });
      });

    await exec({
      target: { tabId: tab.id },
      files: ['content/linkedin.js'],
    });

    await exec({
      target: { tabId: tab.id },
      func: () => {
        try {
          if (!document.getElementById('leadforge-debug-marker')) {
            const marker = document.createElement('div');
            marker.id = 'leadforge-debug-marker';
            marker.style.display = 'none';
            document.documentElement.appendChild(marker);
          }
          document.documentElement.setAttribute('data-leadforge-injected', 'true');

          if (!document.getElementById('leadforge-scrape-btn')) {
            const btn = document.createElement('button');
            btn.id = 'leadforge-scrape-btn';
            btn.textContent = 'LeadForge Extract';
            btn.style.cssText = `
              position: fixed;
              right: 24px;
              top: 110px;
              z-index: 999999;
              background: #7C3AED;
              color: #fff;
              border: none;
              border-radius: 999px;
              padding: 10px 16px;
              font-weight: 700;
              font-size: 13px;
              box-shadow: 0 10px 22px rgba(124, 58, 237, 0.35);
            `;
            btn.onclick = () => {
              const data: any = {
                firstName: '',
                lastName: '',
                fullName: '',
                title: '',
                company: '',
                companyDomain: '',
                linkedinUrl: window.location.href.split('?')[0],
                source: 'LINKEDIN',
              };

              try {
                const nameEl = document.querySelector('h1.text-heading-xlarge') as HTMLElement | null;
                if (nameEl?.innerText) {
                  data.fullName = nameEl.innerText.trim();
                }

                const titleEl = document.querySelector('.text-body-medium.break-words') as HTMLElement | null;
                if (titleEl?.innerText) {
                  data.title = titleEl.innerText.trim();
                }

                const companyEl = document.querySelector('[aria-label="Current company"]') as HTMLElement | null;
                if (companyEl?.innerText) {
                  data.company = companyEl.innerText.trim();
                  data.companyDomain = data.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
                }
              } catch {
                // ignore parse errors
              }

              // Fallbacks for name parsing
              if (!data.fullName) {
                const titleText = document.title || '';
                const maybeName = titleText.split('|')[0]?.trim();
                if (maybeName) {
                  data.fullName = maybeName;
                }
              }

              if (data.fullName) {
                const parts = data.fullName.trim().split(/\s+/);
                data.firstName = parts[0] || '';
                data.lastName = parts.slice(1).join(' ') || '';
              }

              if (!data.firstName) data.firstName = 'Unknown';
              if (!data.lastName) data.lastName = 'Contact';

              try {
                chrome.runtime.sendMessage({ type: 'SCRAPE_PROFILE', data }, (res) => {
                  const ok = res?.success;
                  const msg = ok ? 'Saved lead' : (res?.error || 'Save failed');
                  if (!ok) {
                    console.warn('[LeadForge] Save failed:', msg);
                    return;
                  }
                  const toast = document.createElement('div');
                  toast.textContent = msg;
                  toast.style.cssText = `
                    position: fixed;
                    right: 24px;
                    top: 160px;
                    z-index: 1000000;
                    background: #16A34A;
                    color: #fff;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    box-shadow: 0 10px 22px rgba(0,0,0,0.2);
                  `;
                  document.body.appendChild(toast);
                  setTimeout(() => toast.remove(), 2500);
                });
              } catch {
                console.warn('[LeadForge] Unable to send message from injected script.');
              }
            };
            document.body.appendChild(btn);
          }
        } catch {
          // ignore
        }
      },
    });

    sendResponse({ success: true });
  } catch (err: any) {
    console.error('[LeadForge] Manual inject failed', err);
    sendResponse({ success: false, error: err?.message || 'Inject failed' });
  }
}

// Token Management via chrome.storage.session
async function getAuthToken(): Promise<string | null> {
  const data = await chrome.storage.session.get('leadforge_token');
  return (data.leadforge_token as string) || null;
}

// 3. Setup Alarms for Token Refresh
chrome.alarms.create('refreshAuthToken', { periodInMinutes: 10 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshAuthToken') {
    refreshTokensSilently();
  }
});

async function refreshTokensSilently() {
    console.log('[LeadForge Background] Silent Token Refresh stub');
}
