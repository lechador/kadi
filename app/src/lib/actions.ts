import type { Address, TransactionSigner } from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
} from "@solana-program/token";

import {
  GoalStatus,
  getClaimSolInstructionAsync,
  getClaimTokenInstructionAsync,
  getCreateGoalInstructionAsync,
  getCreateTokenGoalInstructionAsync,
  getDonateSolInstructionAsync,
  getDonateTokenInstructionAsync,
  getRegisterCreatorInstructionAsync,
  getSetGoalStatusInstruction,
  getUpdateCreatorInstruction,
} from "@/generated";
import { findVaultPda } from "./pda";

/// Thin wrappers over the generated builders. The `*Async` variants derive the
/// config, vault and supporter PDAs themselves, so callers only supply what is
/// genuinely their choice.

// ---------------------------------------------------------------------------
// Creators
// ---------------------------------------------------------------------------

export function registerCreator(input: {
  owner: TransactionSigner;
  handle: string;
  displayName: string;
  bio: string;
  avatarUri: string;
}) {
  return getRegisterCreatorInstructionAsync(input);
}

export function updateCreator(input: {
  creator: Address;
  owner: TransactionSigner;
  displayName: string | null;
  bio: string | null;
  avatarUri: string | null;
}) {
  return getUpdateCreatorInstruction(input);
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export function createGoal(input: {
  creator: Address;
  goal: Address;
  owner: TransactionSigner;
  title: string;
  description: string;
  target: bigint;
  deadline: bigint | null;
}) {
  return getCreateGoalInstructionAsync(input);
}

/// A goal denominated in an SPL token (USDC and friends). The vault's
/// associated token account has to be passed explicitly because it is owned by
/// the vault PDA, which is itself derived from the not-yet-created goal.
export async function createTokenGoal(input: {
  creator: Address;
  goal: Address;
  owner: TransactionSigner;
  mint: Address;
  title: string;
  description: string;
  target: bigint;
  deadline: bigint | null;
}) {
  const [vault] = await findVaultPda({ goal: input.goal });
  const [vaultTokenAccount] = await findAssociatedTokenPda({
    mint: input.mint,
    owner: vault,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  return getCreateTokenGoalInstructionAsync({
    ...input,
    vaultTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
}

export function setGoalStatus(input: {
  goal: Address;
  owner: TransactionSigner;
  status: GoalStatus;
}) {
  return getSetGoalStatusInstruction(input);
}

// ---------------------------------------------------------------------------
// Donations
// ---------------------------------------------------------------------------

export function donateSol(input: {
  goal: Address;
  treasury: Address;
  donor: TransactionSigner;
  amount: bigint;
  message: string;
}) {
  return getDonateSolInstructionAsync(input);
}

export async function donateToken(input: {
  goal: Address;
  treasury: Address;
  mint: Address;
  donor: TransactionSigner;
  amount: bigint;
  message: string;
}) {
  const [vault] = await findVaultPda({ goal: input.goal });
  const [vaultTokenAccount] = await findAssociatedTokenPda({
    mint: input.mint,
    owner: vault,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [donorTokenAccount] = await findAssociatedTokenPda({
    mint: input.mint,
    owner: input.donor.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [treasuryTokenAccount] = await findAssociatedTokenPda({
    mint: input.mint,
    owner: input.treasury,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  return getDonateTokenInstructionAsync({
    ...input,
    vaultTokenAccount,
    donorTokenAccount,
    treasuryTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

export function claimSol(input: {
  goal: Address;
  owner: TransactionSigner;
  amount: bigint | null;
}) {
  return getClaimSolInstructionAsync(input);
}

export async function claimToken(input: {
  goal: Address;
  owner: TransactionSigner;
  mint: Address;
  amount: bigint | null;
}) {
  const [vault] = await findVaultPda({ goal: input.goal });
  const [vaultTokenAccount] = await findAssociatedTokenPda({
    mint: input.mint,
    owner: vault,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [ownerTokenAccount] = await findAssociatedTokenPda({
    mint: input.mint,
    owner: input.owner.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  return getClaimTokenInstructionAsync({
    ...input,
    vaultTokenAccount,
    ownerTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
}

export { GoalStatus };
