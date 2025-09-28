import TradingDashboard from '../TradingDashboard';

export default function TradingDashboardExample() {
  // todo: remove mock functionality
  const mockStats = {
    totalPnL: 1250.75,
    winRate: 68,
    totalTrades: 145,
    activePositions: 3
  };

  const mockPositions = [
    {
      id: "1",
      symbol: "BTCUSDT",
      side: "BUY" as const,
      size: 0.1,
      entryPrice: 45000,
      currentPrice: 46200,
      pnl: 120,
      pnlPercent: 2.67
    },
    {
      id: "2", 
      symbol: "ETHUSDT",
      side: "SELL" as const,
      size: 1.5,
      entryPrice: 3200,
      currentPrice: 3150,
      pnl: 75,
      pnlPercent: 1.56
    },
    {
      id: "3",
      symbol: "SOLUSDT", 
      side: "BUY" as const,
      size: 10,
      entryPrice: 150,
      currentPrice: 145,
      pnl: -50,
      pnlPercent: -3.33
    }
  ];

  const mockSignals = [
    {
      id: "1",
      symbol: "DOGEUSDT",
      type: "BUY" as const,
      score: 85,
      price: 0.08,
      confidence: "HIGH" as const
    },
    {
      id: "2",
      symbol: "ADAUSDT", 
      type: "SELL" as const,
      score: 72,
      price: 0.45,
      confidence: "MEDIUM" as const
    },
    {
      id: "3",
      symbol: "XRPUSDT",
      type: "BUY" as const,
      score: 61,
      price: 0.62,
      confidence: "LOW" as const
    }
  ];

  return (
    <TradingDashboard
      stats={mockStats}
      positions={mockPositions}
      signals={mockSignals}
      isAutomatedTradingEnabled={false}
      onToggleAutomatedTrading={() => console.log('Toggle automated trading')}
    />
  );
}