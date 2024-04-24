import { lucid } from "../instance-lucid.ts";
import { getPolicyParams } from "../lib/utils.ts";
import {getUserAddress,getPolicy, getDatum, mintNFTAndPay } from "../lib/utils.ts";
import { Constr, Data, datumJsonToCbor, fromText } from "../lucid/mod.ts";
import { PrivateKey } from "../lucid/src/core/libs/cardano_multiplatform_lib/cardano_multiplatform_lib.generated.js";
import {query_oracle} from "../oracle/query_oracle.ts"

async function main() {
    
    //Getting gambler information
    const { privateKey, gambler_address } = await getUserAddress("./assets/bob-pk");
    const gambler_priv = PrivateKey.from_bech32(privateKey);
    const gambler_pkh = gambler_priv.to_public().hash().to_hex();
    console.log("Gambler address: " + gambler_address);


    //Set some params
    const now = Date.now();
    const assetName = "Token1";
    const plutusJSON = JSON.parse(await Deno.readTextFile("plutus.json"));
    //Getting oracle information
    const oracle_json = await JSON.parse(await Deno.readTextFile("./data/oracle_params.json"));
    const oracle_pkh = oracle_json.public_key_hash

    //Get mint variables
    const match_json = JSON.parse(await Deno.readTextFile("./data/match_params.json"));
    const mint_params = getPolicyParams(match_json.Figther1,match_json.Fighter2,match_json.PosixTime,assetName,oracle_pkh);
    const minting_policy = getPolicy(plutusJSON, mint_params, "mint_bet.mint_bet");
    const minting_address = lucid.utils.validatorToAddress(minting_policy);
    //const minting_policy_id = lucid.utils.mintingPolicyToId(minting_policy);
    console.log("Minting address: ", minting_address);

    //Getting utxo information
    const utxos = await lucid.utxosAt(minting_address);
    console.log(utxos)

    console.log(match_json.PosixTime);
    console.log(now-30000)
    const oracle_winner = await query_oracle();


    var total_bet = 0n;
    var winners_total_bet = 0n;
    var winners_bet = new Map<string,bigint>();
    for(let i = 0;i<utxos.length;i++){
        const utxo = utxos[i];
        const datum: Constr<any> = await lucid.datumOf(utxo) as Constr<any>;
        const pkh = datum.fields[2];
        const winner = datum.fields[0]
        const credential = lucid.utils.keyHashToCredential(pkh);
        const address = lucid.utils.credentialToAddress(credential);
        console.log(address);
        console.log("Winner: " , winner.index===oracle_winner.index)
        total_bet+=datum.fields[1];
        if (winner.index===oracle_winner.index) {
            winners_total_bet+=datum.fields[1]
            winners_bet.set(address,datum.fields[1]);
        }
        
    }

    console.log("Total bet", total_bet);
    console.log("Winners total_bet",winners_total_bet);


    var winners_rewards = new Map<string,bigint>();
    for (let entry of winners_bet.entries()) {
        winners_rewards.set(entry[0], total_bet*(entry[1]/winners_total_bet))
    }
    
    console.log("Winners rewards")
    console.log(winners_rewards);

    
    var tx = lucid.newTx();
    for (let entry of winners_rewards.entries()) {
        tx = tx.payToAddress(entry[0],{lovelace: entry[1]})
    }
    tx = tx.collectFrom(utxos,Data.void())
            .attachSpendingValidator(minting_policy)
            .validFrom(now-30000);
    const completed_tx = await tx.complete()
    

    const signedTx = await completed_tx.sign().complete();
    const output = await signedTx.submit();
    console.log(output);


}

main();


