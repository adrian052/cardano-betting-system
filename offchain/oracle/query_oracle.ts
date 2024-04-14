import { lucid } from "../instance-lucid.ts";
import { Constr, Data, applyParamsToScript, fromText } from "../lucid/mod.ts";
import { SpendingValidator } from "../lucid/mod.ts";



import file from "../../data/match_params.json" with { type: "json" };

const posixtime = file.PosixTime;
const fighter1 = file.Figther1; 
const fighter2 = file.Figther2;
const asset_name = fighter1+"-"+fighter2+"-"+posixtime 

const parameters_json = JSON.parse(await Deno.readTextFile("data/"+asset_name+".json"))
const nft_policy = parameters_json.policy;
const nft_name = parameters_json.asset_name;
const pkh = parameters_json.public_key_hash;
const token = nft_policy + nft_name;
const o_nft = new Constr(0, [nft_policy, nft_name])
const parameter = new Constr(0, [o_nft, pkh])


//Get oracle validator address
const plutusJSON = JSON.parse(await Deno.readTextFile("plutus.json"));
const validator: SpendingValidator = {
    type: "PlutusV2",
    script:applyParamsToScript(
      plutusJSON.validators.filter((val: any) => val.title == "oracle.oracle")[0].compiledCode,[parameter]
    )
  };
  
const oracle_addr = lucid.utils.validatorToAddress(validator);
console.log("Oracle address: ",oracle_addr);

const utxos = await lucid.utxosAt(oracle_addr);
const oracleUTxO = utxos.find((utxo) => utxo.assets[token] == 1n);
if (oracleUTxO == undefined ){
    console.log("UTxO not found at validator");
    Deno.exit();
}

const datum: Constr<Constr<unknown>> = await lucid.datumOf(oracleUTxO) as Constr<Constr<unknown>>;
if(datum.index == 0){
  console.log("Datum: ");
  if(datum.fields[0].index == 0){
    console.log("Fighter1");
  }else{
    console.log("Fighter2");
  }
}else{
  console.log("Datum: Waiting")
}
