import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ETF 策略投资工具',
  description: '全球 ETF 策略推荐、基金匹配与历史回测',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">
        <header className="bg-white border-b px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <h1 className="text-lg font-bold">ETF 策略投资工具</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="hover:text-blue-600">策略</a>
              <a href="/compare" className="hover:text-blue-600">对比</a>
              <a href="/backtest" className="hover:text-blue-600">回测</a>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}
