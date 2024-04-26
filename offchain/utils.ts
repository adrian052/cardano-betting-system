import { lucid } from "./instance-lucid.ts";
import { Constr, Data, UTxO, applyParamsToScript, fromText } from "./lucid/mod.ts";
import { SpendingValidator } from "./lucid/mod.ts";

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

function getPolicyParams( fighter1: string, fighter2:string,deadline:number, assetName: string,oracle_script_hash:string){
    return [new Constr(0, [fromText(fighter1),fromText(fighter2),BigInt(deadline)]),fromText(assetName),oracle_script_hash]
}

function getPolicyParams2( fighter1: string, fighter2:string,deadline:number, assetName: string,oracle_script_hash:string){
    return [new Constr(0, [fromText(fighter1),fromText(fighter2),BigInt(deadline)]),fromText(assetName),oracle_script_hash,Data.void()]
}

function getPolicy(plutusJSON : any, params : any, title: string) {
    const policy: SpendingValidator = {
        type: "PlutusV2",
        script: applyParamsToScript(plutusJSON.validators.find((val:any) => val.title == title).compiledCode, params)
    };
    return policy;
}

function getDatum(fighter:Constr<any>,bet:number ,gambler_pkh:string) {
    return new Constr(0, [fighter, BigInt(bet), gambler_pkh]);
}

async function mintNFTAndPay(utxos:UTxO[], minting_policy:any, token:string, datum:Constr<any>, minting_address:string, validTo:number, bet:number,minting_policy_id:any) {
    const tx = await lucid
        .newTx()
        .mintAssets({ [token]: 1n },Data.to(minting_policy_id))
        .collectFrom(utxos)
        .attachMintingPolicy(minting_policy)
        .payToContract(minting_address, { inline: Data.to(datum) }, { [token]: 1n, lovelace: BigInt(bet)})
        .validTo(validTo)
        .complete();

    const signedTx = await tx.sign().complete();
    return await signedTx.submit();
}

export { getUserAddress, getUTXO, getOutRef, getPolicy, getDatum, mintNFTAndPay,getPolicyParams,getPolicyParams2};