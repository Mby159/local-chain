'use strict'

/**
 * Canonical JSON conformance tests.
 *
 * The vectors live in exactly one place -- `ailog/spec/canonical-vectors.json` --
 * and are shared by every implementation. The expected `canonical` strings there
 * are hand-written from the rules, so passing means agreeing with the spec
 * rather than with ourselves.
 *
 * The file is resolved from $AILOG_REPO or a sibling `../ailog` checkout. When
 * neither exists the vector section is skipped loudly instead of passing
 * silently.
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const canonical = require('../index')

const VECTORS_NAME = path.join('spec', 'canonical-vectors.json')

/**
 * Walk up from this file looking for a sibling `ailog` checkout, so the test
 * works no matter how deep the repo nest is. $AILOG_REPO wins when set.
 */
function resolveVectors() {
  const candidates = []
  if (process.env.AILOG_REPO) {
    candidates.push(path.join(process.env.AILOG_REPO, VECTORS_NAME))
  }
  let dir = __dirname
  for (let depth = 0; depth < 8; depth++) {
    dir = path.dirname(dir)
    candidates.push(path.join(dir, 'ailog', VECTORS_NAME))
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

let passed = 0
const failures = []

function check(name, fn) {
  try {
    fn()
    passed++
  } catch (err) {
    failures.push(name + ': ' + err.message)
  }
}

// ---------------------------------------------------------------- unit rules

check('C1/C3: compact, no whitespace', () => {
  assert.strictEqual(canonical.canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}')
})

check('C2: arrays keep their order', () => {
  assert.strictEqual(canonical.canonicalJson({ z: [3, 1, 2] }), '{"z":[3,1,2]}')
})

check('C3: colon has no trailing space', () => {
  assert.ok(!canonical.canonicalJson({ a: 1, b: 2 }).includes(': '))
})

check('C5: floats are rejected', () => {
  assert.throws(() => canonical.canonicalJson({ a: 1.5 }), canonical.CanonicalJSONError)
})

check('C5: NaN and Infinity are rejected', () => {
  assert.throws(() => canonical.canonicalJson({ a: NaN }), canonical.CanonicalJSONError)
  assert.throws(() => canonical.canonicalJson({ a: Infinity }), canonical.CanonicalJSONError)
})

check('C5: 2^53-1 accepted, 2^53 rejected', () => {
  assert.strictEqual(
    canonical.canonicalJson({ n: canonical.MAX_SAFE_INTEGER }),
    '{"n":9007199254740991}'
  )
  assert.throws(
    () => canonical.canonicalJson({ n: canonical.MAX_SAFE_INTEGER + 1 }),
    canonical.CanonicalJSONError
  )
})

check('C6: undefined-valued keys omitted, undefined array items rejected', () => {
  assert.strictEqual(canonical.canonicalJson({ a: 1, b: undefined }), '{"a":1}')
  assert.throws(() => canonical.canonicalJson({ a: [undefined] }), canonical.CanonicalJSONError)
})

check('C4: lone surrogates rejected, astral pairs kept', () => {
  assert.throws(() => canonical.canonicalJson({ a: '\ud800' }), canonical.CanonicalJSONError)
  assert.strictEqual(canonical.canonicalJson({ a: '\u{1F600}' }), '{"a":"\u{1F600}"}')
})

check('unsupported types rejected', () => {
  assert.throws(() => canonical.canonicalJson({ a: () => {} }), canonical.CanonicalJSONError)
  assert.throws(() => canonical.canonicalJson({ a: 10n }), canonical.CanonicalJSONError)
})

check('key order cannot change the hash', () => {
  assert.strictEqual(
    canonical.canonicalSha256({ type: 'x', id: 'i', turn_index: 0 }),
    canonical.canonicalSha256({ turn_index: 0, id: 'i', type: 'x' })
  )
})

// ------------------------------------------------------------- spec vectors

const vectorsPath = resolveVectors()

if (!vectorsPath) {
  console.log('  !! SKIPPED: ailog/spec/canonical-vectors.json not found.')
  console.log('     Set AILOG_REPO=/path/to/ailog or keep ailog as a sibling checkout.')
  console.log('     The spec conformance vectors were NOT verified.')
} else {
  const crypto = require('crypto')
  const doc = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'))
  const vectors = doc.vectors || []

  check('vectors file is non-trivial', () => {
    assert.ok(vectors.length >= 10, 'only ' + vectors.length + ' vectors')
    assert.ok(vectors.some(v => v.invalid), 'no negative vectors')
    assert.ok(vectors.some(v => !v.invalid), 'no positive vectors')
  })

  for (const vector of vectors) {
    if (vector.invalid) {
      check('vector ' + vector.id + ' must be rejected', () => {
        assert.throws(() => canonical.canonicalJson(vector.input), canonical.CanonicalJSONError)
      })
      continue
    }
    check('vector ' + vector.id + ' canonical', () => {
      assert.strictEqual(canonical.canonicalJson(vector.input), vector.canonical)
    })
    check('vector ' + vector.id + ' sha256', () => {
      const digest = crypto.createHash('sha256').update(vector.canonical, 'utf8').digest('hex')
      assert.strictEqual(digest, vector.sha256, 'vectors file is self-inconsistent')
      assert.strictEqual(canonical.canonicalSha256(vector.input), vector.sha256)
    })
  }

  console.log('  vectors: ' + vectors.length + ' from ' + vectorsPath)
}

if (failures.length) {
  console.error('\n=== Canonical JSON: ' + passed + ' passed, ' + failures.length + ' FAILED ===')
  for (const f of failures) console.error('  x ' + f)
  process.exit(1)
}
console.log('=== Canonical JSON Results: ' + passed + ' passed, 0 failed ===')