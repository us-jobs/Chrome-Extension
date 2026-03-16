import { Router } from 'express';

const router = Router();

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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
  if (!hasSeparator && !hasPlus && digitsOnly.length > 10) return false;
  return true;
};
const isValidEmail = (value: string) => emailRegex.test(value);

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

router.post('/extract-leads', async (req, res) => {
  const apiKey = (req.headers['x-gemini-api-key'] as string | undefined)?.trim();
  if (!apiKey) {
    return res.status(400).json({ error: 'Missing Gemini API key' });
  }

  const { text, url, title } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing page text' });
  }

  const pageText = text.slice(0, 20000);
  const sourceUrl = typeof url === 'string' ? url : '';
  const pageTitle = typeof title === 'string' ? title : '';

  const prompt = [
    'You are extracting contact leads from webpage text.',
    'Return a JSON object that matches the provided schema.',
    'Only include leads that have at least one contact detail (email or phone).',
    'If a lead has no email or phone, omit it.',
    'Infer lead name/company/title when reasonable, but do not hallucinate contact details.',
    '',
    `PAGE TITLE: ${pageTitle}`,
    `PAGE URL: ${sourceUrl}`,
    'PAGE TEXT:',
    pageText,
  ].join('\n');

  try {
    const response = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              leads: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string' },
                    phone: { type: 'string' },
                    company: { type: 'string' },
                    title: { type: 'string' },
                    sourceUrl: { type: 'string' },
                  },
                  required: ['sourceUrl'],
                },
              },
            },
            required: ['leads'],
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: `Gemini error: ${errorText}` });
    }

    const data = await response.json();
    const textOut =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
      '';

    let parsed: any = null;
    try {
      parsed = JSON.parse(textOut);
    } catch {
      // Attempt to extract JSON from a wrapped response
      const match = String(textOut).match(/\{[\s\S]*\}$/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    const rawLeads = Array.isArray(parsed?.leads) ? parsed.leads : [];
    const sanitized = rawLeads.map(sanitizeLead);

    const filtered = sanitized.filter((lead: any) => Boolean(lead.email || lead.phone));

    const deduped: any[] = [];
    const seen = new Set<string>();
    for (const lead of filtered) {
      const key = `${(lead.email || '').toLowerCase()}|${(lead.phone || '').replace(/\D/g, '')}|${(lead.name || '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!lead.sourceUrl) lead.sourceUrl = sourceUrl;
      deduped.push(lead);
    }

    return res.json({ leads: deduped });
  } catch (error: any) {
    console.error('Gemini extraction failed:', error);
    return res.status(500).json({ error: 'Failed to extract leads with Gemini' });
  }
});

export default router;
