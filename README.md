# LocalChain

轻量级本地区块链引擎 — 零成本、模块化、可扩展。

## 快速开始

```bash
# 初始化
node packages/cli/cli.js init

# 添加记录
node packages/cli/cli.js add '[{"hash":"abc","name":"file1.txt"},{"hash":"def","name":"file2.jpg"}]'

# 查看状态
node packages/cli/cli.js status

# 搜索记录
node packages/cli/cli.js search abc

# 获取 Merkle 证明
node packages/cli/cli.js proof 1 0

# 校验链
node packages/cli/cli.js validate
```

## 架构

```
packages/
├── core/           # 核心（Block, Chain, MerkleTree）— 零依赖
├── store/          # 存储插件（JSON）
├── anchor/         # 公链锚定插件（Mock, 可扩展）
├── cli/            # 命令行工具
└── sdk/            # Node.js SDK（整合所有包）
```

## 模块

### @local-chain/core

```javascript
const { Chain, MerkleTree, sha256 } = require('./packages/core')

const chain = new Chain('./my-chain')
chain.addBlock([{ hash: 'abc', name: 'file.txt' }])

// Merkle 证明
const proof = chain.getProof(1, 0)
const valid = chain.verifyRecord(record, 1, 0)

// 搜索
const found = chain.findRecord('abc')
```

### @local-chain/anchor

```javascript
const { PublicAnchor, MockAnchorProvider } = require('./packages/anchor')

const anchor = new PublicAnchor({ provider: new MockAnchorProvider() })
await anchor.anchor(chain.getRootHash())
```

## 测试

```bash
npm test
```

45/45 测试通过。

## 使用场景

- 证据存证（配合 Evidence 项目）
- 审计日志（不可篡改的操作记录）
- 配置版本管理
- 供应链追踪
- 任何需要"不可篡改记录"的场景

## License

MIT
