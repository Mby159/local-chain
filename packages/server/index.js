const http = require('http')
const { Chain } = require('../core/chain')
const { MerkleTree, sha256 } = require('../core/merkle')
const { PublicAnchor } = require('../anchor')

class Router {
  constructor() { this.routes = [] }

  get(path, handler) { this.routes.push({ method: 'GET', path, handler }) }
  post(path, handler) { this.routes.push({ method: 'POST', path, handler }) }
  delete(path, handler) { this.routes.push({ method: 'DELETE', path, handler }) }

  match(method, url) {
    const pathname = url.split('?')[0]
    for (const route of this.routes) {
      if (route.method !== method) continue
      const pattern = route.path.replace(/:(\w+)/g, '([^/]+)')
      const regex = new RegExp(`^${pattern}$`)
      const match = pathname.match(regex)
      if (match) {
        const params = {}
        const paramNames = (route.path.match(/:(\w+)/g) || []).map(p => p.slice(1))
        paramNames.forEach((name, i) => { params[name] = match[i + 1] })
        return { handler: route.handler, params }
      }
    }
    return null
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString()
        resolve(body ? JSON.parse(body) : {})
      } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function createServer(chainDir, opts = {}) {
  const chain = new Chain(chainDir, opts)
  const anchor = new PublicAnchor(opts.anchor || {})
  const router = new Router()
  const port = opts.port || 3456

  // ── Routes ──

  router.get('/api/health', (req, res) => {
    send(res, 200, { status: 'ok', chain: chain.length(), valid: chain.isValid() })
  })

  router.get('/api/chain', (req, res) => {
    send(res, 200, {
      length: chain.length(),
      rootHash: chain.getRootHash(),
      valid: chain.isValid(),
      latest: chain.getLatest(),
    })
  })

  router.get('/api/chain/blocks', (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const offset = parseInt(url.searchParams.get('offset')) || 0
    const limit = parseInt(url.searchParams.get('limit')) || 50
    const blocks = chain.getAllBlocks().slice(offset, offset + limit)
    send(res, 200, { blocks, total: chain.length(), offset, limit })
  })

  router.get('/api/chain/block/:index', (req, res) => {
    const block = chain.getBlock(parseInt(req.params.index))
    if (!block) return send(res, 404, { error: 'Block not found' })
    send(res, 200, block)
  })

  router.get('/api/chain/validate', (req, res) => {
    send(res, 200, { valid: chain.isValid() })
  })

  router.post('/api/chain/blocks', async (req, res) => {
    try {
      const { records } = await parseBody(req)
      if (!records || !Array.isArray(records) || records.length === 0) {
        return send(res, 400, { error: 'records array required' })
      }
      const block = chain.addBlock(records)
      send(res, 201, block)
    } catch (e) {
      send(res, 500, { error: e.message })
    }
  })

  router.get('/api/chain/search/:hash', (req, res) => {
    const found = chain.findRecord(req.params.hash)
    if (!found) return send(res, 404, { error: 'Record not found' })
    send(res, 200, found)
  })

  router.get('/api/chain/proof/:block/:leaf', (req, res) => {
    const proof = chain.getProof(parseInt(req.params.block), parseInt(req.params.leaf))
    if (!proof) return send(res, 404, { error: 'Proof not found' })
    const block = chain.getBlock(parseInt(req.params.block))
    send(res, 200, { proof, merkleRoot: block.merkleRoot })
  })

  router.post('/api/chain/verify', async (req, res) => {
    try {
      const { record, blockIndex, leafIndex } = await parseBody(req)
      const valid = chain.verifyRecord(record, blockIndex, leafIndex)
      send(res, 200, { valid })
    } catch (e) {
      send(res, 500, { error: e.message })
    }
  })

  router.post('/api/anchor', async (req, res) => {
    try {
      const rootHash = chain.getRootHash()
      const result = await anchor.anchor(rootHash)
      send(res, 200, { rootHash, ...result })
    } catch (e) {
      send(res, 500, { error: e.message })
    }
  })

  router.get('/api/anchor/verify', async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const rootHash = url.searchParams.get('rootHash')
    const txHash = url.searchParams.get('txHash')
    if (!rootHash || !txHash) return send(res, 400, { error: 'rootHash and txHash required' })
    const result = await anchor.verify(rootHash, txHash)
    send(res, 200, result)
  })

  // ── Server ──

  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

    const match = router.match(req.method, req.url)
    if (!match) return send(res, 404, { error: 'Not found' })
    req.params = match.params
    try { await match.handler(req, res) }
    catch (e) { send(res, 500, { error: e.message }) }
  })

  return {
    chain,
    anchor,
    router,
    server,
    listen: () => new Promise(resolve => server.listen(port, () => {
      console.log(`LocalChain API running on http://localhost:${port}`)
      resolve(server)
    })),
    close: () => new Promise(resolve => server.close(resolve)),
    port,
  }
}

module.exports = { createServer, Router }
