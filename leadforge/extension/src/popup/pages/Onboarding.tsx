import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, Database, CheckCircle2, ArrowRight } from 'lucide-react';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const handleComplete = async () => {
    // 1. Save onboarding status to Chrome local storage so we don't show this again
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ isOnboarded: true });
    } else {
      // Fallback for local web dev testing
      localStorage.setItem('isOnboarded', 'true');
    }
    
    // 2. Redirect back home
    navigate('/');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800">
      {/* Progress Bar Header */}
      <div className="flex justify-center items-center h-16 border-b border-slate-200 bg-white shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-2 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-slate-200'} transition-colors duration-300`} />
          <div className={`w-8 h-2 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'} transition-colors duration-300`} />
          <div className={`w-8 h-2 rounded-full ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200'} transition-colors duration-300`} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
        
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center w-full max-w-sm">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-blue-200">
              <Rocket className="text-blue-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold mb-3 tracking-tight">Welcome to LeadForge!</h1>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Supercharge your outreach pipeline. Extract, verify, and enrich B2B contact data instantly from any LinkedIn profile or company website.
            </p>
            <button 
              onClick={() => setStep(2)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-semibold transition-all shadow-md active:scale-[0.98]"
            >
              Get Started <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center w-full max-w-sm">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-purple-200">
              <Database className="text-purple-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold mb-3 tracking-tight">Sync your CRM</h1>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Connect LeadForge to your favorite tools to automatically push high-intent leads into your sales campaigns without manual data entry.
            </p>
            
            <div className="space-y-3 mb-8">
              <button className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded shrink-0 bg-[#00A1E0] flex items-center justify-center text-white font-bold text-xs shadow-inner">SF</div>
                  <div>
                    <div className="font-semibold text-sm group-hover:text-blue-600 transition-colors">Salesforce (Beta)</div>
                    <div className="text-xs text-slate-400">Enterprise CRM</div>
                  </div>
                </div>
                <span className="text-blue-600 font-medium text-sm opcaity-0 group-hover:opacity-100 transition-opacity">Connect</span>
              </button>

              <button className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-orange-400 hover:shadow-sm transition-all text-left group">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded shrink-0 bg-[#FF7A59] flex items-center justify-center text-white font-bold text-xs shadow-inner">HS</div>
                  <div>
                    <div className="font-semibold text-sm group-hover:text-orange-600 transition-colors">HubSpot</div>
                    <div className="text-xs text-slate-400">Inbound Marketing</div>
                  </div>
                </div>
                <span className="text-orange-600 font-medium text-sm opcaity-0 group-hover:opacity-100 transition-opacity">Connect</span>
              </button>
            </div>

            <div className="flex gap-3">
               <button 
                onClick={() => setStep(1)}
                className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                Back
              </button>
              <button 
                onClick={() => setStep(3)}
                className="flex-[2] py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-all shadow-md"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 text-center w-full max-w-sm">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md border-4 border-white relative">
              <div className="absolute inset-0 bg-green-400 opacity-20 rounded-full animate-ping"></div>
              <CheckCircle2 className="text-green-600 relative z-10" size={40} />
            </div>
            <h1 className="text-2xl font-bold mb-3 text-slate-800 tracking-tight">You're all set!</h1>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Your LeadForge extension is primed and ready. Click the LeadForge icon on any LinkedIn profile to begin extracting data immediately.
            </p>
            <button 
              onClick={handleComplete}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-500/30 active:scale-[0.98] active:shadow-sm"
            >
              Start Prospecting
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
