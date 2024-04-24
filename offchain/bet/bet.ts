import { lucid } from "../instance-lucid.ts";
import { getPolicyParams } from "../lib/utils.ts";
import {getUserAddress,getPolicy, getDatum, mintNFTAndPay } from "../lib/utils.ts";
import { Constr, fromText } from "../lucid/mod.ts";
import { PrivateKey } from "../lucid/src/core/libs/cardano_multiplatform_lib/cardano_multiplatform_lib.generated.js";

async function main() {
    const minting_json = Deno.args[0];
    const user_path = Deno.args[1]
    const oracle_params = Deno.args[2]
    const bet = Number(Deno.args[3])
    const winner = Deno.args[4];
    
    var winner_datum;
    if (winner == "1") {
        winner_datum = new Constr(0, []);
    } else if (winner == "2") {
        winner_datum = new Constr(1, []);
    } else {
        console.log("Please insert 1 or 2 for the fighter");
        Deno.exit()
    }

    //Getting gambler information
    const { privateKey, gambler_address } = await getUserAddress(user_path);
    const gambler_priv = PrivateKey.from_bech32(privateKey);
    const gambler_pkh = gambler_priv.to_public().hash().to_hex();
    console.log("PKH:", gambler_pkh)
    console.log("Gambler address: " + gambler_address);

    //Getting oracle information
    const oracle_json = await JSON.parse(await Deno.readTextFile(oracle_params));
    const oracle_pkh = oracle_json.public_key_hash

    //Getting utxo information
    const utxos = await lucid.utxosAt(gambler_address);
    
    //Set some params
    const now = Date.now();
    const assetName = "Token1";
    const plutusJSON = JSON.parse(await Deno.readTextFile("plutus.json"));
    //Get mint variables
    const match_json = JSON.parse(await Deno.readTextFile(minting_json));
    const mint_params = getPolicyParams(match_json.Figther1,match_json.Fighter2,match_json.PosixTime,assetName,oracle_pkh);
    const minting_policy = getPolicy(plutusJSON, mint_params, "mint_bet.mint_bet");
    const minting_address = lucid.utils.validatorToAddress(minting_policy);
    const minting_policy_id = lucid.utils.mintingPolicyToId(minting_policy);
    console.log("Minting address: ", minting_address);

    //Making the datum
    const datum = getDatum(winner_datum, bet,gambler_pkh);

    //Nft information
    const nft_name = fromText(assetName);
    const token = minting_policy_id + nft_name;

    //time 
    console.log("Now: ",now)
    const txValidTo = now+60000
    console.log("Tx valid to: ", txValidTo);
    console.log("Match posixtime: ",match_json.PosixTime);
    
    //Make transaction
    const txId = await mintNFTAndPay(utxos,minting_policy, token, datum, minting_address, txValidTo,bet);
    console.log("Transactions submitted with id: ", txId);
}

main();
