const fs = require('fs');
const axios = require('axios');

// Configuration
const XML_PATH = 'C:/Users/mobrien/Downloads/FulfillmentChallenge/FulfillmentChallenge/EvansDistFulfillmentChallenge.xml';
const BACKEND_URL = 'https://leaderboard-backend-qpmb.onrender.com/api/upload';
const POLL_INTERVAL = 5000; // 5 seconds

// Track last sync result
let lastSyncTime = null;
let lastErrorTime = null;
let syncCount = 0;
let errorCount = 0;

async function syncScores() {
  try {
    // Read the XML file
    const xmlData = fs.readFileSync(XML_PATH, 'utf8');
    
    // Post to backend
    await axios.post(BACKEND_URL, xmlData, {
      headers: { 'Content-Type': 'application/xml' },
      timeout: 5000,
    });
    
    lastSyncTime = new Date();
    syncCount++;
    console.log(`[${lastSyncTime.toLocaleTimeString()}] ✓ Synced (${syncCount} total)`);
    
  } catch (err) {
    lastErrorTime = new Date();
    errorCount++;
    
    if (err.code === 'ENOENT') {
      console.error(`[${lastErrorTime.toLocaleTimeString()}] ✗ File not found: ${XML_PATH}`);
    } else if (err.code === 'ECONNREFUSED') {
      console.error(`[${lastErrorTime.toLocaleTimeString()}] ✗ Backend not running at ${BACKEND_URL}`);
    } else {
      console.error(`[${lastErrorTime.toLocaleTimeString()}] ✗ Sync failed: ${err.message}`);
    }
  }
}

// Display startup banner
console.log('\n╔════════════════════════════════════════════╗');
console.log('║     Leaderboard Sync Script Started        ║');
console.log('╚════════════════════════════════════════════╝\n');

console.log(`📁 Reading from:  ${XML_PATH}`);
console.log(`🌐 Posting to:    ${BACKEND_URL}`);
console.log(`⏱️  Interval:      ${POLL_INTERVAL / 1000} seconds\n`);

// Verify file exists
if (!fs.existsSync(XML_PATH)) {
  console.error(`❌ ERROR: File not found at ${XML_PATH}`);
  console.error('Please check the file path and try again.\n');
  process.exit(1);
}

console.log('✓ File found. Starting sync loop...\n');

// Sync immediately on start
syncScores();

// Then sync on interval
setInterval(syncScores, POLL_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n╔════════════════════════════════════════════╗');
  console.log('║        Sync Script Stopped                 ║');
  console.log('╚════════════════════════════════════════════╝\n');
  console.log(`📊 Total syncs: ${syncCount}`);
  console.log(`❌ Total errors: ${errorCount}`);
  process.exit(0);
});
