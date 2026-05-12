// api/quote.js
// Returns real-time stock quote from Tradier sandbox
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol parameter' });

  try {
    const response = await fetch(
      `https://sandbox.tradier.com/v1/markets/quotes?symbols=${symbol}&greeks=false`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
          Accept: 'application/json',
        },
      }
    );
    const data = await response.json();
    const quote = data?.quotes?.quote;
    if (!quote) return res.status(404).json({ error: 'Symbol not found' });
    res.status(200).json({
      symbol: quote.symbol,
      description: quote.description,
      last: quote.last,
      change: quote.change,
      change_percentage: quote.change_percentage,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      week_52_high: quote.week_52_high,
      week_52_low: quote.week_52_low,
      volume: quote.volume,
      average_volume: quote.average_volume,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quote', detail: err.message });
  }
}
