import {
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from "@solana/kit";

import { KADI_PROGRAM_ADDRESS } from "@/generated";

// Codama generates finders for every PDA whose seeds it can resolve statically.
// Re-exported here so callers have one import site for address derivation.
export {
  findConfigPda,
  findCreatorPda,
  findSupporterPda,
  findVaultPda,
} from "@/generated";

const addressEncoder = getAddressEncoder();
const text = new TextEncoder();

function u64le(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytes;
}

/// Written by hand because the goal seed includes `creator.goal_count`, an
/// account field Codama cannot resolve at codegen time.
export async function findGoalPda(
  creator: Address,
  index: bigint
): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: KADI_PROGRAM_ADDRESS,
    seeds: [
      text.encode("goal"),
      new Uint8Array(addressEncoder.encode(creator)),
      u64le(index),
    ],
  });
  return address;
}
