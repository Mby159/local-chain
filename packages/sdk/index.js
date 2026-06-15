const { Block, Chain, MerkleTree, sha256, buildFromRecords } = require('../core')
const { JSONStore } = require('../store')
const { PublicAnchor, MockAnchorProvider } = require('../anchor')

function createChain(chainDir, opts = {}) {
  return new Chain(chainDir, opts)
}

function createStore(filePath) {
  return new JSONStore(filePath)
}

function createAnchor(config = {}) {
  return new PublicAnchor(config)
}

module.exports = {
  Block, Chain, MerkleTree, sha256, buildFromRecords,
  JSONStore, PublicAnchor, MockAnchorProvider,
  createChain, createStore, createAnchor,
}
