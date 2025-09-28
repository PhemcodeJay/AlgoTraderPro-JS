import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { WebSocketServer } from 'ws';
import { storage } from './storage';
import { bybitWsClient, getMarketData, getPositions, getBalance, scanSignals, executeTrade, testConnection } from './bybitClient';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // API Routes (prefixed with /api)
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

  app.get('/api/status', async (req, res) => {
    try {
      const status = await storage.getAppStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch app status' });
    }
  });

  app.post('/api/automated-trading', async (req, res) => {
    try {
      const { enabled } = req.body;
      await storage.setAppStatus({ ...await storage.getAppStatus(), isAutomatedTradingEnabled: enabled });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to toggle automated trading' });
    }
  });

  app.post('/api/trading-mode', async (req, res) => {
    try {
      const { mode } = req.body;
      await storage.setAppStatus({ ...await storage.getAppStatus(), tradingMode: mode });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to change trading mode' });
    }
  });

  app.get('/api/settings/api', async (req, res) => {
    try {
      const config = await storage.getApiConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch API config' });
    }
  });

  app.post('/api/settings/api', async (req, res) => {
    try {
      await storage.setApiConfig(req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save API config' });
    }
  });

  app.get('/api/settings/notify', async (req, res) => {
    try {
      const config = await storage.getNotificationConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notification config' });
    }
  });

  app.post('/api/settings/notify', async (req, res) => {
    try {
      await storage.setNotificationConfig(req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save notification config' });
    }
  });

  app.get('/api/settings/trade', async (req, res) => {
    try {
      const config = await storage.getTradingConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch trading config' });
    }
  });

  app.post('/api/settings/trade', async (req, res) => {
    try {
      await storage.setTradingConfig(req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save trading config' });
    }
  });

  app.post('/api/test-connection', async (req, res) => {
    try {
      await testConnection();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to test connection' });
    }
  });

  app.post('/api/emergency-stop', async (req, res) => {
    try {
      await storage.setAppStatus({ tradingMode: 'virtual', isAutomatedTradingEnabled: false });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to activate emergency stop' });
    }
  });

  // User routes (example, if needed)
  app.post('/api/users', async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  app.get('/api/users/:id', async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (user) res.json(user);
      else res.status(404).json({ error: 'User not found' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  // WebSocket Setup
  const marketWSS = new WebSocketServer({ server: httpServer, path: '/ws/market-data' });
  const positionsWSS = new WebSocketServer({ server: httpServer, path: '/ws/positions' });

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
      // Update storage
      const marketData = storage.getMarketDataSync(); // Synchronous helper
      const index = marketData.findIndex((d) => d.symbol === update.symbol);
      if (index >= 0) {
        marketData[index] = update;
      } else {
        marketData.push(update);
      }
      storage.setMarketData(marketData);
      // Broadcast to clients
      marketWSS.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(update));
        }
      });
    }
  });

  bybitWsClient.subscribe(['tickers.BTCUSDT', 'tickers.ETHUSDT']);

  marketWSS.on('connection', (ws) => {
    console.log('Market WS client connected');
    ws.on('close', () => console.log('Market WS client disconnected'));
  });

  positionsWSS.on('connection', (ws) => {
    console.log('Positions WS client connected');
    ws.send(JSON.stringify({ action: 'invalidate' }));
    ws.on('close', () => console.log('Positions WS client disconnected'));
  });

  // Poll positions to trigger updates
  setInterval(async () => {
    await getPositions();
    positionsWSS.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ action: 'invalidate' }));
      }
    });
  }, 60000);

  return httpServer;
}