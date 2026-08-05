javascript: (() => {
  // APL Preise Bookmarklet: ersetzt EV-Database DE-Listenpreise durch APL.de
  // Privatkunden-Preise. Datenquelle: täglicher GitHub-Action-Lauf -> apl-prices.json.
  // raw zuerst: jsdelivr cached @main 24h und liefert sonst veraltete Preise.
  const JSON_URLS = [
    'https://raw.githubusercontent.com/gnagster/evdb-apl-firefox/main/apl-prices.json',
    'https://cdn.jsdelivr.net/gh/gnagster/evdb-apl-firefox@main/apl-prices.json',
  ];
  const CACHE_KEY = 'apl-pk-prices';
  const DAY = 24 * 60 * 60 * 1000;

  // --- helpers (identisch mit content.js) ---
  const parsePriceNum = (raw) => {
    if (raw == null) return null;
    const s = String(raw).replace(/[€\s]/g, '').trim();
    if (!s) return null;
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? Math.round(n) : null;
  };
  const formatPrice = (raw) => {
    const n = parsePriceNum(raw);
    return n === null ? null : '€' + n.toLocaleString('en-US');
  };
  const pricePerKm = (n, km) => (km ? Math.round(n / km) : null);
  const parseRangeKm = (t) => { const m = String(t || '').match(/(\d+)/); return m ? Number(m[1]) : null; };

  function toast(msg) {
    let el = document.querySelector('[data-apl-toast]');
    if (!el) {
      el = document.createElement('div');
      el.dataset.aplToast = '1';
      el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:8px 12px;font:600 13px/1.4 sans-serif;color:#fff;background:#e8590c;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.3);';
      document.documentElement.appendChild(el);
    }
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.remove(), 4000);
  }

  function kickJplistRefresh() {
    const s = document.createElement('script');
    s.textContent = 'window.jplist && window.jplist.refresh();';
    document.documentElement.appendChild(s);
    s.remove();
  }

  function itemKey(item) {
    const title = item.querySelector('.title');
    if (!title) return null;
    const makeEl = title.querySelector('span');
    const modelEl = title.querySelector('.model');
    if (!makeEl || !modelEl) return null;
    return makeEl.textContent.trim() + '|' + modelEl.textContent.replace(/\s+/g, ' ').trim();
  }

  function applyPrice(item, entry) {
    const endpreis = entry.endpreis;
    const priceNum = parsePriceNum(endpreis);
    if (endpreis == null || priceNum === null) return false;
    const de = item.querySelector('.price_buy.current .country_de');
    if (!de) return false;
    const priceText = formatPrice(endpreis);
    const changed = de.textContent !== priceText;
    de.textContent = priceText;
    de.dataset.aplPrice = '1';
    const pf = item.querySelector('.pricefilter.hidden');
    const ps = item.querySelector('.pricesort.hidden');
    if (pf) pf.textContent = String(priceNum);
    if (ps) ps.textContent = String(priceNum);
    const rangeKm = (() => { const el = item.querySelector('.erange_real'); return el ? parseRangeKm(el.textContent) : null; })();
    const perKm = pricePerKm(priceNum, rangeKm);
    const ppHidden = item.querySelector('.priceperrange.hidden');
    const ppVis = item.querySelector('.priceperrange_p');
    if (perKm !== null) {
      if (ppHidden) ppHidden.textContent = String(perKm);
      if (ppVis) ppVis.textContent = '€' + perKm.toLocaleString('en-US') + ' /km';
    }
    if (de.parentElement && !de.parentElement.querySelector('[data-apl-badge]')) {
      const b = document.createElement('span');
      b.dataset.aplBadge = '1';
      b.textContent = 'APL';
      b.style.cssText = 'display:inline-block;margin-left:5px;padding:0 4px;font-size:10px;line-height:14px;font-weight:700;color:#fff;background:#e8590c;border-radius:3px;vertical-align:top;';
      de.parentElement.appendChild(b);
    }
    return changed;
  }

  async function loadPrices() {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch {}
    if (cached && Date.now() - cached.ts < DAY) return cached.data;
    let lastErr;
    for (const url of JSON_URLS) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        return data;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('fetch failed');
  }

  function applyPrices(data) {
    const byKey = data.prices || data;
    let modified = 0, total = 0;
    for (const item of document.querySelectorAll('.list-item')) {
      try {
        if (!item.querySelector('.availability.current')) continue;
        const key = itemKey(item);
        const entry = key && byKey[key];
        if (!entry) continue;
        total++;
        if (applyPrice(item, entry)) modified++;
      } catch {}
    }
    if (modified > 0) kickJplistRefresh();
    const stand = data.generatedAt ? ' (Stand ' + new Date(data.generatedAt).toLocaleDateString('de-DE') + ')' : '';
    toast('APL: ' + modified + ' Preise aktualisiert von ' + total + stand);
  }

  async function run() {
    if (!document.querySelector('.list-item')) { toast('Keine Fahrzeugliste gefunden'); return; }
    try {
      const data = await loadPrices();
      applyPrices(data);
      const list = document.querySelector('.list'); // bei Sortier-/Filterwechsel neu anwenden
      if (list) {
        let t;
        new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => applyPrices(data), 800); })
          .observe(list, { childList: true, subtree: true });
      }
    } catch (e) { toast('APL-Fehler: ' + e.message); }
  }

  run();
})();
