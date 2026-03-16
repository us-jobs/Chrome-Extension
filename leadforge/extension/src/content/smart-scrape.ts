// Smart Scrape Content Script (Fallback for generic webpages)
// Injects into generic sites defined in manifest host_permissions

console.log('[LeadForge] Smart Scrape Script Loaded.');

let lastHash = '';
let pending = false;
let lastAiHash = '';
let lastAiSentAt = 0;
let lastUrl = window.location.href;

const sendIntel = (intel: ReturnType<typeof performSmartScrape>) => {
  const hash = JSON.stringify({
    emails: intel.emails,
    phones: intel.phones,
    companyGuess: intel.companyGuess,
    url: intel.url,
  });
  if (hash === lastHash) return;
  lastHash = hash;

  console.log('[LeadForge] Smart scrape result:', intel);
  chrome.runtime.sendMessage({
    type: 'SMART_SCRAPE_INTEL',
    data: intel,
  });
};

const scanAndSend = () => {
  if (pending) return;
  pending = true;
  window.setTimeout(() => {
    pending = false;
    const intel = performSmartScrape();
    sendIntel(intel);
    // AI extraction is manual only now
  }, 750);
};

// Initial scan when the browser is idle
window.requestIdleCallback(() => {
  scanAndSend();
});

// Re-scan on dynamic DOM updates (Facebook, etc.)
const observer = new MutationObserver(() => scanAndSend());
observer.observe(document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'TRIGGER_AI_EXTRACT') {
    const intel = performSmartScrape();
    sendIntel(intel);
    sendAiExtract(intel);
  }
});

// Detect SPA url changes and re-run extraction
window.setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    lastAiHash = '';
    scanAndSend();
  }
}, 1500);

function performSmartScrape() {
  const bodyText = document.body?.innerText || '';
  const rawText = document.body?.textContent || '';
  const text = `${bodyText}\n${rawText}`
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .replace(/\u00A0/g, ' '); // non-breaking spaces
  
  // 1. Regex for standard emails
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const emails = Array.from(new Set(text.match(emailRegex) || []));

  // 2. Regex for general phone patterns (international-friendly)
  const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/g;
  const rawPhones = Array.from(new Set(text.match(phoneRegex) || []));
  const normalizePhone = (value: string) => value.replace(/[^\d+]/g, '');
  const isValidPhone = (value: string) => {
    // Reject IPv4-like patterns or dotted versions
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value.trim())) return false;
    // Reject decimal-like ids such as 1773394621488.1
    if (value.includes('.') && !value.startsWith('+') && !/[ \-()]/.test(value)) return false;
    const normalized = normalizePhone(value);
    const digitsOnly = normalized.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) return false;
    const hasSeparator = /[\s().-]/.test(value);
    const hasPlus = normalized.startsWith('+');
    // Require a separator or a leading + to avoid numeric IDs
    if (!hasSeparator && !hasPlus) return false;
    return true;
  };
  const phones = rawPhones.filter(isValidPhone);

  // 3. Find explicit Mailto / Tel links
  const mailToLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
    .map(a => a.getAttribute('href')?.replace('mailto:', '').split('?')[0])
    .filter(Boolean) as string[];
  const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'))
    .map(a => a.getAttribute('href')?.replace('tel:', '').split('?')[0])
    .filter(Boolean) as string[];

  // 3b. Facebook contact block (more reliable on dynamic pages)
  const fbContacts: { emails: string[]; phones: string[] } = { emails: [], phones: [] };
  if (window.location.hostname.includes('facebook.com')) {
    const contactHeaders = Array.from(document.querySelectorAll('h2, h3, h4, span, div'))
      .filter(el => /contact info/i.test(el.textContent || ''))
      .slice(0, 3);
    contactHeaders.forEach(header => {
      const container = header.closest('div') || header.parentElement;
      const blockText = container?.innerText || '';
      const emailsInBlock = Array.from(new Set(blockText.match(emailRegex) || []));
      const phonesInBlock = Array.from(new Set(blockText.match(phoneRegex) || []));
      fbContacts.emails.push(...emailsInBlock);
      fbContacts.phones.push(...phonesInBlock);
    });
  }

  // 4. Try to determine company name from Title
  const title = document.title;
  let company = '';
  if (title.includes('|')) company = title.split('|')[1].trim();
  else if (title.includes('-')) company = title.split('-')[1].trim();

  const allPhones = Array.from(new Set([...phones, ...telLinks, ...fbContacts.phones])).filter(isValidPhone);

  return {
    emails: Array.from(new Set([...emails, ...mailToLinks, ...fbContacts.emails])),
    phones: allPhones,
    companyGuess: company,
    url: window.location.href,
    hostname: window.location.hostname.replace(/^www\./, ''),
    title,
  };
}

function sendAiExtract(intel: ReturnType<typeof performSmartScrape>) {
  const now = Date.now();
  if (now - lastAiSentAt < 3000) return;

  const text = (document.body?.innerText || '').slice(0, 20000);
  if (!text || text.length < 100) return;

  const hash = `${intel.url}|${text.slice(0, 4000)}`;
  if (hash === lastAiHash) return;
  lastAiHash = hash;
  lastAiSentAt = now;

  chrome.runtime.sendMessage({
    type: 'AI_EXTRACT_PAGE',
    data: {
      text,
      url: intel.url,
      title: intel.title,
    },
  });
}
