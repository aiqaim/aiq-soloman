import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any;
try {
  db = new Database(path.join(process.cwd(), 'soloman.db'));
  console.log("Database initialized successfully");
  
  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- 'uploaded' or 'generated'
      url TEXT NOT NULL,
      prompt TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (err) {
  console.error("CRITICAL: Failed to initialize database:", err);
  // Fallback or rethrow
  throw err;
}

export default db;
