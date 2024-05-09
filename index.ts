import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { cryptoWaitReady } from "@polkadot/util-crypto";

const createKeyPair = async () => {
  await cryptoWaitReady();
  const mnemonic =
    "where home proud steak degree act water couple fine snow safe deal";
  const keyring = new Keyring({ type: "sr25519", ss58Format: 0 });
  const keyPair = keyring.createFromUri(mnemonic, { name: "sr25519" });
  return keyPair;
};

const main = async () => {
  const ws_url = "wss://statemint-rpc-tn.dwellir.com"; // Polkadot Asset Hub
  const provider = new WsProvider(ws_url);
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  const keyPair = await createKeyPair();
  let sendersAddr = keyPair.address;

  try {
    // swapping DED for USDC
    // 500000000000 = 50 DED
    // 311853 = 0.311853 USDC
    // Asset ID to send (23=PINK, 30=DED, 1984=USDT, 1337=USDC) or pay fees with
    const assetId = "30"; // send DED
    const assetAmount = "500000000000"; // Amount to send, 20 DED in this case
    const assetBAmount = "10000"; // Amount to send, 0.311853 USDC in this case
    const feeAssetId = "1337"; // pay fees in DED
    // Conversion of feeAssetId to the Location for the SignedExtension
    const paysWithFeeOrigin = `{"parents":0,"interior":{"X2":[{"palletInstance":50},{"generalIndex":${feeAssetId}}]}}`;
    let feeassetId = JSON.parse(paysWithFeeOrigin);
    // Address to which to send the asset
    // const destAddr = "14okT24c4gotG9RgafLjLCfqHBt81TGWFJHFq2dzPFXi6N7A";
    // const addr =
    //   "0xa85c3ffd2a6ee23ef3262ea491d924404aba5b534c3ab961c76598079222cd67"; // pub key of destAddr
    // let tx = api.tx.assets.transfer(assetId, addr, assetAmount);

    // define first arg for multilocation
    const firstArg = api
      .createType("MultiLocation", {
        parents: 0,
        interior: { x2: [{ palletInstance: 50 }, { generalIndex: assetId }] },
      })
      .toU8a();

    const secondArg = api
      .createType("MultiLocation", {
        parents: 1,
        interior: { here: null },
      })
      .toU8a();

    const thirdArg = api
      .createType("MultiLocation", {
        parents: 0,
        interior: {
          x2: [{ palletInstance: 50 }, { generalIndex: feeAssetId }],
        },
      })
      .toU8a();

    const tx = api.tx.assetConversion.swapExactTokensForTokens(
      [firstArg, secondArg, thirdArg],
      assetAmount,
      assetBAmount,
      keyPair.address,
      false,
    );

    const lastHeader = await api.rpc.chain.getHeader();
    const blockNumber = api.registry.createType(
      "BlockNumber",
      lastHeader.number.toNumber(),
    );
    const era = api.registry.createType("ExtrinsicEra", {
      current: lastHeader.number.toNumber(),
      period: 64,
    });
    const nonce = await api.rpc.system.accountNextIndex(sendersAddr);
    const unsignedPayload = {
      specVersion: api.runtimeVersion.specVersion.toHex(),
      transactionVersion: api.runtimeVersion.transactionVersion.toHex(),
      assetId: feeassetId,
      address: sendersAddr,
      blockHash: lastHeader.hash.toHex(),
      blockNumber: blockNumber.toHex(),
      era: era.toHex(),
      genesisHash: api.genesisHash.toHex(),
      method: tx.method.toHex(),
      nonce: nonce.toHex(),
      signedExtensions: ["ChargeAssetTxPayment"],
      tip: api.registry.createType("Compact<Balance>", 0).toHex(),
      version: tx.version,
    };
    const ext = api.registry.createType("ExtrinsicPayload", unsignedPayload, {
      version: unsignedPayload.version,
    });

    const { signature } = ext.sign(keyPair);

    const extrinsic = api.registry.createType(
      "Extrinsic",
      { method: ext.method },
      { version: 4 },
    );
    extrinsic.addSignature(keyPair.address, signature, ext.toHex());
    const extrinsic0 = api.tx(extrinsic);
    let x = await extrinsic0.send();
    console.log("ExtrinsicHash", x.toHex(), x.toJSON());

    // const lastHeader = await api.rpc.chain.getHeader();
    // const blockNumber = api.registry.createType(
    //   "BlockNumber",
    //   lastHeader.number.toNumber(),
    // );
    // const era = api.registry.createType("ExtrinsicEra", {
    //   current: lastHeader.number.toNumber(),
    //   period: 64,
    // });
    // const nonce = await api.rpc.system.accountNextIndex(sendersAddr);
    // const unsignedPayload = {
    //   specVersion: api.runtimeVersion.specVersion.toHex(),
    //   transactionVersion: api.runtimeVersion.transactionVersion.toHex(),
    //   assetId: feeassetId,
    //   address: sendersAddr,
    //   blockHash: lastHeader.hash.toHex(),
    //   blockNumber: blockNumber.toHex(),
    //   era: era.toHex(),
    //   genesisHash: api.genesisHash.toHex(),
    //   method: tx.method.toHex(),
    //   nonce: nonce.toHex(),
    //   signedExtensions: ["ChargeAssetTxPayment"],
    //   tip: api.registry.createType("Compact<Balance>", 0).toHex(),
    //   version: tx.version,
    // };
    // const ext = api.registry.createType("ExtrinsicPayload", unsignedPayload, {
    //   version: unsignedPayload.version,
    // });
    //
    // const { signature } = ext.sign(keyPair);
    // const extrinsic = api.registry.createType(
    //   "Extrinsic",
    //   { method: ext.method },
    //   { version: 4 },
    // );
    // extrinsic.addSignature(keyPair.address, signature, ext.toHex());
    // const extrinsic0 = api.tx(extrinsic);
    // let x = await extrinsic0.send();
    // console.log("ExtrinsicHash", x.toHex(), x.toJSON());
  } catch (e) {
    console.error(e);
    throw Error(e as string);
  }
};

main()
  .catch((err) => console.error(err))
  .finally(() => process.exit());
