import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateFactorWeights } from '@/lib/utils';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.query('SELECT * FROM strategies WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: 'Strategy not found' }, { status: 404 });
  }
  return NextResponse.json(result.rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, factors, params: sp } = body;

  if (factors && !validateFactorWeights(factors)) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', detail: 'Factor weights must sum to 100' }, { status: 400 });
  }

  const result = await db.query(
    `UPDATE strategies SET name = COALESCE($1, name), factors = COALESCE($2::jsonb, factors),
     params = COALESCE($3::jsonb, params) WHERE id = $4 RETURNING *`,
    [name, factors ? JSON.stringify(factors) : null, sp ? JSON.stringify(sp) : null, id]
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: 'Strategy not found' }, { status: 404 });
  }
  return NextResponse.json(result.rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.query('DELETE FROM strategies WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'NOT_FOUND', detail: 'Strategy not found' }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
