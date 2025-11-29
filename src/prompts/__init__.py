"""
Prompt Management Module.

Centralized system for loading and managing system prompts.
All prompts are stored as text files in src/prompts/ and loaded via get_prompt().

## Naming Convention

Prompt files are named with the agent prefix for clear organization:
- `{agent_name}.txt` - Main agent prompt
- `{agent_name}_{subagent}.txt` - Subagent prompts

Examples:
- scryfall_assistant.txt - Main Scryfall assistant agent
- scryfall_assistant_research_specialist.txt - Research subagent
- scryfall_query_builder.txt - Query builder agent

## Template System

Prompts can include reusable sections using the {section:name} placeholder syntax.
Sections are stored in `_sections/` and automatically injected during load.

Example:
    In a prompt file:
    ```
    You are an MTG assistant.
    
    {section:card_verification}
    
    Your role is...
    ```
    
    The {section:card_verification} placeholder will be replaced with the content
    from _sections/card_verification.txt
"""

from pathlib import Path
from typing import Dict
import re

# Cache for loaded prompts and sections
_prompt_cache: Dict[str, str] = {}
_section_cache: Dict[str, str] = {}

# Paths
PROMPTS_DIR = Path(__file__).parent
SECTIONS_DIR = PROMPTS_DIR / "_sections"


def _load_section(section_name: str) -> str:
    """
    Load a reusable prompt section.
    
    Args:
        section_name: Name of the section file (without .txt extension)
        
    Returns:
        Section content as string
    """
    # Check cache
    if section_name in _section_cache:
        return _section_cache[section_name]
    
    # Load from file
    section_file = SECTIONS_DIR / f"{section_name}.txt"
    
    if not section_file.exists():
        # Return placeholder if section doesn't exist
        return f"{{section:{section_name}}} [NOT FOUND]"
    
    with open(section_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Cache it
    _section_cache[section_name] = content
    return content


def _process_template(prompt_text: str) -> str:
    """
    Process template placeholders in a prompt.
    
    Replaces {section:name} with content from _sections/name.txt
    
    Args:
        prompt_text: Raw prompt text with possible template placeholders
        
    Returns:
        Processed prompt with sections injected
    """
    # Find all {section:name} patterns
    pattern = r'\{section:(\w+)\}'
    
    def replace_section(match):
        section_name = match.group(1)
        return _load_section(section_name)
    
    # Replace all section placeholders
    return re.sub(pattern, replace_section, prompt_text)


def get_prompt(slug: str) -> str:
    """
    Load a prompt by its slug identifier.
    
    Prompts are cached after first load for performance.
    Template placeholders ({section:name}) are automatically processed.
    
    Args:
        slug: The prompt identifier following the naming convention:
              - "{agent_name}" for main agent prompts
              - "{agent_name}_{subagent}" for subagent prompts
              
              Examples:
              - "scryfall_assistant"
              - "scryfall_assistant_research_specialist"
              - "scryfall_query_builder"
        
    Returns:
        The prompt text as a string with all sections injected
        
    Raises:
        FileNotFoundError: If the prompt file doesn't exist
        
    Example:
        >>> main_prompt = get_prompt("scryfall_assistant")
        >>> research_prompt = get_prompt("scryfall_assistant_research_specialist")
    """
    # Check cache first
    if slug in _prompt_cache:
        return _prompt_cache[slug]
    
    # Load from file
    prompt_file = PROMPTS_DIR / f"{slug}.txt"
    
    if not prompt_file.exists():
        available_prompts = [f.stem for f in PROMPTS_DIR.glob("*.txt")]
        raise FileNotFoundError(
            f"Prompt '{slug}' not found. Available prompts: {', '.join(available_prompts)}"
        )
    
    with open(prompt_file, "r", encoding="utf-8") as f:
        prompt_text = f.read()
    
    # Process template placeholders
    processed_prompt = _process_template(prompt_text)
    
    # Cache the processed version
    _prompt_cache[slug] = processed_prompt
    
    return processed_prompt


def clear_prompt_cache():
    """
    Clear the prompt and section caches.
    
    Useful for development when prompt files or sections are being edited.
    """
    _prompt_cache.clear()
    _section_cache.clear()


def list_prompts() -> list[str]:
    """
    List all available prompt slugs.
    
    Returns:
        List of prompt slug identifiers (excludes _sections directory)
    """
    return [f.stem for f in PROMPTS_DIR.glob("*.txt")]


def list_sections() -> list[str]:
    """
    List all available reusable sections.
    
    Returns:
        List of section names available for {section:name} placeholders
    """
    if not SECTIONS_DIR.exists():
        return []
    return [f.stem for f in SECTIONS_DIR.glob("*.txt")]


# Export the main functions
__all__ = ["get_prompt", "clear_prompt_cache", "list_prompts", "list_sections"]

