import { lucid } from "../instance-lucid.ts";
import { getPolicyParams, getPolicyParams2 } from "../utils.ts";
import {getUserAddress,getPolicy } from "../utils.ts";
import { Constr, Data, fromText } from "../lucid/mod.ts";
import {query_oracle} from "../oracle/query_oracle.ts"

async function main() {    
    const match_path = Deno.args[0];
    const oracle_params = Deno.args[1]
    const user_path = Deno.args[2]

    //Getting user information
    const { gambler_address } = await getUserAddress(user_path);
    
    //Set some params
    const now = Date.now();
    const assetName = "Token1";
    const plutusJSON = JSON.parse(await Deno.readTextFile("plutus.json"));
    //Getting oracle information
    const oracle_json = await JSON.parse(await Deno.readTextFile(oracle_params));
    const oracle_script_hash = oracle_json.script_hash

    //Get mint variables
    const match_json = JSON.parse(await Deno.readTextFile(match_path));
    const mint_params = getPolicyParams2(match_json.Figther1,match_json.Fighter2,match_json.PosixTime,assetName,oracle_script_hash);
    const minting_policy = getPolicy(plutusJSON, mint_params, "mint_bet.mint_bet");
    const y = lucid.utils.validatorToScriptHash(minting_policy)
    const minting_address = lucid.utils.validatorToAddress(minting_policy);

    const mint_params2 = getPolicyParams(match_json.Figther1,match_json.Fighter2,match_json.PosixTime,assetName,oracle_script_hash);
    const minting_policy2 = getPolicy(plutusJSON, mint_params2, "mint_bet.mint_bet");
    const minting_script_hash = lucid.utils.validatorToScriptHash(minting_policy2)
    const minting_policyid2 = lucid.utils.mintingPolicyToId(minting_policy2)
    const minting_address2 = lucid.utils.validatorToAddress(minting_policy2);

    //Getting utxo information
    const utxos = await lucid.utxosAt(minting_address2);
    const {oracle_winner, oracleUTxO} = await query_oracle(oracle_params);

    var total_bet = 0n;
    var winners_total_bet = 0n;
    var winners_bet = new Map<string,bigint>();
    for(let i = 0;i<utxos.length;i++){
        const utxo = utxos[i];
        const datum: Constr<any> = await lucid.datumOf(utxo) as Constr<any>;
        const pkh = datum.fields[2];
        const winner = datum.fields[0]
        const credential = lucid.utils.keyHashToCredential(pkh);
        const address = lucid.utils.credentialToAddress(credential)        
        total_bet+=datum.fields[1];
        if (winner.index===oracle_winner.index) {
            winners_total_bet+=datum.fields[1]
            var bet;
            if(winners_bet.get(address)==undefined){
                bet = 0n;
            }else{
                bet = winners_bet.get(address);
            }

            winners_bet.set(address,bet+datum.fields[1]);
        }
        
    }
    var winners_rewards = new Map<string,bigint>();
    for (let entry of winners_bet.entries()) {
        winners_rewards.set(entry[0], (total_bet*(entry[1])*9n)/winners_total_bet*10n)
    }

    console.log("Match posixtime:",match_json.PosixTime);
    console.log("Transaction from:",now-30000)
    console.log("Transaction made by: " + gambler_address);
    console.log("Minting address:", minting_address);
    console.log("Total bet:", total_bet);
    console.log(oracleUTxO)
    var tx = lucid.newTx();
    for (let entry of winners_rewards.entries()) {
        tx = tx.payToAddress(entry[0],{lovelace: entry[1]})
    }

    tx = tx.collectFrom(utxos,Data.to(fromText(y)))
            .validFrom(now-30000)
            .attachSpendingValidator(minting_policy2)
            .readFrom([oracleUTxO]);
    const completed_tx = await tx.complete()
    

    const signedTx = await completed_tx.sign().complete();
    const output = await signedTx.submit();


    console.log("Winners total_bet:",winners_total_bet);
    console.log("Winners rewards:")
    console.log(winners_rewards);
    console.log("Transactions submitted with id: ",output);
    console.log("Betting spread done successfully. \u2705")
}

main();