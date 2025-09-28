import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { WebSocketServer } from 'ws';
import { storage } from './storage';
import { bybitWsClient, getMarketData, getPositions, getBalance, scanSignals, executeTrade, testConnection } from './bybitClient';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // --- REST API Routes ---

  app.get('/api/positions', async (req, res) => {
    try {
      const positions = await getPositions();
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch positions' });
    }
  });

  app.get('/api/signals', async (req, res) => {
    try {
      const signals = await storage.getSignals();
      res.json(signals);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch signals' });
    }
  });

  app.post('/api/scan-signals', async (req, res) => {
    try {
      const signals = await scanSignals();
      res.json(signals);
    } catch (error) {
      res.status(500).json({ error: 'Failed to scan signals' });
    }
  });

  app.post('/api/trade', async (req, res) => {
    try {
      const trade = req.body;
      const result = await executeTrade(trade);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to execute trade' });
    }
  });

  app.get('/api/market-data', async (req, res) => {
    try {
      const data = await getMarketData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch market data' });
    }
  });

  app.get('/api/balance', async (req, res) => {
    try {
      const balance = await getBalance();
      res.json(balance);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch balance' });
    }
  });

  app.post('/api/test-connection', async (req, res) => {
    try {
      const success = await testConnection();
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: 'Failed to test connection' });
    }
  });

  // --- Automated trading control ---
  app.post('/api/automated-trading', async (req, res) => {
    try {
      const { enabled } = req.body;
      const status = await storage.getAppStatus();
      await storage.setAppStatus({ ...status, isAutomatedTradingEnabled: enabled });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to toggle automated trading' });
    }
  });

  // --- WebSocket Servers for live updates ---
  const marketWSS = new WebSocketServer({ server: httpServer, path: '/ws/market-data' });
  const positionsWSS = new WebSocketServer({ server: httpServer, path: '/ws/positions' });

  // --- Market data updates ---
  bybitWsClient.on('update', (data: any) => {
    if (data.topic?.startsWith('tickers.')) {
      const update = {
        symbol: data.data.symbol,
        price: parseFloat(data.data.lastPrice),
        change24h: parseFloat(data.data.price24hPcnt),
        changePercent24h: parseFloat(data.data.price24hPcnt) * 100,
        volume24h: parseFloat(data.data.turnover24h),
        high24h: parseFloat(data.data.highPrice24h),
        low24h: parseFloat(data.data.lowPrice24h),
      };
      const marketData = storage.getMarketDataSync();
      const index = marketData.findIndex((d) => d.symbol === update.symbol);
      if (index >= 0) marketData[index] = update;
      else marketData.push(update);
      storage.setMarketData(marketData);

      // Broadcast to clients
      marketWSS.clients.forEach((client) => {
        if (client.readyState === client.OPEN) client.send(JSON.stringify(update));
      });
    }
  });

  bybitWsClient.subscribe(['tickers.BTCUSDT', 'tickers.ETHUSDT']);

  // --- WS client connections ---
  marketWSS.on('connection', (ws) => {
    console.log('Market WS client connected');
    ws.on('close', () => console.log('Market WS client disconnected'));
  });

  positionsWSS.on('connection', (ws) => {
    console.log('Positions WS client connected');
    ws.send(JSON.stringify({ action: 'invalidate' }));
    ws.on('close', () => console.log('Positions WS client disconnected'));
  });

  // --- Poll positions periodically ---
  setInterval(async () => {
    await getPositions();
    positionsWSS.clients.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(JSON.stringify({ action: 'invalidate' }));
    });
  }, 30000); // every 30s

  // --- Automated trading loop ---
  setInterval(async () => {
    const status = await storage.getAppStatus();
    if (!status.isAutomatedTradingEnabled) return;

    const signals = await scanSignals();
    for (const signal of signals) {
      if (signal.status === 'PENDING') {
        try {
          const trade = {
            symbol: signal.symbol,
            side: signal.type,
            size: 1, // You can replace with dynamic sizing logic
            type: 'market' as const,
          };
          await executeTrade(trade);
          console.log(`[AutomatedTrader] Executed trade: ${signal.symbol} ${signal.type}`);
        } catch (err) {
          console.error('[AutomatedTrader] Failed to execute trade:', err);
        }
      }
    }
  }, 15000); // scan every 15s

  return httpServer;
}
