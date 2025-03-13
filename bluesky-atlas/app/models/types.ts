// Node data from the visualization
export interface NodeData {
  did: string;
  handle: string;
  display_name: string;
  description?: string;
  followers?: number;
  following?: number;
  posts?: number;
  bsky_url?: string;
  profile_image_url?: string;
}

// Bluesky API interface definitions
export interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followers?: {
    count: number;
  };
  following?: {
    count: number;
  };
  postsCount?: number;
  indexedAt?: string;
  [key: string]: any;
}

// Post interfaces
export interface PostRecord {
  text: string;
  createdAt: string;
  [key: string]: any;
}

export interface PostAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface BlueskyPost {
  uri: string;
  cid: string;
  author: PostAuthor;
  record: PostRecord;
  embed?: any;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  indexedAt: string;
  viewer?: any;
  labels?: any[];
}

// Feed response structures
export interface FeedViewPost {
  post?: {
    uri: string;
    cid: string;
    author: PostAuthor;
    record: PostRecord;
    indexedAt: string;
    [key: string]: any;
  };
  reply?: {
    root?: BlueskyPost;
    parent?: BlueskyPost;
  };
  reason?: any;
  [key: string]: any;
}

export interface BlueskyFeedResponse {
  feed: FeedViewPost[];
  cursor?: string;
}

// Followers/Following interfaces
export interface ProfileView {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  viewer?: any;
  labels?: any[];
  [key: string]: any;
}

export interface BlueskyFollower {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface BlueskyFollowersResponse {
  followers: ProfileView[];
  cursor?: string;
}

export interface BlueskyFollowingResponse {
  follows: ProfileView[];
  cursor?: string;
} 