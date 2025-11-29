"""
Scryfall API Tools Module.

A comprehensive suite of tools for interacting with the Scryfall Magic: The Gathering API.
See https://scryfall.com/docs/api for full API documentation.

Rate Limiting: Scryfall requests 50-100ms delay between requests (10 req/sec average).
Caching: API responses are cached using LRU cache (256 entries) for performance.
"""

import time
from typing import Optional, Any, Literal
from functools import wraps, lru_cache

import requests
from langchain.tools import tool

# Type definitions for discrete parameter values
UniqueMode = Literal["cards", "art", "prints"]
SortOrder = Literal["name", "set", "released", "rarity", "color", "usd", "tix", "eur", "cmc", "power", "toughness", "edhrec", "penny", "artist", "review"]
SortDirection = Literal["auto", "asc", "desc"]

# API Configuration
SCRYFALL_BASE_URL = "https://api.scryfall.com"
USER_AGENT = "MTGAgent/1.0"
REQUEST_DELAY_MS = 75  # 75ms delay between requests

# Pagination Configuration
SCRYFALL_PAGE_SIZE = 175  # Scryfall's fixed page size
VIRTUAL_PAGE_SIZE = 25    # Our virtual page size for agent consumption

# Track last request time for rate limiting
_last_request_time = 0.0


@lru_cache(maxsize=256)
def _cached_request(
    method: str,
    endpoint: str,
    params_tuple: tuple,  # Frozen params as tuple of (key, value) pairs
    json_tuple: Optional[tuple] = None,  # Frozen json as tuple of (key, value) pairs
) -> dict:
    """
    Cached API request wrapper. Uses LRU cache with 256 entries.
    
    This function is separate from _rate_limited_request to enable caching
    while maintaining rate limiting on actual network calls.
    
    Args:
        method: HTTP method (GET or POST)
        endpoint: API endpoint path
        params_tuple: Query parameters as frozen tuple of (key, value) pairs
        json_tuple: JSON body as frozen tuple of (key, value) pairs
        
    Returns:
        JSON response as dict
        
    Raises:
        Exception: If the API returns an error
    """
    global _last_request_time
    
    # Rate limiting
    elapsed = (time.time() - _last_request_time) * 1000
    if elapsed < REQUEST_DELAY_MS:
        time.sleep((REQUEST_DELAY_MS - elapsed) / 1000)
    
    url = f"{SCRYFALL_BASE_URL}{endpoint}"
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }
    
    # Convert tuples back to dicts
    params = dict(params_tuple) if params_tuple else None
    json_data = dict(json_tuple) if json_tuple else None
    
    if method.upper() == "GET":
        response = requests.get(url, headers=headers, params=params)
    elif method.upper() == "POST":
        headers["Content-Type"] = "application/json"
        response = requests.post(url, headers=headers, json=json_data)
    else:
        raise ValueError(f"Unsupported HTTP method: {method}")
    
    _last_request_time = time.time()
    
    data = response.json()
    
    if response.status_code >= 400:
        error_msg = data.get("details", data.get("error", "Unknown error"))
        raise Exception(f"Scryfall API error ({response.status_code}): {error_msg}")
    
    return data


def _rate_limited_request(
    method: str,
    endpoint: str,
    params: Optional[dict] = None,
    json_data: Optional[dict] = None,
    return_error: bool = False,
) -> dict | tuple[dict | None, str | None]:
    """
    Make a rate-limited and cached request to the Scryfall API.
    
    Requests are cached based on method, endpoint, and parameters.
    Cache size is 256 entries (LRU eviction).
    
    Args:
        method: HTTP method (GET or POST)
        endpoint: API endpoint (e.g., "/cards/search")
        params: Query parameters
        json_data: JSON body for POST requests
        return_error: If True, return (None, error_message) instead of raising
        
    Returns:
        JSON response as dict, or tuple of (None, error_message) if return_error=True
        
    Raises:
        Exception: If the API returns an error and return_error=False
    """
    try:
        # Convert dicts to frozen tuples for caching
        params_tuple = tuple(sorted(params.items())) if params else ()
        json_tuple = tuple(sorted(json_data.items())) if json_data else None
        
        data = _cached_request(method, endpoint, params_tuple, json_tuple)
        
        if return_error:
            return data, None
        else:
            return data
            
    except Exception as e:
        error_msg = str(e)
        
        if return_error:
            return None, error_msg
        else:
            raise


def _format_card_summary(card: dict) -> str:
    """
    Format a card object into a comprehensive, readable summary.
    
    Includes all relevant gameplay information: oracle text, CMC, power/toughness,
    loyalty, mana cost, type, and prices.
    """
    name = card.get("name", "Unknown")
    mana_cost = card.get("mana_cost", "")
    type_line = card.get("type_line", "")
    cmc = card.get("cmc", 0)
    
    # Get oracle text (check card_faces for multiface cards)
    oracle_text = card.get("oracle_text", "")
    if not oracle_text and card.get("card_faces"):
        # Multiface card - combine oracle text from all faces
        faces = card["card_faces"]
        oracle_texts = [face.get("oracle_text", "") for face in faces if face.get("oracle_text")]
        oracle_text = "\n---\n".join(oracle_texts)
    
    # Handle power/toughness for creatures
    pt = ""
    power = card.get("power")
    toughness = card.get("toughness")
    if power is not None and toughness is not None:
        pt = f" ({power}/{toughness})"
    
    # Handle loyalty for planeswalkers
    loyalty = card.get("loyalty")
    if loyalty:
        pt = f" (Loyalty: {loyalty})"
    
    # Prices
    prices = card.get("prices", {})
    usd = prices.get("usd") or prices.get("usd_foil") or "N/A"
    eur = prices.get("eur") or prices.get("eur_foil") or "N/A"
    tix = prices.get("tix") or "N/A"
    
    # Build summary
    summary = f"**{name}** {mana_cost}\n"
    summary += f"*{type_line}*{pt}\n"
    
    # Always include CMC for reference
    if cmc > 0 or mana_cost:  # Show CMC if card has mana cost
        summary += f"**Mana Value (CMC):** {cmc}\n"
    
    # Oracle text (rules text) - CRITICAL for card verification
    if oracle_text:
        summary += f"\n**Oracle Text:**\n{oracle_text}\n"
    
    # Prices
    summary += f"\n**Prices:**\n"
    summary += f"  • USD: ${usd}\n"
    summary += f"  • EUR: €{eur}\n"
    summary += f"  • MTGO (TIX): {tix}"
    
    return summary


def _format_card_list(cards: list, max_cards: int = 10) -> str:
    """Format a list of cards into readable summaries."""
    if not cards:
        return "No cards found."
    
    result = []
    for i, card in enumerate(cards[:max_cards]):
        result.append(f"{i+1}. {_format_card_summary(card)}")
    
    if len(cards) > max_cards:
        result.append(f"\n... and {len(cards) - max_cards} more cards.")
    
    return "\n\n".join(result)


# =============================================================================
# CARD SEARCH TOOLS
# =============================================================================

@tool
def search_cards(
    query: str,
    unique: UniqueMode = "cards",
    order: SortOrder = "name",
    dir: SortDirection = "auto",
    page: int = 1,
) -> str:
    """
    Search for Magic: The Gathering cards using a Scryfall query string.
    
    IMPORTANT: Use the `convert_to_scryfall_query` tool first to convert natural language
    descriptions into valid Scryfall syntax, then pass the result to this tool.
    
    NOTE: Results are paginated at 25 cards per page. The Scryfall API returns 175 cards
    per page internally, which are cached for efficient pagination across multiple requests.
    
    Args:
        query: A Scryfall syntax query string. Get this from `convert_to_scryfall_query`.
        unique: Deduplication mode:
            - "cards": One result per card name (default)
            - "art": One result per unique artwork
            - "prints": All printings of each card
        order: Sort order - choose based on context:
            - "name": Alphabetical (default)
            - "usd"/"eur"/"tix": By price (good for budget/value searches)
            - "edhrec": By EDH popularity (good for Commander format)
            - "cmc": By mana value
            - "power"/"toughness": By P/T stats
            - "rarity": By rarity
            - "released": By release date
            - "set": By set code
            - "color": By color
            - "penny": By Penny Dreadful ranking
            - "artist": By artist name
            - "review": Review order (color & CMC)
        dir: Sort direction - "auto" (default), "asc", "desc"
        page: Page number (default: 1). Each page contains 25 cards.
        
    Returns:
        Formatted list of 25 cards with pagination info
    """
    # Calculate which Scryfall page we need and offset within it
    # Virtual pages are 25 cards, Scryfall pages are 175 cards
    # Page 1 = Scryfall page 1, cards 0-24
    # Page 2 = Scryfall page 1, cards 25-49
    # Page 7 = Scryfall page 1, cards 150-174
    # Page 8 = Scryfall page 2, cards 0-24
    
    scryfall_page = ((page - 1) * VIRTUAL_PAGE_SIZE) // SCRYFALL_PAGE_SIZE + 1
    offset_in_scryfall_page = ((page - 1) * VIRTUAL_PAGE_SIZE) % SCRYFALL_PAGE_SIZE
    
    params = {
        "q": query,
        "unique": unique,
        "order": order,
        "dir": dir,
        "page": scryfall_page,
    }
    
    data, error = _rate_limited_request("GET", "/cards/search", params=params, return_error=True)
    
    # Handle search errors
    if error:
        result = f"❌ Search failed: \"{query}\"\n\n"
        result += f"Scryfall says: {error}\n\n"
        result += "**Possible reasons:**\n"
        result += "- No cards match this search query\n"
        result += "- The query syntax might be invalid\n"
        result += "- The search criteria might be too restrictive\n"
        result += "\n**Suggestions:**\n"
        result += f"- Use `convert_to_scryfall_query()` to generate a valid query from natural language\n"
        result += "- Try broadening your search (remove some filters)\n"
        result += "- Check the Scryfall syntax guide: https://scryfall.com/docs/syntax\n"
        
        return result
    
    all_cards_on_scryfall_page = data.get("data", [])
    total_cards = data.get("total_cards", len(all_cards_on_scryfall_page))
    scryfall_has_more = data.get("has_more", False)
    
    # Calculate virtual pagination info
    total_virtual_pages = (total_cards + VIRTUAL_PAGE_SIZE - 1) // VIRTUAL_PAGE_SIZE
    
    # Slice to get our virtual page of 25 cards
    start_idx = offset_in_scryfall_page
    end_idx = min(start_idx + VIRTUAL_PAGE_SIZE, len(all_cards_on_scryfall_page))
    cards = all_cards_on_scryfall_page[start_idx:end_idx]
    
    # Determine if there are more virtual pages available
    # We have more if:
    # 1. Current Scryfall page has more cards after our slice, OR
    # 2. Scryfall has more pages to fetch
    cards_remaining_on_scryfall_page = len(all_cards_on_scryfall_page) - end_idx
    virtual_has_more = (cards_remaining_on_scryfall_page > 0) or scryfall_has_more
    
    # Build result with assumptions noted
    result = f"**Search Results**: Found {total_cards} total cards matching '{query}'\n"
    result += f"**Page {page} of {total_virtual_pages}** (showing {len(cards)} cards)\n"
    
    # Note the settings used
    settings = []
    if unique == "cards":
        settings.append("one version per card name")
    elif unique == "art":
        settings.append("unique artwork only")
    elif unique == "prints":
        settings.append("all printings")
    
    if order == "name":
        settings.append("sorted alphabetically")
    else:
        settings.append(f"sorted by {order}")
    
    if dir != "auto":
        settings.append(f"direction: {dir}")
    
    if settings:
        result += f"*({', '.join(settings)})*\n"
    
    result += "\n" + _format_card_list(cards)
    
    # Pagination guidance
    if virtual_has_more:
        cards_shown = page * VIRTUAL_PAGE_SIZE
        cards_remaining = total_cards - cards_shown
        result += f"\n\n📄 **More results available**\n"
        result += f"   Showing cards {(page-1)*VIRTUAL_PAGE_SIZE + 1}-{(page-1)*VIRTUAL_PAGE_SIZE + len(cards)} of {total_cards}\n"
        result += f"   To see next page ({VIRTUAL_PAGE_SIZE} more cards), call:\n"
        result += f"   `search_cards(query='{query}', page={page + 1}";
        if unique != "cards":
            result += f", unique='{unique}'"
        if order != "name":
            result += f", order='{order}'"
        if dir != "auto":
            result += f", dir='{dir}'"
        result += ")`\n"
        result += f"   ({cards_remaining} cards remaining)\n"
    elif page < total_virtual_pages:
        # Edge case: last partial page
        result += f"\n\n✅ Last page of results (showing final {len(cards)} cards)\n"
    elif total_cards > VIRTUAL_PAGE_SIZE:
        result += f"\n\n✅ End of results (page {page}/{total_virtual_pages})\n"
    
    return result


@tool
def get_card_by_name(name: str, fuzzy: bool = True, set_code: Optional[str] = None) -> str:
    """
    Get a specific Magic card by its name.
    
    Args:
        name: Card name to search for (e.g., "Black Lotus", "Lightning Bolt")
        fuzzy: If True (default), allows partial/misspelled names. If False, requires exact match.
        set_code: Optional 3-letter set code to get a specific printing (e.g., "lea", "dom")
        
    Returns:
        Detailed card information from the most recent printing (unless set_code specified)
    """
    params = {}
    if fuzzy:
        params["fuzzy"] = name
    else:
        params["exact"] = name
    
    if set_code:
        params["set"] = set_code
    
    card, error = _rate_limited_request("GET", "/cards/named", params=params, return_error=True)
    
    # Handle card not found
    if error:
        result = f"❌ Card not found: \"{name}\"\n\n"
        result += f"Scryfall says: {error}\n\n"
        result += "**Possible reasons:**\n"
        result += "- The card name might be misspelled. Try checking the spelling.\n"
        result += "- The card might use a different name or have multiple printings with variations.\n"
        result += "- If it's a double-faced card, try the front face name.\n"
        
        if set_code:
            result += f"- The card might not exist in set '{set_code}'. Try without specifying the set.\n"
        
        result += "\n**Suggestions:**\n"
        result += f"- Use `autocomplete_card_name(\"{name}\")` to see similar card names\n"
        result += f"- Use `search_cards()` with a broader query to find related cards\n"
        result += "- Double-check the card name on Scryfall's website: https://scryfall.com\n"
        
        return result
    
    # Extended card details
    result = _format_card_summary(card)
    
    # Add set info with note about printing selection
    result += f"\n\nSet: {card.get('set_name', 'Unknown')} ({card.get('set', '').upper()})"
    if not set_code:
        result += " *(most recent printing)*"
    result += f"\nRarity: {card.get('rarity', 'Unknown').title()}"
    
    # Note search mode
    if fuzzy:
        result += f"\n*Matched using fuzzy search for '{name}'*"
    
    # Legalities
    legalities = card.get("legalities", {})
    legal_formats = [fmt for fmt, status in legalities.items() if status == "legal"]
    if legal_formats:
        result += f"\nLegal in: {', '.join(legal_formats[:5])}"
        if len(legal_formats) > 5:
            result += f" (+{len(legal_formats) - 5} more)"
    
    # Scryfall link
    result += f"\n\nScryfall: {card.get('scryfall_uri', 'N/A')}"
    
    return result


@tool
def get_card_by_id(card_id: str) -> str:
    """
    Get a Magic card by its Scryfall UUID.
    
    Args:
        card_id: The Scryfall UUID of the card
        
    Returns:
        Detailed card information
    """
    card = _rate_limited_request("GET", f"/cards/{card_id}")
    return _format_card_summary(card) + f"\n\nScryfall: {card.get('scryfall_uri', 'N/A')}"


@tool
def get_random_card(query: Optional[str] = None) -> str:
    """
    Get a random Magic card, optionally filtered by a search query.
    
    Args:
        query: Optional Scryfall query to filter the random selection.
            Use `convert_to_scryfall_query` first if you have a natural language description.
            If not provided, selects from all cards in the database.
            
    Returns:
        Random card details
    """
    params = {}
    if query:
        params["q"] = query
    
    card = _rate_limited_request("GET", "/cards/random", params=params)
    
    result = "🎲 **Random Card"
    if query:
        result += f" (filtered by: {query})"
    else:
        result += " (from all cards)"
    result += ":**\n\n"
    
    result += _format_card_summary(card)
    result += f"\n\nSet: {card.get('set_name', 'Unknown')} ({card.get('set', '').upper()})"
    result += f"\nScryfall: {card.get('scryfall_uri', 'N/A')}"
    
    return result


@tool
def autocomplete_card_name(partial_name: str) -> str:
    """
    Get autocomplete suggestions for a partial card name.
    
    Args:
        partial_name: Partial card name (at least 2 characters)
        
    Returns:
        List of up to 20 matching card names, sorted by relevance
    """
    if len(partial_name) < 2:
        return "Please provide at least 2 characters for autocomplete."
    
    params = {"q": partial_name}
    
    data = _rate_limited_request("GET", "/cards/autocomplete", params=params)
    
    names = data.get("data", [])
    if not names:
        return f"No card names found matching '{partial_name}'"
    
    result = f"Card name suggestions for '{partial_name}' ({len(names)} matches, sorted by relevance):\n"
    for name in names:
        result += f"  • {name}\n"
    
    return result


# =============================================================================
# SET TOOLS
# =============================================================================

@tool
def get_all_sets() -> str:
    """
    Get a list of all Magic: The Gathering sets.
    
    Returns:
        List of the 20 most recent sets by release date, with total count
    """
    data = _rate_limited_request("GET", "/sets")
    
    sets = data.get("data", [])
    
    result = f"Found {len(sets)} Magic sets total.\n"
    result += "*Showing 20 most recent sets, sorted by release date (newest first):*\n\n"
    
    # Show recent sets (last 20)
    recent = sorted(
        [s for s in sets if s.get("released_at")],
        key=lambda x: x.get("released_at", ""),
        reverse=True
    )[:20]
    
    for s in recent:
        code = s.get("code", "???").upper()
        name = s.get("name", "Unknown")
        released = s.get("released_at", "Unknown")
        card_count = s.get("card_count", 0)
        set_type = s.get("set_type", "").replace("_", " ")
        result += f"  • [{code}] {name} ({released}, {card_count} cards, {set_type})\n"
    
    result += f"\n📋 {len(sets) - 20} older sets not shown. Use `get_set_by_code` for specific set details."
    
    return result


@tool
def get_set_by_code(set_code: str) -> str:
    """
    Get details about a specific Magic set by its code.
    
    Args:
        set_code: The 3-6 letter set code (e.g., "dom" for Dominaria, "lea" for Alpha)
        
    Returns:
        Set details including name, release date, card count, and type
    """
    data = _rate_limited_request("GET", f"/sets/{set_code.lower()}")
    
    result = f"**{data.get('name', 'Unknown Set')}**\n"
    result += f"Code: {data.get('code', '???').upper()}\n"
    result += f"Type: {data.get('set_type', 'Unknown').replace('_', ' ').title()}\n"
    result += f"Released: {data.get('released_at', 'Unknown')}\n"
    result += f"Card Count: {data.get('card_count', 0)}\n"
    
    if data.get("block"):
        result += f"Block: {data.get('block')}\n"
    
    result += f"\nScryfall: {data.get('scryfall_uri', 'N/A')}"
    
    return result


# =============================================================================
# RULINGS TOOLS
# =============================================================================

@tool
def get_card_rulings(card_id: str) -> str:
    """
    Get official rulings for a Magic card by its Scryfall ID.
    
    Args:
        card_id: The Scryfall UUID of the card
        
    Returns:
        List of rulings with sources and dates
    """
    data = _rate_limited_request("GET", f"/cards/{card_id}/rulings")
    
    rulings = data.get("data", [])
    
    if not rulings:
        return "No rulings found for this card."
    
    result = f"Found {len(rulings)} rulings:\n\n"
    
    for ruling in rulings:
        source = ruling.get("source", "unknown").upper()
        date = ruling.get("published_at", "Unknown date")
        comment = ruling.get("comment", "No text")
        result += f"**[{source}]** ({date})\n{comment}\n\n"
    
    return result


@tool
def get_rulings_by_card_name(card_name: str) -> str:
    """
    Get official rulings for a Magic card by searching for its name.
    
    Args:
        card_name: The name of the card (fuzzy matching enabled)
        
    Returns:
        List of rulings with sources and dates, sorted by date (newest first)
    """
    # First, get the card to find its ID
    params = {"fuzzy": card_name}
    card, error = _rate_limited_request("GET", "/cards/named", params=params, return_error=True)
    
    # Handle card not found
    if error:
        result = f"❌ Card not found: \"{card_name}\"\n\n"
        result += f"Scryfall says: {error}\n\n"
        result += "**Suggestions:**\n"
        result += f"- Use `autocomplete_card_name(\"{card_name}\")` to see similar card names\n"
        result += "- Check the spelling or try a different card name\n"
        
        return result
    
    card_id = card.get("id")
    card_actual_name = card.get("name", card_name)
    
    # Then get rulings
    data = _rate_limited_request("GET", f"/cards/{card_id}/rulings")
    
    rulings = data.get("data", [])
    
    if not rulings:
        return f"No rulings found for '{card_actual_name}'.\n*Matched via fuzzy search for '{card_name}'*"
    
    result = f"**Rulings for {card_actual_name}** ({len(rulings)} total)\n"
    result += f"*Matched via fuzzy search for '{card_name}'*\n\n"
    
    for ruling in rulings:
        source = ruling.get("source", "unknown").upper()
        date = ruling.get("published_at", "Unknown date")
        comment = ruling.get("comment", "No text")
        result += f"**[{source}]** ({date})\n{comment}\n\n"
    
    return result


# =============================================================================
# SYMBOLOGY TOOLS
# =============================================================================

@tool
def get_all_symbols() -> str:
    """
    Get a list of all mana symbols used in Magic: The Gathering.
    
    Returns:
        List of symbols with descriptions and properties
    """
    data = _rate_limited_request("GET", "/symbology")
    
    symbols = data.get("data", [])
    
    result = f"Found {len(symbols)} mana symbols:\n\n"
    
    # Group common symbols
    mana_symbols = [s for s in symbols if s.get("represents_mana")]
    
    result += "**Basic Mana:**\n"
    basic = [s for s in mana_symbols if s.get("symbol") in ["{W}", "{U}", "{B}", "{R}", "{G}", "{C}"]]
    for s in basic:
        result += f"  {s.get('symbol')} - {s.get('english')}\n"
    
    result += "\n**Hybrid Mana:**\n"
    hybrid = [s for s in mana_symbols if s.get("hybrid")][:10]
    for s in hybrid:
        result += f"  {s.get('symbol')} - {s.get('english')}\n"
    
    result += f"\n... and {len(symbols) - len(basic) - len(hybrid)} more symbols."
    
    return result


@tool
def parse_mana_cost(mana_string: str) -> str:
    """
    Parse and normalize a mana cost string.
    
    Args:
        mana_string: A mana cost string (e.g., "2WW", "RUx", "3{G}{G}")
        
    Returns:
        Normalized mana cost with CMC and color information
    """
    params = {"cost": mana_string}
    data = _rate_limited_request("GET", "/symbology/parse-mana", params=params)
    
    result = f"**Mana Cost Analysis:**\n"
    result += f"Input: {mana_string}\n"
    result += f"Normalized: {data.get('cost', 'Unknown')}\n"
    result += f"Mana Value (CMC): {data.get('cmc', 0)}\n"
    
    colors = data.get("colors", [])
    if colors:
        result += f"Colors: {', '.join(colors)}\n"
    else:
        result += "Colors: Colorless\n"
    
    if data.get("multicolored"):
        result += "Type: Multicolored\n"
    elif data.get("monocolored"):
        result += "Type: Monocolored\n"
    elif data.get("colorless"):
        result += "Type: Colorless\n"
    
    return result


# =============================================================================
# CATALOG TOOLS
# =============================================================================

@tool
def get_catalog(catalog_name: str) -> str:
    """
    Get a catalog of Magic game data (card names, types, keywords, etc.).
    
    Args:
        catalog_name: Name of the catalog. Options:
            - "card-names" - All unique card names
            - "artist-names" - All artist names  
            - "word-bank" - All unique words in card text
            - "creature-types" - All creature types
            - "planeswalker-types" - All planeswalker types
            - "land-types" - All land types
            - "artifact-types" - All artifact types
            - "enchantment-types" - All enchantment types
            - "spell-types" - All spell types
            - "powers" - All possible power values
            - "toughnesses" - All possible toughness values
            - "loyalties" - All possible loyalty values
            - "watermarks" - All watermarks
            - "keyword-abilities" - All keyword abilities
            - "keyword-actions" - All keyword actions
            - "ability-words" - All ability words
            
    Returns:
        List of values in the specified catalog
    """
    data = _rate_limited_request("GET", f"/catalog/{catalog_name}")
    
    items = data.get("data", [])
    total = data.get("total_values", len(items))
    
    result = f"**{catalog_name.replace('-', ' ').title()} Catalog** ({total} items):\n\n"
    
    # Show first 50 items
    display_items = items[:50]
    for item in display_items:
        result += f"  • {item}\n"
    
    if total > 50:
        result += f"\n... and {total - 50} more items."
    
    return result


# =============================================================================
# BULK DATA TOOLS
# =============================================================================

@tool
def get_bulk_data_info() -> str:
    """
    Get information about available bulk data downloads from Scryfall.
    
    Bulk data files contain complete card databases that can be downloaded
    for offline use. Files are updated daily.
    
    Returns:
        List of bulk data files with download URLs and sizes
    """
    data = _rate_limited_request("GET", "/bulk-data")
    
    files = data.get("data", [])
    
    result = "**Scryfall Bulk Data Files:**\n\n"
    
    for f in files:
        name = f.get("name", "Unknown")
        desc = f.get("description", "")
        size_mb = f.get("size", 0) / (1024 * 1024)
        updated = f.get("updated_at", "Unknown")[:10]
        download = f.get("download_uri", "N/A")
        
        result += f"**{name}** ({size_mb:.1f} MB)\n"
        result += f"{desc}\n"
        result += f"Updated: {updated}\n"
        result += f"Download: {download}\n\n"
    
    return result


# =============================================================================
# UTILITY TOOLS
# =============================================================================

@tool
def compare_cards(card1_name: str, card2_name: str) -> str:
    """
    Compare two Magic cards side by side.
    
    Args:
        card1_name: Name of the first card (fuzzy matching enabled)
        card2_name: Name of the second card (fuzzy matching enabled)
        
    Returns:
        Side-by-side comparison using most recent printings of both cards
    """
    card1, error1 = _rate_limited_request("GET", "/cards/named", params={"fuzzy": card1_name}, return_error=True)
    card2, error2 = _rate_limited_request("GET", "/cards/named", params={"fuzzy": card2_name}, return_error=True)
    
    # Handle card not found errors
    if error1 and error2:
        return f"❌ Both cards not found:\n- \"{card1_name}\": {error1}\n- \"{card2_name}\": {error2}\n\nPlease check the spelling and try again."
    elif error1:
        return f"❌ First card not found: \"{card1_name}\"\nScryfall says: {error1}\n\nPlease check the spelling and try again."
    elif error2:
        return f"❌ Second card not found: \"{card2_name}\"\nScryfall says: {error2}\n\nPlease check the spelling and try again."
    
    def get_val(card, key, default="N/A"):
        return card.get(key, default) or default
    
    # Get oracle text (handle multiface cards)
    def get_oracle_text(card):
        oracle_text = card.get("oracle_text", "")
        if not oracle_text and card.get("card_faces"):
            faces = card["card_faces"]
            oracle_texts = [face.get("oracle_text", "") for face in faces if face.get("oracle_text")]
            oracle_text = " // ".join(oracle_texts)
        return oracle_text or "N/A"
    
    result = "**Card Comparison** *(using most recent printings)*\n\n"
    result += f"{'Property':<20} | {get_val(card1, 'name'):<30} | {get_val(card2, 'name'):<30}\n"
    result += "-" * 85 + "\n"
    result += f"{'Set':<20} | {get_val(card1, 'set').upper():<30} | {get_val(card2, 'set').upper():<30}\n"
    result += f"{'Mana Cost':<20} | {get_val(card1, 'mana_cost'):<30} | {get_val(card2, 'mana_cost'):<30}\n"
    result += f"{'Mana Value (CMC)':<20} | {str(get_val(card1, 'cmc', 0)):<30} | {str(get_val(card2, 'cmc', 0)):<30}\n"
    result += f"{'Type':<20} | {get_val(card1, 'type_line'):<30} | {get_val(card2, 'type_line'):<30}\n"
    
    if card1.get("power") or card2.get("power"):
        pt1 = f"{get_val(card1, 'power')}/{get_val(card1, 'toughness')}" if card1.get("power") else "N/A"
        pt2 = f"{get_val(card2, 'power')}/{get_val(card2, 'toughness')}" if card2.get("power") else "N/A"
        result += f"{'Power/Toughness':<20} | {pt1:<30} | {pt2:<30}\n"
    
    if card1.get("loyalty") or card2.get("loyalty"):
        result += f"{'Loyalty':<20} | {get_val(card1, 'loyalty'):<30} | {get_val(card2, 'loyalty'):<30}\n"
    
    result += f"{'Rarity':<20} | {get_val(card1, 'rarity').title():<30} | {get_val(card2, 'rarity').title():<30}\n"
    
    prices1 = card1.get("prices", {})
    prices2 = card2.get("prices", {})
    price1 = prices1.get("usd") or prices1.get("usd_foil") or "N/A"
    price2 = prices2.get("usd") or prices2.get("usd_foil") or "N/A"
    result += f"{'Price (USD)':<20} | ${price1:<29} | ${price2:<29}\n"
    
    # Add Oracle Text section (critical for comparing card effects)
    oracle1 = get_oracle_text(card1)
    oracle2 = get_oracle_text(card2)
    
    result += "\n" + "=" * 85 + "\n"
    result += "**Oracle Text Comparison:**\n\n"
    result += f"**{get_val(card1, 'name')}:**\n{oracle1}\n\n"
    result += f"**{get_val(card2, 'name')}:**\n{oracle2}\n"
    
    return result


@tool
def get_card_legality(card_name: str) -> str:
    """
    Get the format legality for a specific Magic card.
    
    Args:
        card_name: The name of the card to check (fuzzy matching enabled)
        
    Returns:
        Legality status across all Magic formats
    """
    card, error = _rate_limited_request("GET", "/cards/named", params={"fuzzy": card_name}, return_error=True)
    
    # Handle card not found
    if error:
        result = f"❌ Card not found: \"{card_name}\"\n\n"
        result += f"Scryfall says: {error}\n\n"
        result += "**Suggestions:**\n"
        result += f"- Use `autocomplete_card_name(\"{card_name}\")` to see similar card names\n"
        result += "- Check the spelling or try a different card name\n"
        
        return result
    
    legalities = card.get("legalities", {})
    name = card.get("name", card_name)
    
    result = f"**Format Legality for {name}**\n"
    result += f"*Matched via fuzzy search for '{card_name}'*\n\n"
    
    # Group by legality status
    legal = []
    restricted = []
    banned = []
    not_legal = []
    
    for fmt, status in sorted(legalities.items()):
        fmt_name = fmt.replace("_", " ").title()
        if status == "legal":
            legal.append(fmt_name)
        elif status == "restricted":
            restricted.append(fmt_name)
        elif status == "banned":
            banned.append(fmt_name)
        else:
            not_legal.append(fmt_name)
    
    if legal:
        result += f"✅ **Legal:** {', '.join(legal)}\n\n"
    if restricted:
        result += f"⚠️ **Restricted:** {', '.join(restricted)}\n\n"
    if banned:
        result += f"🚫 **Banned:** {', '.join(banned)}\n\n"
    if not_legal:
        result += f"❌ **Not Legal:** {', '.join(not_legal)}\n"
    
    return result


@tool
def get_card_price(card_name: str, set_code: Optional[str] = None) -> str:
    """
    Get current prices for a Magic card from various marketplaces.
    
    Args:
        card_name: The name of the card (fuzzy matching enabled)
        set_code: Optional set code for a specific printing. If not provided, returns most recent printing.
        
    Returns:
        Price information in USD, EUR, and MTGO tickets
    """
    params = {"fuzzy": card_name}
    if set_code:
        params["set"] = set_code
    
    card = _rate_limited_request("GET", "/cards/named", params=params)
    
    name = card.get("name", card_name)
    set_name = card.get("set_name", "Unknown")
    set_code_actual = card.get("set", "").upper()
    prices = card.get("prices", {})
    
    result = f"**Prices for {name}** ({set_name} [{set_code_actual}])"
    if not set_code:
        result += "\n*Showing most recent printing. Specify set_code for other printings.*"
    result += "\n\n"
    
    has_prices = False
    if prices.get("usd"):
        result += f"💵 USD (Non-Foil): ${prices['usd']}\n"
        has_prices = True
    if prices.get("usd_foil"):
        result += f"✨ USD (Foil): ${prices['usd_foil']}\n"
        has_prices = True
    if prices.get("usd_etched"):
        result += f"🔷 USD (Etched): ${prices['usd_etched']}\n"
        has_prices = True
    if prices.get("eur"):
        result += f"💶 EUR (Non-Foil): €{prices['eur']}\n"
        has_prices = True
    if prices.get("eur_foil"):
        result += f"✨ EUR (Foil): €{prices['eur_foil']}\n"
        has_prices = True
    if prices.get("tix"):
        result += f"🎫 MTGO Tickets: {prices['tix']} tix\n"
        has_prices = True
    
    if not has_prices:
        result += "No price data available for this printing.\n"
    
    purchase = card.get("purchase_uris", {})
    if purchase:
        result += "\n**Purchase Links:**\n"
        if purchase.get("tcgplayer"):
            result += f"  • TCGPlayer: {purchase['tcgplayer']}\n"
        if purchase.get("cardmarket"):
            result += f"  • Cardmarket: {purchase['cardmarket']}\n"
        if purchase.get("cardhoarder"):
            result += f"  • Cardhoarder: {purchase['cardhoarder']}\n"
    
    return result


# Export all tools as a list for easy importing
SCRYFALL_TOOLS = [
    # Card search
    search_cards,
    get_card_by_name,
    get_card_by_id,
    get_random_card,
    autocomplete_card_name,
    # Sets
    get_all_sets,
    get_set_by_code,
    # Rulings
    get_card_rulings,
    get_rulings_by_card_name,
    # Symbology
    get_all_symbols,
    parse_mana_cost,
    # Catalogs
    get_catalog,
    # Bulk data
    get_bulk_data_info,
    # Utility
    compare_cards,
    get_card_legality,
    get_card_price,
]

