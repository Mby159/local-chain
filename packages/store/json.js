const fs = require('fs')
const path = require('path')

class JSONStore {
  constructor(filePath) {
    this.filePath = filePath
    this.dir = path.dirname(filePath)
    fs.mkdirSync(this.dir, { recursive: true })
    this._load()
  }

  _load() {
    if (fs.existsSync(this.filePath)) {
      this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
    } else {
      this.data = []
    }
  }

  _save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
  }

  add(item) { this.data.unshift(item); this._save(); return item }
  getAll() { return [...this.data] }
  getById(id) { return this.data.find(i => i.id === id) || null }
  getByHash(hash) { return this.data.filter(i => i.hash === hash) }
  remove(id) {
    const idx = this.data.findIndex(i => i.id === id)
    if (idx === -1) return false
    this.data.splice(idx, 1)
    this._save()
    return true
  }
  clear() { this.data = []; this._save() }
  stats() {
    return {
      total: this.data.length,
      today: this.data.filter(i => i.date === new Date().toISOString().slice(0, 10)).length,
      totalSize: this.data.reduce((s, i) => s + (i.size || 0), 0),
    }
  }
}

module.exports = { JSONStore }
