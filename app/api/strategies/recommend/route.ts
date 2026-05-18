import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { strategy_id, params } = body;

  // Load strategy
  const stratResult = await db.query('SELECT * FROM strategies WHERE id = $1', [strategy_id]);
  if (stratResult.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: 'Strategy not found' }, { status: 404 });
  }
  const strategy = stratResult.rows[0];

  // Load all ETFs
  const etfResult = await db.query('SELECT * FROM etfs ORDER BY aum DESC');
  const etfs = etfResult.rows;

  // Call Python strategy engine
  const pythonUrl = process.env.PYTHON_FUNCTION_URL || 'http://localhost:3000/api/py';
  const resp = await fetch(`${pythonUrl}/strategy-engine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      factors: strategy.factors,
      params: params || strategy.params,
      etf_tickers: etfs.map((e: { ticker: string }) => e.ticker),
    }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    return NextResponse.json(err, { status: 502 });
  }

  const data = await resp.json();

  // Store scores in DB
  for (const rec of data.recommendations) {
    const etf = etfs.find((e: { ticker: string }) => e.ticker === rec.ticker);
    if (etf) {
      await db.query(
        `INSERT INTO strategy_etf_scores (strategy_id, etf_id, score, factor_scores)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (strategy_id, etf_id) DO UPDATE SET score = $3, factor_scores = $4, scored_at = NOW()`,
        [strategy_id, etf.id, rec.score, JSON.stringify(rec.factor_scores)]
      );
    }
  }

  return NextResponse.json(data);
}
