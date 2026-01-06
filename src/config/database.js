import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const dataDir = path.join(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'inventory.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  }
});

// Enable foreign keys and WAL mode for better concurrency
db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

// Promisified helpers
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbExec = promisify(db.exec.bind(db));

// run needs custom wrapper to capture `changes` / `lastID`
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('[DB] Error in dbRun:', err);
        return reject(err);
      }
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
};

/**
 * Initialize database schema
 */
export async function initializeDatabase() {
  try {
    // Create inventory table
    await dbExec(`
      CREATE TABLE IF NOT EXISTS inventory (
        sku TEXT PRIMARY KEY,
        total_quantity INTEGER NOT NULL DEFAULT 0,
        available_quantity INTEGER NOT NULL DEFAULT 0,
        reserved_quantity INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create reservations table
    await dbExec(`
      CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        sku TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sku) REFERENCES inventory(sku)
      )
    `);

    // Create indexes for performance
    await dbExec(`
      CREATE INDEX IF NOT EXISTS idx_reservations_user_sku 
      ON reservations(user_id, sku, status);
      
      CREATE INDEX IF NOT EXISTS idx_reservations_expires 
      ON reservations(expires_at, status);
      
      CREATE INDEX IF NOT EXISTS idx_reservations_status 
      ON reservations(status);
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Export promisified methods
export const dbMethods = {
  run: dbRun,
  get: dbGet,
  all: dbAll,
  exec: dbExec,
};

// Export db as both named and default for flexibility
export { db };
export default db;
