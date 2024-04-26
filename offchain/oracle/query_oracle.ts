import { lucid } from "../instance-lucid.ts";
import { Constr, applyParamsToScript } from "../lucid/mod.ts";
import { SpendingValidator } from "../lucid/mod.ts";

export async function query_oracle(oracle_path:string){
  const parameters_json = JSON.parse(await Deno.readTextFile(oracle_path))
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
  var value; 
  if(datum.index == 0){
    if(datum.fields[0].index == 0){
      console.log("Winner: Fighter1");
      value =  new Constr (0,[])
    }else{
      console.log("Winner: Fighter2");
      value = new Constr (1,[])
    }
  }else{
    console.log("Datum: Waiting")
    value = new Constr (2,[])
  }

  return {oracle_winner: value, oracleUTxO:oracleUTxO}
}