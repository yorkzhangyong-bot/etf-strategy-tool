import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { etf_tickers, lookback_months } = body;

  if (!etf_tickers?.length || etf_tickers.length < 2) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Need at least 2 ETFs to compare' }, { status: 400 });
  }
  if (etf_tickers.length > 10) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Maximum 10 ETFs at a time' }, { status: 400 });
  }

  const pythonUrl = process.env.PYTHON_FUNCTION_URL || 'http://localhost:3000/api/py';
  const resp = await fetch(`${pythonUrl}/backtest-engine/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etf_tickers, lookback_months: lookback_months || 36 }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    return NextResponse.json(err, { status: 502 });
  }

  const data = await resp.json();
  return NextResponse.json(data);
}
