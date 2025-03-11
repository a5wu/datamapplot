# Uncomment to install dependencies if needed
# import subprocess
# subprocess.run(["uv", "pip", "install", "dask[dataframe]<2025.0.1", "numpy", "datamapplot", "umap-learn", "torch", "pandas", "ipykernel"])
# uv pip install dask[dataframe]<2025.0.1 umap-learn torch pandas numpy ipykernel

import numpy as np
import datamapplot
import matplotlib.pyplot as plt
import umap
import torch
import pandas as pd
import os
import shutil
import random
import base64
from pathlib import Path

producer_embeddings = torch.load('./embeddings/producer_embeddings.pt', weights_only=False)
producer_communities = np.load('./embeddings/producer_communities.npy')

# Load 2D embeddings if they exist, otherwise create them
try:
    embeddings_2d = np.load('./embeddings/producer_embeddings_2d.npy')
except FileNotFoundError:
    # Reduce dimensionality to 2D using UMAP
    reducer = umap.UMAP(n_components=2, random_state=42)
    embeddings_2d = reducer.fit_transform(producer_embeddings)
    # Save the 2D embeddings
    np.save('./embeddings/producer_embeddings_2d.npy', embeddings_2d)

producer_df = pd.read_parquet('./embeddings/producer_profiles_with_avatars.parquet')
producer_df['bsky_url'] = producer_df['did'].apply(lambda x: f"https://bsky.app/profile/{x}")

# # Define a list of image URLs to randomly assign
# image_urls = [
#     "https://inkcap.us-east.host.bsky.network/xrpc/com.atproto.sync.getBlob?did=did:plc:7l75ck5g4b5k6gxqaq5rejit&cid=bafkreia2gyds76c6uk5szzdxvsfcvnm4nh5nvudchuu3tqc6nlkwetcjai",
#     "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/ItsukushimaTorii7379.jpg/330px-ItsukushimaTorii7379.jpg"
# ]
# Convert local WebP paths to base64 data URLs
def path_to_data_url(path):
    if pd.isna(path) or not path:
        return None
    try:
        # Fix path to account for running from root directory
        full_path = path
        if path and not os.path.isabs(path):
            # If path exists in embeddings directory, use that
            if os.path.exists(os.path.join('./embeddings', path)):
                full_path = os.path.join('./embeddings', path)
        
        with open(full_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            return f"data:image/webp;base64,{encoded_string}"
    except Exception as e:
        print(f"Error loading image {path}: {e}")
        return None

# Create image URLs from local paths
producer_df['profile_image_url'] = producer_df['avatar_local_path'].apply(path_to_data_url)

# # Make the first image URL rare (only 0.1% of the data)
# rare_image_probability = 0.001  # 0.1%
# producer_df['profile_image_url'] = [
#     image_urls[0] if random.random() < rare_image_probability else image_urls[1] 
#     for _ in range(len(producer_df))
# ]
# For any missing images, use a default image
default_image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/ItsukushimaTorii7379.jpg/330px-ItsukushimaTorii7379.jpg"
producer_df['profile_image_url'] = producer_df['profile_image_url'].fillna(default_image_url)

# Convert communities to string type
producer_communities = producer_communities.astype(str)

# Define hover text template for interactive visualization
hover_text_template = """
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <p style="font-weight: 600; font-size: 14px; margin: 0 0 2px 0;">{hover_text}</p>
    <p style="font-size: 14px; color: #666; margin: 0 0 8px 0;">@{handle}</p>
    <p style="font-size: 14px; color: #4A4A4A; margin: 0 0 8px 0;">{description}</p>
    <div style="display: flex; gap: 16px; font-size: 13px; color: #666;">
        <span><b>{followers}</b> followers</span>
        <span><b>{following}</b> following</span>
        <span><b>{posts}</b> posts</span>
    </div>
</div>
"""

# Create the plot
plot = datamapplot.create_interactive_plot(
    embeddings_2d, 
    producer_communities,
    hover_text=producer_df['display_name'].to_list(),
    extra_point_data=producer_df[['handle','description', 'followers', 'following', 'bsky_url', 'posts', 'profile_image_url']].fillna(''),
    hover_text_html_template=hover_text_template,
    on_click="window.open(hoverData.bsky_url[index], '_blank')",
    enable_search=True,
    search_field="description",
    background_color="#000000",
    point_radius_min_pixels=0.2,                  # Minimum dot size
    point_radius_max_pixels=16,                   # Maximum dot size
    point_text_field="handle",                    # Display handles as text labels
    point_text_min_zoom=10,                       # Lower zoom threshold for text visibility
    point_text_size=14,                           # Larger text size
    point_text_offset=[0, 20],                    # Position farther above points
    point_text_outline_width=3,                   # Thicker outline
    point_text_outline_color=[0, 0, 0, 255],      # Black outline for better contrast
    enable_point_images=True,                     # Enable point images
    point_image_min_zoom=10,                      # Only load and show images at zoom level 10
    # point_image_url="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/ItsukushimaTorii7379.jpg/330px-ItsukushimaTorii7379.jpg",
    # point_image_url="https://inkcap.us-east.host.bsky.network/xrpc/com.atproto.sync.getBlob?did=did:plc:7l75ck5g4b5k6gxqaq5rejit&cid=bafkreia2gyds76c6uk5szzdxvsfcvnm4nh5nvudchuu3tqc6nlkwetcjai",
    # For per-node images, uncomment and create field with image URLs:
    point_image_field="profile_image_url"
)

# Print some basic statistics about the embeddings
print(f"Original embedding shape: {producer_embeddings.shape}")
print(f"2D embedding shape: {embeddings_2d.shape}")
print(f"Number of posts: {len(producer_embeddings)}")
plot.save('producer_embeddings.html')
