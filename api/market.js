// api/market.js
// Returns market clock status and historical price data from Tradier sandbox
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, symbol, interval, start, end } = req.query;

  try {
    // Market clock — is the market open?
    if (type === 'clock') {
      const clockRes = await fetch(
        'https://sandbox.tradier.com/v1/markets/clock',
        {
          headers: {
            Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
            Accept: 'application/json',
          },
        }
      );
      const clockData = await clockRes.json();
      return res.status(200).json(clockData?.clock || {});
    }

    // Historical price data for charts
    if (type === 'history' && symbol) {
      const startDate = start || (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
      })();
      const endDate = end || new Date().toISOString().split('T')[0];
      const histRes = await fetch(
        `https://sandbox.tradier.com/v1/markets/history?symbol=${symbol}&interval=${interval || 'daily'}&start=${startDate}&end=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
            Accept: 'application/json',
          },
        }
      );
      const histData = await histRes.json();
      const history = histData?.history?.day || [];
      return res.status(200).json({ symbol, history });
    }

    // Intraday data for 5-day chart
    if (type === 'timesales' && symbol) {
      const tsRes = await fetch(
        `https://sandbox.tradier.com/v1/markets/timesales?symbol=${symbol}&interval=5min&start=${start || ''}&end=${end || ''}&session_filter=open`,
        {
          headers: {
            Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
            Accept: 'application/json',
          },
        }
      );
      const tsData = await tsRes.json();
      const series = tsData?.series?.data || [];
      return res.status(200).json({ symbol, series });
    }

    return res.status(400).json({ error: 'Invalid type parameter. Use clock, history, or timesales.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch market data', detail: err.message });
  }
}
