const path = require('path')
const fs = require('fs')
const { SQLiteStore } = require('../sqlite')

let passed = 0
let failed = 0

function assert(name, condition) {
  if (condition) { console.log(`  ✓ ${name}`); passed++ }
  else { console.log(`  ✗ ${name}`); failed++ }
}

const tmpDir = path.join(__dirname, '__tmp_sqlite__')
if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true })
fs.mkdirSync(tmpDir, { recursive: true })

console.log('\n[SQLiteStore]')

const store = new SQLiteStore(path.join(tmpDir, 'test.db'))
assert('creates db', store.count() === 0)

// Add records
store.add({ id: '1', hash: 'aaa', name: 'photo.jpg', type: 'image/jpeg', size: 1024, date: '2026-06-16', timestamp: '2026-06-16T10:00:00Z' })
store.add({ id: '2', hash: 'bbb', name: 'doc.pdf', type: 'application/pdf', size: 2048, date: '2026-06-16', timestamp: '2026-06-16T11:00:00Z' })
store.add({ id: '3', hash: 'aaa', name: 'photo2.jpg', type: 'image/jpeg', size: 512, date: '2026-06-15', timestamp: '2026-06-15T09:00:00Z' })
store.add({ id: '4', hash: 'ccc', name: 'video.mp4', type: 'video/mp4', size: 10240, date: '2026-06-14', timestamp: '2026-06-14T14:00:00Z', blockIndex: 1 })

assert('count 4', store.count() === 4)
assert('getAll', store.getAll().length === 4)
assert('getById', store.getById('1').name === 'photo.jpg')
assert('getById missing', store.getById('999') === null)
assert('getByHash', store.getByHash('aaa').length === 2)
assert('getByDate', store.getByDate('2026-06-16').length === 2)
assert('getByBlock', store.getByBlock(1).length === 1)
assert('getUnanchored', store.getUnanchored().length === 3)

// Search
assert('search name', store.search('photo').length === 2)
assert('search hash', store.search('bbb').length === 1)
assert('search type', store.search('video').length === 1)
assert('search empty', store.search('zzz').length === 0)

// Update block index
store.updateBlockIndex(['1', '2'], 2)
assert('updateBlockIndex', store.getById('1').blockIndex === 2)
assert('updateBlockIndex 2', store.getById('2').blockIndex === 2)
assert('unanchored now 1', store.getUnanchored().length === 1)

// Stats
const s = store.stats()
assert('stats total', s.total === 4)
assert('stats anchored', s.anchored === 3)
assert('stats unanchored', s.unanchored === 1)
assert('stats totalSize', s.totalSize === 13824)

// Remove
assert('remove', store.remove('1'))
assert('removed', store.count() === 3)
assert('remove missing', !store.remove('999'))

// Clear
store.clear()
assert('clear', store.count() === 0)

// Persistence
store.add({ id: '5', hash: 'ddd', name: 'persist.txt', date: '2026-06-16', timestamp: '2026-06-16T12:00:00Z' })
store.close()

const store2 = new SQLiteStore(path.join(tmpDir, 'test.db'))
assert('persists', store2.count() === 1)
assert('persisted data', store2.getById('5').name === 'persist.txt')
store2.close()

// Performance test
console.log('\n[Performance]')
const perfStore = new SQLiteStore(path.join(tmpDir, 'perf.db'))
const start = Date.now()
for (let i = 0; i < 1000; i++) {
  perfStore.add({ id: `perf-${i}`, hash: `hash-${i}`, name: `file-${i}.dat`, size: 100, date: '2026-06-16', timestamp: new Date().toISOString() })
}
const elapsed = Date.now() - start
console.log(`  ⏱ 1000 inserts: ${elapsed}ms`)
assert('1000 inserts < 5s', elapsed < 5000)
assert('count 1000', perfStore.count() === 1000)

const searchStart = Date.now()
for (let i = 0; i < 100; i++) {
  perfStore.search(`hash-${Math.floor(Math.random() * 1000)}`)
}
const searchElapsed = Date.now() - searchStart
console.log(`  ⏱ 100 searches: ${searchElapsed}ms`)
assert('100 searches < 2s', searchElapsed < 2000)

perfStore.close()

console.log(`\n═══ SQLite Results: ${passed} passed, ${failed} failed ═══\n`)
fs.rmSync(tmpDir, { recursive: true, force: true })
process.exit(failed > 0 ? 1 : 0)
