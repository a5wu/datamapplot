"use client";

import React, { useState, useEffect } from 'react';
import ProfileImage from './components/ProfileImage';
import './iframe-fix.css';

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
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      width: '100%',
      overflow: 'hidden'
    }}>
      {/* Debug bar */}
      <div style={{ 
        padding: '8px', 
        backgroundColor: '#f3f4f6', 
        fontSize: '12px', 
        color: '#4b5563'
      }}>
        <span>Debug:</span> <span>{debugMsg}</span>
      </div>
      
      {/* Main content - two column layout */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        flex: '1',
        overflow: 'hidden',
        width: '100%',
        height: '100%'
      }}>
        {/* Visualization column */}
        <div className="iframe-container">
          <iframe 
            src="/producer_embeddings.html" 
            title="Bluesky Atlas Visualization"
            loading="eager"
            allow="fullscreen"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
        
        {/* Sidebar column */}
        <div style={{ 
          height: '100%', 
          backgroundColor: 'white', 
          borderLeft: '1px solid #e5e7eb',
          overflow: 'auto'
        }}>
          {selectedNode ? (
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
                <ProfileImage 
                  src={selectedNode.profile_image_url} 
                  alt={selectedNode.display_name}
                  className="w-16 h-16 rounded-full mr-3"
                />
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                    {selectedNode.display_name}
                  </h2>
                  <a 
                    href={selectedNode.bsky_url}
                    target="_blank"
                    rel="noopener noreferrer" 
                    style={{ color: '#3b82f6', textDecoration: 'none' }}
                    onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    @{selectedNode.handle}
                  </a>
                </div>
              </div>
              
              <p style={{ color: '#4b5563', marginBottom: '16px' }}>
                {selectedNode.description}
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold' }}>
                    {selectedNode.followers?.toLocaleString() || '0'}
                  </div>
                  <div style={{ color: '#6b7280' }}>Followers</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold' }}>
                    {selectedNode.following?.toLocaleString() || '0'}
                  </div>
                  <div style={{ color: '#6b7280' }}>Following</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold' }}>
                    {selectedNode.posts?.toLocaleString() || '0'}
                  </div>
                  <div style={{ color: '#6b7280' }}>Posts</div>
                </div>
              </div>
              
              <div style={{ marginTop: '16px' }}>
                <a 
                  href={selectedNode.bsky_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    width: '100%',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    textAlign: 'center',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                >
                  View Profile
                </a>
              </div>
            </div>
          ) : (
            <div style={{ 
              padding: '16px', 
              color: '#6b7280', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%' 
            }}>
              <div style={{ 
                height: '48px', 
                width: '48px', 
                marginBottom: '12px', 
                borderRadius: '50%', 
                backgroundColor: '#dbeafe', 
                color: '#3b82f6', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '20px', 
                fontWeight: 'bold' 
              }}>
                i
              </div>
              <p style={{ textAlign: 'center' }}>
                Click on a node in the visualization to view details about that user.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
