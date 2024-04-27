import { promises as fs } from "fs";

import { AssetTransferApi, constructApiPromise, TxResult } from '@substrate/asset-transfer-api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

const GREEN = '\u001b[32m';
const PURPLE = '\u001b[35m';

// Polkadot Asset Hub
const ws_url = 'wss://statemint-rpc-tn.dwellir.com';
// Polkadot
const ss58Format = 0;
// Asset ID to send (23=PINK, 30=DED, 1984=USDT, 1337=USDC)
const assetId = '30';
// Amount to send
const assetAmount = '29000000000';
// Asset to pay fees with
const feeAssetId = '30';
// Conversion of feeAssetId to the Location for the SignedExtension
const paysWithFeeOrigin =
	`{"parents":0,"interior":{"X2":[{"palletInstance":50},{"generalIndex":${feeAssetId}}]}}`;
// ParaId for where to send the asset
const destId = '1000';
// Address to which to send the asset
const destAddr = '121Rs6fKm8nguHnvPfG1Cq3ctFuNAVZGRmghwkJwHpKxKjbx';

const createKeyPair = async () => {
    await cryptoWaitReady();

    const mnemonic = ""; // 
    const keyring = new Keyring({ type: 'sr25519', ss58Format });
    const keyPair = keyring.createFromUri(mnemonic, { name: 'sr25519' });
	
    return keyPair;
}

const createSubmittable = async (assetApi: AssetTransferApi, sendersAddr: string): Promise<TxResult<'payload'>> => {
	let callInfo: TxResult<'payload'>;
	try {
		callInfo = await assetApi.createTransferTransaction(
			destId, 					// Destination chain ID (0 if you want to send to a relay chain)
			destAddr,  					// Destination Address
			[assetId], 					// Asset to transfer
			[assetAmount], 				// Amount of the asset to transfer
			{
				format: 'payload',		// Format type - payload is necessary for `paysWithFeeOrigin`
				xcmVersion: 3,			// Xcm Version
				paysWithFeeOrigin, 		// Mulitlocation of the asset to pay on chain
				sendersAddr,			// Address of the sender of this tx.
			},
		);

		console.log(`${PURPLE}The following call data that is returned:\n${JSON.stringify(callInfo, null, 4)}`);
	} catch (e) {
		console.error(e);
		throw Error(e as string);
	}

    return callInfo
}

const main = async () => {
	const { api, specName, safeXcmVersion } = await constructApiPromise(ws_url);
	const assetApi = new AssetTransferApi(api, specName, safeXcmVersion);
	const keyPair = await createKeyPair();
	const txInfo = await createSubmittable(assetApi, keyPair.address);
	const { signature } = txInfo.tx.sign(keyPair);
	const extrinsic = assetApi.api.registry.createType(
		'Extrinsic',
		{ method: txInfo.tx.method },
		{ version: 4 }
	);
	
	extrinsic.addSignature(keyPair.address, signature, txInfo.tx.toHex());
	const extrinsic0 = await assetApi.api.tx(extrinsic);

    try {
        let x = await extrinsic0.send();
	console.log(extrinsic0, x.toHex(), x.toJSON());
    } catch (error) {
        console.error('Error submitting extrinsic:', error);
    }
};

main()
	.catch((err) => console.error(err))
	.finally(() => process.exit());
