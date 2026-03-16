import axios from 'axios';

// Default to localhost for development. In production this would be the live server URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept requests to automatically attach the JWT token
api.interceptors.request.use(async (config) => {
  try {
    // Attempt to grab token from Chrome Storage session
    // (We cast chrome object, as we may be running in local dev outside extension context)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      const data = await chrome.storage.session.get('leadforge_token');
      if (data.leadforge_token) {
        config.headers.Authorization = `Bearer ${data.leadforge_token}`;
      }
    } else {
      // Fallback for local web development debugging
      const localToken = localStorage.getItem('leadforge_token');
      if (localToken) {
        config.headers.Authorization = `Bearer ${localToken}`;
      }
    }
  } catch (err) {
    console.error('[API] Failed to get auth token', err);
  }
  return config;
});

export default api;
