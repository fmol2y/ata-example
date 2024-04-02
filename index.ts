import { promises as fs } from "fs";
import { config } from 'dotenv';

import { AssetTransferApi, constructApiPromise, TxResult } from '@substrate/asset-transfer-api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

// Init Dotenv
config();

const GREEN = '\u001b[32m';
const PURPLE = '\u001b[35m';

// Default values are set for Kusama
const ws_url = process.env.WS_URL || 'wss://statemine-rpc.dwellir.com';
const ss58Format = process.env.SS58 && parseInt(process.env.SS58) || 2;

const createKeyPair = async () => {
    await cryptoWaitReady();

    const keyPhrase = await fs.readFile('keyphrase.txt', 'utf-8')
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
    // Kusama ss58 format is 2
    const keyring = new Keyring({ type: 'sr25519', ss58Format });
	const keyPair = keyring.addFromUri(keyPhrase, { name: 'keyPair' });
    
    return keyPair;
}

const createSubmittable = async (assetApi: AssetTransferApi): Promise<TxResult<'payload'>> => {
	let callInfo: TxResult<'payload'>;
	try {
		callInfo = await assetApi.createTransferTransaction(
			'2007',
			'aSCLonoQ8zS3Ys59HwfDxbaN4xXhGMJwrnbhVUiByGZxUo9',
			['1984'],
			['50000'],
			{
				format: 'payload',
				isLimited: true,
				xcmVersion: 3,
				paysWithFeeOrigin: '{"parents":0,"interior":{"X2":[{"palletInstance":50},{"generalIndex":1984}]}}',
				sendersAddr: 'HLEr3s7jYkuqwrAaBLRrdbi8T95rMjE1rDdHu93LQDPJfJM',
			},
		);

		console.log(`${PURPLE}The following call data that is returned:\n${GREEN}${JSON.stringify(callInfo, null, 4)}`);
	} catch (e) {
		console.error(e);
		throw Error(e as string);
	}

    return callInfo
}

const main = async () => {
	const { api, specName, safeXcmVersion } = await constructApiPromise(ws_url);
	const assetApi = new AssetTransferApi(api, specName, safeXcmVersion);
	const txInfo = await createSubmittable(assetApi);
	const keyPair = await createKeyPair();
	const { signature } = txInfo.tx.sign(keyPair);
	const extrinsic = assetApi.api.registry.createType(
		'Extrinsic',
		{ method: txInfo.tx.method },
		{ version: 4 }
	);
	
	extrinsic.addSignature(keyPair.address, signature, txInfo.tx.toHex()); 
	const res = await assetApi.api.tx(extrinsic).send();
	console.log(res.toHex());
};

main()
	.catch((err) => console.error(err))
	.finally(() => process.exit());
