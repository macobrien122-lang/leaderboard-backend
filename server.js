const express = require('express');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');

const app = express();
const parser = new xml2js.Parser();

// CORS headers - MUST be first!
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware to accept XML and JSON
app.use(bodyParser.text({ type: 'application/xml' }));
app.use(bodyParser.json());

// Store leaderboard in memory
let leaderboard = [];

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'running', 
    leaderboardSize: leaderboard.length,
    lastUpdated: leaderboard.length > 0 ? new Date().toISOString() : 'never'
  });
});

// Receive XML from sync script
app.post('/api/upload', async (req, res) => {
  try {
    const xmlData = req.body;
    
    // Parse XML
    const parsed = await parser.parseStringPromise(xmlData);
    const records = parsed.ArrayOfScoreRecord?.ScoreRecord || [];
    
    // Transform to clean JSON format
    leaderboard = records.map(r => ({
      firstName: r.FirstName?.[0] || '',
      lastInitial: r.LastInitial?.[0]?.trim() || '',
      troopNumber: r.TroopNumber?.[0] || '',
      elapsedTimeInMilliseconds: parseFloat(r.ElapsedTimeInMilliseconds?.[0] || 0),
    }));
    
    // Sort by elapsed time (ascending = fastest/best is first)
    leaderboard.sort((a, b) => a.elapsedTimeInMilliseconds - b.elapsedTimeInMilliseconds);
    
    // Add rank
    leaderboard = leaderboard.map((entry, idx) => ({
      rank: idx + 1,
      ...entry,
    }));
    
    console.log(`✓ Updated leaderboard: ${leaderboard.length} entries`);
    res.json({ success: true, count: leaderboard.length });
  } catch (err) {
    console.error('✗ Upload error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Serve leaderboard to frontend
app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Leaderboard backend running on http://localhost:${PORT}`);
  console.log(`\n📨 POST /api/upload        - Receives XML from sync script`);
  console.log(`📊 GET /api/leaderboard    - Returns current leaderboard as JSON`);
  console.log(`\n⏳ Waiting for sync script to post scores...\n`);
});
