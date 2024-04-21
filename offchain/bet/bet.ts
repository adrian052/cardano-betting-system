import { lucid } from "../instance-lucid.ts";
import { getUTXO, getUserAddress,getOutRef, getPolicy, getDatum, mintNFTAndPay } from "../lib/utils.ts";
import { Constr, fromText } from "../lucid/mod.ts";
import { PrivateKey } from "../lucid/src/core/libs/cardano_multiplatform_lib/cardano_multiplatform_lib.generated.js";



async function main() {
    //Getting gambler information
    const { privateKey, gambler_address } = await getUserAddress("./assets/bob-pk");
    const gambler_priv = PrivateKey.from_bech32(privateKey);
    const gambler_pkh = gambler_priv.to_public().hash().to_hex();
    console.log("Gambler address: " + gambler_address);

    //Getting utxo information
    const utxo = await getUTXO(gambler_address);
    const outRef = getOutRef(utxo);
    console.log("UTXO: ", utxo);

    //Set some params
    const now = Date.now();
    const assetName = "Token1";
    const plutusJSON = JSON.parse(await Deno.readTextFile("plutus.json"));

    //Get validator variables
    const validator_params = [new Constr(0, [fromText("Canelo"), fromText("GGG"), BigInt(9999999999999)])];
    const validator = getPolicy(plutusJSON, validator_params,"betting.betting");
    const validator_address = lucid.utils.validatorToAddress(validator);
    const validator_pkh = lucid.utils.validatorToScriptHash(validator);
    console.log("Validator address: ", validator_address);

    //Get mint variables
    const mint_params = [outRef, fromText(assetName), validator_pkh, BigInt(now + 100001)]
    const minting_policy = getPolicy(plutusJSON, mint_params, "mint_bet.mint_bet");
    const minting_address = lucid.utils.validatorToAddress(minting_policy);
    const minting_policy_id = lucid.utils.mintingPolicyToId(minting_policy);
    console.log("Minting address: ", minting_address);

    //Making the datum
    const datum = getDatum(new Constr(0, []), 2000000,gambler_pkh, now);

    //Nft information
    const nft_name = fromText(assetName);
    const token = minting_policy_id + nft_name;

    //Make transaction
    const txId = await mintNFTAndPay(utxo, minting_policy, token, datum, validator_address, now + 100000,2000000);
    console.log("Transactions submitted with id: ", txId);
}

main();
