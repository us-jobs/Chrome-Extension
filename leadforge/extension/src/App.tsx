import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';

import Dashboard from './popup/pages/Dashboard';
import Contacts from './popup/pages/Contacts';
import Onboarding from './popup/pages/Onboarding';
import Login from './popup/pages/Login';
import api from './api';

import { SequenceBuilder } from './components/SequenceBuilder';

function Settings() {
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [injecting, setInjecting] = useState(false);
  const [injectStatus, setInjectStatus] = useState<string | null>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiStatus, setGeminiStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const res = await chrome.storage.local.get('leadforge_keep_session');
          setKeepSignedIn(!!res.leadforge_keep_session);
          const gemini = await chrome.storage.local.get('leadforge_gemini_api_key');
          setGeminiKey((gemini.leadforge_gemini_api_key as string) || '');
        } else {
          setKeepSignedIn(localStorage.getItem('leadforge_keep_session') === 'true');
          setGeminiKey(localStorage.getItem('leadforge_gemini_api_key') || '');
        }

        // Load from backend if available
        try {
          const profile = await api.get('/auth/me');
          const key = profile?.data?.user?.geminiApiKey;
          if (typeof key === 'string' && key.trim()) {
            setGeminiKey(key.trim());
          }
        } catch {
          // ignore if not authenticated or API unavailable
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleKeep = async (next: boolean) => {
    setKeepSignedIn(next);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ leadforge_keep_session: next });
    } else {
      localStorage.setItem('leadforge_keep_session', String(next));
    }
  };

  const handleLogout = async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.session.remove('leadforge_token');
        if (!keepSignedIn) {
          await chrome.storage.local.remove('leadforge_token');
        }
      } else {
        sessionStorage.removeItem('leadforge_token');
        if (!keepSignedIn) {
          localStorage.removeItem('leadforge_token');
        }
      }
      window.location.reload();
    } catch (err) {
      console.error('Failed to logout', err);
    }
  };

  const handleInject = async () => {
    setInjectStatus(null);
    setInjecting(true);
    try {
      const res = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ type: 'INJECT_LINKEDIN', data: null }, (response) => {
          resolve(response || { success: false, error: 'No response' });
        });
      });
      if (!res.success) {
        setInjectStatus(res.error || 'Injection failed');
      } else {
        setInjectStatus('Injected. Refresh LinkedIn if needed.');
      }
    } catch (err: any) {
      setInjectStatus(err?.message || 'Injection failed');
    } finally {
      setInjecting(false);
    }
  };

  const saveGeminiKey = async () => {
    setGeminiStatus(null);
    try {
      try {
        await api.put('/auth/settings', { geminiApiKey: geminiKey.trim() });
      } catch {
        // If backend is unavailable, still save locally
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ leadforge_gemini_api_key: geminiKey.trim() });
      } else {
        localStorage.setItem('leadforge_gemini_api_key', geminiKey.trim());
      }
      setGeminiStatus('Saved.');
    } catch (err: any) {
      setGeminiStatus(err?.message || 'Failed to save.');
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-neutral-500 mt-2">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-neutral-500 mt-2">Manage authentication and preferences.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm text-slate-800">Keep me signed in</div>
          <div className="text-xs text-slate-500 mt-1">
            Stores your token in local storage so refreshes don’t log you out.
          </div>
        </div>
        <button
          onClick={() => toggleKeep(!keepSignedIn)}
          className={`w-12 h-6 rounded-full transition-colors ${keepSignedIn ? 'bg-blue-600' : 'bg-slate-300'}`}
          aria-pressed={keepSignedIn}
        >
          <span
            className={`block w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
              keepSignedIn ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <button
          onClick={handleLogout}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold transition-colors"
        >
          Logout
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="font-semibold text-sm text-slate-800">Gemini API Key</div>
        <input
          type="password"
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
          placeholder="Paste your Gemini API key"
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <button
          onClick={saveGeminiKey}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
        >
          Save API Key
        </button>
        {geminiStatus && (
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {geminiStatus}
          </div>
        )}
      </div>

      {/*
        Troubleshooting block removed per request
      */}
    </div>
  );
}

function AppLayout() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkNavigation = async () => {
      let onboarded = false;
      let token: string | null = null;
      let keepSession = false;

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const res = await chrome.storage.local.get('isOnboarded');
        onboarded = !!res.isOnboarded;
        const keep = await chrome.storage.local.get('leadforge_keep_session');
        keepSession = !!keep.leadforge_keep_session;
        const auth = await chrome.storage.session.get('leadforge_token');
        token = (auth.leadforge_token as string) || null;
        if (!token && keepSession) {
          const localAuth = await chrome.storage.local.get('leadforge_token');
          token = (localAuth.leadforge_token as string) || null;
          if (token) {
            await chrome.storage.session.set({ leadforge_token: token });
          }
        }
      } else {
        onboarded = !!localStorage.getItem('isOnboarded');
        keepSession = localStorage.getItem('leadforge_keep_session') === 'true';
        token = localStorage.getItem('leadforge_token');
      }

      setIsAuthenticated(!!token);
      setLoading(false);

      if (!token && location.pathname !== '/login') {
        navigate('/login', { replace: true });
        return;
      }

      if (token && !onboarded && location.pathname !== '/onboarding') {
        navigate('/onboarding', { replace: true });
        return;
      }

      if (token && location.pathname === '/login') {
        navigate('/', { replace: true });
      }
    };
    checkNavigation();
  }, [location.pathname, navigate]);

  if (loading) {
    return (
      <div className="h-screen w-[400px] flex items-center justify-center text-slate-400 bg-neutral-100 font-sans text-sm">
        Loading LeadForge...
      </div>
    );
  }

  const isOnboarding = location.pathname === '/onboarding';
  const isLogin = location.pathname === '/login';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-neutral-100 text-neutral-900 font-sans w-[400px]">
      <main className={`flex-1 overflow-y-auto ${isOnboarding || isLogin ? '' : 'pb-16'}`}>
        <Routes>
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/sequences" element={<SequenceBuilder />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/onboarding" element={<Onboarding />} />
        </Routes>
      </main>

      {!isOnboarding && !isLogin && isAuthenticated && (
        <nav className="fixed bottom-0 w-[400px] bg-white border-t border-neutral-200 flex justify-around p-3 pb-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <Link to="/" className="flex flex-col items-center text-neutral-600 hover:text-primary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
            <span className="text-[10px] mt-1 font-medium">Home</span>
          </Link>
          <Link to="/contacts" className="flex flex-col items-center text-neutral-600 hover:text-primary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="text-[10px] mt-1 font-medium">Leads</span>
          </Link>
          <Link to="/sequences" className="flex flex-col items-center text-neutral-600 hover:text-primary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span className="text-[10px] mt-1 font-medium">Campaigns</span>
          </Link>
          <Link to="/settings" className="flex flex-col items-center text-neutral-600 hover:text-primary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            <span className="text-[10px] mt-1 font-medium">Settings</span>
          </Link>
        </nav>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}
