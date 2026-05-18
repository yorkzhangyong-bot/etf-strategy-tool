import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: 'npm run build',
  framework: 'nextjs',
  functions: {
    'api/py/backtest-engine.py': {
      maxDuration: 300,
      memory: 1024,
    },
    'api/py/strategy-engine.py': {
      maxDuration: 60,
      memory: 512,
    },
    'api/py/data-fetcher.py': {
      maxDuration: 30,
      memory: 256,
    },
  },
  crons: [
    { path: '/api/data/refresh', schedule: '0 6 * * *' }
  ],
};
