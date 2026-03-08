const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

function normalizeTitleKey(title) {
    return String(title).toLowerCase().trim().replace(/\s+/g, ' ');
}

class SnapshotDB {
    constructor() {
        const dbPath = path.resolve(config.DATA_DIR, 'snapshot.db');
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this._createTables();
    }

    _createTables() {
        // Migrate tiktok table if schema is outdated (missing 'channel' column)
        try {
            this.db.prepare('SELECT channel FROM tiktok LIMIT 0').run();
        } catch (e) {
            this.db.exec('DROP TABLE IF EXISTS tiktok');
        }

        // Migrate facebook table if schema is outdated (missing 'status' column)
        try {
            this.db.prepare('SELECT status FROM facebook LIMIT 0').run();
        } catch (e) {
            this.db.exec('DROP TABLE IF EXISTS facebook');
        }

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS facebook_title_cache (
                title_raw_key TEXT PRIMARY KEY,
                ai_title      TEXT NOT NULL,
                ai_describe   TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tiktok (
                row_num INTEGER PRIMARY KEY,
                no TEXT,
                title TEXT,
                "describe" TEXT,
                format TEXT,
                channel TEXT,
                date TEXT,
                status TEXT,
                link_to_post TEXT,
                "view" TEXT,
                "like" TEXT,
                "comment" TEXT,
                share TEXT
            );

            CREATE TABLE IF NOT EXISTS facebook (
                row_num INTEGER PRIMARY KEY,
                no TEXT,
                title TEXT,
                "describe" TEXT,
                format TEXT,
                date TEXT,
                status TEXT,
                link_to_post TEXT,
                "view" TEXT,
                "like" TEXT,
                "comment" TEXT,
                share TEXT,
                note TEXT
            );
        `);
    }

    /**
     * Save snapshot of a sheet tab before updating.
     * Clears old data and inserts current sheet rows.
     *
     * @param {'tiktok'|'facebook'} table
     * @param {Array<Array<string>>} rows - raw rows from Google Sheets (A-L)
     * @param {number} startRow - DATA_START_ROW from config
     * @returns {number} number of rows saved
     */
    saveSnapshot(table, rows, startRow) {
        const columns = table === 'tiktok'
            ? ['no', 'title', '"describe"', 'format', 'channel', 'date', 'status', 'link_to_post', '"view"', '"like"', '"comment"', 'share']
            : ['no', 'title', '"describe"', 'format', 'date', 'status', 'link_to_post', '"view"', '"like"', '"comment"', 'share', 'note'];

        const colNames = ['row_num', ...columns].join(', ');
        const placeholders = columns.map(() => '?').join(', ');

        const deleteStmt = this.db.prepare(`DELETE FROM ${table}`);
        const insertStmt = this.db.prepare(
            `INSERT INTO ${table} (${colNames}) VALUES (?, ${placeholders})`
        );

        const transaction = this.db.transaction(() => {
            deleteStmt.run();
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const values = [startRow + i];
                for (let j = 0; j < 12; j++) {
                    values.push(row[j] != null ? String(row[j]) : null);
                }
                insertStmt.run(...values);
            }
        });

        transaction();
        return rows.length;
    }

    /**
     * Get saved snapshot for comparison.
     * @param {'tiktok'|'facebook'} table
     * @returns {Array<Object>}
     */
    getSnapshot(table) {
        return this.db.prepare(`SELECT * FROM ${table} ORDER BY row_num`).all();
    }

    /**
     * Get persistent title cache for Facebook as a Map.
     * Key: normalized title_raw, Value: { ai_title, ai_describe }
     */
    getTitleCacheMap() {
        const rows = this.db.prepare('SELECT * FROM facebook_title_cache').all();
        const map = new Map();
        for (const row of rows) {
            map.set(row.title_raw_key, { ai_title: row.ai_title, ai_describe: row.ai_describe });
        }
        return map;
    }

    /**
     * Save merged posts as the new Facebook snapshot (source of truth).
     * Replaces all existing rows.
     * @param {Array<Object>} posts - merged posts with mainContent, describe, etc.
     * @returns {number} number of rows saved
     */
    saveSnapshotFromPosts(posts) {
        const deleteStmt = this.db.prepare('DELETE FROM facebook');
        const insertStmt = this.db.prepare(`
            INSERT INTO facebook (row_num, no, title, "describe", format, date, status, link_to_post, "view", "like", "comment", share, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = this.db.transaction(() => {
            deleteStmt.run();
            posts.forEach((post, i) => {
                insertStmt.run(
                    i + 1,
                    String(i + 1),
                    post.mainContent || post.title || '',
                    post.describe || '',
                    post._format || post.postType || '',
                    post.date || '',
                    post._status || 'Published',
                    post.url || '',
                    String(post.views || 0),
                    String(post.engagement || 0),
                    String(post.comments || 0),
                    String(post.shares || 0),
                    post._note || ''
                );
            });
        });

        transaction();
        return posts.length;
    }

    /**
     * Upsert AI-processed titles into the persistent cache.
     * @param {Array<Object>} posts - merged posts with .title (raw) + .mainContent + .describe
     * @returns {number} number of entries upserted
     */
    saveBulkTitleCache(posts) {
        const stmt = this.db.prepare(
            `INSERT OR REPLACE INTO facebook_title_cache (title_raw_key, ai_title, ai_describe)
             VALUES (?, ?, ?)`
        );
        let count = 0;
        const transaction = this.db.transaction(() => {
            for (const post of posts) {
                if (!post.title || !post.mainContent) continue;
                stmt.run(normalizeTitleKey(post.title), post.mainContent, post.describe || '');
                count++;
            }
        });
        transaction();
        return count;
    }

    close() {
        if (this.db) this.db.close();
    }
}

module.exports = { SnapshotDB };

// CLI: node src/shared/db.js [tiktok|facebook]
if (require.main === module) {
    const table = process.argv[2] || 'all';
    const db = new SnapshotDB();

    const show = (name) => {
        const rows = db.getSnapshot(name);
        if (rows.length === 0) {
            console.log(`\n📭 ${name}: no snapshot yet`);
            return;
        }
        console.log(`\n📋 ${name}: ${rows.length} rows (snapshot before last update)`);
        console.table(rows.map(r => ({
            row: r.row_num,
            title: r.title ? r.title.substring(0, 45) + (r.title.length > 45 ? '...' : '') : '',
            view: r.view,
            like: r.like,
            comment: r.comment,
            note: r.note
        })));
    };

    if (table === 'all' || table === 'tiktok') show('tiktok');
    if (table === 'all' || table === 'facebook') show('facebook');

    db.close();
}
