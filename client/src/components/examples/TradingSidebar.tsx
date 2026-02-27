import TradingSidebar from '../TradingSidebar';

export default function TradingSidebarExample() {
  // todo: remove mock functionality
  const mockStats = {
    activePositions: 3,
    pendingSignals: 7,
    dailyPnL: 245.75,
    isAutomatedTradingEnabled: true
  };

  return (
    <TradingSidebar
      currentPage="dashboard"
      onPageChange={(page) => console.log('Page changed to:', page)}
      stats={mockStats}
    />
  );
}