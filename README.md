# 🎴 Yomitori: Japanese Vocabulary Extractor

A modern web application for extracting and learning Japanese vocabulary from text. Built with FastAPI backend and React frontend, featuring direct Anki integration for seamless flashcard creation.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![React](https://img.shields.io/badge/react-19.2.0-blue.svg)

## ✨ Features

- **Smart Tokenization**: Uses SudachiPy for accurate Japanese text tokenization
- **Automatic Definitions**: Fetches word definitions from Jisho.org API
- **Known Words Management**: Track and filter words you already know
- **Direct Anki Integration**: Export vocabulary directly to Anki via AnkiConnect
- **Modern UI**: Beautiful, responsive interface with glassmorphism design
- **Batch Processing**: Upload text files or paste text directly
- **Concurrent API Calls**: Fast definition fetching with parallel requests

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- Node.js 16+ and npm
- Anki (optional, for direct import feature)
- [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vocabextractor
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Install SudachiPy dictionary** (required for tokenization)
   ```bash
   python -m pip install sudachidict_core
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   python main.py
   ```
   The API will be available at `http://localhost:8000`

2. **Start the frontend development server** (in a new terminal)
   ```bash
   cd frontend
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

3. **Optional: Start Anki with AnkiConnect**
   - Install the [AnkiConnect add-on](https://ankiweb.net/shared/info/2055492159)
   - Keep Anki running in the background for direct import functionality

## 📖 Usage

### Extracting Vocabulary

1. **Paste or upload Japanese text**
   - Use the text input area for short texts
   - Upload a `.txt` file for longer content

2. **Review extracted words**
   - View words with readings (furigana) and English definitions
   - Filter out known words automatically

3. **Export to Anki**
   - Select words to export
   - Choose your Anki deck
   - Click "Import to Anki" for instant flashcard creation
   - Or download as CSV for manual import

### Managing Known Words

- Words imported to Anki are automatically marked as known
- Manually add words to your known words list
- Clear known words list when starting a new learning phase

## 🏗️ Project Structure

```
vocabextractor/
├── backend/
│   └── main.py              # FastAPI backend server
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React component
│   │   ├── App.css          # Component styles
│   │   └── index.css        # Global styles
│   ├── package.json
│   └── vite.config.js
├── vocab_extractor.py       # Core vocabulary extraction logic
├── known_words.txt          # Persistent known words storage
└── README.md
```

## 🔧 API Endpoints

### Vocabulary Extraction
- `POST /api/extract` - Extract vocabulary from text
- `POST /api/extract/file` - Extract from uploaded file

### Known Words Management
- `GET /api/known-words` - Get all known words
- `POST /api/known-words` - Add words to known list
- `DELETE /api/known-words` - Clear known words

### Anki Integration
- `GET /api/anki/status` - Check AnkiConnect connection
- `GET /api/anki/decks` - Get available Anki decks
- `POST /api/anki/import` - Import vocabulary to Anki

### Statistics
- `GET /api/stats` - Get learning statistics

## 🛠️ Technologies Used

### Backend
- **FastAPI** - Modern, fast web framework for building APIs
- **SudachiPy** - Japanese morphological analyzer
- **Requests** - HTTP library for Jisho.org API calls
- **AnkiConnect** - Integration with Anki

### Frontend
- **React** - UI library
- **Vite** - Build tool and dev server
- **CSS3** - Modern styling with glassmorphism effects

## 📝 How It Works

1. **Tokenization**: Japanese text is tokenized using SudachiPy, which breaks down text into individual words and provides grammatical information

2. **Filtering**: Particles, common function words, and punctuation are filtered out to focus on content words

3. **Definition Fetching**: Unknown words are sent to the Jisho.org API to fetch readings and English definitions

4. **Concurrent Processing**: Multiple API calls are made in parallel for faster results

5. **Anki Export**: Words can be exported directly to Anki via AnkiConnect or downloaded as CSV

## 🎨 Features in Detail

### Smart Filtering
- Automatically filters particles (は, が, を, etc.)
- Removes auxiliary verbs and punctuation
- Focuses on content words (nouns, verbs, adjectives)

### Known Words System
- Persistent storage of known words
- Automatic filtering during extraction
- Words imported to Anki are marked as known

### Batch Processing
- Concurrent API calls for faster definition fetching
- Configurable thread pool (default: 5 workers)
- Retry logic for failed requests

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Jisho.org](https://jisho.org/) for the excellent Japanese dictionary API
- [SudachiPy](https://github.com/WorksApplications/SudachiPy) for Japanese tokenization
- [AnkiConnect](https://foosoft.net/projects/anki-connect/) for Anki integration

## 🐛 Troubleshooting

### "Cannot connect to Anki" error
- Make sure Anki is running
- Install the AnkiConnect add-on
- Check that AnkiConnect is listening on port 8765

### SudachiPy errors
- Install the dictionary: `python -m pip install sudachidict_core`
- Try reinstalling SudachiPy: `pip install --upgrade sudachipy`

### CORS errors
- Make sure the backend is running on port 8000
- Check that the frontend is configured to connect to the correct backend URL

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Happy Learning! 頑張って！** 🎌
