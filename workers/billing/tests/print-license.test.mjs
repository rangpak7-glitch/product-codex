import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const canPurchase = source.match(/function canPurchaseProduct\(product\) \{[\s\S]*?\n\}/)?.[0];
const quote = source.match(/function printLicenseQuote\(product, requestedValue\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(canPurchase && quote, "print license functions must be present");

const context = {};
vm.createContext(context);
vm.runInContext(`${canPurchase}\n${quote}\nthis.quote = printLicenseQuote;`, context);

const product = {
  id: "family-14",
  type: "pdf",
  published: true,
  sale_status: "available",
  purchasable: true,
  price_amount: 3000,
  currency: "KRW",
  base_print_copies: 20,
  print_pack_size: 10,
  print_pack_price: 3000
};

assert.deepEqual({ ...context.quote(product, 20) }, { requested: 20, licensed: 20, basePrice: 3000, surcharge: 0, amount: 3000 });
assert.deepEqual({ ...context.quote(product, 21) }, { requested: 21, licensed: 30, basePrice: 3000, surcharge: 3000, amount: 6000 });
assert.deepEqual({ ...context.quote(product, 30) }, { requested: 30, licensed: 30, basePrice: 3000, surcharge: 3000, amount: 6000 });
assert.deepEqual({ ...context.quote(product, 31) }, { requested: 31, licensed: 40, basePrice: 3000, surcharge: 6000, amount: 9000 });
assert.equal(context.quote(product, 0), null);
assert.equal(context.quote(product, 10001), null);

console.log("print license calculation: ok");
