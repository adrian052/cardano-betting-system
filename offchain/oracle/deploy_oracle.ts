import { lucid } from "../instance-lucid.ts";
import { Constr, Data, applyParamsToScript, fromText } from "../lucid/mod.ts";
import { SpendingValidator } from "../lucid/mod.ts";
import { PrivateKey } from "../lucid/src/core/libs/cardano_multiplatform_lib/cardano_multiplatform_lib.generated.js";
import { Waiting} from '../MatchStatus.ts';



//Getting parameters from match params
import file from "../../data/match_params.json" with { type: "json" };

const owner = file.Owner;
const posixtime = file.PosixTime;
const fighter1 = file.Figther1; 
const fighter2 = file.Figther2;
const asset_name = fighter1+"-"+fighter2+"-"+posixtime 
console.log(asset_name)
//Getting credentials
const priv = PrivateKey.from_bech32(owner);
const pkh = priv.to_public().hash().to_hex();
lucid.selectWalletFromPrivateKey(owner);
const owner_address = await lucid.wallet.address();

// Query Utxos
const utxos = await lucid.utxosAt(owner_address);
if (utxos.length<1) {
    console.log("UTxO not found at validator");
    Deno.exit();
}

const utxo = utxos[0];

//Minting policy parameters
const outRef = new Constr(0, [
    new Constr(0, [utxo.txHash]),
    BigInt(utxo.outputIndex),
]
)

const plutusJSON = JSON.parse(await Deno.readTextFile("plutus.json"));
const policy: SpendingValidator = {
  type: "PlutusV2",
  script:applyParamsToScript(
    plutusJSON.validators.filter((val: any) => val.title == "nft.nft_policy")[0].compiledCode,[outRef,fromText(asset_name)]
  ) 
  
}

const nft_policy = lucid.utils.mintingPolicyToId(policy);
const nft_name = fromText(asset_name)
const token = nft_policy + nft_name

const parameters_json = {
    policy: nft_policy,
    asset_name: nft_name,
    public_key_hash: pkh
}

await Deno.writeTextFile("data/"+asset_name+".json", JSON.stringify(parameters_json))

console.log("Policy: "+ nft_policy)
console.log("Name: "+ nft_name)
console.log("Public key hash: "+ pkh)

const o_nft = new Constr (0,[nft_policy,nft_name])
const parameter =
new Constr (0, [o_nft,pkh])

//Get validator address
const validator: SpendingValidator = {
  type: "PlutusV2",
  script:applyParamsToScript(
    plutusJSON.validators.filter((val: any) => val.title == "oracle.oracle")[0].compiledCode,[parameter]
  )
};

const oracle_addr = lucid.utils.validatorToAddress(validator);
console.log("Oracle address: ",oracle_addr);


const match_status = Waiting

const tx = await lucid
    .newTx()
    .mintAssets({[token]:1n},Data.void())
    .collectFrom([utxo])
    .attachMintingPolicy(policy)
    .payToContract(oracle_addr, {inline: Data.to(match_status)}, {[token]:1n})
    .complete();
const signedTx = await tx.sign().complete();

const txId = await signedTx.submit();
console.log("Transactions submited with id: ", txId);


