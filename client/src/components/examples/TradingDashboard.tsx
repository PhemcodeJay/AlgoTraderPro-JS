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
      pnlPercent: 2.67,
      status: "OPEN" as const,
      leverage: 10
    },
    {
      id: "2",
      symbol: "ETHUSDT",
      side: "SELL" as const,
      size: 1.5,
      entryPrice: 3200,
      currentPrice: 3150,
      pnl: 75,
      pnlPercent: 1.56,
      status: "OPEN" as const,
      leverage: 10
    },
    {
      id: "3",
      symbol: "SOLUSDT",
      side: "BUY" as const,
      size: 10,
      entryPrice: 150,
      currentPrice: 145,
      pnl: -50,
      pnlPercent: -3.33,
      status: "OPEN" as const,
      leverage: 10
    }
  ];

  const mockSignals = [
    {
      id: "1",
      symbol: "DOGEUSDT",
      signalType: "BUY" as const,
      entryPrice: 0.08,
      confidence: "HIGH" as const,
      score: 85,
      type: "BUY" as const,
      interval: "15",
      price: 0.08
    },
    {
      id: "2",
      symbol: "ADAUSDT",
      signalType: "SELL" as const,
      entryPrice: 0.45,
      confidence: "MEDIUM" as const,
      score: 72,
      type: "SELL" as const,
      interval: "15",
      price: 0.45
    },
    {
      id: "3",
      symbol: "XRPUSDT",
      signalType: "BUY" as const,
      entryPrice: 0.62,
      confidence: "LOW" as const,
      score: 61,
      type: "BUY" as const,
      interval: "15",
      price: 0.62
    }
  ];

  return (
    <TradingDashboard
      stats={mockStats}
      positions={mockPositions}
      signals={mockSignals}
      isAutomatedTradingEnabled={false}
      onToggleAutomatedTrading={() => console.log('Toggle automated trading')}
      onScanSignals={() => console.log('Scan signals')}
      isScanning={false}
      onClosePosition={() => console.log('Close position')}
    />
  );
}
