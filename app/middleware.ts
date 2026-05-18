import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const WRITE_METHODS = ['POST', 'PUT', 'DELETE'];

export function middleware(req: NextRequest) {
  const method = req.method;
  const path = req.nextUrl.pathname;

  if (path.startsWith('/api/') && WRITE_METHODS.includes(method)) {
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = process.env.API_SECRET_KEY;

    if (!expectedKey) {
      return NextResponse.next();
    }

    if (apiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', detail: 'Missing or invalid API key' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
