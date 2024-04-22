import { lucid } from "../instance-lucid.ts";
import { Constr, Data, UTxO, applyParamsToScript, fromText } from "../lucid/mod.ts";
import { SpendingValidator } from "../lucid/mod.ts";




async function getUserAddress(filepath:string) {
    const gamblerPK = await Deno.readTextFile(filepath);
    lucid.selectWalletFromPrivateKey(gamblerPK);
    const gamblerAddress = await lucid.wallet.address();
    return { privateKey: gamblerPK, gambler_address: gamblerAddress };
}

async function getUTXO(address:string) {
    const utxos = await lucid.utxosAt(address);
    return utxos[0];
}

function getOutRef(utxo: UTxO) {
    return new Constr(0, [new Constr(0, [utxo.txHash]), BigInt(utxo.outputIndex)]);
}

function getPolicyParams( fighter1: string, fighter2:string,deadline:number, assetName: string){
    return [new Constr(0, [fromText(fighter1),fromText(fighter2),BigInt(deadline)]),fromText(assetName)]
}

function getPolicy(plutusJSON : any, params : any, title: string) {
    const policy: SpendingValidator = {
        type: "PlutusV2",
        script: applyParamsToScript(plutusJSON.validators.find((val:any) => val.title == title).compiledCode, params)
    };
    return policy;
}

function getDatum(fighter:Constr<any>,bet:number ,gambler_pkh:string, validity:number) {
    return new Constr(0, [fighter, BigInt(bet), gambler_pkh, BigInt(validity)]);
}

async function mintNFTAndPay(utxos:UTxO[], minting_policy:any, token:string, datum:Constr<any>, minting_address:string, validTo:number, bet:number) {
    const tx = await lucid
        .newTx()
        .mintAssets({ [token]: 1n }, Data.void())
        .collectFrom(utxos)
        .attachMintingPolicy(minting_policy)
        .payToContract(minting_address, { inline: Data.to(datum) }, { [token]: 1n, lovelace: BigInt(bet)})
        .validTo(validTo)
        .complete();

    const signedTx = await tx.sign().complete();
    return await signedTx.submit();
}

export { getUserAddress, getUTXO, getOutRef, getPolicy, getDatum, mintNFTAndPay,getPolicyParams};