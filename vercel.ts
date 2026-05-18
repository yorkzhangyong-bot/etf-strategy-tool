import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: 'npm run build',
  framework: 'nextjs',
  functions: {
    'functions/backtest-engine/index.py': {
      maxDuration: 300,
      memory: 1024,
    },
    'functions/strategy-engine/index.py': {
      maxDuration: 60,
      memory: 512,
    },
    'functions/data-fetcher/index.py': {
      maxDuration: 30,
      memory: 256,
    },
  },
  crons: [
    { path: '/api/data/refresh', schedule: '0 6 * * *' }
  ],
};
