const crypto = require('crypto')

class PublicAnchor {
  constructor(config = {}) {
    this.provider = config.provider || null
    this.chain = config.chain || 'ethereum-l2'
  }

  async anchor(rootHash) {
    if (!this.provider) return { success: false, error: 'No provider configured', simulated: true }
    try { return await this.provider.anchor(rootHash, this) }
    catch (e) { return { success: false, error: e.message } }
  }

  async verify(rootHash, txHash) {
    if (!this.provider) return { verified: false, error: 'No provider configured' }
    return await this.provider.verify(rootHash, txHash, this)
  }
}

class MockAnchorProvider {
  constructor() { this.anchored = [] }

  async anchor(rootHash, ctx) {
    const txHash = '0x' + crypto.randomBytes(32).toString('hex')
    this.anchored.push({ rootHash, txHash, chain: ctx.chain, timestamp: new Date().toISOString() })
    return { success: true, txHash, chain: ctx.chain }
  }

  async verify(rootHash, txHash) {
    const match = this.anchored.find(a => a.rootHash === rootHash && a.txHash === txHash)
    return { verified: !!match, match: match || null }
  }
}

module.exports = { PublicAnchor, MockAnchorProvider }
