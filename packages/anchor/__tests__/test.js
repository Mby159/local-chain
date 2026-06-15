const path = require('path')
const fs = require('fs')
const { PublicAnchor, MockAnchorProvider } = require('../index')
const { sha256 } = require('../../core/merkle')

let passed = 0
let failed = 0

function assert(name, condition) {
  if (condition) { console.log(`  ✓ ${name}`); passed++ }
  else { console.log(`  ✗ ${name}`); failed++ }
}

console.log('\n[PublicAnchor]')

const mock = new MockAnchorProvider()
const anchor = new PublicAnchor({ provider: mock })

const root = sha256('test-data')
anchor.anchor(root).then(result => {
  assert('anchor success', result.success)
  assert('anchor txHash', result.txHash.startsWith('0x'))
  return anchor.verify(root, result.txHash)
}).then(verify => {
  assert('verify success', verify.verified)
  return anchor.verify('wrong', verify.match?.txHash || 'x')
}).then(bad => {
  assert('reject bad hash', !bad.verified)
  const noProvider = new PublicAnchor()
  return noProvider.anchor('test')
}).then(noResult => {
  assert('no provider', !noResult.success && noResult.simulated)
  return anchor.anchor(sha256('other-data'))
}).then(r2 => {
  assert('second anchor', r2.success)
  assert('two anchored', mock.anchored.length === 2)
  console.log(`\n═══ Anchor Results: ${passed} passed, ${failed} failed ═══\n`)
  process.exit(failed > 0 ? 1 : 0)
})
