"use client";

import React from 'react';
import ProfileImage from '../ProfileImage';
import { BlueskyFollower } from '../../models/types';

interface FollowersTabProps {
  followers: BlueskyFollower[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function FollowersTab({ followers, isLoading, error, hasMore, onLoadMore }: FollowersTabProps) {
  if (isLoading && followers.length === 0) {
    return <div className="p-4 text-slate-400">Loading followers...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-400">Error loading followers: {error}</div>;
  }

  if (!followers || followers.length === 0) {
    return <div className="p-4 text-slate-400">No followers found.</div>;
  }

  return (
    <div>
      {followers.map((follower) => {
        // Skip rendering if follower object is invalid
        if (!follower) {
          console.warn('Follower is undefined');
          return null;
        }
        
        const profileUrl = follower.handle ? `https://bsky.app/profile/${follower.handle}` : null;
        
        return profileUrl ? (
          <a 
            key={follower.did || `unknown-${Math.random()}`} 
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 flex items-center hover:bg-slate-800/50 transition-colors cursor-pointer block rounded-lg"
          >
            <ProfileImage 
              src={follower.avatar || ''} 
              alt={follower.displayName || follower.handle || 'Unknown'}
              className="w-10 h-10 rounded-full mr-3"
            />
            <div>
              <div className="font-medium text-slate-200">{follower.displayName || follower.handle || 'Unknown'}</div>
              <div className="text-sm text-slate-400">@{follower.handle || 'unknown'}</div>
            </div>
          </a>
        ) : (
          // Non-clickable version for followers without handles
          <div key={follower.did || `unknown-${Math.random()}`} className="p-2 flex items-center rounded-lg">
            <ProfileImage 
              src={follower.avatar || ''} 
              alt={follower.displayName || 'Unknown'}
              className="w-10 h-10 rounded-full mr-3"
            />
            <div>
              <div className="font-medium text-slate-200">{follower.displayName || 'Unknown'}</div>
              <div className="text-sm text-slate-400">Unknown handle</div>
            </div>
          </div>
        );
      })}
      
      {/* Load More Button or Loading indicator */}
      {hasMore && (
        <div className="py-4 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading more...
              </span>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
} 