"use client";

import React, { useState, ReactNode, useEffect } from 'react';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabInterfaceProps {
  tabs: Tab[];
  defaultTabId?: string;
  onTabChange?: (tabId: string) => void;
}

export default function TabInterface({ tabs, defaultTabId, onTabChange }: TabInterfaceProps) {
  // Use useEffect to set the default tab only once when component mounts or when defaultTabId changes
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');
  
  useEffect(() => {
    if (defaultTabId && tabs.some(tab => tab.id === defaultTabId)) {
      setActiveTab(defaultTabId);
    }
  }, [defaultTabId, tabs]);

  // Simplified tab change - no transitions
  const handleTabChange = (tabId: string) => {
    if (activeTab !== tabId) {
      setActiveTab(tabId);
      // Call the parent's onTabChange callback if provided
      if (onTabChange) {
        onTabChange(tabId);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar - Bluesky style with evenly distributed tabs */}
      <div className="flex border-b border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex-1 py-2.5 text-sm font-medium focus:outline-none transition-colors ${
              activeTab === tab.id
                ? 'text-blue-500 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300 border-b-2 border-transparent'
            }`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content Container - simplified with no transitions */}
      <div className="flex-1 overflow-hidden relative custom-scrollbar">
        {/* Only show the active tab with no transitions */}
        {tabs.map(tab => (
          <div 
            key={tab.id}
            className={`absolute inset-0 w-full h-full overflow-y-auto custom-scrollbar ${
              activeTab === tab.id ? 'block' : 'hidden'
            }`}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
} 