'use strict'

/**
 * Canonical JSON (CJSON) -- reference implementation for the AILog hash domain.
 *
 * Normative rules live in `ailog/spec/FORMAT.md` ("Canonical JSON").
 *
 * Data entering the *hash domain* (Merkle leaf, anchor, proof bundle) MUST be
 * serialized through `canonicalJson()`. `JSON.stringify()` on its own does NOT
 * satisfy this spec: it preserves insertion order instead of sorting keys.
 *
 *   C1  UTF-8, no BOM
 *   C2  object keys sorted recursively by Unicode code point; arrays keep order
 *   C3  no insignificant whitespace ("," and ":", no space after colon)
 *   C4  escape only " \ and U+0000-U+001F; non-ASCII emitted raw
 *   C5  integers only, |n| <= 2^53-1; float / NaN / Infinity rejected
 *   C6  absent fields are omitted, never written as null
 *   C7  duplicate keys are illegal
 */

const crypto = require('crypto')

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER

class CanonicalJSONError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CanonicalJSONError'
  }
}

function at(path) {
  return path || '$'
}

/**
 * C4: lone surrogates cannot be encoded as UTF-8, so they are rejected rather
 * than silently replaced with U+FFFD.
 */
function assertNoLoneSurrogate(value, path) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < value.length ? value.charCodeAt(i + 1) : 0
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new CanonicalJSONError(
          `lone high surrogate U+${code.toString(16)} at ${at(path)}`
        )
      }
      i++
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new CanonicalJSONError(
        `lone low surrogate U+${code.toString(16)} at ${at(path)}`
      )
    }
  }
}

/**
 * C2: compare by Unicode code point. UTF-8 byte order is identical to code
 * point order, so Buffer.compare works for every string, including astral
 * ones -- unlike `Array.prototype.sort()`, which compares UTF-16 code units.
 */
function compareCodePoints(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

function encode(value, path) {
  if (value === null) return 'null'

  const type = typeof value

  if (type === 'boolean') return value ? 'true' : 'false'

  if (type === 'string') {
    assertNoLoneSurrogate(value, path)
    // JSON.stringify handles C3/C4 escaping exactly as specified.
    return JSON.stringify(value)
  }

  if (type === 'number') {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      throw new CanonicalJSONError(`non-finite number at ${at(path)}`)
    }
    if (!Number.isInteger(value)) {
      throw new CanonicalJSONError(
        `float is not allowed in the canonical domain (C5) at ${at(path)}`
      )
    }
    if (!Number.isSafeInteger(value)) {
      throw new CanonicalJSONError(
        `integer outside +/-(2^53-1) is not representable (C5) at ${at(path)}`
      )
    }
    return String(value)
  }

  if (Array.isArray(value)) {
    const parts = value.map((item, index) => {
      if (item === undefined) {
        throw new CanonicalJSONError(
          `undefined array element is not allowed (C6) at ${path}[${index}]`
        )
      }
      return encode(item, `${path}[${index}]`)
    })
    return '[' + parts.join(',') + ']'
  }

  if (type === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined) // C6
    keys.sort(compareCodePoints)
    const parts = keys.map(k =>
      JSON.stringify(k) + ':' + encode(value[k], `${path}.${k}`)
    )
    return '{' + parts.join(',') + '}'
  }

  throw new CanonicalJSONError(`unsupported type ${type} at ${at(path)}`)
}

/** Serialize `value` as Canonical JSON (C1-C7). */
function canonicalJson(value) {
  return encode(value, '')
}

/** Canonical JSON as UTF-8 bytes (C1). */
function canonicalBytes(value) {
  return Buffer.from(canonicalJson(value), 'utf8')
}

/** SHA-256 (hex) of the Canonical JSON bytes. */
function canonicalSha256(value) {
  return crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex')
}

module.exports = {
  CanonicalJSONError,
  MAX_SAFE_INTEGER,
  canonicalJson,
  canonicalBytes,
  canonicalSha256,
  compareCodePoints,
}