import assert from "node:assert/strict";
import { chooseAction } from "./risk_upload.js";

assert.equal(chooseAction(0.2, 2500), "settle");
assert.equal(chooseAction(0.7, 2500), "review");
assert.equal(chooseAction(0.1, 100000), "review");
console.log("risk decision test passed");
