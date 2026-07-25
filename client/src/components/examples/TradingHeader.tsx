import TradingHeader from '../TradingHeader';

export default function TradingHeaderExample() {
  return (
    <TradingHeader
      tradingMode="virtual"
      onTradingModeChange={(mode) => console.log('Trading mode changed to:', mode)}
      isConnected={true}
      balance={{
        capital: 10000,
        available: 8500,
        used: 1500
      }}
      onEmergencyStop={() => console.log('Emergency stop triggered')}
      onSettingsClick={() => console.log('Settings clicked')}
    />
  );
}