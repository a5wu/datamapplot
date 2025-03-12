# Bluesky Atlas

An interactive visualization of the Bluesky social graph, showing connections between users and communities.

## Overview

Bluesky Atlas embeds a data visualization created with [datamapplot](https://github.com/paired-maps/datamapplot) to display user relationships and community clusters in the Bluesky social network. The visualization allows you to:

- Explore the Bluesky social graph
- Identify communities and clusters of users
- Search for specific users or topics
- View profile images and metadata when zoomed in

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd bluesky-atlas
   ```

2. Install dependencies:
   ```
   npm install
   # or
   yarn install
   ```

3. Run the development server:
   ```
   npm run dev
   # or
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Features

- **Interactive Visualization**: Pan, zoom, and explore the social graph
- **Community Detection**: Users are clustered by community
- **Profile Images**: See user avatars when zoomed in
- **Search**: Find specific users or content
- **Responsive Design**: Works on desktop and mobile devices

## Deployment

This application can be deployed to Vercel or any platform that supports Next.js:

```
npm run build
npm run start
```

## Acknowledgments

- Based on [datamapplot](https://github.com/paired-maps/datamapplot) for interactive data visualization
- Bluesky social graph data analysis
