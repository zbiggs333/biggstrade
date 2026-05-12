// api/options.js
// Returns options chain from Tradier sandbox for a given symbol and expiration
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol, expiration } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol parameter' });

  try {
    // Step 1 — get available expirations if none provided
    if (!expiration) {
      const expRes = await fetch(
        `https://sandbox.tradier.com/v1/markets/options/expirations?symbol=${symbol}&includeAllRoots=false`,
        {
          headers: {
            Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
            Accept: 'application/json',
          },
        }
      );
      const expData = await expRes.json();
      const expirations = expData?.expirations?.date || [];
      return res.status(200).json({ expirations });
    }

    // Step 2 — get options chain for specific expiration
    const chainRes = await fetch(
      `https://sandbox.tradier.com/v1/markets/options/chains?symbol=${symbol}&expiration=${expiration}&greeks=true`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
          Accept: 'application/json',
        },
      }
    );
    const chainData = await chainRes.json();
    const options = chainData?.options?.option || [];

    // Filter to calls and puts separately, sorted by strike
    const calls = options
      .filter(o => o.option_type === 'call')
      .sort((a, b) => a.strike - b.strike)
      .map(o => ({
        symbol: o.symbol,
        strike: o.strike,
        expiration: o.expiration_date,
        type: o.option_type,
        last: o.last,
        bid: o.bid,
        ask: o.ask,
        volume: o.volume,
        open_interest: o.open_interest,
        delta: o.greeks?.delta,
        theta: o.greeks?.theta,
        iv: o.greeks?.smv_vol,
      }));

    const puts = options
      .filter(o => o.option_type === 'put')
      .sort((a, b) => a.strike - b.strike)
      .map(o => ({
        symbol: o.symbol,
        strike: o.strike,
        expiration: o.expiration_date,
        type: o.option_type,
        last: o.last,
        bid: o.bid,
        ask: o.ask,
        volume: o.volume,
        open_interest: o.open_interest,
        delta: o.greeks?.delta,
        theta: o.greeks?.theta,
        iv: o.greeks?.smv_vol,
      }));

    res.status(200).json({ symbol, expiration, calls, puts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch options chain', detail: err.message });
  }
}
