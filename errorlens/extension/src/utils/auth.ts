export async function getAuthToken(): Promise<string> {
  const result = await chrome.storage.local.get(['accessToken']);
  if (result.accessToken) return result.accessToken;

  // Fallback to guest token
  try {
    const res = await fetch('http://localhost:3000/auth/guest', { method: 'POST' });
    const data = await res.json();
    if (data.guestToken) {
      await chrome.storage.local.set({ accessToken: data.guestToken });
      return data.guestToken;
    }
  } catch (e) {
    console.error('Failed to get guest token', e);
  }
  return '';
}

export async function checkUsage(token: string): Promise<boolean> {
  if (!token) return true;
  try {
    const res = await fetch('http://localhost:3000/usage', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    return data.remaining > 0 || data.plan !== 'FREE';
  } catch (e) {
    console.error('Usage check failed', e);
    return true; 
  }
}
