// api/briefing.js
// Generates the morning briefing using live Tradier data + Claude AI
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const tickers = ['SPY', 'AAPL', 'TSLA', 'QQQ'];

  try {
    // Step 1 — fetch live quotes for all 4 tickers
    const quotesRes = await fetch(
      `https://sandbox.tradier.com/v1/markets/quotes?symbols=${tickers.join(',')}&greeks=false`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
          Accept: 'application/json',
        },
      }
    );
    const quotesData = await quotesRes.json();
    const quotes = quotesData?.quotes?.quote || [];
    const quoteMap = {};
    (Array.isArray(quotes) ? quotes : [quotes]).forEach(q => { quoteMap[q.symbol] = q; });

    // Step 2 — fetch market clock
    const clockRes = await fetch('https://sandbox.tradier.com/v1/markets/clock', {
      headers: {
        Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
        Accept: 'application/json',
      },
    });
    const clockData = await clockRes.json();
    const clock = clockData?.clock || {};

    // Step 3 — build market summary for Claude
    const marketSummary = tickers.map(t => {
      const q = quoteMap[t];
      if (!q) return `${t}: No data`;
      return `${t}: $${q.last} (${q.change_percentage > 0 ? '+' : ''}${q.change_percentage}%) High: $${q.high} Low: $${q.low} Volume: ${q.volume}`;
    }).join('\n');

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Step 4 — ask Claude to generate the full briefing
    const prompt = `You are BiggsTrade, a pre-market options trading assistant. Today is ${today}.

Market status: ${clock.state || 'unknown'} — Next change: ${clock.next_change || 'unknown'}

Live market data:
${marketSummary}

The user is a beginner options trader with:
- Budget: $500-$2,000 per trade
- Risk tolerance: Balanced
- Setups: Naked calls, naked puts, covered calls
- Stocks: SPY, AAPL, TSLA, QQQ

Based on the live data above, generate today's morning briefing.

Return ONLY a valid JSON object, no markdown, no backticks:
{
  "mood": "Bullish or Bearish or Neutral or Caution",
  "vix": "estimated VIX level e.g. 16.2",
  "vixRead": "plain English e.g. Low fear — good for calls",
  "spFutures": "e.g. +0.4% based on SPY data",
  "spDirection": "up or down",
  "nqFutures": "e.g. +0.6% based on QQQ data",
  "nqDirection": "up or down",
  "tenYrYield": "e.g. 4.32%",
  "events": [{"time": "e.g. 8:30 AM", "name": "Event name", "impact": "High or Medium or Low"}],
  "marketRead": "2-3 plain English sentences on what the market mood means for a beginner options trader today.",
  "topPick": {
    "ticker": "SPY or AAPL or TSLA or QQQ",
    "setupType": "Call or Put or Covered Call",
    "strike": "suggested strike price based on live data",
    "expiration": "e.g. Today or specific date",
    "costToEnter": "estimated cost within $500-$2,000",
    "profitPotential": "e.g. +$180 (53%)",
    "takeProfit": "specific price to exit for profit",
    "stopLoss": "specific price to cut loss",
    "timeExit": "e.g. 2:30 PM",
    "riskLevel": "Low or Medium or High",
    "confidence": 55-92,
    "reason": "One plain English sentence on why this is today's top pick based on the live data."
  },
  "otherTrades": [
    {"ticker": "ticker", "setupType": "Call or Put or Covered Call", "costToEnter": "e.g. $480", "confidence": 50-88, "riskLevel": "Low or Medium or High", "reason": "One sentence."}
  ]
}
otherTrades must have exactly 3 entries for the remaining 3 tickers.`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content?.find(b => b.type === 'text')?.text || '';
    const match = text.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse Claude response');
    const briefing = JSON.parse(match[0]);
    briefing.marketStatus = clock.state || 'unknown';
    briefing.liveQuotes = quoteMap;
    res.status(200).json(briefing);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate briefing', detail: err.message });
  }
}
