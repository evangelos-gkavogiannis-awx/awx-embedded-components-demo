/**
 * db.js — SQLite database initializer.
 *
 * ─── Claude instructions ────────────────────────────────────────────────────
 * • Import this module to get a ready-to-use SQLite connection:
 *     import db from './db.js';
 * • Create your tables with db.exec(...) before defining routes in server.js:
 *     db.exec(`CREATE TABLE IF NOT EXISTS items (
 *       id    INTEGER PRIMARY KEY AUTOINCREMENT,
 *       name  TEXT NOT NULL,
 *       done  INTEGER NOT NULL DEFAULT 0
 *     )`);
 * • Use synchronous db.prepare(...).run/get/all for queries (no async needed).
 * • Database file is at backend/data/app.db — persists across app restarts.
 * ────────────────────────────────────────────────────────────────────────────
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../data');
const DB_PATH = join(dataDir, 'app.db');

mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
