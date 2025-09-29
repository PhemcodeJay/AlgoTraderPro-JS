import type { Express, Request, Response } from 'express';
import { createServer, type Server } from 'http';
import { WebSocketServer } from 'ws';
import { storage, Signal, Position, MarketData, Balance } from './storage';
import { bybitWsClient, getMarketData, getPositions, getBalance, scanSignals, executeTrade, testConnection } from './bybitClient';
import { startAutomatedTrading, stopAutomatedTrading } from './automatedTrader';
import { sendAllNotifications } from './notifications';

interface TradeRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  type: 'market' | 'limit';
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface ScanSignalsRequest {
  interval?: string;
  limit?: number;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // --- REST API Routes ---
  app.get('/api/positions', async (req: Request, res: Response) => {
    try {
      const positions = await getPositions();
      res.json(positions);
    } catch (error: any) {
      console.error('[Routes] Failed to fetch positions:', error.message ?? error);
      res.status(500).json({ error: 'Failed to fetch positions' });
    }
  });

  app.get('/api/signals', async (req: Request, res: Response) => {
    try {
      const signals = await storage.getSignals();
      res.json(signals);
    } catch (error: any) {
      console.error('[Routes] Failed to fetch signals:', error.message ?? error);
      res.status(500).json({ error: 'Failed to fetch signals' });
    }
  });

  app.post('/api/scan-signals', async (req: Request<{}, {}, ScanSignalsRequest>, res: Response) => {
    try {
      const { interval = '15', limit = 50 } = req.body;
      if (!interval || typeof interval !== 'string' || !limit || typeof limit !== 'number') {
        return res.status(400).json({ error: 'Invalid interval or limit' });
      }
      const signals = await scanSignals(interval, limit);
      await sendAllNotifications(signals); // Trigger notifications
      res.json(signals);
    } catch (error: any) {
      console.error('[Routes] Failed to scan signals:', error.message ?? error);
      res.status(500).json({ error: 'Failed to scan signals' });
    }
  });

  app.post('/api/trade', async (req: Request<{}, {}, TradeRequest>, res: Response) => {
    try {
      const trade = req.body;
      if (!trade.symbol || !trade.side || !['BUY', 'SELL'].includes(trade.side) || !trade.size || !['market', 'limit'].includes(trade.type)) {
        return res.status(400).json({ error: 'Invalid trade parameters' });
      }
      const result = await executeTrade(trade);
      res.json(result);
    } catch (error: any) {
      console.error('[Routes] Failed to execute trade:', error.message ?? error);
      res.status(500).json({ error: 'Failed to execute trade' });
    }
  });

  app.get('/api/market-data', async (req: Request, res: Response) => {
    try {
      const data = await getMarketData();
      res.json(data);
    } catch (error: any) {
      console.error('[Routes] Failed to fetch market data:', error.message ?? error);
      res.status(500).json({ error: 'Failed to fetch market data' });
    }
  });

  app.get('/api/balance', async (req: Request, res: Response) => {
    try {
      const balance = await getBalance();
      res.json(balance);
    } catch (error: any) {
      console.error('[Routes] Failed to fetch balance:', error.message ?? error);
      res.status(500).json({ error: 'Failed to fetch balance' });
    }
  });

  app.post('/api/test-connection', async (req: Request, res: Response) => {
    try {
      const success = await testConnection();
      res.json({ success });
    } catch (error: any) {
      console.error('[Routes] Failed to test connection:', error.message ?? error);
      res.status(500).json({ error: 'Failed to test connection' });
    }
  });

  app.post('/api/automated-trading', async (req: Request<{}, {}, { enabled: boolean; mode?: 'virtual' | 'real' }>, res: Response) => {
    try {
      const { enabled, mode = 'virtual' } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid enabled parameter' });
      }
      if (enabled) {
        await startAutomatedTrading(mode);
      } else {
        await stopAutomatedTrading();
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Routes] Failed to toggle automated trading:', error.message ?? error);
      res.status(500).json({ error: 'Failed to toggle automated trading' });
    }
  });

  app.get('/api/app-status', async (req: Request, res: Response) => {
    try {
      const status = await storage.getAppStatus();
      res.json(status);
    } catch (error: any) {
      console.error('[Routes] Failed to fetch app status:', error.message ?? error);
      res.status(500).json({ error: 'Failed to fetch app status' });
    }
  });

  app.post('/api/app-status', async (req: Request, res: Response) => {
    try {
      const status = req.body;
      await storage.setAppStatus(status);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Routes] Failed to update app status:', error.message ?? error);
      res.status(500).json({ error: 'Failed to update app status' });
    }
  });

  app.get('/api/api-config', async (req: Request, res: Response) => {
    try {
      const config = await storage.getApiConfig();
      res.json(config);
    } catch (error: any) {
      console.error('[Routes] Failed to fetch API config:', error.message ?? error);
      res.status(500).json({ error: 'Failed to fetch API config' });
    }
  });

  app.post('/api/api-config', async (req: Request, res: Response) => {
    try {
      const config = req.body;
      await storage.setApiConfig(config);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Routes] Failed to save API config:', error.message ?? error);
      res.status(500).json({ error: 'Failed to save API config' });
    }
  });

  app.get('/api/notification-config', async (req: Request, res: Response) => {
    try {
      const config = await storage.getNotificationConfig();
      res.json(config);
    } catch (error: any) {
      console.error('[Routes] Failed to fetch notification config:', error.message ?? error);
      res.status(500).json({ error: 'Failed to fetch notification config' });
    }
  });

  app.post('/api/notification-config', async (req: Request, res: Response) => {
    try {
      const config = req.body;
      await storage.setNotificationConfig(config);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Routes] Failed to save notification config:', error.message ?? error);
      res.status(500).json({ error: 'Failed to save notification config' });
    }
  });

  app.get('/api/trading-config', async (req: Request, res: Response) => {
    try {
      const config = await storage.getTradingConfig();
      res.json(config);
    } catch (error: any) {
      console.error('[Routes] Failed to fetch trading config:', error.message ?? error);
      res.status(500).json({ error: 'Failed to fetch trading config' });
    }
  });

  app.post('/api/trading-config', async (req: Request, res: Response) => {
    try {
      const config = req.body;
      await storage.setTradingConfig(config);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Routes] Failed to save trading config:', error.message ?? error);
      res.status(500).json({ error: 'Failed to save trading config' });
    }
  });

  app.get('/api/connection-status', async (req: Request, res: Response) => {
    try {
      const status = await storage.getConnectionStatus();
      res.json({ status });
    } catch (error: any) {
      console.error('[Routes] Failed to fetch connection status:', error.message ?? error);
      res.status(500).json({ error: 'Failed to fetch connection status' });
    }
  });

  app.post('/api/send-notifications', async (req: Request<{}, {}, { signals?: Signal[] }>, res: Response) => {
    try {
      const { signals = await storage.getSignals() } = req.body;
      await sendAllNotifications(signals);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Routes] Failed to send notifications:', error.message ?? error);
      res.status(500).json({ error: 'Failed to send notifications' });
    }
  });

  // --- WebSocket Servers for live updates ---
  const marketWSS = new WebSocketServer({ server: httpServer, path: '/ws/market-data' });
  const positionsWSS = new WebSocketServer({ server: httpServer, path: '/ws/positions' });
  const signalsWSS = new WebSocketServer({ server: httpServer, path: '/ws/signals' });

  // --- Market data updates ---
  bybitWsClient.on('update', async (data: any) => {
    if (data.topic?.startsWith('tickers.')) {
      try {
        const update: MarketData = {
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
      } catch (err: any) {
        console.error('[WebSocket] Error broadcasting market data:', err.message ?? err);
      }
    }
  });

  // --- WS client connections ---
  marketWSS.on('connection', (ws) => {
    console.log('[WebSocket] Market WS client connected');
    ws.on('close', () => console.log('[WebSocket] Market WS client disconnected'));
  });

  positionsWSS.on('connection', async (ws) => {
    console.log('[WebSocket] Positions WS client connected');
    try {
      const positions = await storage.getPositions();
      ws.send(JSON.stringify({ action: 'update', data: positions }));
    } catch (err: any) {
      console.error('[WebSocket] Error sending initial positions:', err.message ?? err);
    }
    ws.on('close', () => console.log('[WebSocket] Positions WS client disconnected'));
  });

  signalsWSS.on('connection', async (ws) => {
    console.log('[WebSocket] Signals WS client connected');
    try {
      const signals = await storage.getSignals();
      ws.send(JSON.stringify({ action: 'update', data: signals }));
    } catch (err: any) {
      console.error('[WebSocket] Error sending initial signals:', err.message ?? err);
    }
    ws.on('close', () => console.log('[WebSocket] Signals WS client disconnected'));
  });

  // --- Poll positions and signals periodically ---
  setInterval(async () => {
    try {
      const positions = await getPositions();
      positionsWSS.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ action: 'update', data: positions }));
        }
      });

      const signals = await storage.getSignals();
      signalsWSS.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ action: 'update', data: signals }));
        }
      });
    } catch (err: any) {
      console.error('[WebSocket] Error polling positions or signals:', err.message ?? err);
    }
  }, 30000); // every 30s

  return httpServer;
}