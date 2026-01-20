import { useState, useEffect, useCallback } from 'react'
import './App.css'

const API_URL = 'http://localhost:8000'

function App() {
  const [activeView, setActiveView] = useState('extract')
  const [text, setText] = useState('')
  const [vocabulary, setVocabulary] = useState([])
  const [selectedWords, setSelectedWords] = useState(new Set())
  const [stats, setStats] = useState({ known_words_count: 0, new_words_count: 0 })
  const [knownWords, setKnownWords] = useState([])
  const [ankiConnected, setAnkiConnected] = useState(false)
  const [ankiDecks, setAnkiDecks] = useState([])
  const [selectedDeck, setSelectedDeck] = useState('Japanese Vocabulary')
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

  // Toast helper
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  // Fetch initial data
  useEffect(() => {
    fetchAnkiStatus()
    fetchStats()
  }, [])

  const fetchAnkiStatus = (showFeedback = false) => {
    if (showFeedback) {
      showToast('Checking Anki connection...', 'info')
    }
    fetch(`${API_URL}/api/anki/status`)
      .then(res => res.json())
      .then(data => {
        setAnkiConnected(data.connected)
        if (data.connected) {
          if (showFeedback) {
            showToast('Connected to Anki!', 'success')
          }
          fetch(`${API_URL}/api/anki/decks`)
            .then(res => res.json())
            .then(data => setAnkiDecks(data.decks || []))
        } else if (showFeedback) {
          showToast('Anki not connected. Make sure Anki is running with AnkiConnect.', 'error')
        }
      })
      .catch(() => {
        setAnkiConnected(false)
        if (showFeedback) {
          showToast('Failed to connect to Anki', 'error')
        }
      })
  }

  const fetchStats = () => {
    fetch(`${API_URL}/api/stats`)
      .then(res => res.json())
      .then(setStats)
      .catch(console.error)
  }

  const fetchKnownWords = () => {
    setLoading(true)
    fetch(`${API_URL}/api/known-words`)
      .then(res => res.json())
      .then(data => {
        setKnownWords(data.words || [])
        setLoading(false)
      })
      .catch(() => {
        showToast('Failed to fetch known words', 'error')
        setLoading(false)
      })
  }

  // Handle view change
  const handleViewChange = (view) => {
    setActiveView(view)
    if (view === 'known') {
      fetchKnownWords()
    }
  }

  // Extract vocabulary
  const handleExtract = async () => {
    if (!text.trim()) {
      showToast('Please enter some Japanese text', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      const data = await res.json()
      setVocabulary(data.vocabulary)
      setSelectedWords(new Set(data.vocabulary.map((_, i) => i)))
      setStats(prev => ({
        ...prev,
        new_words_count: data.count,
        known_words_count: data.known_words_count
      }))
      showToast(`Found ${data.count} new words!`, 'success')
    } catch (error) {
      showToast('Failed to extract vocabulary', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Toggle word selection
  const toggleWord = (index) => {
    setSelectedWords(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Toggle all words
  const toggleAll = () => {
    if (selectedWords.size === vocabulary.length) {
      setSelectedWords(new Set())
    } else {
      setSelectedWords(new Set(vocabulary.map((_, i) => i)))
    }
  }

  // Import to Anki
  const handleAnkiImport = async () => {
    const selected = vocabulary.filter((_, i) => selectedWords.has(i))
    if (selected.length === 0) {
      showToast('No words selected', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/anki/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vocabulary: selected,
          deck_name: selectedDeck
        })
      })
      const data = await res.json()

      // Check if the response indicates an error
      if (!res.ok) {
        const errorMsg = data.detail || data.error || 'Failed to import to Anki'
        showToast(errorMsg, 'error')
        return
      }

      showToast(`Added ${data.added || 0} cards to Anki!`, 'success')
      if (data.duplicates > 0) {
        showToast(`${data.duplicates} duplicates skipped`, 'info')
      }
      setVocabulary([])
      setSelectedWords(new Set())
      fetchStats()
    } catch (error) {
      showToast('Failed to import to Anki. Check if Anki is running.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Mark as known
  const handleMarkKnown = async () => {
    const selected = vocabulary.filter((_, i) => selectedWords.has(i))
    if (selected.length === 0) {
      showToast('No words selected', 'error')
      return
    }

    try {
      await fetch(`${API_URL}/api/known-words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: selected.map(v => v.word) })
      })
      showToast(`Marked ${selected.length} words as known`, 'success')
      setVocabulary(vocabulary.filter((_, i) => !selectedWords.has(i)))
      setSelectedWords(new Set())
      fetchStats()
    } catch (error) {
      showToast('Failed to mark words as known', 'error')
    }
  }

  // Clear all known words
  const handleClearKnownWords = async () => {
    if (!confirm('Are you sure you want to clear all known words? This cannot be undone.')) {
      return
    }

    try {
      await fetch(`${API_URL}/api/known-words`, { method: 'DELETE' })
      showToast('Known words cleared', 'success')
      setKnownWords([])
      fetchStats()
    } catch (error) {
      showToast('Failed to clear known words', 'error')
    }
  }

  // Get POS class
  const getPosClass = (pos) => {
    if (pos === '名詞') return 'pos-noun'
    if (pos === '動詞') return 'pos-verb'
    if (pos === '形容詞') return 'pos-adj'
    return 'pos-default'
  }

  const getPosLabel = (pos) => {
    const posMap = {
      '名詞': 'Noun',
      '動詞': 'Verb',
      '形容詞': 'Adj',
      '副詞': 'Adv',
      '連体詞': 'Pren',
      '接続詞': 'Conj',
      '感動詞': 'Intj',
    }
    return posMap[pos] || pos
  }

  // Filter known words by search
  const filteredKnownWords = knownWords.filter(word =>
    word.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <span>⚡</span> JpVocab
        </div>

        <nav className="nav">
          <button
            className={`nav-item ${activeView === 'extract' ? 'active' : ''}`}
            onClick={() => handleViewChange('extract')}
          >
            📝 Extract
          </button>
          <button
            className={`nav-item ${activeView === 'known' ? 'active' : ''}`}
            onClick={() => handleViewChange('known')}
          >
            📚 Known Words
          </button>
          <button
            className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => handleViewChange('settings')}
          >
            ⚙️ Settings
          </button>
        </nav>

        <div className="anki-status">
          <div className="status-header">Anki Connection</div>
          <div className={`status-indicator ${ankiConnected ? 'connected' : 'disconnected'}`}>
            <div className={`dot ${ankiConnected ? 'connected' : 'disconnected'}`}></div>
            {ankiConnected ? 'Connected' : 'Not Connected'}
          </div>
          {!ankiConnected && (
            <button
              className="btn btn-secondary"
              style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.8rem' }}
              onClick={() => fetchAnkiStatus(true)}
            >
              🔄 Retry
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {/* Stats - show on all views */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{vocabulary.length}</div>
            <div className="stat-label">New Words Found</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.known_words_count.toLocaleString()}</div>
            <div className="stat-label">Total Known Words</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{selectedWords.size}</div>
            <div className="stat-label">Words Selected</div>
          </div>
        </div>

        {/* Extract View */}
        {activeView === 'extract' && (
          <div className="work-area">
            <div className="input-section">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="日本語のテキストをここに貼り付けてください... (Paste your Japanese text here)"
              />
              <div className="actions">
                <button
                  className="btn btn-primary"
                  onClick={handleExtract}
                  disabled={loading || !text.trim()}
                >
                  ⚡ Extract Vocabulary
                </button>
              </div>
            </div>

            <div className="table-container">
              {loading ? (
                <div className="loading">
                  <div className="spinner"></div>
                </div>
              ) : vocabulary.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📚</div>
                  <p>No vocabulary extracted yet</p>
                  <p style={{ fontSize: '0.9rem' }}>Paste Japanese text above and click Extract</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={selectedWords.size === vocabulary.length}
                          onChange={toggleAll}
                        />
                      </th>
                      <th>Word</th>
                      <th>Reading</th>
                      <th>Meaning</th>
                      <th>POS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vocabulary.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedWords.has(index)}
                            onChange={() => toggleWord(index)}
                          />
                        </td>
                        <td className="word-cell">{item.word}</td>
                        <td className="reading-cell">{item.reading}</td>
                        <td>{item.definition}</td>
                        <td>
                          <span className={`pos-tag ${getPosClass(item.pos)}`}>
                            {getPosLabel(item.pos)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {vocabulary.length > 0 && (
              <div className="actions">
                <button
                  className="btn btn-secondary"
                  onClick={handleMarkKnown}
                  disabled={loading || selectedWords.size === 0}
                >
                  🗑️ Mark as Known
                </button>
                {ankiConnected && (
                  <>
                    <select
                      value={selectedDeck}
                      onChange={(e) => setSelectedDeck(e.target.value)}
                    >
                      {ankiDecks.map(deck => (
                        <option key={deck} value={deck}>{deck}</option>
                      ))}
                      {!ankiDecks.includes('Japanese Vocabulary') && (
                        <option value="Japanese Vocabulary">Japanese Vocabulary</option>
                      )}
                    </select>
                    <button
                      className="btn btn-anki"
                      onClick={handleAnkiImport}
                      disabled={loading || selectedWords.size === 0}
                    >
                      🚀 Import to Anki
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Known Words View */}
        {activeView === 'known' && (
          <div className="work-area">
            <div className="section-header">
              <h2>📚 Known Words</h2>
              <p className="section-subtitle">Words you've already learned ({knownWords.length} total)</p>
            </div>

            <div className="input-section">
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Search known words..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="table-container">
              {loading ? (
                <div className="loading">
                  <div className="spinner"></div>
                </div>
              ) : filteredKnownWords.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📖</div>
                  <p>{searchQuery ? 'No matching words found' : 'No known words yet'}</p>
                  <p style={{ fontSize: '0.9rem' }}>
                    {searchQuery ? 'Try a different search term' : 'Extract vocabulary and mark words as known'}
                  </p>
                </div>
              ) : (
                <div className="word-grid">
                  {filteredKnownWords.map((word, index) => (
                    <div key={index} className="word-chip">
                      {word}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="actions">
              <button
                className="btn btn-secondary"
                onClick={handleClearKnownWords}
                disabled={knownWords.length === 0}
              >
                🗑️ Clear All Known Words
              </button>
            </div>
          </div>
        )}

        {/* Settings View */}
        {activeView === 'settings' && (
          <div className="work-area">
            <div className="section-header">
              <h2>⚙️ Settings</h2>
              <p className="section-subtitle">Configure your vocabulary extractor</p>
            </div>

            <div className="settings-section">
              <div className="settings-card">
                <h3>🎴 Anki Integration</h3>
                <div className="settings-item">
                  <div className="settings-label">
                    <strong>Connection Status</strong>
                    <p>Connect to Anki for direct card import</p>
                  </div>
                  <div className={`status-badge ${ankiConnected ? 'connected' : 'disconnected'}`}>
                    {ankiConnected ? '✅ Connected' : '❌ Not Connected'}
                  </div>
                </div>
                {!ankiConnected && (
                  <div className="settings-info">
                    <p><strong>To connect:</strong></p>
                    <ol>
                      <li>Open Anki</li>
                      <li>Install AnkiConnect add-on (code: <code>2055492159</code>)</li>
                      <li>Restart Anki</li>
                      <li>Click "Retry" in the sidebar</li>
                    </ol>
                  </div>
                )}
                {ankiConnected && (
                  <div className="settings-item">
                    <div className="settings-label">
                      <strong>Default Deck</strong>
                      <p>Select your default deck for imports</p>
                    </div>
                    <select
                      value={selectedDeck}
                      onChange={(e) => setSelectedDeck(e.target.value)}
                    >
                      {ankiDecks.map(deck => (
                        <option key={deck} value={deck}>{deck}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="settings-card">
                <h3>📊 Statistics</h3>
                <div className="settings-item">
                  <div className="settings-label">
                    <strong>Known Words</strong>
                    <p>Total words in your vocabulary</p>
                  </div>
                  <span className="stat-badge">{stats.known_words_count}</span>
                </div>
              </div>

              <div className="settings-card">
                <h3>ℹ️ About</h3>
                <div className="about-content">
                  <p><strong>JpVocab</strong> - Japanese Vocabulary Extractor</p>
                  <p>Extract vocabulary from any Japanese text, get definitions from Jisho.org, and import directly to Anki.</p>
                  <p className="version">Version 2.0.0 • FastAPI + React</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
