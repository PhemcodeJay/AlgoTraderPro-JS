import MarketOverview from '../MarketOverview';

export default function MarketOverviewExample() {
  // todo: remove mock functionality
  const mockMarketData = [
    {
      symbol: "BTCUSDT",
      price: 45123.45,
      change24h: 1205.67,
      changePercent24h: 2.75,
      volume24h: 2847650000,
      high24h: 46200.00,
      low24h: 44800.00
    },
    {
      symbol: "ETHUSDT", 
      price: 3245.78,
      change24h: -87.32,
      changePercent24h: -2.62,
      volume24h: 1654320000,
      high24h: 3350.00,
      low24h: 3200.00
    },
    {
      symbol: "SOLUSDT",
      price: 148.92,
      change24h: 8.45,
      changePercent24h: 6.01,
      volume24h: 245870000,
      high24h: 152.00,
      low24h: 140.00
    },
    {
      symbol: "XRPUSDT",
      price: 0.6234,
      change24h: 0.0156,
      changePercent24h: 2.56,
      volume24h: 189450000,
      high24h: 0.6350,
      low24h: 0.6100
    },
    {
      symbol: "DOGEUSDT",
      price: 0.08756,
      change24h: -0.00234,
      changePercent24h: -2.60,
      volume24h: 156780000,
      high24h: 0.09100,
      low24h: 0.08650
    }
  ];

  return (
    <MarketOverview
      marketData={mockMarketData}
      onSymbolSelect={(symbol) => console.log('Symbol selected:', symbol)}
      selectedSymbol="BTCUSDT"
    />
  );
}