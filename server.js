const express = require('express');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const parser = new xml2js.Parser();

// ── Supabase setup ──
// These come from Render environment variables (never hard-code them here)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log('✓ Supabase connected');
} else {
  console.warn('⚠ Supabase env vars missing — running in memory-only mode');
}

// ── Security headers (must be first) ──
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('Cache-Control', 'public, max-age=60');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(bodyParser.text({ type: 'application/xml', limit: '5mb' }));
app.use(bodyParser.json({ limit: '5mb' }));

// In-memory cache — always serves fast, backed by Supabase for durability
let leaderboard = [];

// Sort by time (fastest first) and assign ranks
function rankEntries(entries) {
  const sorted = [...entries].sort(
    (a, b) => a.elapsedTimeInMilliseconds - b.elapsedTimeInMilliseconds
  );
  return sorted.map((e, i) => ({ rank: i + 1, ...e }));
}

// ── Load existing data from Supabase on startup ──
async function loadFromSupabase() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .order('elapsed_ms', { ascending: true });
    if (error) throw error;
    leaderboard = rankEntries(
      data.map(r => ({
        group: r.group_name,
        firstName: r.first_name,
        lastInitial: r.last_initial,
        troopNumber: r.troop_number,
        elapsedTimeInMilliseconds: r.elapsed_ms,
      }))
    );
    console.log(`✓ Loaded ${leaderboard.length} scores from Supabase on startup`);
  } catch (err) {
    console.error('✗ Failed to load from Supabase:', err.message);
  }
}

// ── Health check ──
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    leaderboardSize: leaderboard.length,
    supabase: supabase ? 'connected' : 'memory-only',
  });
});

// ── Receive XML from sync script ──
app.post('/api/upload', async (req, res) => {
  try {
    const parsed = await parser.parseStringPromise(req.body);
    const records = parsed.ArrayOfScoreRecord?.ScoreRecord || [];

    const entries = records.map(r => ({
      group: (r.Group?.[0] || '').trim(),
      firstName: (r.FirstName?.[0] || '').trim(),
      lastInitial: (r.LastInitial?.[0] || '').trim(),
      troopNumber: (r.TroopNumber?.[0] || '').trim(),
      elapsedTimeInMilliseconds: parseFloat(r.ElapsedTimeInMilliseconds?.[0] || 0),
    }));

    // Update in-memory cache immediately (fast path)
    leaderboard = rankEntries(entries);

    // Persist to Supabase: replace-all (delete then insert)
    if (supabase) {
      const { error: delErr } = await supabase
        .from('scores')
        .delete()
        .neq('id', -1); // deletes all rows
      if (delErr) throw delErr;

      if (entries.length > 0) {
        const rows = entries.map(e => ({
          group_name: e.group,
          first_name: e.firstName,
          last_initial: e.lastInitial,
          troop_number: e.troopNumber,
          elapsed_ms: e.elapsedTimeInMilliseconds,
        }));
        const { error: insErr } = await supabase.from('scores').insert(rows);
        if (insErr) throw insErr;
      }
    }

    console.log(`✓ Synced ${leaderboard.length} entries (persisted: ${!!supabase})`);
    res.json({ success: true, count: leaderboard.length });
  } catch (err) {
    console.error('✗ Upload error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── Serve leaderboard to frontend ──
app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard);
});

// ── Serve photos from Supabase ──
app.get('/api/photos/list', async (req, res) => {
  if (!supabase) {
    return res.json([]);
  }
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('✗ Failed to list photos:', err.message);
    res.status(500).json({ error: 'Failed to load photos' });
  }
});

// ── Delete photo from Supabase ──
app.post('/api/photos/delete', async (req, res) => {
  if (!supabase) {
    return res.status(400).json({ error: 'Supabase not configured' });
  }
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Missing photo id' });
  }
  try {
    const { error } = await supabase
      .from('photos')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('✗ Failed to delete photo:', err.message);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🚀 Leaderboard backend running on http://localhost:${PORT}`);
  await loadFromSupabase();
  console.log('\n⏳ Ready for sync posts and frontend requests\n');
});
