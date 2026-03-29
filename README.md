# 🏛️ governance-contracts-101

A hands-on learning project for understanding **OpenZeppelin Governor contracts** — how token-based voting works, how proposals are created, voted on, and executed — all on a local Hardhat node with no real accounts or money involved.

---

## 💡 What This Project Teaches

- How `ERC20Votes` gives tokens voting power via delegation
- How a `Governor` contract manages the full proposal lifecycle
- How a `TimelockController` adds an execution delay for safety
- How to simulate a complete DAO governance flow in local tests

---

## 🏗️ Architecture

Three contracts work together to form the governance system:

```
GovernanceToken  ──►  DemoGovernor  ──►  DemoTimelock
  (voting power)         (voting)        (execution delay)
```

| Contract | Inherits From | Role |
|---|---|---|
| `GovernanceToken` | `ERC20Votes`, `ERC20Permit`, `Ownable` | Token that carries voting weight |
| `DemoGovernor` | `Governor` + 5 OZ extensions | Manages proposals, voting, results |
| `DemoTimelock` | `TimelockController` | Enforces delay before execution |

---

## 🗳️ Proposal Lifecycle

Every proposal goes through these states:

```
0 Pending   → just created, waiting for votingDelay
1 Active    → voting is open
2 Canceled
3 Defeated  → didn't get enough votes
4 Succeeded → passed voting!
5 Queued    → waiting in Timelock
6 Expired   → queued but never executed in time
7 Executed  → done! ✅
```

---

## ⚙️ Governor Settings

| Setting | Value | Meaning |
|---|---|---|
| `votingDelay` | 1 block | Wait 1 block after proposal before voting starts |
| `votingPeriod` | 50 blocks | Voting window |
| `proposalThreshold` | 0 tokens | Anyone can create a proposal |
| `quorumFraction` | 4% | Minimum 4% of total supply must vote |
| `timelockDelay` | 1 second | Delay between passing and execution (local testing) |

---

## 📦 Tech Stack

| Tool | Purpose |
|---|---|
| Hardhat 2 | Local Ethereum development environment |
| OpenZeppelin Contracts v5 | Governance contract modules |
| Ethers.js v6 | Blockchain interaction |
| Chai + Mocha | Testing framework |

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/lowkeysoul745-netizen/governance-contracts-101.git
cd governance-contracts-101
```

### 2. Install dependencies

```bash
npm install
```

### 3. Compile contracts

```bash
npx hardhat compile
```

### 4. Run tests

```bash
npx hardhat test
```

---

## 🧪 Test Coverage

| Test | What it covers |
|---|---|
| `1. Distributes tokens and delegates voting power` | Token transfers + delegation activating voting power |
| `2. Creates a proposal` | Proposing on-chain actions, checking Pending state |
| `3. Votes on a proposal` | Casting For/Against/Abstain votes, checking vote counts |
| `4. Queues and executes a proposal` | Full lifecycle: Succeeded → Queued → Executed |
| `5. Full flow summary` | End-to-end run with console output |

---

## 🔑 Key Concepts

### Delegation
Holding tokens alone does **not** give voting power. You must call `delegate()`:

```js
// Activate your own voting power
await token.connect(voter).delegate(voter.address);

// Or delegate to someone else
await token.connect(voter).delegate(anotherAddress);
```

### Block Mining in Tests
Since `ERC20Votes` snapshots balances per block, you need to mine blocks manually in tests to simulate time passing:

```js
await ethers.provider.send("evm_mine");                   // mine 1 block
await ethers.provider.send("hardhat_mine", ["0x32"]);     // mine 50 blocks
await ethers.provider.send("evm_increaseTime", [2]);      // fast forward 2 seconds
```

### Vote Types
```
0 = Against
1 = For
2 = Abstain
```

---

## 📁 Project Structure

```
governance-contracts-101/
├── contracts/
│   ├── GovernanceToken.sol   ← ERC20 token with voting power
│   ├── DemoTimelock.sol      ← Execution delay controller
│   └── DemoGovernor.sol      ← Full governance engine
├── test/
│   └── governance.test.js    ← All 5 tests
├── hardhat.config.js
└── package.json
```

---

## 📚 Resources

- [OpenZeppelin Governor Docs](https://docs.openzeppelin.com/contracts/5.x/governance)
- [Hardhat Documentation](https://hardhat.org/docs)
- [ERC20Votes Reference](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#ERC20Votes)

---

## 👤 Author

[@lowkeysoul745-netizen](https://github.com/lowkeysoul745-netizen)

> Built as a learning project to understand DAO governance from scratch.
