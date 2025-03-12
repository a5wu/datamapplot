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
# Filter out rows without a handle
producer_df['bsky_url'] = producer_df['did'].apply(lambda x: f"https://bsky.app/profile/{x}")

# Define a list of image URLs to randomly assign
image_urls = [
    # "https://inkcap.us-east.host.bsky.network/xrpc/com.atproto.sync.getBlob?did=did:plc:7l75ck5g4b5k6gxqaq5rejit&cid=bafkreia2gyds76c6uk5szzdxvsfcvnm4nh5nvudchuu3tqc6nlkwetcjai",
    # "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/ItsukushimaTorii7379.jpg/330px-ItsukushimaTorii7379.jpg"
    # "https://cors-anywhere.herokuapp.com/https://cdn.bsky.app/img/avatar/plain/did:plc:5u54z2qgkq43dh2nzwzdbbhb/bafkreif2ng565gq22mobaq5olikueiux7qcpr6d62zrkbph42m65r7cekm@jpeg",
    "data:image/webp;base64,UklGRsoBAABXRUJQVlA4WAoAAAAQAAAAHwAAHwAAQUxQSEMAAAABDzD/ERGCVSRZjZZCwJOAFKQ9pCKBTy7O5eAgov8ToGrS7BKEArGCNUinDnkGP63A3b/roxn81CE3SKcKViAKgmYXAFZQOCBgAQAA8AYAnQEqIAAgAD7RXKhOKCUkIigKqQAaCWwAnRmmtufdpL2FXILIEzmhc/XvJQtPNIEoKlfj8PtNmNubbfOB4AD+y/U3yNkj55hzFuH8SwMkLxbcoZOHP/1vms+ePdPJczorqDFOP7+3TCB81On4zvUVAB/jsdoyunLLhpRVwBJcIuVcOrOvnec8EgVCV/UEo37YrnpMpJenqbaG64SmX+rt8rN8wZ7oKtU+Tkc9vKtvEP+8NpcqKPbMsPYbZAid/xTORJ+iSMn0o0yuQqC3HP52NzVvt4+YCV05srUHaNLik3/osimr5CYm0SOwlHqevmKjaKLZzAQA1NNOF6eCMPKzb/F7UfPar6idNzwlynC06WsN25sHsfl7xLaNTYYV4htHzXbyU1wrR8zq5tx+nAwn7ulmoL/gheuVdtJBCmBedAnCL8LsVA0KDffSWgM3PDCkO6supTL+iZZu3e7gAA==",
    "data:image/webp;base64,UklGRqYBAABXRUJQVlA4WAoAAAAQAAAAHwAAHwAAQUxQSEMAAAABDzD/ERGCVSRZjZZCwJOAFKQ9pCKBTy7O5eAgov8ToGrS7BKEArGCNUinDnkGP63A3b/roxn81CE3SKcKViAKgmYXAFZQOCA8AQAAkAcAnQEqIAAgAD7RWKFLqCUjIbAYDAEAGgliAHjSKBRgcbMoGHTZ/C6U22R4FShp721WeQWT4c5+vbu9lN49HS//wTaAAP5vY5TcklXVOoJJsafpB8xcl8amFOt9dG7kj0Ld1pY1VoLzkjhhIfXfIS1CxPwN1u2cnsUI3TAT4OhmZ+rL5fRhvRyIQexslgWT4/5t2c+XMSB3eEn0txyizc8fCjiZamGAXC6IdAtqh6K2RGOBdSrZ1bfOuoItE9Uxi5ZrJ6494h4jmQtfcrK/BzH8Fsp4zUTN/SwoKuc8N+izRkQljfTjMWpXaUfnrVVzjcjT9neUDEY5uBJ+IRTxF0RQ1w+PPEotKQBd+aWJZBhMtC5E+5paIdNPGizkR6IIVSrHBNMVcvlFLj5THpcayBjPvkXWUnAmmNAAAA=="
]

# Make the first image URL rare (only 0.1% of the data)
rare_image_probability = 0.5  # 0.1%
producer_df['profile_image_url'] = [
    image_urls[0] if random.random() < rare_image_probability else image_urls[1] 
    for _ in range(len(producer_df))
]


# # Convert local WebP paths to base64 data URLs
# def path_to_data_url(path):
#     if pd.isna(path) or not path:
#         return None
#     try:
#         # Fix path to account for running from root directory
#         full_path = path
#         if path and not os.path.isabs(path):
#             # If path exists in embeddings directory, use that
#             if os.path.exists(os.path.join('./embeddings', path)):
#                 full_path = os.path.join('./embeddings', path)
        
#         with open(full_path, "rb") as image_file:
#             encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
#             return f"data:image/webp;base64,{encoded_string}"
#     except Exception as e:
#         print(f"Error loading image {path}: {e}")
#         return None

# # Create image URLs from local paths
# producer_df['profile_image_url'] = producer_df['avatar_local_path'].apply(path_to_data_url)

# # For any missing images, use a default image
# default_image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/ItsukushimaTorii7379.jpg/330px-ItsukushimaTorii7379.jpg"
# producer_df['profile_image_url'] = producer_df['profile_image_url'].fillna(default_image_url)



# Convert communities to string type
producer_communities = producer_communities.astype(str)

follower_counts = producer_df['followers'].fillna(1).to_numpy()
min_size = 3  # Minimum marker size
max_size = 100  # Maximum marker size
log_followers = np.log1p(follower_counts)  # log(1+x) to handle zeros
marker_size_array = min_size + (max_size - min_size) * (log_followers - log_followers.min()) / (log_followers.max() - log_followers.min())

# Define hover text template for interactive visualization
hover_text_template = """
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <p style="font-weight: 800; font-size: 16px; margin: 0 0 2px 0; color: #FFFFFF;">{hover_text}</p>
    <p style="font-size: 14px; color: #64D2FF; font-weight: 600; margin: 0 0 8px 0;">@{handle}</p>
    <p style="font-size: 14px; color: #E0E0E0; margin: 0 0 12px 0; font-style: italic;">{description}</p>
    <div style="display: flex; gap: 16px; font-size: 13px; font-weight: 600; border-top: 1px solid #444; padding-top: 8px;">
        <span style="color: #6FE792;"><b>{followers}</b> followers</span>
        <span style="color: #FFB966;"><b>{following}</b> following</span>
        <span style="color: #FF9ED2;"><b>{posts}</b> posts</span>
    </div>
</div>
"""

tooltip_css = """
    position: absolute;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 0.9em;
    font-weight: 600;
    color: #000000;
    background-color: rgba(255, 255, 255, 0.95);
    border-radius: 8px;
    padding: 10px 14px;
    margin-left: 15px;
    max-width: 300px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    pointer-events: none;
    z-index: 1000;
    transform: translateY(-50%);
}
"""

# Create the plot
plot = datamapplot.create_interactive_plot(
    embeddings_2d, 
    producer_communities,
    hover_text=producer_df['display_name'].to_list(),
    extra_point_data=producer_df[['did','handle','description', 'followers', 'following', 'bsky_url', 'posts', 'profile_image_url']].fillna(''),
    hover_text_html_template=hover_text_template,
    on_click="""
        // Extract only the data for this specific node
        const nodeData = {{
            did: hoverData.did[index],
            handle: hoverData.handle[index],
            display_name: hoverData.hover_text[index],
            description: hoverData.description[index],
            followers: hoverData.followers[index],
            following: hoverData.following[index],
            posts: hoverData.posts[index],
            bsky_url: hoverData.bsky_url[index],
            profile_image_url: hoverData.profile_image_url[index]
        }};
        
        // Add debug message to confirm this code is executing
        console.log("Sending node data to parent:", nodeData);
        
        // Send only this node's data to the parent
        window.parent.postMessage({{type: 'node_click', data: nodeData}}, '*');
    """,
    enable_search=True,
    search_field="description",
    background_color="#000000",
    marker_size_array=marker_size_array,
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
    point_image_field="profile_image_url",        # Use our base64-encoded images
    point_image_border_size_factor=0.85,          # Control border thickness (smaller = thicker)
    point_image_show_outline=False,               # Disable the grey outline for cleaner look
    tooltip_css=tooltip_css
)

# Print some basic statistics about the embeddings
print(f"Original embedding shape: {producer_embeddings.shape}")
print(f"2D embedding shape: {embeddings_2d.shape}")
print(f"Number of posts: {len(producer_embeddings)}")
# Save the plot to the original location
plot.save('producer_embeddings.html')

# Also save it to the public directory for Next.js to serve
plot.save('bluesky-atlas/public/producer_embeddings.html')

