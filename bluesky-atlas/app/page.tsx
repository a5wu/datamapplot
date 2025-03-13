"use client";

import React, { useState, useEffect } from 'react';
import { NodeData } from './models/types';
import ProfileSidebar from './components/ProfileSidebar';

export default function Home() {
  // State to store the selected node data
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  // Effect to set up the message listener
  useEffect(() => {
    // Handle message events from the iframe
    const handleMessage = (event: MessageEvent) => {
      // Make sure the message is from our iframe
      if (event.data && event.data.type === 'node_click') {
        setSelectedNode(event.data.data);
      }
    };

    // Add event listener
    window.addEventListener('message', handleMessage);

    // Clean up
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    // Full height layout without debug panel
    <div className="grid grid-cols-12 h-screen w-full">
      {/* Left column - visualization (9/12 columns) */}
      <div className="col-span-9 relative h-full overflow-hidden">
        <iframe 
          src="/producer_embeddings.html" 
          className="absolute inset-0 w-full h-full"
          title="Bluesky Atlas Visualization"
          loading="eager"
          allow="fullscreen"
          style={{ border: 'none', display: 'block' }}
        />
      </div>
      
      {/* Right column - profile sidebar */}
      <ProfileSidebar selectedNode={selectedNode} />
    </div>
  );
}
