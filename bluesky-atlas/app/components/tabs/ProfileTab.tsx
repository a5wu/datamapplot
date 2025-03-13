"use client";

import React from 'react';
import ProfileImage from '../ProfileImage';
import { NodeData, BlueskyProfile } from '../../models/types';

interface ProfileTabProps {
  profile: NodeData;
  apiProfile?: BlueskyProfile | null;
  isLoading: boolean;
  error?: string | null;
}

export default function ProfileTab({ profile, apiProfile, isLoading, error }: ProfileTabProps) {
  if (isLoading) {
    return <div className="p-4 text-slate-400">Loading profile data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-400">Error loading profile: {error}</div>;
  }

  // Use API profile data if available, otherwise fallback to node data
  const displayName = apiProfile?.displayName || profile.display_name;
  const handle = apiProfile?.handle || profile.handle;
  const description = apiProfile?.description || profile.description;
  const followersCount = apiProfile?.followers?.count || profile.followers || 0;
  const followingCount = apiProfile?.following?.count || profile.following || 0;
  const postsCount = apiProfile?.postsCount || profile.posts || 0;
  const avatar = apiProfile?.avatar || profile.profile_image_url || '';  // Ensure avatar is never undefined
  const profileUrl = `https://bsky.app/profile/${handle}`;

  return (
    <div className="p-4">
      {apiProfile?.banner && (
        <div className="h-32 w-full overflow-hidden rounded-t-lg -mx-4 -mt-4 mb-4">
          <img 
            src={apiProfile.banner} 
            alt={`${displayName}'s banner`}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="mb-4 flex items-center">
        <ProfileImage 
          src={avatar} 
          alt={displayName || 'User'}
          className="w-16 h-16 rounded-full mr-3"
        />
        <div>
          <h2 className="text-xl font-bold text-slate-100">{displayName}</h2>
          <a 
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer" 
            className="text-blue-400 hover:underline"
          >
            @{handle}
          </a>
        </div>
      </div>
      
      <p className="text-slate-300 mb-4 whitespace-pre-wrap break-words">{description}</p>
      
      <div className="flex justify-between text-sm">
        <div className="text-center">
          <div className="font-bold text-slate-200">{followersCount.toLocaleString()}</div>
          <div className="text-slate-400">Followers</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-slate-200">{followingCount.toLocaleString()}</div>
          <div className="text-slate-400">Following</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-slate-200">{postsCount.toLocaleString()}</div>
          <div className="text-slate-400">Posts</div>
        </div>
      </div>
      
      {/* Additional API profile data if available */}
      {apiProfile && (
        <div className="mt-4 border-t border-slate-700 pt-4">
          <div className="text-sm text-slate-400">
            {apiProfile.indexedAt && (
              <div className="mb-2">
                <span className="font-semibold">Indexed:</span> {new Date(apiProfile.indexedAt).toLocaleString()}
              </div>
            )}
            <div className="mb-2">
              <span className="font-semibold">DID:</span> {apiProfile.did}
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-4">
        <a 
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-blue-600 text-white text-center py-2 px-4 rounded hover:bg-blue-700"
        >
          View Profile
        </a>
      </div>
    </div>
  );
} 