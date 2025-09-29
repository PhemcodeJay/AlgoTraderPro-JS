import 'dotenv/config';
import express, { type Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { storage } from './storage';
import { startAutomatedTrading } from './automatedTrader';

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', // Vite dev server
    process.env.FRONTEND_URL || 'http://localhost:3000', // Production frontend
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' })); // Increased limit for large signal arrays
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
    if (path.startsWith('/api') || path.startsWith('/ws')) {
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
  res.send('AlgoTraderPro Backend Running');
});

(async () => {
  try {
    // Initialize storage
    await storage.init();

    // Register routes and WebSocket servers
    const server = await registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal Server Error';
      const stack = process.env.NODE_ENV === 'development' ? err.stack : undefined;
      res.status(status).json({ message, stack });
      log(`[Error] ${status} - ${message}${stack ? `\n${stack}` : ''}`);
    });

    // Setup Vite for dev or static files for prod
    if (process.env.NODE_ENV === 'development') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start HTTP server
    server.listen(PORT, '0.0.0.0', () => {
      log(`Server running on http://localhost:${PORT}`);
    });

    // Start automated trading if enabled
    const status = await storage.getAppStatus();
    if (status.isAutomatedTradingEnabled) {
      log(`[Server] Starting automated trading in ${status.tradingMode || 'virtual'} mode`);
      await startAutomatedTrading(status.tradingMode || 'virtual');
    }
  } catch (error: any) {
    log(`[Server] Failed to start server: ${error.message ?? error}`);
    process.exit(1);
  }
})();