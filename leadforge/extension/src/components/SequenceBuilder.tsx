import React, { useState } from 'react';
import { Plus, GripVertical, Mail, Phone, MessageSquare, Clock, ArrowRight } from 'lucide-react';

const STEP_ICONS: Record<string, any> = {
  EMAIL: <Mail size={16} />,
  LINKEDIN_DM: <MessageSquare size={16} />,
  CALL: <Phone size={16} />,
  WAIT: <Clock size={16} />
};

export const SequenceBuilder = () => {
  const [steps, setSteps] = useState([
    { id: '1', type: 'EMAIL', name: 'Initial Outreach', delay: 0 },
    { id: '2', type: 'WAIT', name: 'Wait 3 Days', delay: 72 },
    { id: '3', type: 'LINKEDIN_DM', name: 'Follow-up Note', delay: 0 }
  ]);

  return (
    <div className="flex flex-col h-full bg-neutral-50 overflow-y-auto">
      {/* Header */}
      <div className="p-4 bg-white border-b sticky top-0 z-10 shadow-sm">
        <h1 className="text-xl font-bold">New Campaign</h1>
        <p className="text-sm text-neutral-500 mt-1">SDR Outbound Drip</p>
      </div>

      {/* Builder Canvas */}
      <div className="p-4 flex-1">
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="relative">
              {/* Connector Line */}
              {index !== steps.length - 1 && (
                <div className="absolute left-6 top-10 bottom-[-20px] w-0.5 bg-neutral-200 z-0"></div>
              )}
              
              <div className="relative z-10 flex items-start space-x-3 group">
                {/* Drag Handle & Icon */}
                <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-sm border border-neutral-200 group-hover:border-primary transition-colors cursor-grab">
                  <div className="text-neutral-500">{STEP_ICONS[step.type]}</div>
                </div>

                {/* Step Card */}
                <div className="flex-1 bg-white border border-neutral-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-sm text-neutral-800">{step.name}</h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {step.type === 'WAIT' ? `Delay: ${step.delay} hours` : `Day ${index + 1} • Auto-send`}
                      </p>
                    </div>
                    <button className="text-neutral-400 hover:text-neutral-600 p-1">
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Step Button */}
        <div className="mt-8 flex justify-center pb-8">
          <button className="flex items-center space-x-2 bg-white border-2 border-dashed border-neutral-300 text-neutral-600 px-6 py-2.5 rounded-full text-sm font-semibold hover:border-primary hover:text-primary transition-colors shadow-sm">
            <Plus size={16} />
            <span>Add Step</span>
          </button>
        </div>
      </div>
    </div>
  );
};
