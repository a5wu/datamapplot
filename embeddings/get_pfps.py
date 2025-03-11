#!/usr/bin/env python3
# avatar_processor.py - Download and process Bluesky avatar images

import requests
import pandas as pd
from PIL import Image, ImageDraw
import io
import os
from pathlib import Path
import concurrent.futures
from functools import lru_cache
import time
import threading
from tqdm import tqdm
import argparse

class RateLimiter:
    """Token bucket rate limiter for controlling request rates"""
    def __init__(self, rate=10):
        self.rate = rate  # requests per second
        self.tokens = rate  # initial tokens
        self.last_updated = time.time()
        self.lock = threading.Lock()
    
    def acquire(self):
        with self.lock:
            now = time.time()
            # Refill tokens based on elapsed time
            elapsed = now - self.last_updated
            self.tokens = min(self.rate, self.tokens + elapsed * self.rate)
            self.last_updated = now
            
            if self.tokens >= 1:
                self.tokens -= 1
                return 0  # No need to wait
            
            wait_time = (1 - self.tokens) / self.rate
            self.tokens = 0
            return wait_time

@lru_cache(maxsize=10)
def create_circular_mask(size):
    """Create a circular mask for cropping images, cached for common sizes"""
    width, height = size
    mask = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, width, height), fill=(255, 255, 255, 255))
    return mask

def process_avatar(args, rate_limiter=None):
    """Process a single avatar image with rate limiting
    
    Args:
        args: Tuple of (did, avatar_url, quality, max_size, output_dir)
        rate_limiter: Optional RateLimiter instance
    
    Returns:
        Tuple of (did, filepath) where filepath is None on error
    """
    did, avatar_url, quality, max_size, output_dir = args
    
    if not avatar_url:
        return did, None
    
    # Generate a filename from the DID
    filename = f"{did.split(':')[-1]}.webp"
    filepath = output_dir / filename
    
    # Skip if file already exists
    if filepath.exists():
        return did, str(filepath)
    
    try:
        # Apply rate limiting before making the request
        if rate_limiter:
            wait_time = rate_limiter.acquire()
            if wait_time > 0:
                time.sleep(wait_time)
        
        # Download image
        with requests.Session() as session:
            response = session.get(avatar_url, timeout=5)
            response.raise_for_status()
        
        # Process image
        img = Image.open(io.BytesIO(response.content))
        
        # Resize if larger than max_size
        if max(img.width, img.height) > max_size:
            if img.width > img.height:
                new_width = max_size
                new_height = int(img.height * max_size / img.width)
            else:
                new_height = max_size
                new_width = int(img.width * max_size / img.height)
            img = img.resize((new_width, new_height), Image.LANCZOS)
        
        # Convert to RGBA if needed
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Apply circular mask
        mask = create_circular_mask(img.size)
        result = Image.new('RGBA', img.size, (0, 0, 0, 0))
        result.paste(img, (0, 0), mask=mask)
        
        # Save as WEBP
        result.save(filepath, 'WEBP', quality=quality, lossless=False)
        
        return did, str(filepath)
    except Exception as e:
        return did, None

def process_avatars_parallel(df, output_dir="avatar_images", quality=50, max_size=32, max_workers=20, rate_limit=10):
    """Process multiple avatars in parallel with rate limiting
    
    Args:
        df: Pandas DataFrame with 'did' and 'avatar_url' columns
        output_dir: Directory to save processed avatar images
        quality: WEBP quality (0-100)
        max_size: Maximum dimension for resizing images
        max_workers: Number of parallel worker threads
        rate_limit: Requests per second limit
        
    Returns:
        Dictionary mapping DIDs to local file paths
    """
    # Create output directory if it doesn't exist
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    # Get rows with non-null avatar URLs
    avatar_rows = df[df['avatar_url'].notna()]
    print(f"Processing {len(avatar_rows)} avatar images with rate limit of {rate_limit}/second...")
    
    # Create rate limiter
    rate_limiter = RateLimiter(rate=rate_limit)
    
    # Prepare arguments for parallel processing
    args_list = [(row['did'], row['avatar_url'], quality, max_size, output_dir) 
                 for _, row in avatar_rows.iterrows()]
    
    # Process in parallel using ThreadPoolExecutor with rate limiting
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Create a function with bound rate limiter
        def process_with_rate_limit(args):
            return process_avatar(args, rate_limiter)
        
        # Submit all tasks
        futures = [executor.submit(process_with_rate_limit, args) for args in args_list]
        
        # Process results as they complete
        for future in tqdm(concurrent.futures.as_completed(futures), total=len(args_list)):
            did, filepath = future.result()
            if filepath:
                results[did] = filepath
    
    return results

def main(input_file="producer_profiles.parquet", 
         output_file="producer_profiles_with_avatars.parquet", 
         avatars_dir="avatar_images", 
         quality=50, 
         max_size=32, 
         workers=20, 
         rate_limit=10):
    """Main function to process avatars from a DataFrame
    
    Args:
        input_file: Path to input parquet file
        output_file: Path to output parquet file
        avatars_dir: Directory to save processed avatar images
        quality: WEBP quality (0-100)
        max_size: Maximum dimension for resizing images
        workers: Number of parallel worker threads
        rate_limit: Requests per second limit
    """
    # Handle command line arguments if provided
    parser = argparse.ArgumentParser(description='Process Bluesky avatar images')
    parser.add_argument('--input-file', default=input_file, help='Input parquet file with profile data')
    parser.add_argument('--output-file', default=output_file, help='Output parquet file with avatar paths')
    parser.add_argument('--avatars-dir', default=avatars_dir, help='Directory to store avatar images')
    parser.add_argument('--quality', type=int, default=quality, help='WEBP quality (0-100)')
    parser.add_argument('--max-size', type=int, default=max_size, help='Maximum image dimension')
    parser.add_argument('--workers', type=int, default=workers, help='Number of worker threads')
    parser.add_argument('--rate-limit', type=int, default=rate_limit, help='Requests per second')
    
    # If script is called directly with arguments, parse them
    import sys
    if len(sys.argv) > 1:
        args = parser.parse_args()
        input_file = args.input_file
        output_file = args.output_file
        avatars_dir = args.avatars_dir
        quality = args.quality
        max_size = args.max_size
        workers = args.workers
        rate_limit = args.rate_limit

    # Load producer profiles
    print(f"Loading profiles from {input_file}")
    producer_df = pd.read_parquet(input_file)
    
    # Process avatars
    start_time = time.time()
    did_to_filepath = process_avatars_parallel(
        producer_df,
        output_dir=avatars_dir,
        quality=quality,
        max_size=max_size,
        max_workers=workers,
        rate_limit=rate_limit
    )
    end_time = time.time()
    
    # Report results
    print(f"Successfully processed {len(did_to_filepath)} avatars in {end_time - start_time:.2f} seconds")
    print(f"Average processing rate: {len(did_to_filepath)/(end_time-start_time):.2f} images/second")
    
    # Add local filepaths to DataFrame
    producer_df['avatar_local_path'] = producer_df['did'].map(did_to_filepath)
    
    # Save updated DataFrame
    producer_df.to_parquet(output_file)
    print(f"Updated profiles saved to {output_file}")
    
    # Show file size statistics
    if did_to_filepath:
        total_size = sum(os.path.getsize(f) for f in did_to_filepath.values())
        avg_size = total_size / len(did_to_filepath)
        print(f"Total size of all avatars: {total_size/1024/1024:.2f} MB")
        print(f"Average size per avatar: {avg_size/1024:.2f} KB")
    
    return did_to_filepath

if __name__ == "__main__":
    main()