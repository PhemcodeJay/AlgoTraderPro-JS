import { storage, Signal, Position, Balance } from './storage';
import { bybitRestClient } from './bybitClient';
import { randomUUID } from 'crypto';

// Execute a trade based on a signal
export async function executeTrade(signal: Signal, mode: 'virtual' | 'real' = 'virtual'): Promise<Position | null> {
  try {
    // Fetch current balance
    const balance: Balance = await storage.getBalance();
    if (balance.available < signal.margin_usdt) {
      console.warn(`[executeTrade] Insufficient balance to execute trade for ${signal.symbol}. Required: ${signal.margin_usdt}, Available: ${balance.available}`);
      return null;
    }

    // Fetch trading configuration
    const tradingConfig = await storage.getTradingConfig();

    // Calculate position size using signal's margin and leverage
    const size = (signal.margin_usdt / signal.entry) * signal.leverage;

    // Create Position object with enhanced signal properties
    const position: Position = {
      id: randomUUID(),
      symbol: signal.symbol,
      side: signal.type,
      size: parseFloat(size.toFixed(6)),
      leverage: signal.leverage,
      entryPrice: signal.entry,
      stopLoss: signal.sl,
      takeProfit: signal.tp,
      liquidationPrice: signal.liquidation,
      trailingStop: signal.trail,
      currentPrice: signal.currentMarketPrice,
      pnl: 0,
      pnlPercent: 0,
      status: 'OPEN',
      openTime: signal.created_at,
    };

    if (mode === 'virtual') {
      // Virtual trade: store position directly
      await storage.addPosition(position);
    } else {
      // Real trade: submit order to Bybit with stop-loss and take-profit
      const orderResponse = await bybitRestClient.submitOrder({
        category: 'linear',
        symbol: signal.symbol,
        side: signal.type === 'BUY' ? 'Buy' : 'Sell',
        orderType: 'Market',
        qty: size.toString(),
        stopLoss: signal.sl.toString(),
        takeProfit: signal.tp.toString(),
        // Note: Bybit API may require additional parameters for trailing stop
      });

      if (
          !orderResponse.result ||
          (orderResponse.result as any).orderStatus !== 'Filled'
        ) {
          console.error(`[executeTrade] Real trade failed for ${signal.symbol}: ${JSON.stringify(orderResponse)}`);
          return null;
        }


      // Update position with executed price from Bybit
      // Safely extract avgPrice without TypeScript errors
      const avgPrice =
        (orderResponse.result as any)?.avgPrice ??
        signal.entry.toString();

      const executedPrice = parseFloat(avgPrice);

      position.entryPrice = isNaN(executedPrice)
        ? signal.entry
        : executedPrice;

      await storage.addPosition(position);

    }

    // Update balance
    const used = balance.used + signal.margin_usdt;
    const available = balance.available - signal.margin_usdt;
    await storage.setBalance({ ...balance, used, available });

    // Update the executed signal in storage
    const allSignals = await storage.getSignals();
    const updatedSignals: Signal[] = allSignals.map((s) =>
      s.id === signal.id
        ? { ...s, status: 'EXECUTED' as const, executedPrice: position.entryPrice }
        : s
    );
    await storage.setSignals(updatedSignals);

    console.info(`[executeTrade] Trade executed for ${signal.symbol} (${mode}) - Size: ${size}, Entry: ${position.entryPrice}, SL: ${signal.sl}, TP: ${signal.tp}`);
    return position;
  } catch (err: any) {
    console.error(`[executeTrade] Error executing trade for ${signal.symbol}:`, err.message ?? err);
    return null;
  }
}