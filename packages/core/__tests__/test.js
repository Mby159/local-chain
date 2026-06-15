const path = require('path')
const fs = require('fs')
const { Block, Chain, MerkleTree, sha256, buildFromRecords } = require('../index')

let passed = 0
let failed = 0

function assert(name, condition) {
  if (condition) { console.log(`  ✓ ${name}`); passed++ }
  else { console.log(`  ✗ ${name}`); failed++ }
}

const tmpDir = path.join(__dirname, '__tmp__')
if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true })

// ── Block ──
console.log('\n[Block]')
const b = new Block(1, { test: true }, '0')
assert('block has hash', b.hash.length === 64)
assert('block has timestamp', !!b.timestamp)
assert('block index', b.index === 1)
assert('block previousHash', b.previousHash === '0')

const mined = new Block(2, { x: 1 }, 'prev')
mined.mineBlock(2)
assert('mined starts 00', mined.hash.startsWith('00'))

// ── Merkle Tree ──
console.log('\n[Merkle Tree]')
const mt = new MerkleTree(['a', 'b', 'c', 'd'])
assert('4 leaves root', mt.getRoot().length === 64)
assert('height 3', mt.getHeight() === 3)

const proof0 = mt.getProof(0)
assert('proof verify', MerkleTree.verifyProof(sha256('a'), proof0, mt.getRoot()))
assert('proof reject', !MerkleTree.verifyProof(sha256('x'), proof0, mt.getRoot()))

const mt2 = new MerkleTree(['single'])
assert('single leaf', mt2.getRoot() === sha256('single'))

const mt3 = new MerkleTree([])
assert('empty tree', mt3.getRoot().length === 64)

const bf = buildFromRecords([{ h: '1' }, { h: '2' }, { h: '3' }])
assert('buildFromRecords', bf.getLeaves().length === 3)

// ── Chain ──
console.log('\n[Chain]')
const chain = new Chain(path.join(tmpDir, 'chain1'))
assert('genesis', chain.length() === 1)

const block1 = chain.addBlock([{ hash: 'aaa', name: 'f1' }, { hash: 'bbb', name: 'f2' }])
assert('addBlock', chain.length() === 2)
assert('block has merkle', !!block1.merkleRoot)
assert('merkle 64 hex', block1.merkleRoot.length === 64)

const proof = chain.getProof(1, 0)
assert('getProof', proof !== null)
assert('verifyRecord true', chain.verifyRecord(block1.data.records[0], 1, 0))
assert('verifyRecord false', !chain.verifyRecord({ hash: 'zzz' }, 1, 0))

const found = chain.findRecord('aaa')
assert('findRecord', found !== null && found.blockIndex === 1)
assert('findRecord not found', chain.findRecord('zzz') === null)

chain.addBlock([{ hash: 'ccc' }, { hash: 'ddd' }])
assert('chain valid', chain.isValid())
assert('getRootHash', chain.getRootHash().length === 64)

// Persistence
const chain2 = new Chain(path.join(tmpDir, 'chain1'))
assert('persists', chain2.length() === 3)
assert('persisted findRecord', chain2.findRecord('aaa') !== null)
assert('persisted proof', chain2.getProof(1, 0) !== null)

// Mining
const chain3 = new Chain(path.join(tmpDir, 'chain_mine'), { difficulty: 2 })
chain3.addBlock([{ hash: 'xxx' }])
assert('mined', chain3.getLatest().hash.startsWith('00'))

console.log(`\n═══ Core Results: ${passed} passed, ${failed} failed ═══\n`)
fs.rmSync(tmpDir, { recursive: true, force: true })
process.exit(failed > 0 ? 1 : 0)
