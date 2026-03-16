import { getAuthToken } from '../utils/auth';

async function init() {
  const token = await getAuthToken();
  const loginBtn = document.getElementById('btn-login') as HTMLButtonElement;
  
  // Usage
  try {
    const res = await fetch('http://localhost:3000/usage', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const limit = data.plan === 'FREE' ? 20 : 100;
    const used = Math.max(0, limit - data.remaining);
    const pct = Math.min(100, (used / limit) * 100);
    
    document.getElementById('usage-fill')!.style.width = `${pct}%`;
    document.getElementById('usage-text')!.textContent = data.plan === 'FREE' 
      ? `${used} / ${limit} free` 
      : 'Unlimited (Pro)';
  } catch (e) {
    document.getElementById('usage-text')!.textContent = 'Failed to load usage';
  }

  // History
  try {
    const res = await fetch('http://localhost:3000/history', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const history = await res.json();
    const list = document.getElementById('history-list')!;
    if (history.length === 0) {
      list.innerHTML = '<div style="font-size:12px; color:#777; margin-top:4px">No recent errors.</div>';
    } else {
      list.innerHTML = history.map((h: any) => `
        <div class="history-item" title="${h.errorText}">${h.errorText}</div>
      `).join('');
    }
  } catch (e) {
    document.getElementById('history-list')!.textContent = 'Failed to load history';
  }

  loginBtn.addEventListener('click', () => {
    alert("Google OAuth login will be implemented soon!");
  });
}

init();
