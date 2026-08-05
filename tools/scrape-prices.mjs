// Nightly APL Privatkunden scrape -> apl-prices.json (consumed by the bookmarklet).
// Usage: node tools/scrape-prices.mjs [maxVehicles]   (maxVehicles = quick smoke test)
'use strict';
import { writeFileSync } from 'node:fs';
import APLMatcher from '../matcher.js';
import APLScraper from '../scraper.js';

const UA = APLScraper.UA;
const MAX = Number(process.argv[2]) || Infinity;
const CONCURRENCY = Number(process.env.APL_CONCURRENCY) || 3;
const DELAY = Number(process.env.APL_DELAY) || 300;
const CONSEC_FAIL_ABORT = 25; // stop early if APL starts bot-blocking us

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, accept = '*/*') {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept } });
  if (!res.ok) { const e = new Error('HTTP ' + res.status + ' ' + url); e.status = res.status; throw e; }
  return res.text();
}

async function main() {
  const [aplSlugs, vehicles] = await Promise.all([
    (async () => {
      const xml = await fetchText('https://www.apl.de/sitemap.xml', 'application/xml,text/xml,*/*');
      return [...xml.matchAll(/<loc>\s*([^<]*\/neuwagen\/[^<]*?\/modellvarianten\/)\s*<\/loc>/gi)].map((m) => m[1]);
    })(),
    (async () => {
      const html = await fetchText('https://ev-database.org/', 'text/html');
      const out = [];
      for (const chunk of String(html).split('<div class="list-item" data-jplist-item>').slice(1)) {
        if (!/class="availability current"/.test(chunk)) continue; // nur bestellbar
        const title = chunk.match(/class="title">([\s\S]*?)<\/a>/);
        if (!title) continue;
        const make = (title[1].match(/<span class="[a-z0-9_]+">([^<]*)<\/span>/) || [])[1];
        const modelRaw = (title[1].match(/class="model">([\s\S]*?)<\/span>/) || [])[1];
        const model = modelRaw ? modelRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null;
        const shape = (chunk.match(/class="shape-([a-z]+) hidden"/) || [])[1];
        if (make && model) out.push({ make: make.trim(), model, shape });
      }
      return out;
    })(),
  ]);

  const paths = aplSlugs.map((u) => new URL(u).pathname);
  const { mapping } = APLMatcher.buildMapping(vehicles, paths); // 'Make|Model' -> apl slug
  const slugToUrl = {};
  for (const u of aplSlugs) {
    const p = u.split('/').filter(Boolean);
    if (p[p.length - 1] === 'modellvarianten') slugToUrl[p[p.length - 2]] = u;
  }

  const jobs = Object.entries(mapping).slice(0, MAX);
  const prices = {};
  const failures = []; // 'key -> slug [reason]' for diagnosis
  const cats = {};
  const failCount = () => Object.values(cats).reduce((a, b) => a + b, 0);
  let scraped = 0, consecFail = 0, fetched = 0, aborted = false;

  const recordFail = (key, slug, reason) => {
    cats[reason] = (cats[reason] || 0) + 1;
    failures.push(key + ' -> ' + slug + ' [' + reason + ']');
  };

  const runPool = async () => {
    let i = 0;
    const next = async () => {
      while (!aborted && i < jobs.length) {
        const [key, slug] = jobs[i++];
        const url = slugToUrl[slug];
        const run = async () => {
          const page = await fetchText(url, 'text/html');
          const id = (page.match(/FzgBlock-infos" data-id="(\d+)"/) || [])[1];
          if (!id) throw new Error('no variant id');
          const price = await APLScraper.fetchPrices(id, 'privatkunden');
          if (!price || price.endpreis === undefined) throw new Error('no PK price');
          prices[key] = { slug, ...price };
          scraped++;
        };
        const once = async () => {
          try {
            await run();
            consecFail = 0;
            return true;
          } catch (e) {
            const reason = e && e.status ? 'HTTP ' + e.status : (e && e.message) || String(e);
            if (e && e.status === 429) {
              await sleep(2000); // politeness on rate limit, retry once
              try { await run(); consecFail = 0; return true; } catch { recordFail(key, slug, reason); }
            } else {
              recordFail(key, slug, reason);
            }
            consecFail++;
            return false;
          }
        };
        if (!(await once()) && consecFail >= CONSEC_FAIL_ABORT) {
          console.error('Aborting: ' + consecFail + ' consecutive failures');
          aborted = true;
          return;
        }
        if (++fetched % 50 === 0) console.log('  ' + fetched + '/' + jobs.length + ' (ok=' + scraped + ', fail=' + failCount() + ')');
        await sleep(DELAY);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, next));
  };

  console.log('Mapped ' + jobs.length + ' vehicles, scraping Privatkunden…');
  await runPool();

  if (aborted) { console.error('Incomplete run - apl-prices.json not touched.'); process.exit(1); }

  if (failures.length) {
    console.log('Failures by reason:');
    for (const [r, n] of Object.entries(cats).sort((a, b) => b[1] - a[1])) console.log('  ' + n + '\t' + r);
    const makes = {};
    for (const f of failures) { const m = (f.match(/^([^|]+)\|/) || [])[1]; if (m) makes[m] = (makes[m] || 0) + 1; }
    console.log('Top failure makes: ' + Object.entries(makes).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([m, n]) => m + ':' + n).join(', '));
  }

  // Never overwrite a good dataset with a bot-blocked/partial run.
  try {
    const prev = await (await fetch('https://raw.githubusercontent.com/gnagster/evdb-apl-firefox/main/apl-prices.json')).json();
    const floor = Math.max(50, (prev.count || 0) * 0.5);
    if (scraped < floor) { console.error('Coverage drop (' + scraped + ' < ' + floor + ') - keeping existing file.'); process.exit(1); }
  } catch { /* first run / fetch hiccup -> write anyway */ }

  const out = { generatedAt: new Date().toISOString(), source: 'privatkunden', count: scraped, prices };
  writeFileSync('apl-prices.json', JSON.stringify(out, null, 2));
  console.log('Wrote apl-prices.json with ' + scraped + ' prices (' + failCount() + ' failed).');
}

main().catch((e) => { console.error(e); process.exit(1); });
