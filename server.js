/**
 * FARMLY — Poultry Farm Management System
 * Backend REST API Server (Node.js + Express)
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Directories & Storage paths
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'farm_data.json');

// Ensure data and backup directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve frontend static files
app.use(express.static(__dirname));

// Default Farm Seed Data
const DEFAULT_FARM = {
  name: 'FARMLY Poultry Farm',
  manager: 'Abhinand Roney',
  location: 'Sector 3, Main Shed',
  breed: 'Lohmann Brown',
  ageWeeks: 28,
  birds: 500,
  capacity: 600,
  feedStock: 250,
  dailyFeedRate: 45,
  eggsToday: 320,
  eggDate: new Date().toISOString().slice(0, 10),
  totalLosses: 2,
  lossesToday: 0,
  vaccines: [
    { id: 'v1', name: 'Newcastle Disease (ND Lasota)', target: 'Newcastle Virus', date: '2026-11-14', method: 'Drinking Water', status: 'Upcoming', notes: 'Administer in morning cool water' },
    { id: 'v2', name: 'IBD / Gumboro Booster', target: 'Gumboro Disease', date: '2026-10-22', method: 'Eye Drop', status: 'Completed', notes: 'Completed on schedule without issues' },
    { id: 'v3', name: 'Deworming (Piperazine)', target: 'Roundworms', date: '2026-11-04', method: 'Drinking Water', status: 'Completed', notes: 'All drinkers treated. Shed cleaned' }
  ],
  finances: [
    { id: 'f1', type: 'income', category: 'Egg Sales', amount: 240, date: '2026-11-08', note: '16 crates Grade A delivered to market' },
    { id: 'f2', type: 'expense', category: 'Feed Purchase', amount: 135, date: '2026-11-05', note: '3 bags Layer Mash (50kg each)' }
  ],
  eggHistory: [
    { date: '2026-11-03', count: 305, gradeA: 298, damaged: 7 },
    { date: '2026-11-04', count: 310, gradeA: 302, damaged: 8 },
    { date: '2026-11-05', count: 315, gradeA: 308, damaged: 7 },
    { date: '2026-11-06', count: 322, gradeA: 314, damaged: 8 },
    { date: '2026-11-07', count: 318, gradeA: 310, damaged: 8 },
    { date: '2026-11-08', count: 325, gradeA: 318, damaged: 7 }
  ],
  flockHistory: [
    { date: '2026-11-08T08:15:00Z', action: 'Mortality', qty: 1, reason: 'Natural / Unknown', note: 'Old cull bird found' },
    { date: '2026-10-15T09:00:00Z', action: 'Flock Addition', qty: 100, reason: 'Restock', note: 'Point-of-lay pullets arrived' }
  ],
  feedHistory: [
    { date: '2026-11-09T07:30:00Z', action: 'Feed Used', qty: 45, formula: 'Layer Mash', note: 'Daily feeding' },
    { date: '2026-11-05T14:00:00Z', action: 'Feed Added', qty: 150, formula: 'Layer Mash', note: 'Silo restock' }
  ],
  records: [
    { id: 'r1', title: 'Morning egg collection complete', detail: 'Gathered 320 eggs (312 Grade A). Clean shell quality.', type: 'egg', time: '2026-11-09T08:30:00Z' },
    { id: 'r2', title: 'Feed silo refilled', detail: 'Added 150 kg layer mash into silo feeders.', type: 'feed', time: '2026-11-05T14:00:00Z' },
    { id: 'r3', title: 'Cleaned drinker lines & fresh water checked', detail: 'Drinker cups flushed with clean water.', type: 'note', time: '2026-11-04T10:00:00Z' }
  ]
};

// --- Helper Functions ---
function readDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDatabase(DEFAULT_FARM);
      return DEFAULT_FARM;
    }
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading database file, returning default:', err.message);
    return DEFAULT_FARM;
  }
}

let lastBackupTime = 0;
function writeDatabase(data, forceBackup = false) {
  const content = JSON.stringify(data, null, 2);
  // Atomic write via temp file
  const tempFile = DB_FILE + '.tmp';
  fs.writeFileSync(tempFile, content, 'utf8');
  fs.renameSync(tempFile, DB_FILE);

  // Auto-backup (at most once every 5 minutes unless forced)
  const now = Date.now();
  if (forceBackup || now - lastBackupTime > 5 * 60 * 1000) {
    createBackup(data);
    lastBackupTime = now;
  }
}

function createBackup(data) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `farmly-backup-${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf8');

    // Keep only the last 20 backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 20) {
      files.slice(20).forEach(f => {
        try { fs.unlinkSync(path.join(BACKUP_DIR, f.name)); } catch (_) {}
      });
    }
  } catch (e) {
    console.warn('Backup creation failed:', e.message);
  }
}

// --- API Routes ---

// 1. Health & Server Status
app.get('/api/status', (req, res) => {
  const data = readDatabase();
  res.json({
    status: 'online',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    farmName: data.name || 'FARMLY Poultry Farm',
    birdCount: data.birds || 0,
    recordsCount: (data.records || []).length,
    timestamp: new Date().toISOString()
  });
});

// 2. GET current farm data
app.get('/api/farm', (req, res) => {
  const data = readDatabase();
  res.json({ success: true, data });
});

// 3. PUT / UPDATE farm data
app.put('/api/farm', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid farm data payload.' });
    }

    // Preserve core identifiers if omitted
    incoming.name = incoming.name || 'FARMLY Poultry Farm';
    incoming.lastServerSync = new Date().toISOString();

    writeDatabase(incoming);
    res.json({ success: true, message: 'Farm data saved successfully.', lastServerSync: incoming.lastServerSync });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST / Force Manual Backup
app.post('/api/backup', (req, res) => {
  try {
    const data = readDatabase();
    createBackup(data);
    res.json({ success: true, message: 'Backup created successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. GET / List Backups
app.get('/api/backups', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename: f,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, backups: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. POST / Restore from Backup
app.post('/api/restore/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const target = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(target)) {
      return res.status(404).json({ success: false, error: 'Backup file not found.' });
    }

    const restoredData = JSON.parse(fs.readFileSync(target, 'utf8'));
    writeDatabase(restoredData, true);

    res.json({ success: true, message: `Restored successfully from ${filename}`, data: restoredData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. POST / Reset Database to Default
app.post('/api/reset', (req, res) => {
  try {
    writeDatabase(DEFAULT_FARM, true);
    res.json({ success: true, message: 'Database reset to factory defaults.', data: DEFAULT_FARM });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback route to index.html for SPA-style navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log('================================================================');
  console.log('🐔 FARMLY POULTRY FARM MANAGEMENT SERVER');
  console.log(`🌐 Server active at: http://localhost:${PORT}`);
  console.log(`📁 Database file:    ${DB_FILE}`);
  console.log(`💾 Auto-backups:     ${BACKUP_DIR}`);
  console.log('================================================================');
});
