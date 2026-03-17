export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint");
  const headers = { 
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*" 
  };

  try {
    // 1. GET ALL TRANSACTIONS (Din D1 in loc de Google Sheets)
    if (endpoint === "get-transactions") {
      const { results } = await env.DB.prepare("SELECT * FROM transactions ORDER BY date DESC").all();
      return Response.json(results, { headers });
    }

    // 2. ADD TRANSACTION (Cu populare automata de date)
    if (endpoint === "add-transaction" && request.method === "POST") {
      const body = await request.json();
      const { symbol, shares, avg_price, date, broker } = body;

      // Fetch date fundamentale de la Yahoo Finance
      const yfRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`);
      const yfData = await yfRes.json();
      const meta = yfData.chart.result?.[0]?.meta;

      const sector = meta?.instrumentType || "Unknown"; // Yahoo nu da sectorul direct in chart, dar avem baza
      const marketCap = meta?.regularMarketPrice * 1000000; // Simulare cap pentru structura

      // Salvare in D1
      await env.DB.prepare(
        "INSERT INTO transactions (symbol, shares, avg_price, date, broker, sector, market_cap) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(symbol, shares, avg_price, date, broker, sector, marketCap).run();

      return Response.json({ ok: true, message: "Tranzactie salvata in D1!" }, { headers });
    }

    // 3. PREȚURI LIVE (Pentru Dashboard)
    if (endpoint === "prices") {
      const symbols = url.searchParams.get("symbols")?.split(",") || [];
      const prices = {};
      await Promise.all(symbols.map(async (s) => {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=1d&range=1d`);
        const j = await res.json();
        const meta = j.chart.result?.[0]?.meta;
        if (meta) prices[s] = { price: meta.regularMarketPrice, prev: meta.previousClose };
      }));
      return Response.json({ ok: true, prices }, { headers });
    }

    return Response.json({ status: "API is Online", database: "Connected" }, { headers });

  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500, headers });
  }
}
