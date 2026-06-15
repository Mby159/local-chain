const path = require('path')
const fs = require('fs')
const http = require('http')
const { createServer } = require('../index')
const { MockAnchorProvider } = require('../../anchor')

let passed = 0
let failed = 0

function assert(name, condition) {
  if (condition) { console.log(`  ✓ ${name}`); passed++ }
  else { console.log(`  ✗ ${name}`); failed++ }
}

function request(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const opts = { hostname: '127.0.0.1', port, path, method, headers: { 'Content-Type': 'application/json' } }
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data)
    const req = http.request(opts, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }) }
        catch { resolve({ status: res.statusCode, body: null }) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

const tmpDir = path.join(__dirname, '__tmp_server__')
if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true })

async function run() {
  const port = 13456 + Math.floor(Math.random() * 1000)
  const srv = createServer(path.join(tmpDir, 'chain'), { port, anchor: { provider: new MockAnchorProvider() } })
  await srv.listen()

  // ── Health ──
  console.log('\n[Health]')
  const h = await request(port, 'GET', '/api/health')
  assert('health 200', h.status === 200)
  assert('health ok', h.body.status === 'ok')
  assert('health valid', h.body.valid === true)

  // ── Chain Status ──
  console.log('\n[Chain Status]')
  const cs = await request(port, 'GET', '/api/chain')
  assert('chain status', cs.status === 200)
  assert('chain length 1', cs.body.length === 1)
  assert('chain valid', cs.body.valid === true)

  // ── Add Block ──
  console.log('\n[Add Block]')
  const add = await request(port, 'POST', '/api/chain/blocks', {
    records: [{ hash: 'aaa', name: 'f1.txt' }, { hash: 'bbb', name: 'f2.jpg' }]
  })
  assert('add block 201', add.status === 201)
  assert('block index 1', add.body.index === 1)
  assert('block has merkle', !!add.body.merkleRoot)

  // ── Get Block ──
  console.log('\n[Get Block]')
  const gb = await request(port, 'GET', '/api/chain/block/1')
  assert('get block 200', gb.status === 200)
  assert('block records', gb.body.data.records.length === 2)

  const gn = await request(port, 'GET', '/api/chain/block/999')
  assert('block 404', gn.status === 404)

  // ── List Blocks ──
  console.log('\n[List Blocks]')
  const lb = await request(port, 'GET', '/api/chain/blocks')
  assert('list blocks', lb.status === 200)
  assert('list total 2', lb.body.total === 2)

  // ── Search ──
  console.log('\n[Search]')
  const sr = await request(port, 'GET', '/api/chain/search/aaa')
  assert('search found', sr.status === 200)
  assert('search blockIndex', sr.body.blockIndex === 1)

  const sn = await request(port, 'GET', '/api/chain/search/zzz')
  assert('search not found', sn.status === 404)

  // ── Proof ──
  console.log('\n[Proof]')
  const pr = await request(port, 'GET', '/api/chain/proof/1/0')
  assert('proof 200', pr.status === 200)
  assert('proof has merkleRoot', !!pr.body.merkleRoot)

  // ── Verify Record ──
  console.log('\n[Verify Record]')
  const vr = await request(port, 'POST', '/api/chain/verify', {
    record: { hash: 'aaa', name: 'f1.txt' },
    blockIndex: 1,
    leafIndex: 0,
  })
  assert('verify valid', vr.status === 200 && vr.body.valid === true)

  const vf = await request(port, 'POST', '/api/chain/verify', {
    record: { hash: 'zzz' },
    blockIndex: 1,
    leafIndex: 0,
  })
  assert('verify invalid', vf.body.valid === false)

  // ── Validate ──
  console.log('\n[Validate]')
  const vl = await request(port, 'GET', '/api/chain/validate')
  assert('validate', vl.status === 200 && vl.body.valid === true)

  // ── Anchor ──
  console.log('\n[Anchor]')
  const an = await request(port, 'POST', '/api/anchor')
  assert('anchor 200', an.status === 200)
  assert('anchor success', an.body.success === true)

  // ── Add more blocks ──
  await request(port, 'POST', '/api/chain/blocks', { records: [{ hash: 'ccc' }] })
  await request(port, 'POST', '/api/chain/blocks', { records: [{ hash: 'ddd' }, { hash: 'eee' }, { hash: 'fff' }] })

  const cs2 = await request(port, 'GET', '/api/chain')
  assert('chain now 4', cs2.body.length === 4)
  assert('chain still valid', cs2.body.valid === true)

  // ── 404 ──
  console.log('\n[404]')
  const nf = await request(port, 'GET', '/api/nonexistent')
  assert('404', nf.status === 404)

  // ── Invalid input ──
  console.log('\n[Validation]')
  const bad = await request(port, 'POST', '/api/chain/blocks', { records: [] })
  assert('empty records 400', bad.status === 400)

  // Done
  await srv.close()
  console.log(`\n═══ Server Results: ${passed} passed, ${failed} failed ═══\n`)
  fs.rmSync(tmpDir, { recursive: true, force: true })
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
