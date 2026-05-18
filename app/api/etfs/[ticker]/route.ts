import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const result = await db.query('SELECT * FROM etfs WHERE ticker = $1', [ticker.toUpperCase()]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: `ETF ${ticker} not found` }, { status: 404 });
  }
  return NextResponse.json(result.rows[0]);
}
