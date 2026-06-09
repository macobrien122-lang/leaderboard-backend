# Leaderboard Sync System

This is a local testing setup for your conference leaderboard. It consists of:
- **server.js** — Backend that receives XML and serves the leaderboard as JSON
- **sync-scores.js** — Script that reads your game's XML file and posts updates
- **package.json** — Dependencies

## Quick Start

### 1. Install Node.js
If you don't have Node.js installed, download it from https://nodejs.org/ (LTS version recommended).

To verify installation, run:
```bash
node --version
npm --version
```

### 2. Install Dependencies
In the folder containing these files, run:
```bash
npm install
```

This installs `express`, `xml2js`, and `axios`.

### 3. Start the Backend (Terminal 1)
```bash
npm start
```

You should see:
```
🚀 Leaderboard backend running on http://localhost:3000

📨 POST /api/upload        - Receives XML from sync script
📊 GET /api/leaderboard    - Returns current leaderboard as JSON

⏳ Waiting for sync script to post scores...
```

**Leave this terminal open.**

### 4. Start the Sync Script (Terminal 2)
```bash
npm run sync
```

You should see:
```
╔════════════════════════════════════════════╗
║     Leaderboard Sync Script Started        ║
╚════════════════════════════════════════════╝

📁 Reading from:  /Users/mobrien/Downloads/FulfillmentChallenge/FulfillmentChallenge/EvansDistFulfillmentChallenge.xml
🌐 Posting to:    http://localhost:3000/api/upload
⏱️  Interval:      5 seconds

✓ File found. Starting sync loop...

[12:34:56 PM] ✓ Synced (1 total)
[12:35:01 PM] ✓ Synced (2 total)
```

### 5. View the Leaderboard
In your browser, visit:
```
http://localhost:3000/api/leaderboard
```

You should see a JSON array like:
```json
[
  {
    "rank": 1,
    "firstName": "Mac",
    "lastInitial": "O",
    "troopNumber": "1000",
    "elapsedTimeInMilliseconds": 2591.513
  },
  {
    "rank": 2,
    "firstName": "John",
    "lastInitial": "D",
    "troopNumber": "0001",
    "elapsedTimeInMilliseconds": 3000.000
  }
]
```

The leaderboard is **sorted by elapsed time** (fastest time = rank 1).

## How It Works

1. **sync-scores.js** reads your XML file every 5 seconds
2. Posts the raw XML to **server.js** at `POST /api/upload`
3. **server.js** parses the XML → sorts by elapsed time → stores in memory
4. Frontend can fetch `GET /api/leaderboard` and display it
5. Repeat every 5 seconds

## Testing

### Add a new score to your game
The sync script will automatically pick up the new data on the next poll (within 5 seconds) and post it to the backend. Refresh `http://localhost:3000/api/leaderboard` to see the updated list.

### Check backend health
Visit `http://localhost:3000/` to see:
```json
{
  "status": "running",
  "leaderboardSize": 42,
  "lastUpdated": "2026-06-04T18:34:22.123Z"
}
```

## Troubleshooting

### "File not found"
```
❌ ERROR: File not found at /Users/mobrien/Downloads/...
```
**Fix:** Make sure the XML file path is correct. Check that the file exists by opening Finder and navigating to the folder.

### "Backend not running" or "ECONNREFUSED"
```
[6:35 PM] ✗ Backend not running at http://localhost:3000/api/upload
```
**Fix:** Make sure `npm start` is running in another terminal.

### "Port 3000 already in use"
If port 3000 is busy, you can specify a different port:
```bash
PORT=3001 npm start
```

Then update `BACKEND_URL` in sync-scores.js to `http://localhost:3001/api/upload`.

## Next Steps

Once you've verified this works locally:

1. **Deploy the backend to Render** (free tier)
   - Create a GitHub repo with server.js + package.json
   - Connect to Render, deploy in 2 minutes
   - Get a live URL like `https://your-app.onrender.com`

2. **Update the sync script** to point to the Render URL
   - Change `BACKEND_URL` to the Render URL
   - Run the sync script on your game machine during the conference

3. **Build the frontend** (React on Netlify)
   - Fetch from `GET /api/leaderboard` (from the Render URL)
   - Display the leaderboard on a public web page
   - People at the conference can open the URL and refresh to see live rankings

## Questions?
If something isn't working, check:
- Is `npm start` running? (terminal 1)
- Is `npm run sync` running? (terminal 2)
- Is the XML file path correct?
- Does the backend get the sync message? (check terminal 1 logs)
