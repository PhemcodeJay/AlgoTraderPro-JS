// routes.ts
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

  app.get('/api/app-status', async (req, res) => {
    try {
      const status = await storage.getAppStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch app status' });
    }
  });

  app.post('/api/app-status', async (req, res) => {
    try {
      const status = req.body;
      await storage.setAppStatus(status);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update app status' });
    }
  });

  app.get('/api/api-config', async (req, res) => {
    try {
      const config = await storage.getApiConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch API config' });
    }
  });

  app.post('/api/api-config', async (req, res) => {
    try {
      const config = req.body;
      await storage.setApiConfig(config);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save API config' });
    }
  });

  app.get('/api/notification-config', async (req, res) => {
    try {
      const config = await storage.getNotificationConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notification config' });
    }
  });

  app.post('/api/notification-config', async (req, res) => {
    try {
      const config = req.body;
      await storage.setNotificationConfig(config);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save notification config' });
    }
  });

  app.get('/api/trading-config', async (req, res) => {
    try {
      const config = await storage.getTradingConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch trading config' });
    }
  });

  app.post('/api/trading-config', async (req, res) => {
    try {
      const config = req.body;
      await storage.setTradingConfig(config);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save trading config' });
    }
  });

  app.get('/api/connection-status', async (req, res) => {
    try {
      const status = await storage.getConnectionStatus();
      res.json({ status });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch connection status' });
    }
  });

  // --- WebSocket Servers for live updates ---
  const marketWSS = new WebSocketServer({ server: httpServer, path: '/ws/market-data' });
  const positionsWSS = new WebSocketServer({ server: httpServer, path: '/ws/positions' });

  // --- Market data updates ---
  bybitWsClient.on('update', async (data: any) => {
    if (data.topic?.startsWith('tickers.')) {
      try {
        const update = {
          symbol: data.data.symbol,
          price: parseFloat(data.data.lastPrice) || 0,
          change24h: parseFloat(data.data.price24hPcnt) || 0,
          changePercent24h: parseFloat(data.data.price24hPcnt) * 100 || 0,
          volume24h: parseFloat(data.data.turnover24h) || 0,
          high24h: parseFloat(data.data.highPrice24h) || 0,
          low24h: parseFloat(data.data.lowPrice24h) || 0,
        };
        const marketData = await storage.getMarketData();
        const index = marketData.findIndex((d) => d.symbol === update.symbol);
        if (index >= 0) marketData[index] = update;
        else marketData.push(update);
        await storage.setMarketData(marketData);

        // Broadcast to clients
        marketWSS.clients.forEach((client) => {
          if (client.readyState === client.OPEN) client.send(JSON.stringify(update));
        });
      } catch (err) {
        console.error('[WebSocket] Error broadcasting market data:', err);
      }
    }
  });

  bybitWsClient.subscribe(['tickers.BTCUSDT', 'tickers.ETHUSDT']);

  // --- WS client connections ---
  marketWSS.on('connection', (ws) => {
    console.log('Market WS client connected');
    ws.on('close', () => console.log('Market WS client disconnected'));
  });

  positionsWSS.on('connection', async (ws) => {
    console.log('Positions WS client connected');
    try {
      const positions = await storage.getPositions();
      ws.send(JSON.stringify({ action: 'update', data: positions }));
    } catch (err) {
      console.error('[WebSocket] Error sending initial positions:', err);
    }
    ws.on('close', () => console.log('Positions WS client disconnected'));
  });

  // --- Poll positions periodically ---
  setInterval(async () => {
    try {
      const positions = await getPositions();
      positionsWSS.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ action: 'update', data: positions }));
        }
      });
    } catch (err) {
      console.error('[WebSocket] Error polling positions:', err);
    }
  }, 30000); // every 30s

  return httpServer;
}