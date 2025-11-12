import { GlobalSettingsAddr } from "../global_settings.ts/validator.js";
import { OrderValidatorAddr } from "../order/validator.js";
import { PoolValidatorAddr } from "../pool/validator.js";
import { blockchainProvider } from "../setup.js";

const globalSettingsUtxos = await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr);
const poolUtxos = await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr);
const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);

console.log("globalSettingsUtxos:", globalSettingsUtxos);
console.log("poolUtxos:", poolUtxos);
console.log("orderUtxos:", orderUtxos);
