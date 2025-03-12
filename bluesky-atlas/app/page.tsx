"use client";

import React, { useState, useEffect } from 'react';
import ProfileImage from './components/ProfileImage';

// Type definition for the node data
interface NodeData {
  did: string;
  handle: string;
  display_name: string;
  description: string;
  followers: number;
  following: number;
  posts: number;
  bsky_url: string;
  profile_image_url: string;
}

export default function Home() {
  // State to store the selected node data
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [debugMsg, setDebugMsg] = useState<string>('Waiting for messages...');

  // Effect to set up the message listener
  useEffect(() => {
    console.log('Setting up message listener');
    
    // Handle message events from the iframe
    const handleMessage = (event: MessageEvent) => {
      console.log('Received message event:', event);
      
      // Make sure the message is from our iframe
      if (event.data && event.data.type === 'node_click') {
        console.log("Received node data:", event.data.data);
        // Using a more sanitized approach for the debug message
        setDebugMsg(`Received node: ${event.data.data?.display_name || 'unknown'} (@${event.data.data?.handle || 'unknown'})`);
        setSelectedNode(event.data.data);
      } else {
        console.log('Received non-node_click message:', event.data);
        // More safely handle potentially malformed data
        const msgType = event.data?.type ? String(event.data.type) : 'unknown';
        setDebugMsg(`Received message of type: ${msgType}`);
      }
    };

    // Add event listener
    window.addEventListener('message', handleMessage);

    // Clean up
    return () => {
      console.log('Removing message listener');
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    // Using grid instead of flex for more precise layout control
    <div className="grid grid-rows-[auto_1fr] h-screen w-full">
      {/* Debug panel - can be removed in production */}
      <div className="bg-gray-100 p-2 text-xs text-gray-600">
        <span>Debug:</span> <span>{debugMsg}</span>
      </div>
      
      {/* Main content area - takes remaining height */}
      <div className="grid grid-cols-12 h-full">
        {/* Left column - visualization (8/12 columns) */}
        <div className="col-span-8 relative h-full overflow-hidden">
          <iframe 
            src="/producer_embeddings.html" 
            className="absolute inset-0 w-full h-full"
            title="Bluesky Atlas Visualization"
            loading="eager"
            allow="fullscreen"
            style={{ border: 'none', display: 'block' }}
          />
        </div>
        
        {/* Right column - sidebar (4/12 columns) */}
        <div className="col-span-4 bg-white border-l border-gray-200 overflow-y-auto">
          {selectedNode ? (
            <div className="p-4">
              <div className="mb-4 flex items-center">
                <ProfileImage 
                  src={selectedNode.profile_image_url} 
                  alt={selectedNode.display_name}
                  className="w-16 h-16 rounded-full mr-3"
                />
                <div>
                  <h2 className="text-xl font-bold">{selectedNode.display_name}</h2>
                  <a 
                    href={selectedNode.bsky_url}
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="text-blue-500 hover:underline"
                  >
                    @{selectedNode.handle}
                  </a>
                </div>
              </div>
              
              <p className="text-gray-700 mb-4">{selectedNode.description}</p>
              
              <div className="flex justify-between text-sm">
                <div className="text-center">
                  <div className="font-bold">{selectedNode.followers?.toLocaleString() || '0'}</div>
                  <div className="text-gray-500">Followers</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{selectedNode.following?.toLocaleString() || '0'}</div>
                  <div className="text-gray-500">Following</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{selectedNode.posts?.toLocaleString() || '0'}</div>
                  <div className="text-gray-500">Posts</div>
                </div>
              </div>
              
              <div className="mt-4">
                <a 
                  href={selectedNode.bsky_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-blue-500 text-white text-center py-2 px-4 rounded hover:bg-blue-600"
                >
                  View Profile
                </a>
              </div>
            </div>
          ) : (
            <div className="p-4 text-gray-500 flex flex-col items-center justify-center h-full">
              {/* Replacing with a simpler icon */}
              <div className="h-12 w-12 mb-3 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center text-xl font-bold">
                i
              </div>
              <p className="text-center">
                Click on a node in the visualization to view details about that user.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
