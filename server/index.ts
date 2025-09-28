import 'dotenv/config';
import express, { type Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { storage } from './storage';
import { scanSignals, executeTrade, getPositions, getMarketData, getBalance, testConnection } from './bybitClient';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + '…';
      log(logLine);
    }
  });

  next();
});

// Health check
app.get('/', (_req: Request, res: Response) => {
  res.send('Trading Backend Running');
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal Server Error';
      res.status(status).json({ message });
      log(`Error: ${status} - ${message}`);
    });

    // Setup Vite for dev or static files for prod
    if (app.get('env') === 'development') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start HTTP server
    server.listen(PORT, '0.0.0.0', () => {
      log(`Server running on http://localhost:${PORT}`);
    });

    // --- Optional: ML / automated trading loop ---
    setInterval(async () => {
      try {
        const status = await storage.getAppStatus();
        if (!status.isAutomatedTradingEnabled) return;

        // Scan for signals
        const signals = await scanSignals();

        // Execute pending signals
        for (const signal of signals) {
          if (signal.status === 'PENDING') {
            try {
              await executeTrade({
                symbol: signal.symbol,
                side: signal.type,
                size: 1, // dynamic sizing logic can be added
                type: 'market',
              });
              log(`[AutomatedTrader] Executed trade: ${signal.symbol} ${signal.type}`);
              // Optionally notify front-end via WebSocket
              // await notifyClients(signal);
            } catch (err) {
              log(`[AutomatedTrader] Failed to execute trade: ${err}`);
            }
          }
        }
      } catch (err) {
        log(`[AutomatedTrader] Error scanning signals: ${err}`);
      }
    }, 15000); // every 15s

  } catch (error) {
    log(`Failed to start server: ${error}`);
    process.exit(1);
  }
})();
