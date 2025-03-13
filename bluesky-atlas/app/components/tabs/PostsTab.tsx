"use client";

import React from 'react';
import { formatDate } from '../../services/blueskyService';
import ProfileImage from '../ProfileImage';
import { BlueskyPost } from '../../models/types';

// Remove the unused Post interface since we're using BlueskyPost now
interface PostsTabProps {
  posts: BlueskyPost[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function PostsTab({ posts, isLoading, error, hasMore, onLoadMore }: PostsTabProps) {
  // Render loading state
  if (isLoading && posts.length === 0) {
    return <div className="p-4 text-slate-400">Loading posts...</div>;
  }

  // Render error state
  if (error) {
    return <div className="p-4 text-red-400">Error loading posts: {error}</div>;
  }

  // Render empty state
  if (!posts || posts.length === 0) {
    return <div className="p-4 text-slate-400">No posts found.</div>;
  }

  return (
    <div>
      {/* Render posts */}
      {posts.map((post) => {
        // Simplified check - verify we have the minimal required data
        if (!post || !post.cid || !post.author || !post.author.handle) {
          console.warn('Invalid post structure:', post);
          return null; // Skip rendering this post
        }
        
        // Get record fields with fallbacks
        const postText = post.record?.text || '';
        const postDate = post.record?.createdAt ? formatDate(post.record.createdAt) : '';
        const postUrl = `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`;
        
        return (
          <a 
            key={post.cid}
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 hover:bg-slate-800/50 transition-colors cursor-pointer rounded-lg"
          >
            <div className="flex items-start">
              <ProfileImage 
                src={post.author.avatar || ''}
                alt={post.author.displayName || post.author.handle || 'Unknown'}
                className="w-10 h-10 rounded-full mr-3"
              />
              <div className="flex-1">
                <div className="flex justify-between">
                  <div>
                    <span className="font-bold text-slate-200">{post.author.displayName || post.author.handle}</span>{' '}
                    <span className="text-slate-400">@{post.author.handle}</span>
                  </div>
                  <span className="text-xs text-slate-500">{postDate}</span>
                </div>
                <p className="text-slate-300 mt-1 whitespace-pre-wrap break-words">{postText}</p>
              </div>
            </div>
          </a>
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