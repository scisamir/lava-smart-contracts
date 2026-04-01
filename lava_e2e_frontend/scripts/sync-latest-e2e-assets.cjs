const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const {
  applyParamsToScript,
  builtinByteString,
  deserializeDatum,
  outputReference,
  resolveScriptHash,
  scriptAddress,
  serializePlutusScript,
  serializeRewardAddress,
  stringToHex,
} = require("@meshsdk/core");

const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");
const generatedRoot = path.join(appRoot, "src", "generated");
const derivedArtifactsPath = path.join(generatedRoot, "latest-e2e-derived.json");

dotenv.config({ path: path.join(appRoot, ".env") });

const copies = [
  {
    from: path.join(repoRoot, "smart_contract", "plutus.json"),
    to: path.join(generatedRoot, "plutus.json"),
    type: "file",
  },
  {
    from: path.join(repoRoot, "e2e", "atrium_mainnet", "src"),
    to: path.join(generatedRoot, "atrium_mainnet"),
    type: "directory",
  },
];

const readText = (filePath) => fs.readFileSync(filePath, "utf8");

const copyAssets = () => {
  for (const copy of copies) {
    if (!fs.existsSync(copy.from)) {
      throw new Error(`Missing sync source: ${copy.from}`);
    }

    fs.mkdirSync(path.dirname(copy.to), { recursive: true });
    fs.rmSync(copy.to, { recursive: true, force: true });

    if (copy.type === "file") {
      fs.copyFileSync(copy.from, copy.to);
    } else {
      fs.cpSync(copy.from, copy.to, { recursive: true });
    }
  }
};

const extractConfigValue = (configSource, key) => {
  const match = configSource.match(
    new RegExp(`${key}:\\s*"([^"]+)"`, "m"),
  );

  if (!match) {
    throw new Error(`Unable to read ${key} from Atrium config`);
  }

  return match[1];
};

const requireValidatorCode = (blueprint, title) => {
  const validator = blueprint.validators.find((item) => item.title === title);

  if (!validator) {
    throw new Error(`Validator not found in blueprint: ${title}`);
  }

  return validator.compiledCode;
};

const serializeSelfStakedValidatorAddress = (
  script,
  scriptHash,
  networkId,
) =>
  serializePlutusScript(
    { code: script, version: "V3" },
    scriptHash,
    networkId,
    true,
  ).address;

const fetchJson = async (url, projectId) => {
  const response = await fetch(url, {
    headers: { project_id: projectId },
  });

  if (!response.ok) {
    throw new Error(`Blockfrost ${response.status} for ${url}`);
  }

  return response.json();
};

const deriveArtifacts = async () => {
  const blueprint = JSON.parse(readText(path.join(generatedRoot, "plutus.json")));
  const atriumConfigSource = readText(
    path.join(generatedRoot, "atrium_mainnet", "config.ts"),
  );
  const blockfrostId =
    process.env.NEXT_PUBLIC_BLOCKFROST_ID ??
    process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY ??
    extractConfigValue(atriumConfigSource, "blockfrostApiKey");
  const basketTokenCS = extractConfigValue(atriumConfigSource, "basketTokenCS");
  const networkId = 1;
  const atriumPoolStakeAssetName = stringToHex("LADA");

  const globalSettingsScript = applyParamsToScript(
    requireValidatorCode(blueprint, "global_settings.global_settings.spend"),
    [outputReference("9d225cd31ee8b47b9782a2b1a9308a02d129f919e562dd492d4accb5b25311ab", 4)],
    "JSON",
  );
  const globalSettingsHash = resolveScriptHash(globalSettingsScript, "V3");
  const globalSettingsAddr = serializePlutusScript(
    { code: globalSettingsScript, version: "V3" },
    undefined,
    networkId,
    undefined,
  ).address;

  const poolValidatorScript = applyParamsToScript(
    requireValidatorCode(blueprint, "pool.pool_validator.mint"),
    [builtinByteString(globalSettingsHash)],
    "JSON",
  );
  const poolValidatorHash = resolveScriptHash(poolValidatorScript, "V3");
  const poolValidatorAddr = serializeSelfStakedValidatorAddress(
    poolValidatorScript,
    poolValidatorHash,
    networkId,
  );

  const poolUtxos = await fetchJson(
    `https://cardano-mainnet.blockfrost.io/api/v0/addresses/${poolValidatorAddr}/utxos`,
    blockfrostId,
  );

  const matchingPools = poolUtxos.flatMap((utxo) => {
    if (typeof utxo.inline_datum !== "string") {
      return [];
    }

    const datum = deserializeDatum(utxo.inline_datum);
    const poolStakeAsset = datum?.fields?.[6]?.bytes;
    if (poolStakeAsset !== atriumPoolStakeAssetName) {
      return [];
    }

    const poolNft = (utxo.amount ?? []).find(
      (asset) =>
        typeof asset.unit === "string" &&
        asset.unit.startsWith(poolValidatorHash) &&
        asset.unit !== "lovelace",
    );

    if (!poolNft) {
      throw new Error("Atrium pool NFT not found on the live pool UTxO.");
    }

    return [{ poolNftName: poolNft.unit.slice(poolValidatorHash.length) }];
  });

  if (matchingPools.length === 0) {
    throw new Error("No live Atrium pool UTxO found for derived frontend artifacts.");
  }

  if (matchingPools.length > 1) {
    throw new Error("Multiple live Atrium pools found; cannot derive a single frontend artifact set.");
  }

  const [{ poolNftName }] = matchingPools;

  const rewardsValidatorScript = applyParamsToScript(
    requireValidatorCode(blueprint, "rewards.rewards_validator.spend"),
    [
      builtinByteString(globalSettingsHash),
      builtinByteString(poolValidatorHash),
      builtinByteString(poolNftName),
    ],
    "JSON",
  );
  const rewardsValidatorHash = resolveScriptHash(rewardsValidatorScript, "V3");
  const rewardsValidatorAddr = serializePlutusScript(
    { code: rewardsValidatorScript, version: "V3" },
    undefined,
    networkId,
    undefined,
  ).address;

  const atriumStakeValidatorScript = applyParamsToScript(
    requireValidatorCode(blueprint, "stake_datums/atrium.atrium.withdraw"),
    [
      builtinByteString(globalSettingsHash),
      builtinByteString(basketTokenCS),
      scriptAddress(rewardsValidatorHash),
    ],
    "JSON",
  );
  const atriumStakeValidatorHash = resolveScriptHash(
    atriumStakeValidatorScript,
    "V3",
  );
  const atriumStakeRewardAddress = serializeRewardAddress(
    atriumStakeValidatorHash,
    true,
    networkId,
  );

  const atriumSwapValidatorScript = applyParamsToScript(
    requireValidatorCode(blueprint, "swap_validators/atrium_swap.atrium_swap.withdraw"),
    [builtinByteString(basketTokenCS), scriptAddress(rewardsValidatorHash)],
    "JSON",
  );
  const atriumSwapValidatorHash = resolveScriptHash(
    atriumSwapValidatorScript,
    "V3",
  );
  const atriumSwapRewardAddress = serializeRewardAddress(
    atriumSwapValidatorHash,
    true,
    networkId,
  );

  return {
    atriumPoolNftName: poolNftName,
    globalSettingsHash,
    globalSettingsAddr,
    poolValidatorHash,
    poolValidatorAddr,
    rewardsValidatorScript,
    rewardsValidatorHash,
    rewardsValidatorAddr,
    atriumStakeValidatorScript,
    atriumStakeValidatorHash,
    atriumStakeRewardAddress,
    atriumSwapValidatorScript,
    atriumSwapValidatorHash,
    atriumSwapRewardAddress,
  };
};

const ensureDerivedArtifacts = async () => {
  try {
    const derivedArtifacts = await deriveArtifacts();
    fs.writeFileSync(
      derivedArtifactsPath,
      `${JSON.stringify(derivedArtifacts, null, 2)}\n`,
    );
  } catch (error) {
    if (fs.existsSync(derivedArtifactsPath)) {
      console.warn(
        `[sync-latest-e2e-assets] Keeping existing derived artifacts because refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    throw error;
  }
};

const main = async () => {
  copyAssets();
  await ensureDerivedArtifacts();
};

main().catch((error) => {
  console.error(
    `[sync-latest-e2e-assets] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
