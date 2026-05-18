import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateWeights } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { strategy_id, etf_tickers, weights, start_date, end_date } = body;

  if (!strategy_id || !etf_tickers?.length || !weights?.length || !start_date || !end_date) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Missing required fields' }, { status: 400 });
  }
  if (etf_tickers.length !== weights.length) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'weights length must equal etf_tickers length' }, { status: 400 });
  }
  if (!validateWeights(weights)) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Weights must sum to 1.0' }, { status: 400 });
  }
  if (new Date(start_date) >= new Date(end_date)) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'start_date must be before end_date' }, { status: 400 });
  }

  const pythonUrl = process.env.PYTHON_FUNCTION_URL || 'http://localhost:3000/api/py';
  const resp = await fetch(`${pythonUrl}/backtest-engine/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etf_tickers, weights, start_date, end_date }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    return NextResponse.json(err, { status: 502 });
  }

  const data = await resp.json();
  if (data.error && !data.partial_data) {
    return NextResponse.json(data, { status: 500 });
  }

  // Look up ETF IDs for the junction table, keeping ticker→weight mapping
  const tickerWeightMap = new Map<string, number>();
  for (let i = 0; i < etf_tickers.length; i++) {
    tickerWeightMap.set(etf_tickers[i].toUpperCase(), weights[i]);
  }

  // Store result
  const result = await db.query(
    `INSERT INTO backtest_results (strategy_id, start_date, end_date, annual_return, sharpe_ratio, max_drawdown, volatility, daily_nav)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [strategy_id, start_date, end_date, data.annual_return, data.sharpe_ratio, data.max_drawdown, data.volatility, JSON.stringify(data.daily_nav)]
  );
  const backtestId = result.rows[0].id;

  // Insert junction rows using ticker→weight mapping, not positional index
  for (const ticker of etf_tickers) {
    const r = await db.query('SELECT id FROM etfs WHERE ticker = $1', [ticker.toUpperCase()]);
    if (r.rows.length > 0) {
      await db.query('INSERT INTO backtest_etfs (backtest_id, etf_id, weight) VALUES ($1, $2, $3)',
        [backtestId, r.rows[0].id, tickerWeightMap.get(ticker.toUpperCase()) || 0]);
    }
  }

  return NextResponse.json({ id: backtestId, ...data });
}
