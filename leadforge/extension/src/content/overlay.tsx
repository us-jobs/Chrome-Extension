import React from 'react';
import Draggable from 'react-draggable';
import { Mail, Phone, ExternalLink, X, Save, MessageSquare } from 'lucide-react';

export const ContactOverlay = ({ data, onClose, onSave }) => {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(data);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Draggable handle=".drag-handle">
      <div className="fixed z-[99999] top-4 right-4 w-80 bg-white rounded-xl shadow-2xl overflow-hidden border border-neutral-200 font-sans text-neutral-900">
        
        {/* Header - Draggable Area */}
        <div className="drag-handle bg-neutral-50 px-4 py-3 border-b flex justify-between items-center cursor-move hover:bg-neutral-100 transition-colors">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-semibold text-sm text-neutral-700">LeadForge Detection</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-neutral-200 rounded-md transition-colors">
            <X size={16} className="text-neutral-500" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4">
          <h2 className="text-lg font-bold truncate pr-4">{data.fullName || `${data.firstName} ${data.lastName}`}</h2>
          <p className="text-sm text-neutral-500 font-medium truncate">{data.title}</p>
          <div className="flex items-center mt-1 text-sm text-primary hover:underline cursor-pointer w-fit">
            <span className="font-semibold truncate max-w-[200px]">{data.company}</span>
            <ExternalLink size={12} className="ml-1" />
          </div>

          <div className="mt-4 space-y-3">
            {data.email && (
              <div className="flex items-center text-sm">
                <div className="w-8 flex justify-center"><Mail size={16} className="text-neutral-400" /></div>
                <span className="truncate flex-1">{data.email}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold ml-2">Valid</span>
              </div>
            )}
            {data.phone && (
              <div className="flex items-center text-sm">
                <div className="w-8 flex justify-center"><Phone size={16} className="text-neutral-400" /></div>
                <span className="truncate flex-1">{data.phone}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold ml-2">Mobile</span>
              </div>
            )}
            {typeof data.intentScore === 'number' && (
              <div className="mt-1">
                <div className="flex justify-between text-[11px] text-neutral-500 mb-1 font-semibold">
                  <span>Intent Score</span>
                  <span className={data.intentScore > 75 ? 'text-green-600' : 'text-amber-600'}>{data.intentScore}/100</span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-1.5 rounded-full ${data.intentScore > 75 ? 'bg-green-500' : 'bg-amber-500'}`} 
                    style={{ width: `${data.intentScore}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-neutral-50 border-t flex space-x-2">
          <button 
            onClick={handleSave}
            disabled={saving || saved}
            className={`flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              saved ? 'bg-green-500 text-white' : 
              saving ? 'bg-primary/70 text-white cursor-not-allowed' : 
              'bg-primary text-white hover:bg-blue-700 shadow-sm'
            }`}
          >
            {saved ? (
              <span>Saved ✓</span>
            ) : (
              <>
                <Save size={16} />
                <span>{saving ? 'Saving...' : 'Save Lead'}</span>
              </>
            )}
          </button>
          
          <button className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-sm font-medium border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors shadow-sm">
            <MessageSquare size={16} />
            <span>Sequence</span>
          </button>
        </div>

      </div>
    </Draggable>
  );
};
