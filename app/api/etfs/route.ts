import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const category = searchParams.get('category') || '';
  const region = searchParams.get('region') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: (string | number)[] = [];
  let paramIndex = 1;

  if (q) {
    conditions.push(`(ticker ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`);
    values.push(`%${q}%`);
    paramIndex++;
  }
  if (category) {
    conditions.push(`category = $${paramIndex}`);
    values.push(category);
    paramIndex++;
  }
  if (region) {
    conditions.push(`region = $${paramIndex}`);
    values.push(region);
    paramIndex++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, offset);

  const countResult = await db.query(`SELECT COUNT(*) FROM etfs ${where}`, values.slice(0, paramIndex - 1));
  const total = parseInt(countResult.rows[0].count);

  const result = await db.query(
    `SELECT * FROM etfs ${where} ORDER BY aum DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values
  );

  return NextResponse.json({ data: result.rows, total, page, limit });
}
