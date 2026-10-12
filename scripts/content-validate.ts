/*
  `npm run content:validate` (BE-3.2): the deterministic validators over content/**.yaml.

    --poc        also fail when the POC scope (Laws of Motion + Work, Energy and Power, all three
                 tracks) is short of 3 diagnostic / 3 retest / 6 practice items per concept
    --quiet      print errors only

  Exit code 1 on any error. Warnings never fail the run.
*/
import { coverage, coverageGaps } from "../src/domains/content/rules";
import { loadContent } from "../src/domains/content/load";
import { POC_CONCEPTS } from "../src/domains/content/scope";

const args = new Set(process.argv.slice(2));
const { files, findings } = loadContent();
const errors = findings.filter((f) => f.severity === "error");
const warnings = findings.filter((f) => f.severity === "warning");

for (const f of [...errors, ...(args.has("--quiet") ? [] : warnings)]) console.log(`${f.severity === "error" ? "ERROR" : "warn "} ${f.file} ${f.id} [${f.validator}] ${f.message}`);

const items = files.reduce((n, f) => n + f.items.length, 0);
console.log(`\n${files.length} files, ${items} items, ${errors.length} errors, ${warnings.length} warnings`);

const cov = coverage(files);
const gaps = coverageGaps(cov, POC_CONCEPTS);
if (!args.has("--quiet")) {
  console.log("\nPOC coverage (jee_main; diagnostic/retest/practice, target 3/3/6):");
  for (const c of POC_CONCEPTS) {
    const row = cov[c]?.jee_main;
    console.log(`  ${c.padEnd(12)} ${row ? `${row.diagnostic}/${row.retest}/${row.practice}` : "-"}`);
  }
}
if (args.has("--poc") && gaps.length > 0) {
  console.log(`\n${gaps.length} coverage gaps:`);
  for (const g of gaps) console.log(`  ${g.concept} ${g.track} ${g.pool}: ${g.have}/${g.need}`);
}
process.exit(errors.length > 0 || (args.has("--poc") && gaps.length > 0) ? 1 : 0);
