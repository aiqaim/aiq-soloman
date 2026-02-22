import Database from 'better-sqlite3';
const db = new Database('soloman.db');
const rows = db.prepare("SELECT * FROM gallery").all();
console.log(JSON.stringify(rows, null, 2));
