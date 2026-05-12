// api/research.js
// Calls Anthropic Claude API server-side to generate AI research reports
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker, quoteData } = req.body;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const prompt = `You are a pre-market trading research assistant for BiggsTrade, an options trading app for beginners. 
  
The user is researching: ${ticker}
${quoteData ? `Current market data: Price $${quoteData.last}, Change ${quoteData.change_percentage}%, High $${quoteData.high}, Low $${quoteData.low}` : ''}

The user has a $500-$2,000 budget, balanced risk tolerance, and trades naked calls, puts, and covered calls.

Respond with ONLY a raw JSON object. No markdown, no code fences. Start with { and end with }.

{"ticker":"${ticker}","companyName":"full company name","sentiment":"Bullish or Bearish or Neutral","news":"2-3 sentences on the most important recent news affecting this stock and options trading outlook.","legal":"2-3 sentences on any active lawsuits, SEC investigations, or regulatory risks. If none, say so plainly.","secFilings":"2-3 sentences on the most relevant recent 10-K or 10-Q highlights a trader should know.","recommendation":"Buy calls or Buy puts or Covered call or Hold off today","recommendationReason":"2-3 plain English sentences explaining why, what to watch for, and risk level for a beginner with a $500-$2,000 budget."}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const match = text.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse Claude response');
    const parsed = JSON.parse(match[0]);
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate research', detail: err.message });
  }
}
