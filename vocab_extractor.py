"""
Japanese Vocabulary Extractor
Core logic for tokenizing Japanese text and fetching definitions from Jisho.org
"""

import requests
import time
from pathlib import Path
from sudachipy import Dictionary, Tokenizer

# Initialize SudachiPy tokenizer
tokenizer = Dictionary().create()

# Japanese particles to filter out
PARTICLES = {
    'は', 'が', 'を', 'の', 'に', 'で', 'と', 'も', 'へ', 'から', 'まで',
    'より', 'か', 'や', 'など', 'て', 'た', 'だ', 'です', 'ます', 'ない',
    'ある', 'いる', 'する', 'なる', 'れる', 'られる', 'せる', 'させる',
    'ん', 'の', 'よ', 'ね', 'な', 'わ', 'さ', 'ぞ', 'ぜ', 'こと', 'もの',
    'ところ', 'とき', 'ため', 'よう', 'そう', 'らしい', 'みたい',
    # Common verb endings and auxiliaries
    'う', 'く', 'す', 'つ', 'ぬ', 'ふ', 'む', 'ゆ', 'る',
    # Punctuation and symbols
    '。', '、', '！', '？', '・', '「', '」', '『', '』', '（', '）',
    '…', '―', '〜', ' ', '　', '\n', '\r', '\t'
}

# Part of speech tags to filter (particles, auxiliaries, punctuation)
FILTER_POS = {'助詞', '助動詞', '記号', '補助記号', '空白'}


def load_known_words(filepath: Path) -> set:
    """Load known words from file."""
    if filepath.exists():
        with open(filepath, 'r', encoding='utf-8') as f:
            return set(line.strip() for line in f if line.strip())
    return set()


def save_known_words(words: set, filepath: Path):
    """Save known words to file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        for word in sorted(words):
            f.write(f"{word}\n")


def tokenize_text(text: str) -> list:
    """
    Tokenize Japanese text and return list of unique words.
    Filters out particles and common function words.
    """
    tokens = tokenizer.tokenize(text, Tokenizer.SplitMode.C)
    words = []
    seen = set()
    
    for token in tokens:
        # Get the dictionary form (lemma) of the word
        word = token.dictionary_form()
        surface = token.surface()
        reading = token.reading_form()
        pos = token.part_of_speech()[0]  # Main POS category
        
        # Skip if already seen, is a particle, or is in filter list
        if word in seen or word in PARTICLES or surface in PARTICLES:
            continue
        if pos in FILTER_POS:
            continue
        # Skip single hiragana characters
        if len(word) == 1 and '\u3040' <= word <= '\u309f':
            continue
        # Skip if only contains punctuation or whitespace
        if not any(c.isalnum() or '\u4e00' <= c <= '\u9fff' or '\u3040' <= c <= '\u30ff' for c in word):
            continue
            
        seen.add(word)
        words.append({
            'word': word,
            'surface': surface,
            'reading': reading,
            'pos': pos
        })
    
    return words


def fetch_definition(word: str, retries: int = 2) -> dict:
    """
    Fetch word definition from Jisho.org API.
    Returns dict with reading and definitions.
    """
    url = f"https://jisho.org/api/v1/search/words?keyword={word}"
    
    for attempt in range(retries):
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get('data'):
                    entry = data['data'][0]
                    
                    # Get reading
                    reading = ''
                    if entry.get('japanese'):
                        jp = entry['japanese'][0]
                        reading = jp.get('reading', jp.get('word', ''))
                    
                    # Get definitions
                    definitions = []
                    if entry.get('senses'):
                        for sense in entry['senses'][:3]:  # Max 3 definitions
                            if sense.get('english_definitions'):
                                definitions.append(', '.join(sense['english_definitions']))
                    
                    return {
                        'word': word,
                        'reading': reading,
                        'definitions': '; '.join(definitions) if definitions else 'No definition found'
                    }
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(0.2)
            continue
    
    return {'word': word, 'reading': '', 'definitions': 'Failed to fetch definition'}


def fetch_definitions_batch(words: list, max_workers: int = 5) -> dict:
    """
    Fetch definitions for multiple words concurrently.
    Returns a dict mapping word -> definition_data
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    results = {}
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_word = {executor.submit(fetch_definition, word): word for word in words}
        
        for future in as_completed(future_to_word):
            try:
                result = future.result()
                results[result['word']] = result
            except Exception:
                word = future_to_word[future]
                results[word] = {'word': word, 'reading': '', 'definitions': 'Error fetching'}
    
    return results


def extract_vocabulary(text: str, known_words: set = None) -> list:
    """
    Main function to extract vocabulary from Japanese text.
    Returns list of dicts with word, reading, and definition.
    Uses concurrent fetching for faster results.
    """
    if known_words is None:
        known_words = set()
    
    # Tokenize
    tokens = tokenize_text(text)
    
    # Filter out known words
    unknown_tokens = [t for t in tokens if t['word'] not in known_words]
    
    if not unknown_tokens:
        return []
    
    # Get unique words to fetch (avoid duplicate API calls)
    unique_words = list(set(t['word'] for t in unknown_tokens))
    
    # Fetch definitions concurrently
    definitions_map = fetch_definitions_batch(unique_words)
    
    # Build results
    results = []
    seen = set()
    for token in unknown_tokens:
        if token['word'] in seen:
            continue
        seen.add(token['word'])
        
        def_data = definitions_map.get(token['word'], {})
        results.append({
            'word': token['word'],
            'reading': def_data.get('reading') or token['reading'],
            'definition': def_data.get('definitions', 'No definition'),
            'pos': token['pos']
        })
    
    return results


def export_to_csv(vocabulary: list, filepath: Path):
    """Export vocabulary to CSV for Anki import."""
    import csv
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        # Anki expects: Front, Back format
        for item in vocabulary:
            front = f"{item['word']}"
            back = f"{item['reading']}<br>{item['definition']}"
            writer.writerow([front, back])


# ============ AnkiConnect Integration ============

ANKI_CONNECT_URL = "http://127.0.0.1:8765"


def anki_request(action: str, params: dict = None) -> dict:
    """Make a request to AnkiConnect API."""
    payload = {
        "action": action,
        "version": 6
    }
    if params:
        payload["params"] = params
    
    try:
        response = requests.post(ANKI_CONNECT_URL, json=payload, timeout=5)
        result = response.json()
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        return {"success": True, "result": result.get("result")}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Cannot connect to Anki. Make sure Anki is running with AnkiConnect add-on installed."}
    except Exception as e:
        return {"success": False, "error": str(e)}


def check_anki_connection() -> dict:
    """Check if AnkiConnect is running and accessible."""
    return anki_request("version")


def get_anki_decks() -> dict:
    """Get list of available Anki decks."""
    return anki_request("deckNames")


def get_anki_models() -> dict:
    """Get list of available Anki note types (models)."""
    return anki_request("modelNames")


def create_deck_if_not_exists(deck_name: str) -> dict:
    """Create a deck if it doesn't exist."""
    return anki_request("createDeck", {"deck": deck_name})


def add_note_to_anki(word: str, reading: str, definition: str, deck_name: str = "Japanese Vocabulary", tags: list = None) -> dict:
    """Add a single note to Anki."""
    if tags is None:
        tags = ["vocab-extractor"]
    
    note = {
        "deckName": deck_name,
        "modelName": "Basic",
        "fields": {
            "Front": word,
            "Back": f"{reading}<br><br>{definition}"
        },
        "tags": tags,
        "options": {
            "allowDuplicate": False,
            "duplicateScope": "deck"
        }
    }
    
    return anki_request("addNote", {"note": note})


def add_notes_to_anki(vocabulary: list, deck_name: str = "Japanese Vocabulary", tags: list = None) -> dict:
    """
    Add multiple notes to Anki at once.
    Returns dict with success count, fail count, and details.
    """
    if tags is None:
        tags = ["vocab-extractor"]
    
    # First, ensure the deck exists
    create_result = create_deck_if_not_exists(deck_name)
    if not create_result["success"]:
        return create_result
    
    notes = []
    for item in vocabulary:
        notes.append({
            "deckName": deck_name,
            "modelName": "Basic",
            "fields": {
                "Front": item["word"],
                "Back": f"{item['reading']}<br><br>{item['definition']}"
            },
            "tags": tags,
            "options": {
                "allowDuplicate": False,
                "duplicateScope": "deck",
                "duplicateScopeOptions": {
                    "deckName": deck_name,
                    "checkChildren": False,
                    "checkAllModels": False
                }
            }
        })
    
    result = anki_request("addNotes", {"notes": notes})
    
    if not result["success"]:
        return result
    
    # Count successes and failures
    note_ids = result["result"]
    success_count = sum(1 for nid in note_ids if nid is not None)
    fail_count = len(note_ids) - success_count
    
    return {
        "success": True,
        "added": success_count,
        "duplicates": fail_count,
        "total": len(vocabulary),
        "note_ids": note_ids
    }
