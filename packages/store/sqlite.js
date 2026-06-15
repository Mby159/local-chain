const { DatabaseSync } = require('node:sqlite')

class SQLiteStore {
  constructor(dbPath) {
    this.db = new DatabaseSync(dbPath)
    this._init()
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        name TEXT,
        type TEXT,
        size INTEGER DEFAULT 0,
        algorithm TEXT,
        signature TEXT,
        cid TEXT,
        block_index INTEGER,
        timestamp TEXT,
        date TEXT,
        data TEXT
      )
    `)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_hash ON records(hash)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_date ON records(date)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_block ON records(block_index)`)
  }

  add(record) {
    this.db.prepare(`
      INSERT OR REPLACE INTO records (id, hash, name, type, size, algorithm, signature, cid, block_index, timestamp, date, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id, record.hash, record.name || null, record.type || null, record.size || 0,
      record.algorithm || null, record.signature || null, record.cid || null,
      record.blockIndex != null ? record.blockIndex : null, record.timestamp || null, record.date || null,
      JSON.stringify(record)
    )
    return record
  }

  getAll() {
    const rows = this.db.prepare('SELECT data FROM records ORDER BY rowid DESC').all()
    return rows.map(r => JSON.parse(r.data))
  }

  getById(id) {
    const row = this.db.prepare('SELECT data FROM records WHERE id = ?').get(id)
    return row ? JSON.parse(row.data) : null
  }

  getByHash(hash) {
    const rows = this.db.prepare('SELECT data FROM records WHERE hash = ? ORDER BY rowid DESC').all(hash)
    return rows.map(r => JSON.parse(r.data))
  }

  getByDate(date) {
    const rows = this.db.prepare('SELECT data FROM records WHERE date = ? ORDER BY rowid DESC').all(date)
    return rows.map(r => JSON.parse(r.data))
  }

  getByBlock(blockIndex) {
    const rows = this.db.prepare('SELECT data FROM records WHERE block_index = ? ORDER BY rowid DESC').all(blockIndex)
    return rows.map(r => JSON.parse(r.data))
  }

  getUnanchored() {
    const rows = this.db.prepare('SELECT data FROM records WHERE block_index IS NULL ORDER BY rowid DESC').all()
    return rows.map(r => JSON.parse(r.data))
  }

  search(query) {
    const rows = this.db.prepare(
      'SELECT data FROM records WHERE name LIKE ? OR hash LIKE ? OR data LIKE ? ORDER BY rowid DESC'
    ).all(`%${query}%`, `%${query}%`, `%${query}%`)
    return rows.map(r => JSON.parse(r.data))
  }

  updateBlockIndex(ids, blockIndex) {
    const stmt = this.db.prepare('UPDATE records SET block_index = ?, data = json_set(data, \'$.blockIndex\', ?) WHERE id = ?')
    for (const id of ids) stmt.run(blockIndex, blockIndex, id)
  }

  remove(id) {
    const result = this.db.prepare('DELETE FROM records WHERE id = ?').run(id)
    return result.changes > 0
  }

  clear() {
    this.db.exec('DELETE FROM records')
  }

  count() {
    return this.db.prepare('SELECT COUNT(*) as n FROM records').get().n
  }

  stats() {
    const today = new Date().toISOString().slice(0, 10)
    return {
      total: this.count(),
      today: this.db.prepare('SELECT COUNT(*) as n FROM records WHERE date = ?').get(today).n,
      totalSize: this.db.prepare('SELECT COALESCE(SUM(size), 0) as s FROM records').get().s,
      anchored: this.db.prepare('SELECT COUNT(*) as n FROM records WHERE block_index IS NOT NULL').get().n,
      unanchored: this.db.prepare('SELECT COUNT(*) as n FROM records WHERE block_index IS NULL').get().n,
    }
  }

  close() {
    this.db.close()
  }
}

module.exports = { SQLiteStore }
