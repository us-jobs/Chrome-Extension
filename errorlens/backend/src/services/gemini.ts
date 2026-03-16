import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 1024,
    topP: 0.8,
  },
  safetySettings: [
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_ONLY_HIGH' as any }
  ]
});

export async function* streamExplanation(prompt: string) {
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    yield chunk;
  }
}

export function getFallbackResponse(error: string): string {
  const searchQuery = encodeURIComponent(error.split('\n')[0].slice(0, 100));
  return `**ErrorLens couldn't reach the AI right now.**\n\nSearch for this error: [${error.slice(0, 60)}...](https://www.google.com/search?q=${searchQuery}+site:stackoverflow.com)`;
}
