# Uncomment to install dependencies if needed
# import subprocess
# subprocess.run(["uv", "pip", "install", "dask[dataframe]<2025.0.1", "numpy", "datamapplot", "umap-learn", "torch", "pandas", "ipykernel"])
# install dask[dataframe]<2025.0.1 numpy umap-learn torch pandas ipykernel

import numpy as np
import datamapplot
import matplotlib.pyplot as plt
import umap
import torch
import pandas as pd

def main():
    producer_embeddings = torch.load('producer_embeddings.pt', weights_only=False)
    producer_communities = np.load('producer_communities.npy')

    # Load 2D embeddings if they exist, otherwise create them
    try:
        embeddings_2d = np.load('producer_embeddings_2d.npy')
    except FileNotFoundError:
        # Reduce dimensionality to 2D using UMAP
        reducer = umap.UMAP(n_components=2, random_state=42)
        embeddings_2d = reducer.fit_transform(producer_embeddings)
        # Save the 2D embeddings
        np.save('producer_embeddings_2d.npy', embeddings_2d)

    producer_df = pd.read_parquet('producer_profiles.parquet')
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
        offline_mode=True
    )

    # Print some basic statistics about the embeddings
    print(f"Original embedding shape: {producer_embeddings.shape}")
    print(f"2D embedding shape: {embeddings_2d.shape}")
    print(f"Number of posts: {len(producer_embeddings)}")
    plot.save('producer_embeddings.html')

if __name__ == "__main__":
    main()