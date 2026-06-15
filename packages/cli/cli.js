#!/usr/bin/env node
const path = require('path')
const fs = require('fs')
const { Chain } = require('../core/chain')
const { MerkleTree, sha256 } = require('../core/merkle')

const args = process.argv.slice(2)
const cmd = args[0]

function usage() {
  console.log(`
LocalChain CLI v0.1.0

Usage:
  lc init              初始化链
  lc add <json>        添加区块（JSON 格式的记录数组）
  lc status            链状态
  lc block <index>     查看区块
  lc search <hash>     搜索记录
  lc proof <block> <leaf>  获取 Merkle 证明
  lc verify <block> <leaf> <record.json>  验证记录
  lc validate          校验整条链
  lc export [file]     导出 JSON
`)
}

function getChain() {
  const dir = path.join(process.cwd(), '.localchain')
  return new Chain(dir)
}

async function main() {
  if (!cmd || cmd === 'help') { usage(); return }

  switch (cmd) {
    case 'init': {
      const chain = getChain()
      console.log(`\n  ✓ 链已初始化 (${chain.length()} blocks)`)
      break
    }

    case 'add': {
      const input = args[1]
      if (!input) { console.error('Error: provide JSON records'); process.exit(1) }
      let records
      if (fs.existsSync(input)) {
        records = JSON.parse(fs.readFileSync(input, 'utf-8'))
      } else {
        records = JSON.parse(input)
      }
      if (!Array.isArray(records)) records = [records]
      const chain = getChain()
      const block = chain.addBlock(records)
      console.log(`\n  ✓ 区块 #${block.index} 已添加`)
      console.log(`  记录: ${records.length} 条`)
      console.log(`  Merkle Root: ${block.merkleRoot}`)
      console.log(`  Block Hash: ${block.hash}`)
      break
    }

    case 'status': {
      const chain = getChain()
      console.log(`\n  区块数: ${chain.length()}`)
      console.log(`  链有效: ${chain.isValid() ? '✓' : '✗'}`)
      console.log(`  根哈希: ${chain.getRootHash()}`)
      break
    }

    case 'block': {
      const idx = parseInt(args[1])
      if (isNaN(idx)) { console.error('Error: provide block index'); process.exit(1) }
      const chain = getChain()
      const block = chain.getBlock(idx)
      if (!block) { console.error(`Block #${idx} not found`); process.exit(1) }
      console.log(`\n  Block #${block.index}`)
      console.log(`  Timestamp: ${block.timestamp}`)
      console.log(`  Hash: ${block.hash}`)
      console.log(`  Previous: ${block.previousHash}`)
      if (block.merkleRoot) console.log(`  Merkle: ${block.merkleRoot}`)
      if (block.data.records) {
        console.log(`  Records: ${block.data.records.length}`)
        block.data.records.forEach((r, i) => console.log(`    [${i}] ${JSON.stringify(r).slice(0, 80)}`))
      }
      break
    }

    case 'search': {
      const hash = args[1]
      if (!hash) { console.error('Error: provide record hash'); process.exit(1) }
      const chain = getChain()
      const found = chain.findRecord(hash)
      if (found) {
        console.log(`\n  ✓ 找到记录`)
        console.log(`  Block: #${found.blockIndex}`)
        console.log(`  Leaf: ${found.leafIndex}`)
        console.log(`  Record: ${JSON.stringify(found.record)}`)
      } else {
        console.log('\n  ✗ 未找到')
      }
      break
    }

    case 'proof': {
      const blockIdx = parseInt(args[1])
      const leafIdx = parseInt(args[2])
      if (isNaN(blockIdx) || isNaN(leafIdx)) { console.error('Error: provide block index and leaf index'); process.exit(1) }
      const chain = getChain()
      const proof = chain.getProof(blockIdx, leafIdx)
      if (!proof) { console.error('Proof not found'); process.exit(1) }
      console.log(`\n  Merkle Proof (block #${blockIdx}, leaf #${leafIdx}):`)
      console.log(JSON.stringify(proof, null, 2))
      break
    }

    case 'verify': {
      const blockIdx = parseInt(args[1])
      const leafIdx = parseInt(args[2])
      const recordFile = args[3]
      if (isNaN(blockIdx) || isNaN(leafIdx) || !recordFile) {
        console.error('Error: lc verify <block> <leaf> <record.json>'); process.exit(1)
      }
      const record = JSON.parse(fs.readFileSync(recordFile, 'utf-8'))
      const chain = getChain()
      const valid = chain.verifyRecord(record, blockIdx, leafIdx)
      console.log(valid ? '\n  ✓ 记录验证通过' : '\n  ✗ 记录验证失败')
      break
    }

    case 'validate': {
      const chain = getChain()
      const valid = chain.isValid()
      console.log(valid ? '\n  ✓ 整条链有效' : '\n  ✗ 链已损坏')
      break
    }

    case 'export': {
      const out = args[1] || 'localchain-export.json'
      const chain = getChain()
      fs.writeFileSync(out, JSON.stringify(chain.getAllBlocks(), null, 2))
      console.log(`\n  ✓ 已导出到 ${out}`)
      break
    }

    default:
      console.error(`Unknown command: ${cmd}`)
      usage()
      process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
