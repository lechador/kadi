import { NextResponse } from "next/server";
import {
  address,
  appendTransactionMessageInstruction,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getBase64Decoder,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";

import { getDonateSolInstructionAsync } from "@/generated";
import { BRAND, RPC_URL } from "@/lib/config";
import { solToLamports } from "@/lib/format";
import { fetchConfig, fetchCreatorByHandle, fetchGoalAt } from "@/lib/queries";
import { NATIVE_MINT_SENTINEL } from "@/lib/tokens";

/// Solana Pay transaction request endpoint.
///
/// A QR scan makes the wallet GET this for a label, then POST the donor's
/// address to receive a fully-formed transaction. The wallet only signs — the
/// instruction, the fee split and the supporter bookkeeping are identical to
/// the desktop flow, because both build the same on-chain instruction.
///
/// Spec: https://docs.solanapay.com/spec

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Content-Encoding",
};

type RouteContext = { params: Promise<{ handle: string; index: string }> };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request, context: RouteContext) {
  const { handle, index } = await context.params;
  const rpc = createSolanaRpc(RPC_URL);

  const creator = await fetchCreatorByHandle(rpc, handle);
  if (!creator) {
    return NextResponse.json(
      { error: `No creator @${handle}` },
      { status: 404, headers: CORS }
    );
  }

  const goal = await fetchGoalAt(rpc, creator.address, BigInt(index));
  if (!goal) {
    return NextResponse.json(
      { error: "Goal not found" },
      { status: 404, headers: CORS }
    );
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json(
    {
      label: `${creator.data.displayName || handle} · ${goal.data.title}`,
      icon: `${origin}/icon.svg`,
    },
    { headers: CORS }
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { handle, index } = await context.params;
  const url = new URL(request.url);

  let body: { account?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body" },
      { status: 400, headers: CORS }
    );
  }

  if (!body.account) {
    return NextResponse.json(
      { error: "Missing `account`" },
      { status: 400, headers: CORS }
    );
  }

  const amount = solToLamports(url.searchParams.get("amount") ?? "0.1");
  if (amount === null || amount <= 0n) {
    return NextResponse.json(
      { error: "Invalid `amount`" },
      { status: 400, headers: CORS }
    );
  }

  const message = (url.searchParams.get("message") ?? "").slice(0, 200);

  try {
    const rpc = createSolanaRpc(RPC_URL);

    const [config, creator] = await Promise.all([
      fetchConfig(rpc),
      fetchCreatorByHandle(rpc, handle),
    ]);
    if (!config) {
      return NextResponse.json(
        { error: "Protocol is not initialised" },
        { status: 503, headers: CORS }
      );
    }
    if (!creator) {
      return NextResponse.json(
        { error: `No creator @${handle}` },
        { status: 404, headers: CORS }
      );
    }

    const goal = await fetchGoalAt(rpc, creator.address, BigInt(index));
    if (!goal) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404, headers: CORS }
      );
    }

    // Token goals need the donor's associated token account, which a Solana Pay
    // request cannot create on their behalf. Fail with something readable
    // rather than building a SOL transfer that the program would reject.
    if (goal.data.mint !== NATIVE_MINT_SENTINEL) {
      return NextResponse.json(
        {
          error:
            "This goal is denominated in an SPL token. Donate with a connected wallet.",
        },
        { status: 409, headers: CORS }
      );
    }

    // The wallet supplies the signature; the donor is a noop signer here so the
    // instruction still carries the correct account metas.
    const donor = createNoopSigner(address(body.account));

    const instruction = await getDonateSolInstructionAsync({
      goal: goal.address,
      treasury: config.treasury,
      donor,
      amount,
      message,
    });

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const transaction = pipe(
      createTransactionMessage({ version: 0 }),
      (draft) => setTransactionMessageFeePayerSigner(donor, draft),
      (draft) =>
        setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, draft),
      (draft) => appendTransactionMessageInstruction(instruction, draft),
      (draft) => compileTransaction(draft)
    );

    const wire = getTransactionEncoder().encode(transaction);
    const encoded = getBase64Decoder().decode(wire);

    return NextResponse.json(
      {
        transaction: encoded,
        message: `Donate to ${goal.data.title} on ${BRAND.name}`,
      },
      { headers: CORS }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not build the transaction",
      },
      { status: 500, headers: CORS }
    );
  }
}
