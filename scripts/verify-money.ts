import {
  toSantim, fromSantim, formatMoney, formatMoneyWithCurrency,
  toBasisPoints, formatPercent, applyRate, sumSantim,
} from "@/lib/money";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  <- " + detail}`);
  if (!ok) failures++;
}

console.log("\nThe float problem this replaces");
const floatSum = 0.1 + 0.2;
check("floats really are wrong: 0.1 + 0.2 !== 0.3", floatSum !== 0.3, String(floatSum));
console.log(`     0.1 + 0.2 = ${floatSum}`);
check("santim addition is exact", toSantim(0.1) + toSantim(0.2) === toSantim(0.3),
  `${toSantim(0.1) + toSantim(0.2)} vs ${toSantim(0.3)}`);

console.log("\nParsing");
check('toSantim("1840.00") is 184000', toSantim("1840.00") === 184000, String(toSantim("1840.00")));
check('toSantim("1,840.50") handles grouping', toSantim("1,840.50") === 184050, String(toSantim("1,840.50")));
check("toSantim(null) is 0", toSantim(null) === 0);
check('toSantim("") is 0', toSantim("") === 0);
check('toSantim("abc") is 0', toSantim("abc") === 0);
check("toSantim rounds half up", toSantim("0.005") === 1, String(toSantim("0.005")));

console.log("\nFormatting");
check('formatMoney(184000) is "1,840.00"', formatMoney(184000) === "1,840.00", formatMoney(184000));
check('formatMoney(5) is "0.05"', formatMoney(5) === "0.05", formatMoney(5));
check('formatMoney(0) is "0.00"', formatMoney(0) === "0.00", formatMoney(0));
check('formatMoney(-2550) is "-25.50"', formatMoney(-2550) === "-25.50", formatMoney(-2550));
check('formatMoney(123456789) groups', formatMoney(123456789) === "1,234,567.89", formatMoney(123456789));
check("currency prefix", formatMoneyWithCurrency(184000) === "ETB 1,840.00");

console.log("\nRates");
check("toBasisPoints(15) is 1500", toBasisPoints(15) === 1500);
check('toBasisPoints("7.5") is 750', toBasisPoints("7.5") === 750);
check("15% of 1840.00 is exactly 276.00", applyRate(184000, 1500) === 27600, String(applyRate(184000, 1500)));
check("formatPercent(1500) is 15%", formatPercent(1500) === "15%", formatPercent(1500));
check("formatPercent(750) is 7.5%", formatPercent(750) === "7.5%", formatPercent(750));
check("rate on a tiny amount rounds to 0", applyRate(1, 1500) === 0, String(applyRate(1, 1500)));
check("rate rounds half away from zero", applyRate(10, 5000) === 5, String(applyRate(10, 5000)));

console.log("\nA realistic till total");
// Three services at 610.00, 615.00, 615.00; 15% tax; 50.00 discount; 25.00 tip.
const lines = [toSantim("610.00"), toSantim("615.00"), toSantim("615.00")];
const subtotal = sumSantim(lines);
const tax = applyRate(subtotal, toBasisPoints(15));
const discount = toSantim("50.00");
const tip = toSantim("25.00");
const total = subtotal + tax - discount + tip;
check("subtotal is 1,840.00", formatMoney(subtotal) === "1,840.00", formatMoney(subtotal));
check("tax is 276.00", formatMoney(tax) === "276.00", formatMoney(tax));
check("total is 2,091.00", formatMoney(total) === "2,091.00", formatMoney(total));
console.log(`     ${formatMoney(subtotal)} + ${formatMoney(tax)} - ${formatMoney(discount)} + ${formatMoney(tip)} = ${formatMoney(total)}`);

console.log("\nThe same sum in floats, for comparison");
const fSub = 610.0 + 615.0 + 615.0;
const fTotal = fSub + fSub * 0.15 - 50.0 + 25.0;
console.log(`     float total = ${fTotal}  (integer total = ${fromSantim(total)})`);
check("integer and float agree here to 2dp", Math.abs(fTotal - fromSantim(total)) < 0.005);

console.log("\nAccumulated float drift over a day");
let drift = 0;
for (let i = 0; i < 1000; i++) drift += 0.1;
check("1000 float additions of 0.10 drift from 100", drift !== 100, String(drift));
console.log(`     float: ${drift}`);
const exact = sumSantim(Array(1000).fill(toSantim(0.1)));
check("1000 santim additions are exactly 100.00", formatMoney(exact) === "100.00", formatMoney(exact));

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
