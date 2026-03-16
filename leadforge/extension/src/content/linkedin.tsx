import React from 'react';
import { createRoot } from 'react-dom/client';
import { ContactOverlay } from './overlay';

// LinkedIn Content Script
// Interacts purely with the DOM. Does not use private LinkedIn APIs.

// Debug marker to confirm content script is running
try {
  (window as any).leadforge_debug = true;
  if (!document.getElementById('leadforge-debug-marker')) {
    const marker = document.createElement('div');
    marker.id = 'leadforge-debug-marker';
    marker.style.display = 'none';
    document.documentElement.appendChild(marker);
  }
} catch {
  // noop
}

console.log('[LeadForge] LinkedIn Content Script Loaded.');

// State to track if we've already injected the button
let uiInjected = false;
let overlayRoot: any = null;
let intelTimer: number | null = null;
let aiTimer: number | null = null;
let companyScanTimer: number | null = null;

const scheduleIntelSend = () => {
  if (intelTimer) window.clearTimeout(intelTimer);
  intelTimer = window.setTimeout(() => {
    try {
      const intel = parseCompanyPage();
      if (intel && (intel.emails?.length || intel.phones?.length)) {
        chrome.runtime.sendMessage({
          type: 'SMART_SCRAPE_INTEL',
          data: intel,
        });
      }
    } catch (err) {
      console.warn('[LeadForge] LinkedIn intel send failed', err);
    }
  }, 800);
};

const scheduleAiExtract = () => {
  if (aiTimer) window.clearTimeout(aiTimer);
  aiTimer = window.setTimeout(() => {
    try {
      const text = (document.body?.innerText || '').slice(0, 20000);
      if (!text || text.length < 100) return;
      chrome.runtime.sendMessage({
        type: 'AI_EXTRACT_PAGE',
        data: {
          text,
          url: window.location.href.split('?')[0],
          title: document.title,
        },
      });
    } catch (err) {
      console.warn('[LeadForge] LinkedIn AI extract failed', err);
    }
  }, 1200);
};

const startCompanyPolling = () => {
  if (companyScanTimer) window.clearInterval(companyScanTimer);
  let attempts = 0;
  companyScanTimer = window.setInterval(() => {
    attempts += 1;
    try {
      const intel = parseCompanyPage();
      if (intel && (intel.emails?.length || intel.phones?.length)) {
        chrome.runtime.sendMessage({ type: 'SMART_SCRAPE_INTEL', data: intel });
        window.clearInterval(companyScanTimer!);
        companyScanTimer = null;
        return;
      }
      if (attempts >= 12) {
        window.clearInterval(companyScanTimer!);
        companyScanTimer = null;
      }
    } catch {
      // ignore
    }
  }, 3000);
};

// 1. Observe DOM changes to re-inject buttons when navigating the SPA
const observer = new MutationObserver(() => {
  const isProfilePage = window.location.href.includes('/in/');
  const isCompanyPage = window.location.href.includes('/company/');
  if (isProfilePage && !uiInjected) {
    injectLeadForgeButton();
  } else if (!isProfilePage) {
    uiInjected = false; // Reset if user navigates away from profile
    removeOverlay();
  }
  if (isCompanyPage) {
    scheduleIntelSend();
    // AI extraction is manual only now
    startCompanyPolling();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Attempt early injection on initial load, then retry a few times.
if (window.location.href.includes('/in/')) {
  // Always show a floating button immediately for visibility.
  injectFallbackButton();
  injectLeadForgeButton();
  let attempts = 0;
  const retry = setInterval(() => {
    if (uiInjected || attempts > 10) {
      clearInterval(retry);
      return;
    }
    attempts += 1;
    injectLeadForgeButton();
  }, 500);
}

if (window.location.href.includes('/company/')) {
  scheduleIntelSend();
  startCompanyPolling();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'TRIGGER_AI_EXTRACT') {
    scheduleAiExtract();
    scheduleIntelSend();
  }
});

function removeOverlay() {
  if (overlayRoot) {
    overlayRoot.unmount();
    overlayRoot = null;
    const container = document.getElementById('leadforge-overlay-root');
    if (container) container.remove();
  }
}

function showOverlay(data: any) {
  removeOverlay(); // ensure clean state

  const container = document.createElement('div');
  container.id = 'leadforge-overlay-root';
  document.body.appendChild(container);

  overlayRoot = createRoot(container);
  overlayRoot.render(
    <ContactOverlay 
      data={data} 
      onClose={removeOverlay}
      onSave={async (d) => {
        // Send actual save command to background service worker
        return new Promise((resolve) => {
           chrome.runtime.sendMessage({ type: 'SCRAPE_PROFILE', data: d }, (res) => {
             console.log('Save response:', res);
             resolve(res);
           });
        });
      }}
    />
  );
}

function findActionContainer(): HTMLElement | null {
  const selectors = [
    '.ph5.pb5 .pvs-profile-actions',
    '.pv-top-card-v2-ctas',
    '.pv-top-card__actions',
    'section.pv-top-card .pvs-profile-actions',
    'section.pv-top-card',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) return el;
  }

  // Fallback: find a nearby action button and use its parent
  const openTo = Array.from(document.querySelectorAll('button')).find((b) =>
    (b as HTMLElement).innerText.trim().toLowerCase().startsWith('open to')
  ) as HTMLElement | undefined;
  if (openTo && openTo.parentElement) return openTo.parentElement;

  const message = Array.from(document.querySelectorAll('button')).find((b) =>
    (b as HTMLElement).innerText.trim().toLowerCase() === 'message'
  ) as HTMLElement | undefined;
  if (message && message.parentElement) return message.parentElement;

  return null;
}

function createScrapeButton(variant: 'inline' | 'floating') {
  const button = document.createElement('button');
  button.id = 'leadforge-scrape-btn';
  button.innerText = 'Extract & Save';

  if (variant === 'inline') {
    button.style.cssText = `
      background-color: #2563EB;
      color: white;
      border: none;
      border-radius: 20px;
      padding: 6px 16px;
      font-weight: 600;
      font-size: 1.4rem;
      margin-left: 8px;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
  } else {
    button.style.cssText = `
      position: fixed;
      right: 24px;
      top: 90px;
      z-index: 999999;
      background-color: #7C3AED;
      color: white;
      border: none;
      border-radius: 999px;
      padding: 10px 16px;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 10px 22px rgba(124, 58, 237, 0.35);
      cursor: pointer;
      transition: background-color 0.2s, transform 0.15s;
    `;
  }

  button.onmouseover = () => button.style.backgroundColor = variant === 'floating' ? '#6D28D9' : '#1D4ED8';
  button.onmouseout = () => button.style.backgroundColor = variant === 'floating' ? '#7C3AED' : '#2563EB';
  button.onmousedown = () => button.style.transform = 'scale(0.98)';
  button.onmouseup = () => button.style.transform = 'scale(1)';

  button.addEventListener('click', async () => {
    button.innerText = 'Extracting...';
    button.disabled = true;

    const data = parseProfilePage();
    showOverlay(data);

    button.innerText = 'Extract & Save';
    button.disabled = false;
  });

  return button;
}

function injectLeadForgeButton() {
  const actionButtonContainer = findActionContainer();
  if (!actionButtonContainer || document.getElementById('leadforge-scrape-btn')) {
    return;
  }

  const button = createScrapeButton('inline');
  actionButtonContainer.appendChild(button);
  uiInjected = true;
  console.log('[LeadForge] Button Injected (inline)');
}

function injectFallbackButton() {
  if (document.getElementById('leadforge-scrape-btn')) return;
  const button = createScrapeButton('floating');
  document.body.appendChild(button);
  uiInjected = true;
  console.log('[LeadForge] Button Injected (floating)');
}

// 2. DOM Parser specific to LinkedIn Profile Pages
function parseProfilePage() {
  const data = {
    firstName: '',
    lastName: '',
    title: '',
    company: '',
    companyDomain: '',
    linkedinUrl: window.location.href.split('?')[0] // remove query params
  };

  try {
    // Name is usually an h1 element at the top
    const nameEl = document.querySelector('h1.text-heading-xlarge') as HTMLElement;
    if (nameEl && nameEl.innerText) {
      const parts = nameEl.innerText.trim().split(' ');
      data.firstName = parts[0] || '';
      data.lastName = parts.slice(1).join(' ') || '';
    }

    // Headline/Title
    const titleEl = document.querySelector('.text-body-medium.break-words') as HTMLElement;
    if (titleEl) {
      data.title = titleEl.innerText.trim();
    }

    // Company (usually the first text in the right-hand education/company list)
    const companyEl = document.querySelector('[aria-label="Current company"]') as HTMLElement;
    if (companyEl) {
      data.company = companyEl.innerText.trim();
      // Generate rudimentary domain base for matching logic (e.g. "Google" -> "google.com")
      data.companyDomain = data.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    }

  } catch (error) {
    console.warn('[LeadForge] Error parsing profile:', error);
  }

  return data;
}

function parseCompanyPage() {
  if (!window.location.href.includes('/company/')) return null;

  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/g;
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

  const title = document.title;
  const hostname = window.location.hostname.replace(/^www\./, '');
  const url = window.location.href.split('?')[0];

  const companyName = (document.querySelector('h1') as HTMLElement | null)?.innerText?.trim() || '';

  const bodyText = document.body?.innerText || '';
  const rawText = document.body?.textContent || '';
  const text = `${bodyText}\n${rawText}`
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ');

  const emails = Array.from(new Set(text.match(emailRegex) || []));
  const phones = Array.from(new Set(text.match(phoneRegex) || [])).filter(isValidPhone);

  // Definition list parsing (LinkedIn About section often uses dt/dd)
  const getDefinitionValue = (label: RegExp) => {
    const dts = Array.from(document.querySelectorAll('dt')) as HTMLElement[];
    for (const dt of dts) {
      const labelText = dt.innerText.trim();
      if (!label.test(labelText)) continue;
      const dd = dt.nextElementSibling as HTMLElement | null;
      if (dd) {
        return dd.innerText.trim();
      }
    }
    return '';
  };

  const getLabelValue = (label: RegExp) => {
    const nodes = Array.from(document.querySelectorAll('span, div, h3, h4, p')) as HTMLElement[];
    for (const node of nodes) {
      const textValue = node.innerText?.trim() || '';
      if (!label.test(textValue)) continue;
      const container = node.closest('section, div, li') || node.parentElement;
      if (!container) continue;
      const candidates = Array.from(container.querySelectorAll('a, span')) as HTMLElement[];
      for (const c of candidates) {
        const v = c.innerText?.trim() || '';
        if (!v) continue;
        if (label.test(v)) continue;
        return v;
      }
    }
    return '';
  };

  const phoneFromDefinition = getDefinitionValue(/^phone$/i) || getLabelValue(/^phone$/i);
  if (phoneFromDefinition && isValidPhone(phoneFromDefinition)) {
    phones.push(phoneFromDefinition);
  }

  // Try to find a website link near the "Website" label
  let website: string | null = null;
  const websiteFromDefinition = getDefinitionValue(/^website$/i) || getLabelValue(/^website$/i);
  if (websiteFromDefinition) {
    website = websiteFromDefinition;
  } else {
    const websiteLabel = Array.from(document.querySelectorAll('span, div, dt, h3, h4'))
      .find(el => /website/i.test(el.textContent || ''));
    if (websiteLabel) {
      const container = websiteLabel.closest('section, div') || websiteLabel.parentElement;
      const link = container?.querySelector('a[href^="http"]') as HTMLAnchorElement | null;
      if (link?.href) {
        website = link.href;
      }
    }
  }

  // Explicit tel/mail links
  const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'))
    .map(a => a.getAttribute('href')?.replace('tel:', '').split('?')[0])
    .filter(Boolean) as string[];
  const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
    .map(a => a.getAttribute('href')?.replace('mailto:', '').split('?')[0])
    .filter(Boolean) as string[];

  // Company details section parsing (About tab)
  const detailsSection = Array.from(document.querySelectorAll('section'))
    .find(section => /about|company details|overview/i.test(section.innerText || ''));
  if (detailsSection) {
    const sectionText = detailsSection.innerText || '';
    const emailsInSection = Array.from(new Set(sectionText.match(emailRegex) || []));
    const phonesInSection = Array.from(new Set(sectionText.match(phoneRegex) || [])).filter(isValidPhone);
    emails.push(...emailsInSection);
    phones.push(...phonesInSection);
  }

  return {
    emails: Array.from(new Set([...emails, ...mailtoLinks])),
    phones: Array.from(new Set([...phones, ...telLinks])).filter(isValidPhone),
    companyGuess: companyName || undefined,
    url,
    hostname,
    title,
    website,
  };
}
