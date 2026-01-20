"""
Japanese Vocabulary Extractor - FastAPI Backend
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sys
import os

# Add parent directory to path to import vocab_extractor
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from vocab_extractor import (
    extract_vocabulary,
    load_known_words,
    save_known_words,
    check_anki_connection,
    get_anki_decks,
    add_notes_to_anki
)
from pathlib import Path

app = FastAPI(
    title="JpVocab API",
    description="Japanese Vocabulary Extractor API",
    version="1.0.0"
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,  # Must be False when using wildcard origins
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# File paths
KNOWN_WORDS_PATH = Path(__file__).parent.parent / "known_words.txt"


# Pydantic models
class TextInput(BaseModel):
    text: str


class AnkiImportRequest(BaseModel):
    vocabulary: list
    deck_name: str = "Japanese Vocabulary"
    tags: Optional[list] = None


class KnownWordsUpdate(BaseModel):
    words: list[str]


# Endpoints
@app.get("/")
async def root():
    return {"message": "JpVocab API is running"}


@app.get("/api/stats")
async def get_stats():
    """Get dashboard statistics"""
    known_words = load_known_words(KNOWN_WORDS_PATH)
    return {
        "known_words_count": len(known_words),
        "new_words_count": 0,
        "efficiency": 0
    }


@app.post("/api/extract")
async def extract_vocab(input_data: TextInput):
    """Extract vocabulary from Japanese text"""
    if not input_data.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    known_words = load_known_words(KNOWN_WORDS_PATH)
    vocabulary = extract_vocabulary(input_data.text, known_words)
    
    return {
        "vocabulary": vocabulary,
        "count": len(vocabulary),
        "known_words_count": len(known_words)
    }


@app.post("/api/extract/file")
async def extract_from_file(file: UploadFile = File(...)):
    """Extract vocabulary from uploaded text file"""
    if not file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="Only .txt files are supported")
    
    content = await file.read()
    text = content.decode('utf-8')
    
    known_words = load_known_words(KNOWN_WORDS_PATH)
    vocabulary = extract_vocabulary(text, known_words)
    
    return {
        "vocabulary": vocabulary,
        "count": len(vocabulary),
        "known_words_count": len(known_words)
    }


@app.get("/api/known-words")
async def get_known_words():
    """Get all known words"""
    known_words = load_known_words(KNOWN_WORDS_PATH)
    return {"words": sorted(list(known_words)), "count": len(known_words)}


@app.post("/api/known-words")
async def add_known_words(update: KnownWordsUpdate):
    """Add words to known words list"""
    known_words = load_known_words(KNOWN_WORDS_PATH)
    known_words.update(update.words)
    save_known_words(known_words, KNOWN_WORDS_PATH)
    return {"message": f"Added {len(update.words)} words", "total": len(known_words)}


@app.delete("/api/known-words")
async def clear_known_words():
    """Clear all known words"""
    save_known_words(set(), KNOWN_WORDS_PATH)
    return {"message": "Known words cleared"}


@app.get("/api/anki/status")
async def anki_status():
    """Check Anki connection status"""
    result = check_anki_connection()
    return {
        "connected": result["success"],
        "error": result.get("error")
    }


@app.get("/api/anki/decks")
async def anki_decks():
    """Get available Anki decks"""
    result = get_anki_decks()
    if result["success"]:
        return {"decks": result["result"]}
    raise HTTPException(status_code=503, detail=result.get("error", "Failed to get decks"))


@app.post("/api/anki/import")
async def anki_import(request: AnkiImportRequest):
    """Import vocabulary to Anki"""
    result = add_notes_to_anki(
        request.vocabulary,
        deck_name=request.deck_name,
        tags=request.tags
    )
    
    if result["success"]:
        # Mark imported words as known
        words_to_add = [item["word"] for item in request.vocabulary]
        known_words = load_known_words(KNOWN_WORDS_PATH)
        known_words.update(words_to_add)
        save_known_words(known_words, KNOWN_WORDS_PATH)
        
        return {
            "success": True,
            "added": result["added"],
            "duplicates": result["duplicates"],
            "total": result["total"]
        }
    
    raise HTTPException(status_code=503, detail=result.get("error", "Failed to import"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
