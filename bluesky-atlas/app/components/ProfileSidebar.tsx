"use client";

import React, { useEffect, useState } from 'react';
import { 
  NodeData, 
  BlueskyProfile,
  FeedViewPost, 
  BlueskyPost,
  BlueskyFollower,
  ProfileView,
  BlueskyFeedResponse,
  BlueskyFollowersResponse,
  BlueskyFollowingResponse
} from '../models/types';
import TabInterface from './TabInterface';
import PostsTab from './tabs/PostsTab';
import FollowersTab from './tabs/FollowersTab';
import FollowingTab from './tabs/FollowingTab';
import ProfileImage from './ProfileImage';
import { 
  getProfile, 
  getUserPosts, 
  getFollowers, 
  getFollowing 
} from '../services/blueskyService';

interface ProfileSidebarProps {
  selectedNode: NodeData | null;
}

// Add these two constant key values to prevent layout shifts when node changes
const SIDEBAR_MIN_HEIGHT = "calc(100vh - 64px)"; // Adjust based on your layout
const CONTENT_MIN_HEIGHT = "400px"; // Minimum height for tab content

export default function ProfileSidebar({ selectedNode }: ProfileSidebarProps) {
  // States for the different data types
  const [profile, setProfile] = useState<BlueskyProfile | null>(null);
  const [posts, setPosts] = useState<BlueskyPost[]>([]);
  const [followers, setFollowers] = useState<BlueskyFollower[]>([]);
  const [following, setFollowing] = useState<BlueskyFollower[]>([]);
  
  // Pagination cursors
  const [postsCursor, setPostsCursor] = useState<string | undefined>(undefined);
  const [followersCursor, setFollowersCursor] = useState<string | undefined>(undefined);
  const [followingCursor, setFollowingCursor] = useState<string | undefined>(undefined);
  
  // "Has more data" flags
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [hasMoreFollowers, setHasMoreFollowers] = useState(false);
  const [hasMoreFollowing, setHasMoreFollowing] = useState(false);
  
  // Loading states
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isPostsLoading, setIsPostsLoading] = useState(false);
  const [isFollowersLoading, setIsFollowersLoading] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  
  // Error states
  const [profileError, setProfileError] = useState<string | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [followersError, setFollowersError] = useState<string | null>(null);
  const [followingError, setFollowingError] = useState<string | null>(null);
  
  // Add a change key to force the TabInterface to maintain position when node changes
  const [contentKey, setContentKey] = useState<string>("stable-content");
  // Add state to track the currently active tab
  const [activeTabId, setActiveTabId] = useState<string>("posts");
  
  // Function to fetch posts with pagination
  const fetchPosts = (did: string, cursor?: string) => {
    setIsPostsLoading(true);
    getUserPosts(did, 25, cursor)
      .then(data => {
        console.log("API Posts data:", data);
        // Apply validation and transformation to ensure proper data structure
        const validatedPosts = (data.feed || []).map((feedItem: FeedViewPost) => {
          // Check if feedItem is valid
          if (!feedItem) return null;
          
          // Most common case - direct post
          if (feedItem.post) {
            const post = feedItem.post;
            return {
              uri: post.uri,
              cid: post.cid,
              author: {
                did: post.author.did,
                handle: post.author.handle,
                displayName: post.author.displayName || '',
                avatar: post.author.avatar || ''
              },
              record: {
                text: post.record.text || '',
                createdAt: post.record.createdAt || new Date().toISOString()
              },
              indexedAt: post.indexedAt || new Date().toISOString()
            } as BlueskyPost;
          }
          
          // Handle reply case
          else if (feedItem.reply && feedItem.reply.parent) {
            const parent = feedItem.reply.parent;
            return {
              uri: parent.uri,
              cid: parent.cid,
              author: {
                did: parent.author.did,
                handle: parent.author.handle,
                displayName: parent.author.displayName || '',
                avatar: parent.author.avatar || ''
              },
              record: {
                text: parent.record.text || '',
                createdAt: parent.record.createdAt || new Date().toISOString()
              },
              indexedAt: parent.indexedAt || new Date().toISOString()
            } as BlueskyPost;
          }
          
          return null;
        }).filter(Boolean) as BlueskyPost[]; // Remove any null entries and cast to BlueskyPost[]
        
        // Append new posts if we're paginating, otherwise replace
        if (cursor) {
          setPosts(prevPosts => [...prevPosts, ...validatedPosts]);
        } else {
          setPosts(validatedPosts);
        }
        
        // Update cursor and hasMore flag
        setPostsCursor(data.cursor);
        setHasMorePosts(!!data.cursor);
        setPostsError(null);
      })
      .catch(err => {
        console.error('Error fetching posts:', err);
        setPostsError('Failed to load posts');
      })
      .finally(() => setIsPostsLoading(false));
  };
  
  // Function to fetch followers with pagination
  const fetchFollowers = (did: string, cursor?: string) => {
    setIsFollowersLoading(true);
    getFollowers(did, 50, cursor)
      .then(data => {
        console.log("API Followers data:", data);
        // Validate followers data
        const validatedFollowers = (data.followers || []).map((follower: ProfileView) => {
          if (!follower) return null;
          
          return {
            did: follower.did,
            handle: follower.handle,
            displayName: follower.displayName || '',
            avatar: follower.avatar || ''
          } as BlueskyFollower;
        }).filter(Boolean) as BlueskyFollower[];
        
        // Append new followers if we're paginating, otherwise replace
        if (cursor) {
          setFollowers(prevFollowers => [...prevFollowers, ...validatedFollowers]);
        } else {
          setFollowers(validatedFollowers);
        }
        
        // Update cursor and hasMore flag
        setFollowersCursor(data.cursor);
        setHasMoreFollowers(!!data.cursor);
        setFollowersError(null);
      })
      .catch(err => {
        console.error('Error fetching followers:', err);
        setFollowersError('Failed to load followers');
      })
      .finally(() => setIsFollowersLoading(false));
  };
  
  // Function to fetch following with pagination
  const fetchFollowing = (did: string, cursor?: string) => {
    setIsFollowingLoading(true);
    getFollowing(did, 50, cursor)
      .then(data => {
        console.log("API Following data:", data);
        // Validate following data
        const validatedFollowing = (data.follows || []).map((follow: ProfileView) => {
          if (!follow) return null;
          
          return {
            did: follow.did,
            handle: follow.handle,
            displayName: follow.displayName || '',
            avatar: follow.avatar || ''
          } as BlueskyFollower;
        }).filter(Boolean) as BlueskyFollower[];
        
        // Append new following if we're paginating, otherwise replace
        if (cursor) {
          setFollowing(prevFollowing => [...prevFollowing, ...validatedFollowing]);
        } else {
          setFollowing(validatedFollowing);
        }
        
        // Update cursor and hasMore flag
        setFollowingCursor(data.cursor);
        setHasMoreFollowing(!!data.cursor);
        setFollowingError(null);
      })
      .catch(err => {
        console.error('Error fetching following:', err);
        setFollowingError('Failed to load following');
      })
      .finally(() => setIsFollowingLoading(false));
  };
  
  // Handle loading more posts
  const handleLoadMorePosts = () => {
    if (!selectedNode || !postsCursor || isPostsLoading) return;
    fetchPosts(selectedNode.did, postsCursor);
  };
  
  // Handle loading more followers
  const handleLoadMoreFollowers = () => {
    if (!selectedNode || !followersCursor || isFollowersLoading) return;
    fetchFollowers(selectedNode.did, followersCursor);
  };
  
  // Handle loading more following
  const handleLoadMoreFollowing = () => {
    if (!selectedNode || !followingCursor || isFollowingLoading) return;
    fetchFollowing(selectedNode.did, followingCursor);
  };
  
  // Track tab changes and load data for the selected tab if needed
  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);
    
    // Only fetch data if we don't have any data for this tab yet and the node is selected
    if (!selectedNode) return;
    const { did } = selectedNode;
    
    if (tabId === 'posts' && posts.length === 0 && !isPostsLoading) {
      fetchPosts(did);
    } else if (tabId === 'followers' && followers.length === 0 && !isFollowersLoading) {
      fetchFollowers(did);
    } else if (tabId === 'following' && following.length === 0 && !isFollowingLoading) {
      fetchFollowing(did);
    }
  };
  
  // Effect to fetch data when selectedNode changes
  useEffect(() => {
    if (!selectedNode) return;
    
    const { did } = selectedNode;
    
    // Reset states and cursors
    setProfile(null);
    setPosts([]);
    setFollowers([]);
    setFollowing([]);
    setPostsCursor(undefined);
    setFollowersCursor(undefined);
    setFollowingCursor(undefined);
    setHasMorePosts(false);
    setHasMoreFollowers(false);
    setHasMoreFollowing(false);
    
    setProfileError(null);
    setPostsError(null);
    setFollowersError(null);
    setFollowingError(null);
    
    // Use random key to maintain scroll position between different nodes
    // This needs to change only when the node changes, not when loading more content
    setContentKey(`content-${did}`);
    
    // Fetch profile data
    setIsProfileLoading(true);
    getProfile(did)
      .then(data => {
        console.log("API Profile data:", data);
        setProfile(data);
        setProfileError(null);
      })
      .catch(err => {
        console.error('Error fetching profile:', err);
        setProfileError('Failed to load profile information');
      })
      .finally(() => setIsProfileLoading(false));
    
    // Only fetch data for the active tab initially
    if (activeTabId === 'posts') {
      fetchPosts(did);
    } else if (activeTabId === 'followers') {
      fetchFollowers(did);
    } else if (activeTabId === 'following') {
      fetchFollowing(did);
    }
    
  }, [selectedNode]); // Remove activeTabId from dependency array
  
  // If no node is selected, show the instruction message
  if (!selectedNode) {
    return (
      <div className="col-span-3 bg-slate-900 border-l border-slate-700 overflow-y-auto custom-scrollbar h-full" style={{ minHeight: SIDEBAR_MIN_HEIGHT }}>
        <div className="p-4 text-slate-400 flex flex-col items-center justify-center h-full">
          <div className="h-12 w-12 mb-3 rounded-full bg-slate-700 text-blue-300 flex items-center justify-center text-xl font-bold">
            i
          </div>
          <p className="text-center">
            Click on a node in the visualization to view details about that user.
          </p>
        </div>
      </div>
    );
  }

  // Get profile data for header
  const displayName = profile?.displayName || selectedNode.display_name;
  const handle = profile?.handle || selectedNode.handle;
  const description = profile?.description || selectedNode.description || '';
  const followersCount = profile?.followers?.count || selectedNode.followers || 0;
  const followingCount = profile?.following?.count || selectedNode.following || 0;
  const postsCount = profile?.postsCount || selectedNode.posts || 0;
  const avatar = profile?.avatar || selectedNode.profile_image_url || '';
  const profileUrl = `https://bsky.app/profile/${handle}`;
  
  // Define tabs with their content (now with pagination)
  const tabs = [
    {
      id: 'posts',
      label: 'Posts',
      content: (
        <div className="custom-scrollbar p-3" style={{ minHeight: CONTENT_MIN_HEIGHT }}>
          <PostsTab 
            posts={posts} 
            isLoading={isPostsLoading} 
            error={postsError}
            hasMore={hasMorePosts}
            onLoadMore={handleLoadMorePosts}
          />
        </div>
      )
    },
    {
      id: 'followers',
      label: 'Followers',
      content: (
        <div className="custom-scrollbar p-3" style={{ minHeight: CONTENT_MIN_HEIGHT }}>
          <FollowersTab 
            followers={followers} 
            isLoading={isFollowersLoading} 
            error={followersError}
            hasMore={hasMoreFollowers}
            onLoadMore={handleLoadMoreFollowers}
          />
        </div>
      )
    },
    {
      id: 'following',
      label: 'Following',
      content: (
        <div className="custom-scrollbar p-3" style={{ minHeight: CONTENT_MIN_HEIGHT }}>
          <FollowingTab 
            following={following} 
            isLoading={isFollowingLoading} 
            error={followingError}
            hasMore={hasMoreFollowing}
            onLoadMore={handleLoadMoreFollowing}
          />
        </div>
      )
    }
  ];
  
  return (
    <div className="col-span-3 bg-slate-900 border-l border-slate-700 overflow-hidden custom-scrollbar h-full flex flex-col" style={{ minHeight: SIDEBAR_MIN_HEIGHT }}>
      {/* Profile Header */}
      <div className="flex-none">
        {/* Banner with profile image overlay - Bluesky style */}
        <div className="relative">
          {/* Banner image */}
          <div className="h-32 w-full bg-neutral-900 overflow-hidden">
            {profile?.banner && (
              <img 
                src={profile.banner} 
                alt={`${displayName}'s banner`}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          
          {/* Profile image - positioned to overlap the banner, without border, and clickable */}
          <div className="absolute left-5 -bottom-8">
            <a 
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`View ${displayName} on Bluesky`}
            >
              <ProfileImage 
                src={avatar} 
                alt={displayName || 'User'}
                className="w-16 h-16 rounded-full object-cover hover:opacity-90 transition-opacity"
              />
            </a>
          </div>
        </div>
        
        {/* Profile info with padding to account for the overlapping profile image - aligned below image */}
        <div className="pt-10 pb-3 px-5">
          {/* Name and handle - directly below profile image */}
          <div>
            <a 
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              title={`View ${displayName} on Bluesky`}
            >
              <h2 className="text-xl font-bold text-white leading-tight">{displayName}</h2>
            </a>
            <p className="text-gray-400 text-xs">@{handle}</p>
          </div>
          
          {isProfileLoading ? (
            <div className="my-1 text-gray-400 text-xs">Loading profile data...</div>
          ) : profileError ? (
            <div className="my-1 text-red-400 text-xs">Error: {profileError}</div>
          ) : (
            <>
              {/* Bio/Description - with same style as tab content */}
              {description && (
                <p className="text-slate-300 mt-3 text-sm whitespace-pre-wrap break-words">{description}</p>
              )}

              {/* Follower stats - reordered to match tab order (posts, followers, following) */}
              <div className="flex space-x-3 text-xs mt-3">
                <div>
                  <span className="font-medium text-white">{postsCount.toLocaleString()}</span>{' '}
                  <span className="text-gray-400">posts</span>
                </div>
                <div>
                  <span className="font-medium text-white">{followersCount.toLocaleString()}</span>{' '}
                  <span className="text-gray-400">followers</span>
                </div>
                <div>
                  <span className="font-medium text-white">{followingCount.toLocaleString()}</span>{' '}
                  <span className="text-gray-400">following</span>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Divider before tabs */}
        <div className="border-b border-slate-700"></div>
      </div>
      
      {/* Tabs below profile header - using Bluesky-like styling */}
      <div className="flex-1 overflow-hidden">
        <TabInterface 
          key={contentKey} 
          tabs={tabs} 
          defaultTabId={activeTabId} 
          onTabChange={handleTabChange}
        />
      </div>
    </div>
  );
} 