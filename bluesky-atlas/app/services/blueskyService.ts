import { BskyAgent } from '@atproto/api';

// Create a singleton agent
const agent = new BskyAgent({
  service: 'https://bsky.social',
});

// Connect with auth credentials from .env
export async function connectAgent() {
  if (!agent.session) {
    try {
      // Get credentials from environment variables
      const identifier = process.env.NEXT_PUBLIC_BLUESKY_IDENTIFIER;
      const password = process.env.NEXT_PUBLIC_BLUESKY_PASSWORD;
      
      if (identifier && password) {
        // Login with credentials
        await agent.login({
          identifier,
          password,
        });
        console.log("Authenticated with Bluesky API");
      } else {
        // Fallback to anonymous mode if credentials are not available
        console.warn("No Bluesky credentials found in .env, using anonymous mode");
      }
    } catch (error) {
      console.error("Error connecting to Bluesky API:", error);
      console.warn("Falling back to anonymous mode");
    }
  }
  return agent;
}

// Get profile information
export async function getProfile(did: string) {
  const agent = await connectAgent();
  try {
    const { data } = await agent.getProfile({ actor: did });
    return data;
  } catch (error) {
    console.error("Error fetching profile:", error);
    throw error;
  }
}

// Get user's posts with pagination support
export async function getUserPosts(did: string, limit = 25, cursor?: string) {
  const agent = await connectAgent();
  try {
    const { data } = await agent.getAuthorFeed({ 
      actor: did, 
      limit,
      cursor 
    });
    return data;
  } catch (error) {
    console.error("Error fetching user posts:", error);
    throw error;
  }
}

// Get user's followers with pagination support
export async function getFollowers(did: string, limit = 50, cursor?: string) {
  const agent = await connectAgent();
  try {
    const { data } = await agent.getFollowers({ 
      actor: did, 
      limit, 
      cursor 
    });
    return data;
  } catch (error) {
    console.error("Error fetching followers:", error);
    throw error;
  }
}

// Get accounts the user follows with pagination support
export async function getFollowing(did: string, limit = 50, cursor?: string) {
  const agent = await connectAgent();
  try {
    const { data } = await agent.getFollows({ 
      actor: did, 
      limit, 
      cursor 
    });
    return data;
  } catch (error) {
    console.error("Error fetching following:", error);
    throw error;
  }
}

// Format a post's text content
export function formatPostText(text: string): string {
  // Simple formatting - you could enhance this with link detection, etc.
  return text;
}

// Format a timestamp to a readable date
export function formatDate(datetime: string): string {
  return new Date(datetime).toLocaleString();
} 