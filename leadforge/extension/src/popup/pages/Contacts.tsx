import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, MoreHorizontal, Trash, Sparkles } from 'lucide-react';
import api from '../../api';

// Defined based on backend Prisma schema
interface Contact {
  id: string;
  fullName: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  intentScore?: number;
  source: string;
}

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [leads, setLeads] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrapeStatus, setScrapeStatus] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/contacts', { params: { search } });
      setLeads(res.data.contacts);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [search]); // re-fetch on search change

  const deleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await api.delete(`/contacts/${id}`);
      fetchContacts();
    } catch (err) {
      alert('Failed to delete contact');
    }
  };

  const scrapeCurrentPage = async () => {
    setScrapeStatus(null);
    setScraping(true);
    try {
      const res = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ type: 'SCRAPE_CURRENT_PAGE', data: null }, (response) => {
          resolve(response || { success: false, error: 'No response' });
        });
      });
      if (!res.success) {
        setScrapeStatus(res.error || 'Scrape failed');
      } else {
        setScrapeStatus('Saved from current page.');
        fetchContacts();
      }
    } catch (err: any) {
      setScrapeStatus(err?.message || 'Scrape failed');
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="p-4 h-full flex flex-col pt-16">
      {/* Header Area */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">My Leads</h1>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={scrapeCurrentPage}
            disabled={scraping}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-[11px] leading-none bg-blue-600 text-white border border-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <Sparkles size={16} /> {scraping ? 'Extracting...' : 'Extract Page'}
          </button>
          <button className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-[11px] leading-none bg-white border border-slate-200 rounded-md shadow-sm hover:bg-slate-50 text-slate-600 transition-colors whitespace-nowrap">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search leads, companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
          />
        </div>
        <button className="flex items-center justify-center w-10 h-10 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200">
          <Filter size={18} />
        </button>
      </div>

      {scrapeStatus && (
        <div className="mb-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {scrapeStatus}
        </div>
      )}

      {/* Leads List */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Search className="text-slate-300" size={24} />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">No leads found</p>
            <p className="text-xs">Try adjusting your search or scrape a new profile from LinkedIn.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const hasTitleOrCompany = Boolean(lead.title || lead.company);
              const subline = hasTitleOrCompany
                ? `${lead.title ? lead.title : ''}${lead.title && lead.company ? ' ' : ''}${lead.company ? `at ${lead.company}` : ''}`.trim()
                : lead.source;
              return (
              <div key={lead.id} className="p-4 hover:bg-slate-50/80 transition-colors group relative">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-slate-800 tracking-tight leading-none">{lead.fullName || lead.source}</h3>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => deleteContact(lead.id)} className="p-1 hover:bg-red-100 text-red-500 rounded-md transition-colors">
                      <Trash size={14} />
                    </button>
                    <button className="p-1 hover:bg-slate-200 text-slate-400 rounded-md transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>
                
                <p className="text-xs text-slate-500 mb-2 truncate font-medium">
                  {subline || 'Saved from current page'}
                </p>
                
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <div className="w-4 flex justify-center"><span className="text-xs">✉️</span></div>
                    <span className="text-xs truncate max-w-[120px]">{lead.email || 'No email'}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-slate-500">
                     <div className="w-4 flex justify-center"><span className="text-xs">📞</span></div>
                    <span className="text-xs">{lead.phone || 'No phone'}</span>
                  </div>
                </div>

                {lead.intentScore !== undefined && lead.intentScore > 0 && (
                  <div className="absolute bottom-4 right-4">
                     <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${lead.intentScore > 75 ? 'bg-green-50 text-green-700 border-green-200' : lead.intentScore > 40 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        Score {lead.intentScore}
                     </span>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
