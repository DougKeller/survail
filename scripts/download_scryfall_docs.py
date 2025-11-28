#!/usr/bin/env python3
"""
Script to crawl and download all Scryfall API documentation.
Downloads all documentation pages from https://scryfall.com/docs/api
and saves them to the tmp/cache directory with caching support.
Also converts HTML to markdown files containing only the API documentation portions.
"""

import os
import time
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse
from typing import Set, List, Optional

import requests
from bs4 import BeautifulSoup
from markdownify import markdownify as md


# Configuration
BASE_URL = "https://scryfall.com/docs/api"
CACHE_DIR = Path(__file__).parent.parent / "tmp" / "cache"
MARKDOWN_DIR = Path(__file__).parent.parent / "tmp" / "markdown"
DELAY_MS = 75  # 50-100ms delay as per Scryfall's rate limit guidelines
USER_AGENT = "MTGDocsCrawler/1.0"


def setup_directories():
    """Create cache and markdown directories if they don't exist."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    MARKDOWN_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Cache directory: {CACHE_DIR.absolute()}")
    print(f"Markdown directory: {MARKDOWN_DIR.absolute()}")


def get_session():
    """Create a requests session with required headers."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    })
    return session


def sanitize_filename(url: str, extension: str = ".html") -> str:
    """Convert URL to a safe filename."""
    # Extract the path component
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    
    # Replace slashes and special characters
    filename = path.replace("/", "_")
    if not filename:
        filename = "index"
    
    # Add extension if not present
    if not filename.endswith((".html", ".json", ".xml", ".md")):
        filename += extension
    
    return filename


def get_cached_file(url: str) -> Optional[bytes]:
    """Check if file exists in cache and return its content."""
    filename = sanitize_filename(url, ".html")
    filepath = CACHE_DIR / filename
    
    if filepath.exists():
        print(f"Using cached: {url}")
        with open(filepath, "rb") as f:
            return f.read()
    return None


def download_page(session: requests.Session, url: str) -> Optional[tuple[str, bytes]]:
    """Download a single page and return its content, using cache if available."""
    # Check cache first
    cached_content = get_cached_file(url)
    if cached_content is not None:
        return url, cached_content
    
    # Download if not cached
    try:
        print(f"Downloading: {url}")
        response = session.get(url, timeout=30)
        response.raise_for_status()
        return url, response.content
    except requests.RequestException as e:
        print(f"Error downloading {url}: {e}")
        return None


def save_html_content(url: str, content: bytes):
    """Save downloaded HTML content to cache directory."""
    filename = sanitize_filename(url, ".html")
    filepath = CACHE_DIR / filename
    
    with open(filepath, "wb") as f:
        f.write(content)
    
    print(f"Saved HTML: {filepath}")


def extract_prose_content(soup: BeautifulSoup) -> Optional[BeautifulSoup]:
    """Extract the main documentation content from the .prose div."""
    # Find the main content area
    main = soup.find("div", {"id": "main", "class": "main"})
    if not main:
        return None
    
    # Find the reference-doc-content div
    ref_content = main.find("div", class_="reference-doc-content")
    if not ref_content:
        return None
    
    # Find the prose div which contains the actual documentation
    prose = ref_content.find("div", class_="prose")
    if not prose:
        return None
    
    return prose


def convert_html_to_markdown(url: str, html_content: bytes) -> Optional[str]:
    """Convert HTML content to markdown, extracting only the API documentation portions."""
    try:
        soup = BeautifulSoup(html_content, "lxml")
        
        # Extract the prose content
        prose = extract_prose_content(soup)
        if not prose:
            print(f"Warning: Could not find prose content in {url}")
            return None
        
        # Convert to markdown
        # The prose content already contains the proper title (h1), so we don't need to add one
        markdown = md(
            str(prose),
            heading_style="ATX",  # Use # for headings
            bullets="-",  # Use - for bullets
            strip=["script", "style"],  # Remove script and style tags
        )
        
        # Add source URL at the end
        markdown += f"\n\n---\n\n*Source: {url}*"
        
        return markdown
    except Exception as e:
        print(f"Error converting {url} to markdown: {e}")
        return None


def save_markdown_content(url: str, markdown: str):
    """Save markdown content to markdown directory."""
    filename = sanitize_filename(url, ".md")
    filepath = MARKDOWN_DIR / filename
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(markdown)
    
    print(f"Saved Markdown: {filepath}")


def find_documentation_links(soup: BeautifulSoup, base_url: str) -> Set[str]:
    """Find all documentation links from the page."""
    links = set()
    
    # Find all anchor tags
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        
        # Convert relative URLs to absolute
        absolute_url = urljoin(base_url, href)
        
        # Only include links that point to scryfall.com/docs
        if "scryfall.com/docs" in absolute_url:
            # Remove fragments
            absolute_url = absolute_url.split("#")[0]
            links.add(absolute_url)
    
    return links


def crawl_documentation():
    """Main function to crawl all Scryfall API documentation."""
    setup_directories()
    session = get_session()
    
    # Start with the main API docs page
    visited: Set[str] = set()
    to_visit: List[str] = [BASE_URL]
    
    print(f"Starting crawl from: {BASE_URL}")
    print(f"Rate limit delay: {DELAY_MS}ms between requests\n")
    
    downloaded_count = 0
    cached_count = 0
    converted_count = 0
    
    while to_visit:
        url = to_visit.pop(0)
        
        # Skip if already visited
        if url in visited:
            continue
        
        visited.add(url)
        
        # Check if we need to download (or use cache)
        was_cached = get_cached_file(url) is not None
        if was_cached:
            cached_count += 1
        
        # Download the page (or get from cache)
        result = download_page(session, url)
        if result is None:
            continue
        
        url, content = result
        
        # Save HTML to cache (only if newly downloaded)
        if not was_cached:
            save_html_content(url, content)
            downloaded_count += 1
            # Rate limiting: wait before next request (only for new downloads)
            time.sleep(DELAY_MS / 1000.0)
        
        # Convert to markdown
        markdown = convert_html_to_markdown(url, content)
        if markdown:
            save_markdown_content(url, markdown)
            converted_count += 1
        
        # Parse HTML to find more documentation links
        try:
            soup = BeautifulSoup(content, "lxml")
            
            # Find all documentation links on this page
            new_links = find_documentation_links(soup, url)
            
            # Add new links to the queue
            for link in new_links:
                if link not in visited:
                    to_visit.append(link)
            
            print(f"Found {len(new_links)} links on this page")
        except Exception as e:
            print(f"Error parsing {url}: {e}")
    
    print(f"\nCrawl complete!")
    print(f"  Total pages processed: {len(visited)}")
    print(f"  Newly downloaded: {downloaded_count}")
    print(f"  From cache: {cached_count}")
    print(f"  Converted to markdown: {converted_count}")
    print(f"  HTML cache: {CACHE_DIR.absolute()}")
    print(f"  Markdown files: {MARKDOWN_DIR.absolute()}")


if __name__ == "__main__":
    crawl_documentation()
