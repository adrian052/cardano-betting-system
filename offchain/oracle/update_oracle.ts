import { lucid } from "../instance-lucid.ts";
import { Constr, Data, applyParamsToScript, fromText } from "../lucid/mod.ts";
import { SpendingValidator } from "../lucid/mod.ts";
import { PrivateKey } from "../lucid/src/core/libs/cardano_multiplatform_lib/cardano_multiplatform_lib.generated.js";
import { Waiting, Fighter1, Fighter2 } from '../MatchStatus.ts';


//Get the argument from args
if (Deno.args.length != 1) {
    console.log("I need the new rate as argument");
    Deno.exit();
}

const winner = Deno.args[0];
var match_status;
if (winner == "1") {
    match_status = Fighter1;
} else if (winner == "2") {
    match_status = Fighter2
} else if (winner == "0") {
    match_status = Waiting;
} else {
    console.log("Please insert a number between 0 and 2.");
    Deno.exit()
}

//Prepare params
import file from "../../data/match_params.json" with { type: "json" };

const owner = file.Owner;
const posixtime = file.PosixTime;
const fighter1 = file.Figther1;
const fighter2 = file.Figther2;
const asset_name = fighter1 + "-" + fighter2 + "-" + posixtime

lucid.selectWalletFromPrivateKey(owner);
const owner_address = await lucid.wallet.address()


//Getting credentials
const parameters_json = JSON.parse(await Deno.readTextFile("data/oracle_params.json"))
const nft_policy = parameters_json.policy;
const nft_name = parameters_json.asset_name;
const pkh = parameters_json.public_key_hash;
const token = nft_policy + nft_name;

//More parameters
const o_nft = new Constr(0, [nft_policy, nft_name]);
const parameter = new Constr(0, [o_nft, pkh]);

console.log("Policy: " + nft_policy);
console.log("Name: " + nft_name);
console.log("Public key hash: " + pkh);




//Get validator address
const plutusJSON = JSON.parse(await Deno.readTextFile("plutus.json"))
const validator: SpendingValidator = {
    type: "PlutusV2",
    script: applyParamsToScript(
        plutusJSON.validators.filter((val: any) => val.title == "oracle.oracle")[0].compiledCode, [parameter]
    )
};

const oracle_addr = lucid.utils.validatorToAddress(validator);
console.log("Oracle address: ", oracle_addr);

//Query utxos
console.log("UTxOs at:", oracle_addr);
const utxos = await lucid.utxosAt(oracle_addr);
console.log(utxos)
const oracleUTxO = utxos.find((utxo) => utxo.assets[token] == 1n);
if (oracleUTxO === undefined) {
    console.log("UTxO not found at validator");
    Deno.exit();
}


const updateRedemer = new Constr(0, [])

const tx = await lucid
    .newTx()
    .collectFrom([oracleUTxO], Data.to(updateRedemer))
    .attachSpendingValidator(validator)
    .payToContract(oracle_addr, { inline: Data.to(match_status) }, { [token]: 1n })
    .addSigner(owner_address)
    .complete()

const signedTx = await tx.sign().complete();

const txId = await signedTx.submit();

console.log("Transaction submited with id: " + txId)



