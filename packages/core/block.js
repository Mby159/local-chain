const crypto = require('crypto')

class Block {
  constructor(index, data, previousHash = '') {
    this.index = index
    this.timestamp = new Date().toISOString()
    this.data = data
    this.previousHash = previousHash
    this.nonce = 0
    this.hash = this.computeHash()
  }

  computeHash() {
    const payload = this.index + this.timestamp + JSON.stringify(this.data) + this.previousHash + this.nonce
    return crypto.createHash('sha256').update(payload).digest('hex')
  }

  mineBlock(difficulty = 0) {
    if (difficulty === 0) return
    const prefix = '0'.repeat(difficulty)
    while (!this.hash.startsWith(prefix)) {
      this.nonce++
      this.hash = this.computeHash()
    }
  }

  static fromJSON(data) {
    const block = new Block(data.index, data.data, data.previousHash)
    block.timestamp = data.timestamp
    block.nonce = data.nonce
    block.hash = data.hash
    return block
  }
}

module.exports = { Block }
