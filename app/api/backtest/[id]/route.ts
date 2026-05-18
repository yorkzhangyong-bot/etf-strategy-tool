import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.query('SELECT * FROM backtest_results WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: 'Backtest not found' }, { status: 404 });
  }
  const bt = result.rows[0];
  const etfs = await db.query(
    `SELECT be.weight, e.ticker, e.name FROM backtest_etfs be JOIN etfs e ON be.etf_id = e.id WHERE be.backtest_id = $1`,
    [id]
  );
  return NextResponse.json({ ...bt, etfs: etfs.rows });
}
