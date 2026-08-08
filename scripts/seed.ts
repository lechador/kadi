/**
 * Seeds a validator with demo creators, goals and donations.
 *
 *   npm run seed              populate the protocol
 *   npm run seed -- --donate  send one more donation (use to watch the OBS
 *                             overlay fire live)
 *
 * Every step is idempotent: keypairs come from fixed seeds, and goals are
 * matched by title against what is already on-chain rather than by a
 * positional index. Re-running against a live validator is therefore safe —
 * goal PDAs are derived from the creator's own counter, so assuming a fresh
 * chain would derive the wrong address the second time around.
 */
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import type { Kadi } from "../target/types/kadi";

const FEE_BPS = 250;
const USDC_DECIMALS = 6;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = (anchor.workspace.kadi ??
  anchor.workspace.Kadi) as Program<Kadi>;
const connection = provider.connection;
const payer = (provider.wallet as anchor.Wallet).payer;

const seeded = (byte: number) => Keypair.fromSeed(Buffer.alloc(32, byte));

const treasury = seeded(7);
const donors = [seeded(11), seeded(12), seeded(13), seeded(14)];

/// Localnet has no USDC, so a stand-in is minted from a fixed keypair. The
/// address is stable across resets and is what app/.env.local points
/// NEXT_PUBLIC_USDC_MINT at.
const usdcMintKeypair = seeded(30);

// --- PDAs -------------------------------------------------------------------

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

// --- helpers ----------------------------------------------------------------

async function fund(pubkey: PublicKey, sol: number) {
  const balance = await connection.getBalance(pubkey);
  if (balance >= sol * LAMPORTS_PER_SOL) return;
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
}

function isAlreadyExists(err: unknown): boolean {
  const text = String((err as { message?: string })?.message ?? err);
  return (
    text.includes("already in use") ||
    text.includes("custom program error: 0x0")
  );
}

/// Every goal a creator currently has, keyed by title.
async function existingGoals(creator: PublicKey) {
  const account = await program.account.creator.fetchNullable(creator);
  if (!account) return { count: 0, byTitle: new Map<string, PublicKey>() };

  const count = account.goalCount.toNumber();
  const byTitle = new Map<string, PublicKey>();
  for (let index = 0; index < count; index++) {
    const address = goalPda(creator, index);
    const goal = await program.account.goal.fetchNullable(address);
    if (goal) byTitle.set(goal.title, address);
  }
  return { count, byTitle };
}

// --- demo content -----------------------------------------------------------

const CREATORS = [
  {
    owner: seeded(21),
    handle: "nikoloz_live",
    displayName: "Nikoloz",
    bio: "Variety streamer from Tbilisi. Mostly CS2 and late-night talk.",
    goals: [
      {
        title: "New microphone",
        description: "The current one clips every time I get excited.",
        target: 5,
      },
      {
        title: "Soundproofing the room",
        description: "Neighbours have been patient. Let us fix it properly.",
        target: 12,
      },
    ],
  },
  {
    owner: seeded(22),
    handle: "tako_arts",
    displayName: "Tako",
    bio: "Digital illustration streams — Georgian folklore, mostly.",
    goals: [
      {
        title: "Drawing tablet upgrade",
        description: "Moving up to a screen tablet so you can see every stroke.",
        target: 8,
      },
    ],
  },
  {
    owner: seeded(23),
    handle: "kartuli_chess",
    displayName: "Kartuli Chess",
    bio: "Coaching and tournament casts, in Georgian.",
    goals: [
      {
        title: "Tournament entry fund",
        description: "Sending two juniors to the European youth championship.",
        target: 20,
      },
    ],
  },
];

const MESSAGES = [
  "გამარჯობა! keep it up 🇬🇪",
  "watching from Berlin, we miss home",
  "for the juniors 💪",
  "best stream on Georgian internet",
  "დიდი მადლობა for yesterday's cast",
  "small but regular, see you next week",
];

const TOKEN_GOAL = {
  handle: "tako_arts",
  title: "Commission fund",
  description: "Priced in a stablecoin so the target does not move with SOL.",
  target: 2_000,
};

// --- actions ----------------------------------------------------------------

async function donateSol(
  goal: PublicKey,
  donor: Keypair,
  sol: number,
  message: string
) {
  await program.methods
    .donateSol(new BN(Math.round(sol * LAMPORTS_PER_SOL)), message)
    .accountsPartial({
      config: configPda(),
      goal,
      vault: vaultPda(goal),
      treasury: treasury.publicKey,
      supporter: supporterPda(goal, donor.publicKey),
      donor: donor.publicKey,
    })
    .signers([donor])
    .rpc();
}

async function donateToken(
  goal: PublicKey,
  mint: PublicKey,
  donor: Keypair,
  amount: number,
  message: string
) {
  await program.methods
    .donateToken(new BN(amount * 10 ** USDC_DECIMALS), message)
    .accountsPartial({
      config: configPda(),
      goal,
      vault: vaultPda(goal),
      mint,
      vaultTokenAccount: getAssociatedTokenAddressSync(
        mint,
        vaultPda(goal),
        true
      ),
      donorTokenAccount: getAssociatedTokenAddressSync(mint, donor.publicKey),
      treasury: treasury.publicKey,
      treasuryTokenAccount: getAssociatedTokenAddressSync(
        mint,
        treasury.publicKey
      ),
      supporter: supporterPda(goal, donor.publicKey),
      donor: donor.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([donor])
    .rpc();
}

// --- main -------------------------------------------------------------------

async function seedEverything() {
  console.log("config");
  try {
    await program.methods
      .initialize(FEE_BPS)
      .accountsPartial({
        config: configPda(),
        authority: provider.publicKey,
        treasury: treasury.publicKey,
      })
      .rpc();
    console.log(`  + initialize (fee ${FEE_BPS} bps)`);
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
    console.log("  · already initialised");
  }

  // --- creators and their SOL goals ---
  const solGoals = new Map<string, PublicKey>();

  for (const creator of CREATORS) {
    console.log(`\n@${creator.handle}`);
    await fund(creator.owner.publicKey, 5);
    const creatorAddress = creatorPda(creator.handle);

    try {
      await program.methods
        .registerCreator(creator.handle, creator.displayName, creator.bio, "")
        .accountsPartial({
          creator: creatorAddress,
          owner: creator.owner.publicKey,
        })
        .signers([creator.owner])
        .rpc();
      console.log("  + register");
    } catch (err) {
      if (!isAlreadyExists(err)) throw err;
      console.log("  · register (exists)");
    }

    let { count, byTitle } = await existingGoals(creatorAddress);

    for (const goal of creator.goals) {
      const found = byTitle.get(goal.title);
      if (found) {
        solGoals.set(`${creator.handle}/${goal.title}`, found);
        console.log(`  · goal "${goal.title}" (exists)`);
        continue;
      }

      // The program derives the goal PDA from the creator's live counter, so
      // the address must be derived from `count`, not from a loop index.
      const address = goalPda(creatorAddress, count);
      await program.methods
        .createGoal(
          goal.title,
          goal.description,
          new BN(goal.target * LAMPORTS_PER_SOL),
          null
        )
        .accountsPartial({
          creator: creatorAddress,
          goal: address,
          vault: vaultPda(address),
          owner: creator.owner.publicKey,
        })
        .signers([creator.owner])
        .rpc();

      solGoals.set(`${creator.handle}/${goal.title}`, address);
      byTitle.set(goal.title, address);
      count += 1;
      console.log(`  + goal "${goal.title}"`);
    }
  }

  // --- a USDC-denominated goal, so the token path has real demo data ---
  console.log("\nUSDC (mock)");
  let mint: PublicKey;
  try {
    mint = await createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      USDC_DECIMALS,
      usdcMintKeypair
    );
    console.log(`  + mint ${mint.toBase58()}`);
  } catch {
    mint = usdcMintKeypair.publicKey;
    console.log(`  · mint ${mint.toBase58()} (exists)`);
  }

  for (const donor of donors.slice(0, 3)) {
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      donor,
      mint,
      donor.publicKey
    );
    if (Number(ata.amount) === 0) {
      await mintTo(connection, payer, mint, ata.address, payer, 5_000_000_000);
    }
  }

  const tokenCreator = CREATORS.find((c) => c.handle === TOKEN_GOAL.handle)!;
  const tokenCreatorAddress = creatorPda(TOKEN_GOAL.handle);
  const tokenState = await existingGoals(tokenCreatorAddress);

  let tokenGoal = tokenState.byTitle.get(TOKEN_GOAL.title);
  if (tokenGoal) {
    console.log(`  · goal "${TOKEN_GOAL.title}" (exists)`);
  } else {
    tokenGoal = goalPda(tokenCreatorAddress, tokenState.count);
    await program.methods
      .createTokenGoal(
        TOKEN_GOAL.title,
        TOKEN_GOAL.description,
        new BN(TOKEN_GOAL.target * 10 ** USDC_DECIMALS),
        null
      )
      .accountsPartial({
        creator: tokenCreatorAddress,
        goal: tokenGoal,
        vault: vaultPda(tokenGoal),
        mint,
        vaultTokenAccount: getAssociatedTokenAddressSync(
          mint,
          vaultPda(tokenGoal),
          true
        ),
        owner: tokenCreator.owner.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([tokenCreator.owner])
      .rpc();
    console.log(`  + goal "${TOKEN_GOAL.title}"`);
  }

  for (const [i, donor] of donors.slice(0, 3).entries()) {
    const amount = [250, 400, 125][i];
    try {
      await donateToken(
        tokenGoal,
        mint,
        donor,
        amount,
        MESSAGES[(i + 2) % MESSAGES.length]
      );
      console.log(`  + ${amount} USDC -> @${TOKEN_GOAL.handle}`);
    } catch (err) {
      console.log(`  ! ${amount} USDC: ${(err as Error).message}`);
    }
  }

  // --- SOL donations ---
  console.log("\ndonations");
  const plan: Array<[string, number, number]> = [
    ["nikoloz_live/New microphone", 0, 1.5],
    ["nikoloz_live/New microphone", 1, 0.75],
    ["nikoloz_live/New microphone", 2, 2.25],
    ["nikoloz_live/New microphone", 0, 0.5],
    ["nikoloz_live/Soundproofing the room", 3, 3],
    ["tako_arts/Drawing tablet upgrade", 1, 2],
    ["tako_arts/Drawing tablet upgrade", 2, 1.25],
    ["kartuli_chess/Tournament entry fund", 3, 6.5],
    ["kartuli_chess/Tournament entry fund", 0, 1],
  ];

  for (const [index, [key, donorIndex, sol]] of plan.entries()) {
    const goal = solGoals.get(key);
    if (!goal) {
      console.log(`  ! ${key}: goal missing`);
      continue;
    }
    try {
      await donateSol(
        goal,
        donors[donorIndex],
        sol,
        MESSAGES[index % MESSAGES.length]
      );
      console.log(`  + ${sol} SOL -> ${key}`);
    } catch (err) {
      console.log(`  ! ${key}: ${(err as Error).message}`);
    }
  }
}

async function singleDonation() {
  const creatorAddress = creatorPda("nikoloz_live");
  const { byTitle } = await existingGoals(creatorAddress);
  const goal = byTitle.get("New microphone");
  if (!goal) {
    throw new Error("Run `npm run seed` first — the demo goal does not exist.");
  }

  const sol = 0.42;
  await donateSol(
    goal,
    donors[2],
    sol,
    "live alert test — გამარჯობა from the terminal!"
  );
  console.log(`  + ${sol} SOL -> @nikoloz_live (watch the overlay)`);
}

async function main() {
  console.log(`\nprogram  ${program.programId.toBase58()}`);
  console.log(`treasury ${treasury.publicKey.toBase58()}\n`);

  await fund(treasury.publicKey, 1);
  await Promise.all(donors.map((donor) => fund(donor.publicKey, 50)));

  if (process.argv.includes("--donate")) {
    await singleDonation();
  } else {
    await seedEverything();
  }

  console.log("\ndone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
