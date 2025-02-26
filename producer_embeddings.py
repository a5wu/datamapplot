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

producer_df = pd.read_parquet('./embeddings/producer_profiles.parquet')
producer_df['bsky_url'] = producer_df['did'].apply(lambda x: f"https://bsky.app/profile/{x}")

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

# Make sure example_image.jpg exists in the embeddings directory
# If not, create a simple colored circle as a placeholder
if not os.path.exists('example_image.jpg'):
    # Create a simple colored circle as the example image
    fig, ax = plt.subplots(figsize=(1, 1), dpi=128)
    circle = plt.Circle((0.5, 0.5), 0.4, color='blue', alpha=0.7)
    ax.add_patch(circle)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')
    plt.savefig('example_image.jpg', bbox_inches='tight', pad_inches=0)
    plt.close(fig)

# Create the plot
plot = datamapplot.create_interactive_plot(
    embeddings_2d, 
    producer_communities,
    hover_text=producer_df['display_name'].to_list(),
    extra_point_data=producer_df[['handle','description', 'followers', 'following', 'bsky_url', 'posts']].fillna(''),
    hover_text_html_template=hover_text_template,
    on_click="window.open(hoverData.bsky_url[index], '_blank')",
    enable_search=True,
    search_field="description",
    background_color="#000000",
    # Add point text labels that show handles when zoomed in
    # point_text_field="handle",      # Use handle as the text label
    # point_text_min_zoom=8,          # Show labels when zoom level is 8 or higher
    # point_text_size=12,             # 12px font size
    # point_text_offset=[0, 14],      # Position labels 14px above the points
    # point_text_outline_width=2,     # Add a 2px outline for better readability
    # point_text_outline_color=[255, 255, 255, 200],  # White outline with 80% opacity
    # font_family="Arial, sans-serif", # Use a system font that's definitely available
    # offline_mode=True
)

# Print some basic statistics about the embeddings
print(f"Original embedding shape: {producer_embeddings.shape}")
print(f"2D embedding shape: {embeddings_2d.shape}")
print(f"Number of posts: {len(producer_embeddings)}")
plot.save('producer_embeddings.html')
