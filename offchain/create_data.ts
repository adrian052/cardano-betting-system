import fs from "node:fs";

const fighter1 = "Canelo";
const fighter2 = "GGG";
const posixtime = Date.now() + 180000;
const owner = fs.readFileSync("./assets/alice-pk", "utf-8");

const json = {
  "Figther1": fighter1,
  "Figther2": fighter2,
  "PosixTime": posixtime,
  "Owner": owner
};

const filePath = "data/match.json";

fs.writeFileSync(filePath, JSON.stringify(json, null, 2));

console.log(`JSON written ${filePath}`);