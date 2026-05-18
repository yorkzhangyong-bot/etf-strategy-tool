import { sql } from '@vercel/postgres';

export const db = {
  query: async (text: string, params?: unknown[]) => {
    const result = await sql.query(text, params);
    return result;
  },
  sql,
};
