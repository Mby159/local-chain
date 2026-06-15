const path = require('path')
const fs = require('fs')
const { createChain, createStore, createAnchor, Chain, MerkleTree, sha256, MockAnchorProvider } = require('../index')

let passed = 0
let failed = 0

function assert(name, condition) {
  if (condition) { console.log(`  ✓ ${name}`); passed++ }
  else { console.log(`  ✗ ${name}`); failed++ }
}

const tmpDir = path.join(__dirname, '__tmp_sdk__')
if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true })

console.log('\n[SDK Factories]')

const chain = createChain(path.join(tmpDir, 'chain'))
assert('createChain', chain.length() === 1)

const store = createStore(path.join(tmpDir, 'records.json'))
assert('createStore', store.getAll().length === 0)
store.add({ id: '1', hash: 'abc', name: 'test' })
assert('store add', store.getAll().length === 1)

const anchor = createAnchor()
assert('createAnchor', anchor instanceof Object)

console.log('\n[Full Integration]')

const chain2 = createChain(path.join(tmpDir, 'chain2'))
chain2.addBlock([{ hash: 'file1', name: 'photo.jpg' }, { hash: 'file2', name: 'doc.pdf' }])
chain2.addBlock([{ hash: 'file3', name: 'audio.mp3' }])
assert('chain blocks', chain2.length() === 3)
assert('chain valid', chain2.isValid())

const found = chain2.findRecord('file1')
assert('findRecord', found !== null)
assert('verifyRecord', chain2.verifyRecord(found.record, found.blockIndex, found.leafIndex))

const mockProvider = new MockAnchorProvider()
const { PublicAnchor } = require('../../anchor')
const pubAnchor = new PublicAnchor({ provider: mockProvider })

pubAnchor.anchor(chain2.getRootHash()).then(anchResult => {
  assert('anchor root', anchResult.success)
  return pubAnchor.verify(chain2.getRootHash(), anchResult.txHash)
}).then(anchVerify => {
  assert('verify anchor', anchVerify.verified)
  const exported = chain2.getAllBlocks()
  assert('export blocks', exported.length === 3)
  console.log(`\n═══ SDK Results: ${passed} passed, ${failed} failed ═══\n`)
  fs.rmSync(tmpDir, { recursive: true, force: true })
  process.exit(failed > 0 ? 1 : 0)
})
