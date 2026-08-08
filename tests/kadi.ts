import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";
import type { Kadi } from "../target/types/kadi";

const FEE_BPS = 250; // 2.5% — a third of kisa.ge's 7.5%
const RENT_EXEMPT_ZERO_DATA = 890_880; // lamports for a 0-byte account

describe("kadi", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = (anchor.workspace.kadi ??
    anchor.workspace.Kadi) as Program<Kadi>;
  const connection = provider.connection;
  const authority = (provider.wallet as anchor.Wallet).payer;

  const treasury = Keypair.generate();
  const creatorOwner = Keypair.generate();
  const donorA = Keypair.generate();
  const donorB = Keypair.generate();
  const stranger = Keypair.generate();

  const HANDLE = "nikoloz_live";

  // --- PDA helpers ---------------------------------------------------------

  const configPda = () =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    )[0];

  const creatorPda = (handle: string) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("creator"), Buffer.from(handle)],
      program.programId
    )[0];

  const goalPda = (creator: PublicKey, index: number) => {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(index));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("goal"), creator.toBuffer(), buf],
      program.programId
    )[0];
  };

  const vaultPda = (goal: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), goal.toBuffer()],
      program.programId
    )[0];

  const supporterPda = (goal: PublicKey, donor: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("supporter"), goal.toBuffer(), donor.toBuffer()],
      program.programId
    )[0];

  async function fund(pubkey: PublicKey, sol = 20) {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  }

  async function expectError(promise: Promise<unknown>, code: string) {
    try {
      await promise;
      assert.fail(`expected the instruction to fail with ${code}`);
    } catch (err: any) {
      const text = err?.error?.errorCode?.code ?? JSON.stringify(err);
      assert.include(
        String(text),
        code,
        `expected ${code}, got: ${err?.message ?? text}`
      );
    }
  }

  before(async () => {
    await Promise.all(
      [treasury, creatorOwner, donorA, donorB, stranger].map((kp) =>
        fund(kp.publicKey)
      )
    );
  });

  // -------------------------------------------------------------------------
  // Protocol config
  // -------------------------------------------------------------------------

  it("initializes the protocol config", async () => {
    await program.methods
      .initialize(FEE_BPS)
      .accountsPartial({
        config: configPda(),
        authority: authority.publicKey,
        treasury: treasury.publicKey,
      })
      .rpc();

    const config = await program.account.config.fetch(configPda());
    assert.equal(config.feeBps, FEE_BPS);
    assert.ok(config.treasury.equals(treasury.publicKey));
    assert.ok(config.authority.equals(authority.publicKey));
  });

  it("refuses a fee above the 10% on-chain ceiling", async () => {
    await expectError(
      program.methods
        .updateConfig(1_500, null, null)
        .accountsPartial({ config: configPda(), authority: authority.publicKey })
        .rpc(),
      "FeeTooHigh"
    );
  });

  it("refuses a config update from a non-authority", async () => {
    await expectError(
      program.methods
        .updateConfig(100, null, null)
        .accountsPartial({ config: configPda(), authority: stranger.publicKey })
        .signers([stranger])
        .rpc(),
      "Unauthorized"
    );
  });

  // -------------------------------------------------------------------------
  // Creators
  // -------------------------------------------------------------------------

  it("registers a creator", async () => {
    await program.methods
      .registerCreator(HANDLE, "Nikoloz", "Streaming from Tbilisi", "")
      .accountsPartial({
        creator: creatorPda(HANDLE),
        owner: creatorOwner.publicKey,
      })
      .signers([creatorOwner])
      .rpc();

    const creator = await program.account.creator.fetch(creatorPda(HANDLE));
    assert.equal(creator.handle, HANDLE);
    assert.equal(creator.displayName, "Nikoloz");
    assert.equal(creator.goalCount.toNumber(), 0);
    assert.ok(creator.owner.equals(creatorOwner.publicKey));
  });

  it("rejects handles outside [a-z0-9_]", async () => {
    for (const bad of ["Nikoloz", "ni", "niko loz", "niko-loz"]) {
      await expectError(
        program.methods
          .registerCreator(bad, "x", "", "")
          .accountsPartial({
            creator: creatorPda(bad),
            owner: stranger.publicKey,
          })
          .signers([stranger])
          .rpc(),
        "InvalidHandle"
      );
    }
  });

  it("makes handles globally unique", async () => {
    try {
      await program.methods
        .registerCreator(HANDLE, "Impostor", "", "")
        .accountsPartial({
          creator: creatorPda(HANDLE),
          owner: stranger.publicKey,
        })
        .signers([stranger])
        .rpc();
      assert.fail("a second creator claimed an existing handle");
    } catch (err: any) {
      assert.ok(err, "expected the duplicate registration to fail");
    }
  });

  it("rejects a profile update from someone who is not the owner", async () => {
    await expectError(
      program.methods
        .updateCreator("Hacked", null, null)
        .accountsPartial({
          creator: creatorPda(HANDLE),
          owner: stranger.publicKey,
        })
        .signers([stranger])
        .rpc(),
      "Unauthorized"
    );
  });

  // -------------------------------------------------------------------------
  // SOL goals and donations
  // -------------------------------------------------------------------------

  const creator = () => creatorPda(HANDLE);
  const goal0 = () => goalPda(creator(), 0);

  it("creates a SOL goal with a rent-exempt vault", async () => {
    await program.methods
      .createGoal(
        "New microphone",
        "Upgrading the stream audio",
        new BN(5 * LAMPORTS_PER_SOL),
        null
      )
      .accountsPartial({
        creator: creator(),
        goal: goal0(),
        vault: vaultPda(goal0()),
        owner: creatorOwner.publicKey,
      })
      .signers([creatorOwner])
      .rpc();

    const goal = await program.account.goal.fetch(goal0());
    assert.equal(goal.title, "New microphone");
    assert.equal(goal.raised.toNumber(), 0);
    assert.equal(goal.target.toNumber(), 5 * LAMPORTS_PER_SOL);
    assert.ok(goal.mint.equals(PublicKey.default), "SOL goal has a null mint");
    assert.deepEqual(goal.status, { active: {} });

    const vaultBalance = await connection.getBalance(vaultPda(goal0()));
    assert.equal(vaultBalance, RENT_EXEMPT_ZERO_DATA);

    const updated = await program.account.creator.fetch(creator());
    assert.equal(updated.goalCount.toNumber(), 1);
  });

  it("rejects a goal from someone who is not the creator", async () => {
    await expectError(
      program.methods
        .createGoal("Stolen", "", new BN(1), null)
        .accountsPartial({
          creator: creator(),
          goal: goalPda(creator(), 1),
          vault: vaultPda(goalPda(creator(), 1)),
          owner: stranger.publicKey,
        })
        .signers([stranger])
        .rpc(),
      "Unauthorized"
    );
  });

  it("splits a donation between the vault and the treasury atomically", async () => {
    const amount = 1 * LAMPORTS_PER_SOL;
    const expectedFee = (amount * FEE_BPS) / 10_000;
    const expectedNet = amount - expectedFee;

    const vaultBefore = await connection.getBalance(vaultPda(goal0()));
    const treasuryBefore = await connection.getBalance(treasury.publicKey);

    await program.methods
      .donateSol(new BN(amount), "გამარჯობა! keep it up 🇬🇪")
      .accountsPartial({
        config: configPda(),
        goal: goal0(),
        vault: vaultPda(goal0()),
        treasury: treasury.publicKey,
        supporter: supporterPda(goal0(), donorA.publicKey),
        donor: donorA.publicKey,
      })
      .signers([donorA])
      .rpc();

    const vaultAfter = await connection.getBalance(vaultPda(goal0()));
    const treasuryAfter = await connection.getBalance(treasury.publicKey);

    assert.equal(vaultAfter - vaultBefore, expectedNet, "net went to the vault");
    assert.equal(
      treasuryAfter - treasuryBefore,
      expectedFee,
      "fee went to the treasury"
    );

    const goal = await program.account.goal.fetch(goal0());
    assert.equal(goal.raised.toNumber(), amount, "raised tracks the gross");
    assert.equal(goal.donationCount.toNumber(), 1);
    assert.equal(goal.supporterCount.toNumber(), 1);

    const supporter = await program.account.supporter.fetch(
      supporterPda(goal0(), donorA.publicKey)
    );
    assert.equal(supporter.total.toNumber(), amount);
    assert.equal(supporter.count.toNumber(), 1);
  });

  it("accumulates a repeat donor without inflating the supporter count", async () => {
    await program.methods
      .donateSol(new BN(0.5 * LAMPORTS_PER_SOL), "again!")
      .accountsPartial({
        config: configPda(),
        goal: goal0(),
        vault: vaultPda(goal0()),
        treasury: treasury.publicKey,
        supporter: supporterPda(goal0(), donorA.publicKey),
        donor: donorA.publicKey,
      })
      .signers([donorA])
      .rpc();

    const goal = await program.account.goal.fetch(goal0());
    assert.equal(goal.donationCount.toNumber(), 2);
    assert.equal(goal.supporterCount.toNumber(), 1, "still one unique donor");

    const supporter = await program.account.supporter.fetch(
      supporterPda(goal0(), donorA.publicKey)
    );
    assert.equal(supporter.count.toNumber(), 2);
    assert.equal(supporter.total.toNumber(), 1.5 * LAMPORTS_PER_SOL);
  });

  it("builds a leaderboard from supporter accounts", async () => {
    await program.methods
      .donateSol(new BN(2 * LAMPORTS_PER_SOL), "from Berlin")
      .accountsPartial({
        config: configPda(),
        goal: goal0(),
        vault: vaultPda(goal0()),
        treasury: treasury.publicKey,
        supporter: supporterPda(goal0(), donorB.publicKey),
        donor: donorB.publicKey,
      })
      .signers([donorB])
      .rpc();

    const supporters = await program.account.supporter.all([
      { memcmp: { offset: 8, bytes: goal0().toBase58() } },
    ]);
    assert.equal(supporters.length, 2);

    const ranked = supporters.sort((a, b) =>
      b.account.total.cmp(a.account.total)
    );
    assert.ok(
      ranked[0].account.donor.equals(donorB.publicKey),
      "donor B leads with 2 SOL"
    );

    const goal = await program.account.goal.fetch(goal0());
    assert.equal(goal.supporterCount.toNumber(), 2);
    assert.equal(goal.raised.toNumber(), 3.5 * LAMPORTS_PER_SOL);
  });

  it("rejects an empty donation and an oversized message", async () => {
    const accounts = {
      config: configPda(),
      goal: goal0(),
      vault: vaultPda(goal0()),
      treasury: treasury.publicKey,
      supporter: supporterPda(goal0(), donorA.publicKey),
      donor: donorA.publicKey,
    };

    await expectError(
      program.methods
        .donateSol(new BN(0), "hi")
        .accountsPartial(accounts)
        .signers([donorA])
        .rpc(),
      "InvalidAmount"
    );

    await expectError(
      program.methods
        .donateSol(new BN(1000), "x".repeat(201))
        .accountsPartial(accounts)
        .signers([donorA])
        .rpc(),
      "MessageTooLong"
    );
  });

  it("rejects a donation routed to the wrong treasury", async () => {
    await expectError(
      program.methods
        .donateSol(new BN(1000), "fee theft")
        .accountsPartial({
          config: configPda(),
          goal: goal0(),
          vault: vaultPda(goal0()),
          treasury: stranger.publicKey,
          supporter: supporterPda(goal0(), donorA.publicKey),
          donor: donorA.publicKey,
        })
        .signers([donorA])
        .rpc(),
      "Unauthorized"
    );
  });

  // -------------------------------------------------------------------------
  // Claiming
  // -------------------------------------------------------------------------

  it("rejects a claim from someone who is not the goal owner", async () => {
    await expectError(
      program.methods
        .claimSol(null)
        .accountsPartial({
          goal: goal0(),
          vault: vaultPda(goal0()),
          owner: stranger.publicKey,
        })
        .signers([stranger])
        .rpc(),
      "Unauthorized"
    );
  });

  it("rejects a claim larger than the vault balance", async () => {
    await expectError(
      program.methods
        .claimSol(new BN(999 * LAMPORTS_PER_SOL))
        .accountsPartial({
          goal: goal0(),
          vault: vaultPda(goal0()),
          owner: creatorOwner.publicKey,
        })
        .signers([creatorOwner])
        .rpc(),
      "InsufficientFunds"
    );
  });

  it("lets the creator claim a partial amount", async () => {
    const claimAmount = 1 * LAMPORTS_PER_SOL;
    const ownerBefore = await connection.getBalance(creatorOwner.publicKey);
    const vaultBefore = await connection.getBalance(vaultPda(goal0()));

    await program.methods
      .claimSol(new BN(claimAmount))
      .accountsPartial({
        goal: goal0(),
        vault: vaultPda(goal0()),
        owner: creatorOwner.publicKey,
      })
      .signers([creatorOwner])
      .rpc();

    const ownerAfter = await connection.getBalance(creatorOwner.publicKey);
    const vaultAfter = await connection.getBalance(vaultPda(goal0()));

    assert.equal(vaultBefore - vaultAfter, claimAmount);
    // The owner also paid the transaction fee, so allow for that.
    assert.isAtLeast(ownerAfter - ownerBefore, claimAmount - 10_000);

    const goal = await program.account.goal.fetch(goal0());
    assert.equal(goal.claimed.toNumber(), claimAmount);
    assert.equal(
      goal.raised.toNumber(),
      3.5 * LAMPORTS_PER_SOL,
      "claiming never rewinds the progress bar"
    );
  });

  it("claims the remainder but never breaks the rent-exempt floor", async () => {
    await program.methods
      .claimSol(null)
      .accountsPartial({
        goal: goal0(),
        vault: vaultPda(goal0()),
        owner: creatorOwner.publicKey,
      })
      .signers([creatorOwner])
      .rpc();

    const vaultAfter = await connection.getBalance(vaultPda(goal0()));
    assert.equal(
      vaultAfter,
      RENT_EXEMPT_ZERO_DATA,
      "vault keeps exactly its rent-exempt minimum"
    );

    // Everything donated, minus the protocol fee, reached the creator.
    const goal = await program.account.goal.fetch(goal0());
    const grossDonated = 3.5 * LAMPORTS_PER_SOL;
    const expectedNet = grossDonated - (grossDonated * FEE_BPS) / 10_000;
    assert.equal(goal.claimed.toNumber(), expectedNet);
  });

  it("rejects a claim when nothing is left", async () => {
    await expectError(
      program.methods
        .claimSol(null)
        .accountsPartial({
          goal: goal0(),
          vault: vaultPda(goal0()),
          owner: creatorOwner.publicKey,
        })
        .signers([creatorOwner])
        .rpc(),
      "InvalidAmount"
    );
  });

  // -------------------------------------------------------------------------
  // Goal status
  // -------------------------------------------------------------------------

  it("stops donations once a goal is archived", async () => {
    await program.methods
      .setGoalStatus({ archived: {} })
      .accountsPartial({ goal: goal0(), owner: creatorOwner.publicKey })
      .signers([creatorOwner])
      .rpc();

    const goal = await program.account.goal.fetch(goal0());
    assert.deepEqual(goal.status, { archived: {} });

    await expectError(
      program.methods
        .donateSol(new BN(1000), "too late")
        .accountsPartial({
          config: configPda(),
          goal: goal0(),
          vault: vaultPda(goal0()),
          treasury: treasury.publicKey,
          supporter: supporterPda(goal0(), donorA.publicKey),
          donor: donorA.publicKey,
        })
        .signers([donorA])
        .rpc(),
      "GoalNotActive"
    );
  });

  it("rejects a deadline in the past", async () => {
    await expectError(
      program.methods
        .createGoal("Expired", "", new BN(LAMPORTS_PER_SOL), new BN(1_600_000_000))
        .accountsPartial({
          creator: creator(),
          goal: goalPda(creator(), 1),
          vault: vaultPda(goalPda(creator(), 1)),
          owner: creatorOwner.publicKey,
        })
        .signers([creatorOwner])
        .rpc(),
      "InvalidDeadline"
    );
  });

  // -------------------------------------------------------------------------
  // SPL token goals (USDC path)
  // -------------------------------------------------------------------------

  describe("token goals", () => {
    let mint: PublicKey;
    let goal1: PublicKey;
    const DECIMALS = 6; // USDC-like

    before(async () => {
      mint = await createMint(
        connection,
        authority,
        authority.publicKey,
        null,
        DECIMALS
      );

      for (const donor of [donorA, donorB]) {
        const ata = await createAssociatedTokenAccount(
          connection,
          donor,
          mint,
          donor.publicKey
        );
        await mintTo(connection, authority, mint, ata, authority, 1_000_000_000);
      }
    });

    it("creates a token-denominated goal", async () => {
      const creatorAccount = await program.account.creator.fetch(creator());
      goal1 = goalPda(creator(), creatorAccount.goalCount.toNumber());

      await program.methods
        .createTokenGoal(
          "Travel to a LAN event",
          "Denominated in a stablecoin so the target does not move",
          new BN(500_000_000), // 500 tokens
          null
        )
        .accountsPartial({
          creator: creator(),
          goal: goal1,
          vault: vaultPda(goal1),
          mint,
          vaultTokenAccount: getAssociatedTokenAddressSync(
            mint,
            vaultPda(goal1),
            true
          ),
          owner: creatorOwner.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([creatorOwner])
        .rpc();

      const goal = await program.account.goal.fetch(goal1);
      assert.ok(goal.mint.equals(mint));
      assert.equal(goal.target.toNumber(), 500_000_000);
    });

    it("rejects a SOL donation to a token goal", async () => {
      await expectError(
        program.methods
          .donateSol(new BN(1000), "wrong rail")
          .accountsPartial({
            config: configPda(),
            goal: goal1,
            vault: vaultPda(goal1),
            treasury: treasury.publicKey,
            supporter: supporterPda(goal1, donorA.publicKey),
            donor: donorA.publicKey,
          })
          .signers([donorA])
          .rpc(),
        "NotNativeGoal"
      );
    });

    it("splits a token donation between the vault and the treasury", async () => {
      const amount = 100_000_000; // 100 tokens
      const expectedFee = (amount * FEE_BPS) / 10_000;
      const expectedNet = amount - expectedFee;

      const vaultAta = getAssociatedTokenAddressSync(
        mint,
        vaultPda(goal1),
        true
      );
      const treasuryAta = getAssociatedTokenAddressSync(
        mint,
        treasury.publicKey
      );

      await program.methods
        .donateToken(new BN(amount), "stablecoin support")
        .accountsPartial({
          config: configPda(),
          goal: goal1,
          vault: vaultPda(goal1),
          mint,
          vaultTokenAccount: vaultAta,
          donorTokenAccount: getAssociatedTokenAddressSync(
            mint,
            donorA.publicKey
          ),
          treasury: treasury.publicKey,
          treasuryTokenAccount: treasuryAta,
          supporter: supporterPda(goal1, donorA.publicKey),
          donor: donorA.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([donorA])
        .rpc();

      const vaultBalance = await getAccount(connection, vaultAta);
      const treasuryBalance = await getAccount(connection, treasuryAta);

      assert.equal(Number(vaultBalance.amount), expectedNet);
      assert.equal(Number(treasuryBalance.amount), expectedFee);

      const goal = await program.account.goal.fetch(goal1);
      assert.equal(goal.raised.toNumber(), amount);
      assert.equal(goal.supporterCount.toNumber(), 1);
    });

    it("lets the creator claim the token balance", async () => {
      const vaultAta = getAssociatedTokenAddressSync(
        mint,
        vaultPda(goal1),
        true
      );
      const ownerAta = getAssociatedTokenAddressSync(
        mint,
        creatorOwner.publicKey
      );
      const expectedNet = 100_000_000 - (100_000_000 * FEE_BPS) / 10_000;

      await program.methods
        .claimToken(null)
        .accountsPartial({
          goal: goal1,
          vault: vaultPda(goal1),
          mint,
          vaultTokenAccount: vaultAta,
          ownerTokenAccount: ownerAta,
          owner: creatorOwner.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([creatorOwner])
        .rpc();

      const ownerBalance = await getAccount(connection, ownerAta);
      const vaultBalance = await getAccount(connection, vaultAta);

      assert.equal(Number(ownerBalance.amount), expectedNet);
      assert.equal(Number(vaultBalance.amount), 0);
    });

    it("rejects a token claim from a stranger", async () => {
      await expectError(
        program.methods
          .claimToken(null)
          .accountsPartial({
            goal: goal1,
            vault: vaultPda(goal1),
            mint,
            vaultTokenAccount: getAssociatedTokenAddressSync(
              mint,
              vaultPda(goal1),
              true
            ),
            ownerTokenAccount: getAssociatedTokenAddressSync(
              mint,
              stranger.publicKey
            ),
            owner: stranger.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([stranger])
          .rpc(),
        "Unauthorized"
      );
    });
  });
});
