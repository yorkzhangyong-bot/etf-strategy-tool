import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = {
  query: async (text: string, params?: unknown[]) => {
    const result = await pool.query(text, params);
    return { rows: result.rows, rowCount: result.rowCount };
  },
};
