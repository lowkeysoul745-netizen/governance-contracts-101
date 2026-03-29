const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Governance Flow", function () {
  let token, timelock, governor;
  let owner, voter1, voter2, voter3;

  beforeEach(async function () {
    // Get fake accounts from Hardhat (pre-loaded with 10,000 ETH each)
    [owner, voter1, voter2, voter3] = await ethers.getSigners();

    // 1. Deploy GovernanceToken
    const Token = await ethers.getContractFactory("GovernanceToken");
    token = await Token.deploy(owner.address);
    await token.waitForDeployment();

    // 2. Deploy Timelock
    const Timelock = await ethers.getContractFactory("DemoTimelock");
    timelock = await Timelock.deploy(
      1,          // minDelay: 1 second
      [],         // proposers: empty for now
      [],         // executors: empty for now
      owner.address
    );
    await timelock.waitForDeployment();

    // 3. Deploy Governor
    const Governor = await ethers.getContractFactory("DemoGovernor");
    governor = await Governor.deploy(
      await token.getAddress(),
      await timelock.getAddress()
    );
    await governor.waitForDeployment();

    // Grant Governor the proposer and executor roles on Timelock
const proposerRole = await timelock.PROPOSER_ROLE();
const executorRole = await timelock.EXECUTOR_ROLE();
const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

await timelock.grantRole(proposerRole, await governor.getAddress());
await timelock.grantRole(executorRole, ethers.ZeroAddress); // anyone can execute
await timelock.revokeRole(adminRole, owner.address); // renounce admin for decentralization
  })
  it("1. Distributes tokens and delegates voting power", async function () {
  // Distribute tokens to voters
  await token.transfer(voter1.address, ethers.parseEther("100000")); // 100k tokens
  await token.transfer(voter2.address, ethers.parseEther("200000")); // 200k tokens
  await token.transfer(voter3.address, ethers.parseEther("50000"));  // 50k tokens

  // Check balances
  expect(await token.balanceOf(voter1.address)).to.equal(ethers.parseEther("100000"));
  expect(await token.balanceOf(voter2.address)).to.equal(ethers.parseEther("200000"));

  // Delegate voting power to themselves
  await token.connect(voter1).delegate(voter1.address);
  await token.connect(voter2).delegate(voter2.address);
  await token.connect(voter3).delegate(voter3.address);

  // Check voting power
  expect(await token.getVotes(voter1.address)).to.equal(ethers.parseEther("100000"));
  expect(await token.getVotes(voter2.address)).to.equal(ethers.parseEther("200000"));
  expect(await token.getVotes(voter3.address)).to.equal(ethers.parseEther("50000"));
});

it("2. Creates a proposal", async function () {
  // Distribute and delegate first
  await token.transfer(voter1.address, ethers.parseEther("100000"));
  await token.connect(voter1).delegate(voter1.address);

  // Mine a block so voting power is checkpointed
  await ethers.provider.send("evm_mine");

  // Proposal: send 0 ETH to voter1 (a simple dummy proposal for testing)
  const targets = [voter1.address];   // who to call
  const values = [0];                  // ETH to send
  const calldatas = ["0x"];            // function to call (empty = just ETH transfer)
  const description = "Proposal #1: Give voter1 some recognition!";

  const tx = await governor.connect(voter1).propose(
    targets,
    values,
    calldatas,
    description
  );

  const receipt = await tx.wait();
  const proposalId = receipt.logs[0].args[0];

  console.log("Proposal ID:", proposalId.toString());

  // State 0 = Pending (voting hasn't started yet, waiting for votingDelay)
  expect(await governor.state(proposalId)).to.equal(0);
});

it("3. Votes on a proposal", async function () {
  // Distribute and delegate
  await token.transfer(voter1.address, ethers.parseEther("100000"));
  await token.transfer(voter2.address, ethers.parseEther("200000"));
  await token.transfer(voter3.address, ethers.parseEther("50000"));
  await token.connect(voter1).delegate(voter1.address);
  await token.connect(voter2).delegate(voter2.address);
  await token.connect(voter3).delegate(voter3.address);

  // Mine a block to checkpoint voting power
  await ethers.provider.send("evm_mine");

  // Create proposal
  const targets = [voter1.address];
  const values = [0];
  const calldatas = ["0x"];
  const description = "Proposal #1: Give voter1 some recognition!";
  const tx = await governor.connect(voter1).propose(targets, values, calldatas, description);
  const receipt = await tx.wait();
  const proposalId = receipt.logs[0].args[0];

  await ethers.provider.send("hardhat_mine", ["0x5"]);//Mining 5 blocks Prior to voting start (votingDelay = 3 blocks)

  // State should now be Active (1)
  expect(await governor.state(proposalId)).to.equal(1);

  // Cast votes
  // 0 = Against, 1 = For, 2 = Abstain
  await governor.connect(voter1).castVote(proposalId, 1); // For
  await governor.connect(voter2).castVote(proposalId, 1); // For
  await governor.connect(voter3).castVote(proposalId, 0); // Against

  // Check vote counts
  const { againstVotes, forVotes, abstainVotes } = await governor.proposalVotes(proposalId);
  console.log("For votes:     ", ethers.formatEther(forVotes));
  console.log("Against votes: ", ethers.formatEther(againstVotes));
  console.log("Abstain votes: ", ethers.formatEther(abstainVotes));

  expect(forVotes).to.be.gt(againstVotes);
});

it("4. Queues and executes a proposal", async function () {
  // Distribute and delegate
  await token.transfer(voter1.address, ethers.parseEther("100000"));
  await token.transfer(voter2.address, ethers.parseEther("200000"));
  await token.transfer(voter3.address, ethers.parseEther("50000"));
  await token.connect(voter1).delegate(voter1.address);
  await token.connect(voter2).delegate(voter2.address);
  await token.connect(voter3).delegate(voter3.address);

  await ethers.provider.send("evm_mine");

  // Create proposal
  const targets = [voter1.address];
  const values = [0];
  const calldatas = ["0x"];
  const description = "Proposal #1: Give voter1 some recognition!";
  const tx = await governor.connect(voter1).propose(targets, values, calldatas, description);
  const receipt = await tx.wait();
  const proposalId = receipt.logs[0].args[0];

  // Skip votingDelay
  await ethers.provider.send("hardhat_mine", ["0x5"]);

  // Vote
  await governor.connect(voter1).castVote(proposalId, 1); // For
  await governor.connect(voter2).castVote(proposalId, 1); // For
  await governor.connect(voter3).castVote(proposalId, 0); // Against

  // Skip votingPeriod (50 blocks)
  await ethers.provider.send("hardhat_mine", ["0x32"]); // 0x32 = 50 in hex

  // State should be Succeeded (4)
  expect(await governor.state(proposalId)).to.equal(4);
  console.log("Proposal Succeeded! ✅");

  // Queue it in the Timelock
  const descriptionHash = ethers.id(description);
  await governor.queue(targets, values, calldatas, descriptionHash);

  // State should be Queued (5)
  expect(await governor.state(proposalId)).to.equal(5);
  console.log("Proposal Queued in Timelock! ⏳");

  // Skip the timelock delay
  await ethers.provider.send("evm_increaseTime", [2]); // increase time by 2 seconds
  await ethers.provider.send("evm_mine");

  // Execute!
  await governor.execute(targets, values, calldatas, descriptionHash);

  // State should be Executed (6)
  expect(await governor.state(proposalId)).to.equal(7);
  console.log("Proposal Executed! 🚀");
});

it("5. Full flow summary", async function() {
  await token.transfer(voter1.address, ethers.parseEther("100000"));
  await token.transfer(voter2.address, ethers.parseEther("200000"));
  await token.transfer(voter3.address, ethers.parseEther("50000"));

  await token.connect(voter1).delegate(voter1.address);
  await token.connect(voter2).delegate(voter2.address);
  await token.connect(voter3).delegate(voter3.address);

  await ethers.provider.send("evm_mine");

  const targets = [voter1.address];
  const values = [0];
  const calldatas = ["0x"];
  const description = "Final summary proposal";

  const tx = await governor.connect(voter1).propose(targets, values, calldatas, description);
  const receipt = await tx.wait();
  const proposalId = receipt.logs[0].args[0];

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📜 Proposal created!");
  console.log("👤 Proposer   :", voter1.address);
  console.log("🆔 Proposal ID:", proposalId.toString().slice(0, 10) + "...");

  await ethers.provider.send("hardhat_mine", ["0x5"]);
  console.log("🗳️  Voting is now ACTIVE");

  await governor.connect(voter1).castVote(proposalId, 1);
  await governor.connect(voter2).castVote(proposalId, 1);
  await governor.connect(voter3).castVote(proposalId, 0);

  const { againstVotes, forVotes } = await governor.proposalVotes(proposalId);
  console.log("\n📊 Vote Results:");
  console.log("   ✅ For    :", ethers.formatEther(forVotes), "DEMO");
  console.log("   ❌ Against:", ethers.formatEther(againstVotes), "DEMO");

  await ethers.provider.send("hardhat_mine", ["0x32"]);

  const descriptionHash = ethers.id(description);
  await governor.queue(targets, values, calldatas, descriptionHash);
  console.log("\n⏳ Proposal queued in Timelock...");

  await ethers.provider.send("evm_increaseTime", [2]);
  await ethers.provider.send("evm_mine");

  await governor.execute(targets, values, calldatas, descriptionHash);
  console.log("🚀 Proposal EXECUTED!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  expect(await governor.state(proposalId)).to.equal(7);
});

});


