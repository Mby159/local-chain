const { MerkleTree, sha256, hashPair, buildFromRecords } = require('../index')

let passed = 0
let failed = 0

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`); process.exitCode = 1 }
}

console.log('\n=== MerkleTree Tests ===\n')

// 1. Basic construction
const tree = new MerkleTree(['a', 'b', 'c', 'd'])
assert(tree.getLeaves().length === 4, '4 leaves')
assert(tree.getHeight() === 3, 'height 3 (4 leaves -> 2 -> 1)')
assert(tree.getRoot() && tree.getRoot().length === 64, 'root is 64-char hex')

// 2. Empty tree
const empty = new MerkleTree([])
assert(empty.getLeaves().length === 0, 'empty leaves')
assert(empty.getRoot().length === 64, 'empty root is still valid hash')

// 3. Odd number leaves (promotion path)
const odd = new MerkleTree(['x', 'y', 'z'])
assert(odd.getLeaves().length === 3, '3 leaves')
assert(odd.getHeight() === 3, 'odd height correct')

// 4. sha256 helper
assert(sha256('test').length === 64, 'sha256 returns 64-char hex')
assert(sha256('a') !== sha256('b'), 'different inputs different hashes')

// 5. hashPair
const h1 = sha256('a'), h2 = sha256('b')
assert(hashPair(h1, h2) === sha256(h1 + h2), 'hashPair consistent')

// 6. Proof generation and verification
const records = [{ name: 'f1' }, { name: 'f2' }, { name: 'f3' }]
const tree2 = new MerkleTree(records.map(r => JSON.stringify(r)))
const leafHash = sha256(JSON.stringify(records[1]))
const proof = tree2.getProof(1)
assert(proof !== null && proof.length > 0, 'proof generated')
assert(MerkleTree.verifyProof(leafHash, proof, tree2.getRoot()), 'proof verifies')

// 7. Out-of-range proof returns null
assert(tree.getProof(99) === null, 'out-of-range returns null')
assert(tree.getProof(-1) === null, 'negative index returns null')

// 8. Tampered proof fails
const badProof = proof ? proof.map(p => ({ ...p, hash: sha256('tampered') })) : []
assert(!MerkleTree.verifyProof(leafHash, badProof, tree2.getRoot()), 'tampered proof fails')

// 9. Single leaf
const single = new MerkleTree(['only'])
assert(single.getProof(0).length === 0, 'single leaf empty proof')
assert(MerkleTree.verifyProof(single.getLeaves()[0], [], single.getRoot()), 'single leaf trivially verified')

// 10. Consistent root across rebuilds
const t1 = new MerkleTree(['a', 'b', 'c'])
const t2 = new MerkleTree(['a', 'b', 'c'])
assert(t1.getRoot() === t2.getRoot(), 'deterministic root')

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
