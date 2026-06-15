const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { Block } = require('./block')
const { MerkleTree, sha256 } = require('./merkle')

class Chain {
  constructor(chainDir, opts = {}) {
    this.chainDir = chainDir
    this.chainFile = path.join(chainDir, 'chain.json')
    this.difficulty = opts.difficulty || 0
    fs.mkdirSync(chainDir, { recursive: true })
    this._load()
  }

  _load() {
    if (fs.existsSync(this.chainFile)) {
      this.chain = JSON.parse(fs.readFileSync(this.chainFile, 'utf-8'))
    } else {
      this.chain = [this._genesis()]
    }
  }

  _save() {
    fs.writeFileSync(this.chainFile, JSON.stringify(this.chain, null, 2))
  }

  _genesis() {
    const genesis = new Block(0, { type: 'genesis', message: 'LocalChain Genesis' }, '0')
    return { index: 0, timestamp: genesis.timestamp, data: genesis.data, previousHash: '0', hash: genesis.hash, nonce: 0 }
  }

  addBlock(records) {
    const last = this.chain[this.chain.length - 1]
    const tree = new MerkleTree(records.map(r => JSON.stringify(r)))
    const merkleRoot = tree.getRoot()
    const block = new Block(last.index + 1, { type: 'batch', records, merkleRoot }, last.hash)
    block.mineBlock(this.difficulty)
    const blockData = { index: block.index, timestamp: block.timestamp, data: block.data, previousHash: block.previousHash, hash: block.hash, nonce: block.nonce, merkleRoot }
    this.chain.push(blockData)
    this._save()
    return blockData
  }

  getBlock(index) { return this.chain[index] || null }
  getLatest() { return this.chain[this.chain.length - 1] }
  length() { return this.chain.length }

  getRootHash() {
    const hashes = this.chain.map(b => b.hash)
    return crypto.createHash('sha256').update(hashes.join('')).digest('hex')
  }

  isValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i]
      const previous = this.chain[i - 1]
      if (current.previousHash !== previous.hash) return false
      const payload = current.index + current.timestamp + JSON.stringify(current.data) + current.previousHash + current.nonce
      const recomputed = crypto.createHash('sha256').update(payload).digest('hex')
      if (recomputed !== current.hash) return false
    }
    return true
  }

  getProof(blockIndex, leafIndex) {
    const block = this.chain[blockIndex]
    if (!block || !block.data.records) return null
    const tree = new MerkleTree(block.data.records.map(r => JSON.stringify(r)))
    return tree.getProof(leafIndex)
  }

  verifyRecord(record, blockIndex, leafIndex) {
    const block = this.chain[blockIndex]
    if (!block || !block.merkleRoot) return false
    const proof = this.getProof(blockIndex, leafIndex)
    if (!proof) return false
    const leafHash = sha256(JSON.stringify(record))
    return MerkleTree.verifyProof(leafHash, proof, block.merkleRoot)
  }

  findRecord(hash) {
    for (const block of this.chain) {
      if (!block.data.records) continue
      const idx = block.data.records.findIndex(r => r.hash === hash)
      if (idx !== -1) return { blockIndex: block.index, leafIndex: idx, record: block.data.records[idx] }
    }
    return null
  }

  getAllBlocks() { return [...this.chain] }
}

module.exports = { Chain }
