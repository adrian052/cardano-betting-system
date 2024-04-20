import { lucid } from "../instance-lucid.ts";
import { Constr, Data, MintingPolicy, applyParamsToScript, fromText, networkToId } from "../lucid/mod.ts";
import { SpendingValidator } from "../lucid/mod.ts";
import { PrivateKey } from "../lucid/src/core/libs/cardano_multiplatform_lib/cardano_multiplatform_lib.generated.js";

///Get the user address
const gamblerPK = await Deno.readTextFile("./assets/bob-pk");
lucid.selectWalletFromPrivateKey(gamblerPK);
const gambler_address = await lucid.wallet.address();
const priv = PrivateKey.from_bech32(gamblerPK);
const gambler_pkh = priv.to_public().hash().to_hex();

console.log("Gambler address: "+gambler_address);
const now = Date.now()
//Getting the utxo to create the nft
const utxos = await lucid.utxosAt(gambler_address);
const utxo = utxos[0];
console.log("UTXO: ",utxo);

//geting outRef from UTxO
const outRef = new Constr(0, [
    new Constr(0, [utxo.txHash]),
    BigInt(utxo.outputIndex)
]);


//Asset name 
const assetName = "Token1"

//Get the betting validator address
const matchParams = 
  new Constr(0, [fromText("Canelo"),fromText("GGG"), BigInt(9999999999999)]);   

const plutusJSON = JSON.parse(await Deno.readTextFile("plutus.json"));
const policy: SpendingValidator = {
  type: "PlutusV2",
  script:applyParamsToScript(
    plutusJSON.validators.filter((val: any) => val.title == "betting.betting")[0].compiledCode,[matchParams]
  ) 
}

const validator_address = lucid.utils.validatorToAddress(policy);
const pkh = lucid.utils.validatorToScriptHash(policy)
console.log("Validator address: ", validator_address);

///Getting minting policy
const minting_policy: SpendingValidator = {
    type: "PlutusV2",
    script:applyParamsToScript(
      plutusJSON.validators.filter((val: any) => val.title == "mint_bet.mint_bet")[0].compiledCode,[outRef,fromText(assetName),pkh, BigInt(now+100001)]
    ) 
  }

const minting_address = lucid.utils.validatorToAddress(minting_policy);
console.log("Minting address: ", minting_address);

//Datum:
const fighter1 = new Constr(0,[]);

const datum = new Constr(0,[fighter1,BigInt(1500000),gambler_pkh,BigInt(now)])

//Token
const minting_policy_id = lucid.utils.mintingPolicyToId(minting_policy);
const nft_name = fromText(assetName)
const token = minting_policy_id + nft_name


const tx = await lucid
    .newTx()
    .mintAssets({[token]:1n},Data.void())
    .collectFrom([utxo])
    .attachMintingPolicy(minting_policy)
    .payToContract(validator_address, {inline: Data.to(datum)}, {[token]:1n,lovelace:1500000n})
    .validTo(now+100000)
    .complete();
    
const signedTx = await tx.sign().complete();

const txId = await signedTx.submit();

console.log("Transactions submited with id: ", txId);
