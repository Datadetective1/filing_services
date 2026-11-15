#!/usr/bin/env node
/**
 * Tell IndexNow (Bing and partners) about every URL in the live sitemap.
 *
 *   node scripts/indexnow-submit.mjs            # dry run: prints what would be sent
 *   node scripts/indexnow-submit.mjs --send     # submits
 *
 * Run after a production deploy that adds or changes pages. Owner-approved runs only.
 */
import { readFileSync } from "node:fs";

const SITE = "https://www.getfilewell.com";
const key = readFileSync(new URL("../src/lib/seo/indexnow.ts", import.meta.url), "utf8").match(/INDEXNOW_KEY = "([a-f0-9]+)"/)?.[1];
if (!key) throw new Error("IndexNow key not found in src/lib/seo/indexnow.ts");

const keyFile = await fetch(`${SITE}/${key}.txt`);
if (!keyFile.ok || (await keyFile.text()).trim() !== key) throw new Error(`${SITE}/${key}.txt doesn't serve the key yet. Deploy first.`);

const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()).filter((u) => u.startsWith(SITE));
console.log(`${urls.length} URLs from the sitemap`);

if (!process.argv.includes("--send")) {
  console.log(urls.slice(0, 10).join("\n"), urls.length > 10 ? `\n... and ${urls.length - 10} more` : "");
  console.log("Dry run. Add --send to submit.");
  process.exit(0);
}

for (let i = 0; i < urls.length; i += 10000) {
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/${key}.txt`, urlList: urls.slice(i, i + 10000) }),
  });
  console.log(`IndexNow answered ${res.status} for ${Math.min(10000, urls.length - i)} URLs`);
  if (res.status >= 400) process.exitCode = 1;
}
