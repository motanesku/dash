export async function onRequest(context) {
  const url = new URL(context.request.url);
  const endpoint = url.searchParams.get("endpoint");
  const headers = { "Content-Type": "application/json" };

  try {
    // ── DATE FUNDAMENTALE ȘI PREȚURI ──────────────────────────
    if (endpoint === "prices") {
      const symbols = url.searchParams.get("symbols")?.split(",") || [];
      const data = {};

      await Promise.all(symbols.map(async (s) => {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`);
        const json = await res.json();
        const meta = json.chart.result?.[0]?.meta;

        if (meta) {
          data[s] = {
            price: meta.regularMarketPrice,
            prev: meta.previousClose,
            name: meta.shortName || s,
            currency: meta.currency,
            // Datele fundamentale pe care le vrei populate automat
            exchange: meta.exchangeName,
            instrumentType: meta.instrumentType,
            // Notă: Pentru indicatori mai avansați (Cap, P/E), 
            // Yahoo are nevoie de un alt endpoint, dar meta oferă baza.
          };
        }
      }));
      return Response.json({ ok: true, prices: data }, { headers });
    }

    // ── FEAR & GREED ──────────────────────────────────────────
    if (endpoint === "feargreed") {
      const res = await fetch("https://api.alternative.me/fng/?limit=1");
      const j = await res.json();
      return Response.json({ 
        ok: true, 
        value: +j.data[0].value, 
        label: j.data[0].value_classification 
      }, { headers });
    }

    return Response.json({ message: "Cloudflare Function Active" }, { headers });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500, headers });
  }
}

