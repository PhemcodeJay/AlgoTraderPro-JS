import TradeExecutionPanel from '../TradeExecutionPanel';

export default function TradeExecutionPanelExample() {
  // todo: remove mock functionality
  return (
    <TradeExecutionPanel
      selectedSymbol="BTCUSDT"
      currentPrice={45123.45}
      balance={{
        available: 2500.00,
        used: 1500.00
      }}
      onExecuteTrade={(trade) => console.log('Execute trade:', trade)}
    />
  );
}