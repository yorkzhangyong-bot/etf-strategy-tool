import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const etfs = await db.query('SELECT ticker FROM etfs');
    const pythonUrl = process.env.PYTHON_FUNCTION_URL || 'http://localhost:3000/api/py';

    let updated = 0;
    let failed = 0;

    for (const etf of etfs.rows) {
      const resp = await fetch(`${pythonUrl}/data-fetcher/fetch-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: (etf as { ticker: string }).ticker }),
      });
      if (resp.ok) {
        const info = await resp.json();
        if (!info.error) {
          await db.query(
            `UPDATE etfs SET name = $1, issuer = $2, category = $3, expense_ratio = $4,
             aum = $5, updated_at = NOW() WHERE ticker = $6`,
            [info.name, info.issuer, info.category, info.expense_ratio, info.aum, info.ticker]
          );
          updated++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    }

    return NextResponse.json({ updated, failed, total: etfs.rows.length });
  } catch (e) {
    return NextResponse.json({ error: 'REFRESH_FAILED', detail: String(e) }, { status: 500 });
  }
}
