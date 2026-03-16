import React, { useState, useEffect } from 'react';
import { Activity, Users, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

interface DashboardMetrics {
  totalContacts: number;
  activeSequences: number;
  creditsRemaining: number;
  plan: string;
}

interface HighIntentLead {
  id: string;
  fullName: string;
  company?: string;
  intentScore: number;
  linkedinUrl?: string;
}

interface ActivityLog {
  id: string;
  action: string;
  createdAt: string;
  contactName: string;
  metadata?: any;
}

interface ExtractedIntel {
  emails?: string[];
  phones?: string[];
  companyGuess?: string;
  url?: string;
  hostname?: string;
  title?: string;
  receivedAt?: number;
}

interface ExtractedLead {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [leads, setLeads] = useState<HighIntentLead[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIntel, setCurrentIntel] = useState<ExtractedIntel | null>(null);
  const [intelStatus, setIntelStatus] = useState<string | null>(null);
  const [savingIntel, setSavingIntel] = useState(false);
  const [savingLeadKey, setSavingLeadKey] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [currentLeads, setCurrentLeads] = useState<ExtractedLead[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/analytics/dashboard');
        setMetrics(res.data.metrics);
        setLeads(res.data.highIntentLeads);
        setActivities(res.data.recentActivity);
      } catch (error) {
        const status = (error as any)?.response?.status;
        if (status === 401) {
          try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
              await chrome.storage.session.remove('leadforge_token');
              await chrome.storage.local.remove('leadforge_token');
            } else {
              sessionStorage.removeItem('leadforge_token');
              localStorage.removeItem('leadforge_token');
            }
          } catch (err) {
            console.error('Failed to clear auth token', err);
          }
          navigate('/login', { replace: true });
          return;
        }
        setError((error as any)?.response?.data?.error || 'Failed to load dashboard.');
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [navigate]);

  useEffect(() => {
    let disposed = false;
    const loadForTab = async (tabId?: number) => {
      if (typeof chrome === 'undefined' || !chrome.storage) return;
      try {
        let resolvedTabId = tabId;
        if (!resolvedTabId) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          resolvedTabId = tab?.id;
        }
        if (resolvedTabId) setActiveTabId(resolvedTabId);

        const tabKey = resolvedTabId ? `leadforge_tab_intel_${resolvedTabId}` : null;
        const leadsKey = resolvedTabId ? `leadforge_tab_leads_${resolvedTabId}` : null;
        const errorKey = resolvedTabId ? `leadforge_tab_ai_error_${resolvedTabId}` : null;
        const tabData = tabKey ? await chrome.storage.local.get(tabKey) : {};
        const intelFromTab = tabKey ? (tabData[tabKey] as ExtractedIntel | undefined) : undefined;
        const leadsData = leadsKey ? await chrome.storage.local.get(leadsKey) : {};
        const leadsFromTab = leadsKey ? (leadsData[leadsKey] as ExtractedLead[] | undefined) : undefined;
        const errorData = errorKey ? await chrome.storage.local.get(errorKey) : {};
        const errorFromTab = errorKey ? (errorData[errorKey] as string | undefined) : undefined;

        if (!disposed) {
          setCurrentLeads(leadsFromTab || []);
          setAiError(errorFromTab || null);
        }

        if (intelFromTab) {
          if (!disposed) setCurrentIntel(intelFromTab);
          return;
        }

        const data = await chrome.storage.local.get('leadforge_last_intel');
        const intel = data.leadforge_last_intel as ExtractedIntel | undefined;
        if (!intel) {
          if (!disposed) setCurrentIntel(null);
          return;
        }

        if (!disposed) setCurrentIntel(intel);
      } catch (err) {
        console.warn('Failed to load stored intel', err);
      }
    };

    loadForTab();

    const handleActivated = (info: { tabId: number }) => {
      loadForTab(info.tabId);
    };

    const handleStorage = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== 'local') return;
      const tabKey = activeTabId ? `leadforge_tab_intel_${activeTabId}` : null;
      const leadsKey = activeTabId ? `leadforge_tab_leads_${activeTabId}` : null;
      const errorKey = activeTabId ? `leadforge_tab_ai_error_${activeTabId}` : null;
      if (tabKey && changes[tabKey]?.newValue) {
        setCurrentIntel(changes[tabKey].newValue as ExtractedIntel);
      }
      if (leadsKey && changes[leadsKey]?.newValue) {
        setCurrentLeads(changes[leadsKey].newValue as ExtractedLead[]);
      }
      if (errorKey && changes[errorKey]?.newValue !== undefined) {
        setAiError(changes[errorKey].newValue as string);
      }
      const change = changes.leadforge_last_intel;
      if (change?.newValue && !tabKey) {
        setCurrentIntel(change.newValue as ExtractedIntel);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.onActivated.addListener(handleActivated);
    }
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener(handleStorage);
    }

    return () => {
      disposed = true;
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.onActivated.removeListener(handleActivated);
      }
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.removeListener(handleStorage);
      }
    };
  }, [activeTabId]);

  const handleSaveLead = async (lead: ExtractedLead) => {
    const key = `${lead.email || ''}|${lead.phone || ''}|${lead.name || lead.company || ''}`;
    setSavingLeadKey(key);
    setIntelStatus(null);

    const fullName = lead.name || lead.company || 'Website Lead';
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || 'Website';
    const lastName = parts.slice(1).join(' ') || 'Lead';

    try {
      await api.post('/contacts', {
        firstName,
        lastName,
        fullName,
        email: lead.email || null,
        phone: lead.phone || null,
        company: lead.company || null,
        companyDomain: null,
        title: lead.title || null,
        source: 'WEBSITE',
        sourceUrl: lead.sourceUrl || null,
      });
      setIntelStatus('Lead saved to your list.');
    } catch (err: any) {
      setIntelStatus(err?.response?.data?.error || 'Failed to save lead.');
    } finally {
      setSavingLeadKey(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <span className="text-slate-400">Loading Dashboard...</span>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-4 h-full flex flex-col items-center justify-center text-center">
        <div className="text-sm text-slate-500 mb-2">{error || 'Unable to load dashboard.'}</div>
        <button
          onClick={() => window.location.reload()}
          className="text-xs font-semibold text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col h-full overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-sm uppercase tracking-wider font-bold text-slate-500 mb-3 ml-1">Extracted Leads</h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {currentLeads.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              No extracted leads yet.
              {aiError && (
                <div className="mt-2 text-[11px] text-red-500 break-words">
                  {aiError}
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {currentLeads.map((lead, idx) => {
                const key = `${lead.email || ''}|${lead.phone || ''}|${lead.name || lead.company || ''}`;
                return (
                  <div key={`${key}-${idx}`} className="p-3 relative">
                    <button
                      onClick={() => handleSaveLead(lead)}
                      disabled={savingLeadKey === key}
                      className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                      title="Add lead"
                    >
                      {savingLeadKey === key ? 'Saving…' : '+ Add'}
                    </button>
                    <div className="text-sm font-semibold text-slate-800 pr-14">
                      {lead.name || lead.company || 'Lead'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 pr-14">
                      {(lead.email && lead.email.trim()) ? lead.email : 'No Email'} • {(lead.phone && lead.phone.trim()) ? lead.phone : 'No Phone'}
                    </div>
                    {lead.title && (
                      <div className="text-[11px] text-slate-400 mt-1 pr-14">{lead.title}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {intelStatus && (
          <div className="mt-2 text-xs text-slate-500">{intelStatus}</div>
        )}
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Overview</h1>
          <p className="text-sm text-slate-500">{metrics.plan} Plan</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{metrics.creditsRemaining}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Credits Left</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-600">Total Leads</h2>
          </div>
          <div className="text-2xl font-bold text-slate-800">{metrics.totalContacts}</div>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <Send size={16} className="text-green-500" />
            <h2 className="text-sm font-semibold text-slate-600">Active Seq.</h2>
          </div>
          <div className="text-2xl font-bold text-slate-800">{metrics.activeSequences}</div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-sm uppercase tracking-wider font-bold text-slate-500 mb-3 ml-1">High Intent Leads</h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {leads.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">No high intent leads yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leads.map(lead => (
                <div key={lead.id} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="font-semibold text-sm text-slate-800">{lead.fullName}</div>
                    <div className="text-xs text-slate-500">{lead.company}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                      Score {lead.intentScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-sm uppercase tracking-wider font-bold text-slate-500 mb-3 ml-1">Recent Activity</h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          {activities.length === 0 ? (
            <div className="text-center text-sm text-slate-500">No recent activity.</div>
          ) : (
            <div className="space-y-4">
              {activities.map(act => (
                <div key={act.id} className="flex gap-3">
                  <div className="mt-0.5"><Activity size={14} className="text-slate-400" /></div>
                  <div>
                    <div className="text-sm text-slate-800">
                      <span className="font-medium">{act.action}</span> - {act.contactName}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(act.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
