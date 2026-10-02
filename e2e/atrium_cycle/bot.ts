import { execFile } from "node:child_process";
import { open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { deserializeDatum } from "@meshsdk/core";
import { BASKET_TOKEN_UNIT } from "../atrium_mainnet/src/config.js";
import { exRateLessThan } from "../atrium_mainnet/src/math.js";
import { fetchBasketUtxos } from "../atrium_mainnet/src/queries.js";
import { AdminControllerHash } from "../admin_controller/validator.js";
import { GlobalSettingsAddr } from "../global_settings/validator.js";
import { OrderValidatorAddr } from "../order/validator.js";
import { PoolValidatorAddr } from "../pool/validator.js";
import { RewardsValidatorAddr } from "../rewards/validator.js";
import { LAVA_NETWORK, NETWORK_CONFIG } from "../network.js";
import {
  ATRIUM_POOL_STAKE_ASSET_NAME,
  blockchainProvider,
  MinPoolLovelace,
} from "../setup.js";

const execFileAsync = promisify(execFile);
const statePath = fileURLToPath(
  new URL("../../../.atrium-cycle-mainnet.json", import.meta.url),
);
const lockPath = fileURLToPath(
  new URL("../../../.atrium-cycle-mainnet.lock", import.meta.url),
);
const pollMs = 5 * 60 * 1000;

type Phase =
  | "batch"
  | "close"
  | "stake"
  | "wait_reward"
  | "withdraw"
  | "return"
  | "open";
type Action = Exclude<Phase, "wait_reward">;
type Rate = { numerator: string; denominator: string };
type Pending = {
  action: Action;
  startedAt: string;
  txHash?: string;
  rate?: Rate;
  epoch?: number;
};
type CycleState = {
  version: 1;
  network: "mainnet";
  phase: Phase;
  depositRate?: Rate;
  depositEpoch?: number;
  pending?: Pending;
};

const quantity = (amount: { unit: string; quantity: string }[], unit: string) =>
  BigInt(amount.find((asset) => asset.unit === unit)?.quantity ?? "0");

const saveState = async (state: CycleState) => {
  await writeFile(`${statePath}.tmp`, JSON.stringify(state, null, 2) + "\n");
  await rename(`${statePath}.tmp`, statePath);
};

const readState = async (): Promise<CycleState | null> => {
  try {
    const state = JSON.parse(await readFile(statePath, "utf8")) as CycleState;
    if (state.version !== 1 || state.network !== "mainnet") {
      throw new Error("Invalid Atrium cycle state file");
    }
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

const fetchEpoch = async (): Promise<number> => {
  const blockfrostId = process.env.BLOCKFROST_ID?.trim();
  const response = await fetch(`${NETWORK_CONFIG.blockfrostBaseUrl}/epochs/latest`, {
    headers: { project_id: blockfrostId ?? "" },
  });
  if (!response.ok) throw new Error(`Failed to fetch epoch: ${response.status}`);
  const epoch = Number((await response.json()).epoch);
  if (!Number.isSafeInteger(epoch)) throw new Error("Invalid Cardano epoch");
  return epoch;
};

const fetchSnapshot = async () => {
  const [gsUtxos, poolUtxos, rewardUtxos, orderUtxos, basket, epoch] = await Promise.all([
    blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr),
    blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr),
    blockchainProvider.fetchAddressUTxOs(RewardsValidatorAddr),
    blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr),
    fetchBasketUtxos(blockchainProvider),
    fetchEpoch(),
  ]);

  if (gsUtxos.length !== 1 || !gsUtxos[0].output.plutusData) {
    throw new Error("Expected one Global Settings UTxO with an inline datum");
  }
  const globalSettings = deserializeDatum<any>(gsUtxos[0].output.plutusData);
  const admin = globalSettings.fields?.[0];
  if (Number(admin?.constructor) !== 2 ||
    admin?.fields?.[0]?.bytes !== AdminControllerHash) {
    throw new Error("Global Settings admin is not the configured controller");
  }

  const pools = poolUtxos.filter((utxo) => {
    if (!utxo.output.plutusData) return false;
    const datum = deserializeDatum<any>(utxo.output.plutusData);
    return datum.fields?.[6]?.bytes === ATRIUM_POOL_STAKE_ASSET_NAME;
  });
  if (pools.length !== 1) throw new Error(`Expected one LADA pool, found ${pools.length}`);

  const pool = pools[0];
  const datum = deserializeDatum<any>(pool.output.plutusData!);
  const openValue = Number(datum.fields?.[7]?.constructor);
  if (openValue !== 0 && openValue !== 1) throw new Error("Invalid pool processing state");

  const pendingOrders = orderUtxos.filter((utxo) => {
    if (!utxo.output.plutusData) return false;
    const order = deserializeDatum<any>(utxo.output.plutusData);
    return order.fields?.[3]?.bytes === ATRIUM_POOL_STAKE_ASSET_NAME;
  }).length;

  return {
    poolOpen: openValue === 1,
    poolUnderlying: quantity(pool.output.amount, "lovelace") - BigInt(MinPoolLovelace),
    diffusion: rewardUtxos.reduce(
      (total, utxo) => total + quantity(utxo.output.amount, BASKET_TOKEN_UNIT),
      0n,
    ),
    rewardAdaUtxos: rewardUtxos.filter(
      (utxo) => utxo.output.amount.length === 1 &&
        quantity(utxo.output.amount, "lovelace") > 0n,
    ).length,
    pendingOrders,
    rate: basket.basketState.datum.exRate,
    basketLocked: basket.basketState.datum.lock.type === "Locked",
    pledgeLocked: basket.basketState.datum.pledgeLock.type === "Locked",
    epoch,
  };
};

const confirmed = async (txHash: string): Promise<boolean> => {
  const response = await fetch(`${NETWORK_CONFIG.blockfrostBaseUrl}/txs/${txHash}`, {
    headers: { project_id: process.env.BLOCKFROST_ID?.trim() ?? "" },
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Failed to check transaction: ${response.status}`);
  return true;
};

const nextPhase = (action: Action): Phase => {
  switch (action) {
    case "batch": return "batch";
    case "close": return "stake";
    case "stake": return "wait_reward";
    case "withdraw": return "withdraw";
    case "return": return "return";
    case "open": return "batch";
  }
};

const scriptFor = (action: Action) => {
  switch (action) {
    case "batch": return "../batching/batching.js";
    case "close":
    case "open": return "../admin_controller/toggle_pool.js";
    case "stake": return "../pool/stake_to_atrium.js";
    case "withdraw": return "../pool/withdraw_from_atrium.js";
    case "return": return "../pool/add_rewards_to_pool.js";
  }
};

const submit = async (state: CycleState, action: Action, rate?: Rate, epoch?: number) => {
  state.pending = { action, startedAt: new Date().toISOString(), rate, epoch };
  await saveState(state);

  const script = fileURLToPath(new URL(scriptFor(action), import.meta.url));
  let stdout: string;
  let stderr: string;
  try {
    ({ stdout, stderr } = await execFileAsync(process.execPath, [script], {
      env: {
        ...process.env,
        POOL_STAKE_ASSET_NAME: "LADA",
        POOL_PROCESSING_STATE: action === "open" ? "open" : "closed",
        EXPECTED_ATRIUM_RATE: rate ? `${rate.numerator}/${rate.denominator}` : "",
      },
      maxBuffer: 1024 * 1024,
      timeout: 5 * 60 * 1000,
    }));
  } catch (error) {
    const childError = error as Error & { stdout?: string; stderr?: string };
    if (childError.stdout) process.stdout.write(childError.stdout);
    if (childError.stderr) process.stderr.write(childError.stderr);
    throw new Error(`${action} failed. Check the chain before retrying: ${childError.message}`);
  }
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  const txHash = stdout.match(/tx hash:\s*([0-9a-f]{64})/i)?.[1];
  if (!txHash) {
    throw new Error("No transaction hash returned. Check the chain before retrying.");
  }
  state.pending.txHash = txHash;
  await saveState(state);
};

const step = async (state: CycleState) => {
  if (state.pending) {
    if (!state.pending.txHash) {
      throw new Error("Previous action has no saved tx hash. Check the chain before retrying.");
    }
    if (!await confirmed(state.pending.txHash)) {
      if (Date.now() - Date.parse(state.pending.startedAt) > 60 * 60 * 1000) {
        throw new Error("Transaction unconfirmed for over an hour. Check it manually.");
      }
      console.log("Waiting for confirmation:", state.pending.txHash);
      return;
    }
    if (state.pending.action === "stake") {
      if (!state.pending.rate || state.pending.epoch === undefined) {
        throw new Error("Missing deposit rate or epoch");
      }
      state.depositRate = state.pending.rate;
      state.depositEpoch = state.pending.epoch;
    }
    state.phase = nextPhase(state.pending.action);
    console.log("Confirmed:", state.pending.txHash);
    delete state.pending;
    await saveState(state);
    return;
  }

  const live = await fetchSnapshot();
  console.log("Phase:", state.phase, "epoch:", live.epoch,
    "pool:", live.poolOpen ? "open" : "closed",
    "orders:", live.pendingOrders,
    "Diffusion:", live.diffusion.toString());

  switch (state.phase) {
    case "batch":
      if (!live.poolOpen) throw new Error("Pool closed while draining orders");
      if (live.pendingOrders > 0) return submit(state, "batch");
      state.phase = "close";
      break;
    case "close":
      if (live.poolUnderlying <= 0n) {
        console.log("No ADA to stake; leaving the pool open");
        return;
      }
      if (live.poolOpen) return submit(state, "close");
      state.phase = "stake";
      break;
    case "stake":
      if (live.poolOpen || live.diffusion > 0n) {
        throw new Error("Unexpected pool or Diffusion state before staking");
      }
      if (live.basketLocked) return console.log("Atrium is locked; waiting");
      return submit(state, "stake", {
        numerator: live.rate.numerator.toString(),
        denominator: live.rate.denominator.toString(),
      }, live.epoch);
    case "wait_reward":
      if (live.poolOpen || live.diffusion <= 0n || !state.depositRate ||
        state.depositEpoch === undefined) {
        throw new Error("Unexpected state while waiting for Atrium rewards");
      }
      if (exRateLessThan(live.rate, {
        numerator: BigInt(state.depositRate.numerator),
        denominator: BigInt(state.depositRate.denominator),
      })) throw new Error("Atrium exchange rate decreased; stopping");
      if (live.epoch <= state.depositEpoch || !exRateLessThan({
        numerator: BigInt(state.depositRate.numerator),
        denominator: BigInt(state.depositRate.denominator),
      }, live.rate)) return console.log("Waiting for a later epoch and higher Atrium rate");
      state.phase = "withdraw";
      break;
    case "withdraw":
      if (live.poolOpen) throw new Error("Pool opened before Atrium withdrawal finished");
      if (live.diffusion > 0n) {
        if (live.basketLocked || live.pledgeLocked) {
          return console.log("Atrium is locked; waiting");
        }
        return submit(state, "withdraw");
      }
      state.phase = "return";
      break;
    case "return":
      if (live.poolOpen || live.diffusion > 0n) {
        throw new Error("Unexpected state while returning ADA to Lava");
      }
      if (live.rewardAdaUtxos > 0) return submit(state, "return");
      state.phase = "open";
      break;
    case "open":
      if (!live.poolOpen) return submit(state, "open");
      state.phase = "batch";
      break;
  }
  await saveState(state);
};

const main = async () => {
  if (LAVA_NETWORK !== "mainnet") {
    throw new Error("Atrium cycle requires LAVA_NETWORK=mainnet");
  }
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--init", "--execute", "--watch"].includes(arg)) ||
    (args.includes("--init") && args.length !== 1) ||
    (args.includes("--watch") && !args.includes("--execute"))) {
    throw new Error("Use --init, --execute, or --execute --watch");
  }

  if (args.length === 0) {
    const state = await readState();
    const live = await fetchSnapshot();
    console.log("Cycle:", state?.phase ?? "not initialized");
    console.log("Pending tx:", state?.pending?.txHash ?? "none");
    console.log("Pool:", live.poolOpen ? "open" : "closed");
    console.log("Pool ADA available:", live.poolUnderlying.toString());
    console.log("Diffusion:", live.diffusion.toString());
    console.log("Pending orders:", live.pendingOrders);
    console.log("Atrium rate:", `${live.rate.numerator}/${live.rate.denominator}`);
    return;
  }

  const lock = await open(lockPath, "wx").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") {
      throw new Error("Another cycle process may be running. Check the lock file before retrying.");
    }
    throw error;
  });
  try {
    await lock.writeFile(String(process.pid));
    let state = await readState();
    if (args.includes("--init")) {
      if (state) throw new Error("Cycle is already initialized");
      const live = await fetchSnapshot();
      if (!live.poolOpen || live.diffusion > 0n || live.rewardAdaUtxos > 0) {
        throw new Error("Initialize only with an open pool and no Atrium funds pending");
      }
      state = { version: 1, network: "mainnet", phase: "batch" };
      await saveState(state);
      console.log("Cycle initialized. No transaction submitted.");
      return;
    }
    if (!state) throw new Error("Run npm run cycle:init first");
    do {
      await step(state);
      if (args.includes("--watch")) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    } while (args.includes("--watch"));
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
