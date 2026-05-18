import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateFactorWeights } from '@/lib/utils';

export async function GET() {
  const result = await db.query('SELECT * FROM strategies ORDER BY created_at DESC');
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, type, factors, params } = body;

  if (!name || !type || !factors || !params) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Missing required fields' }, { status: 400 });
  }
  if (!validateFactorWeights(factors)) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Factor weights must sum to 100' }, { status: 400 });
  }

  const result = await db.query(
    'INSERT INTO strategies (name, type, factors, params) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, type, JSON.stringify(factors), JSON.stringify(params)]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}
