import React, { useEffect, useState } from 'react';
import api from '../../api';

type Mode = 'login' | 'register';

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const googleAuthUrl = import.meta.env.VITE_GOOGLE_OAUTH_URL as string | undefined;

  const saveToken = async (token: string) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
        await chrome.storage.session.set({ leadforge_token: token });
        const keep = await chrome.storage.local.get('leadforge_keep_session');
        if (keep.leadforge_keep_session) {
          await chrome.storage.local.set({ leadforge_token: token });
        }
      } else {
        localStorage.setItem('leadforge_token', token);
      }
    } catch (err) {
      console.error('Failed to store auth token', err);
    }
  };

  useEffect(() => {
    let expectedOrigin = '';
    try {
      expectedOrigin = new URL(apiBaseUrl).origin;
    } catch (err) {
      console.warn('Invalid VITE_API_URL, OAuth origin check disabled', err);
    }

    const handleOAuthMessage = async (event: MessageEvent) => {
      if (expectedOrigin && event.origin !== expectedOrigin) {
        return;
      }
      const data = event.data as {
        type?: string;
        accessToken?: string;
      };
      if (!data || data.type !== 'leadforge:oauth' || !data.accessToken) {
        return;
      }
      await saveToken(data.accessToken);
      window.location.reload();
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [apiBaseUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password || (mode === 'register' && !name)) {
      setError('Please fill all required fields.');
      return;
    }

    try {
      setLoading(true);
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login'
        ? { email, password }
        : { email, password, name };

      const res = await api.post(endpoint, payload);
      const { accessToken } = res.data;

      if (!accessToken) {
        throw new Error('Missing access token');
      }

      await saveToken(accessToken);
      // Hard reload ensures router/auth checks pick up token immediately.
      window.location.reload();
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError(null);
    if (!googleAuthUrl) {
      setError('Google sign-in is not configured yet.');
      return;
    }
    window.open(googleAuthUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800">
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="mb-6 text-center">
            <div className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'login'
                ? 'Sign in to continue to LeadForge.'
                : 'Start by creating a free account.'}
            </p>
          </div>

          {mode === 'login' && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-red-500 border border-slate-200 text-xs font-bold">
                G
              </span>
              Continue with Google
            </button>
          )}

          {mode === 'login' && (
            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[11px] text-slate-400 uppercase tracking-wider">or</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div>
                <label className="text-xs font-semibold text-slate-600">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold transition-all disabled:opacity-60"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <button
                onClick={() => setMode('register')}
                className="text-blue-600 hover:underline font-medium"
              >
                Create an account
              </button>
            ) : (
              <button
                onClick={() => setMode('login')}
                className="text-blue-600 hover:underline font-medium"
              >
                Already have an account? Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
