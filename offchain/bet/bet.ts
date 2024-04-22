import { lucid } from "../instance-lucid.ts";
import { getPolicyParams } from "../lib/utils.ts";
import {getUserAddress,getPolicy, getDatum, mintNFTAndPay } from "../lib/utils.ts";
import { Constr, fromText } from "../lucid/mod.ts";
import { PrivateKey } from "../lucid/src/core/libs/cardano_multiplatform_lib/cardano_multiplatform_lib.generated.js";



async function main() {
    //Getting gambler information
    const { privateKey, gambler_address } = await getUserAddress("./assets/bob-pk");
    const gambler_priv = PrivateKey.from_bech32(privateKey);
    const gambler_pkh = gambler_priv.to_public().hash().to_hex();
    console.log("Gambler address: " + gambler_address);

    //Getting utxo information
    const utxos = await lucid.utxosAt(gambler_address);
    
    //Set some params
    const now = Date.now();
    const assetName = "Token1";
    const plutusJSON = JSON.parse(await Deno.readTextFile("plutus.json"));

    const match_posixtime= 1714443139000
    //Get mint variables
    const mint_params = getPolicyParams("Canelo","GGG",match_posixtime, assetName);
    const minting_policy = getPolicy(plutusJSON, mint_params, "mint_bet.mint_bet");
    const minting_address = lucid.utils.validatorToAddress(minting_policy);
    const minting_policy_id = lucid.utils.mintingPolicyToId(minting_policy);
    console.log("Minting address: ", minting_address);

    //Making the datum
    const datum = getDatum(new Constr(0, []), 2000000,gambler_pkh, now);

    //Nft information
    const nft_name = fromText(assetName);
    const token = minting_policy_id + nft_name;

    //time 
    console.log("Now: ",now)
    const txValidTo = now+100000
    console.log("Tx valid to: ", txValidTo);
    console.log("Match posixtime: ",match_posixtime);
    
    //Make transaction
    const txId = await mintNFTAndPay(utxos,minting_policy, token, datum, minting_address, txValidTo,2000000);
    console.log("Transactions submitted with id: ", txId);
}

main();
