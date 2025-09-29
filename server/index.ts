// ✅ Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { storage } from './storage';
import { startAutomatedTrading } from './automatedTrader';

// ✅ Handle uncaught exceptions and rejections to prevent process exit
process.on('uncaughtException', (error) => {
  log(`[Uncaught Exception] ${error.message}\n${error.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`[Unhandled Rejection] at: ${promise} reason: ${reason}`);
});

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// ✅ Create the server BEFORE anything else that needs it
const server = http.createServer(app);

// Middleware
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:8000',
      'http://localhost:3000',
      'http://0.0.0.0:5000',
      'http://0.0.0.0:8000',
      process.env.FRONTEND_URL || 'http://localhost:3000',
      /\.replit\.app$/,
      /\.repl\.co$/
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
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
      if (capturedJsonResponse)
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
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
    // ✅ Initialize storage with error handling
    try {
      await storage.init();
    } catch (error: any) {
      log(`[Storage] Failed to initialize: ${error.message}, using in-memory defaults`);
      // Optionally, initialize in-memory storage explicitly if needed
    }

    await registerRoutes(app);

    // Global error handler for Express middleware
    app.use(
      (err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || 'Internal Server Error';
        const stack =
          process.env.NODE_ENV === 'development' ? err.stack : undefined;
        res.status(status).json({ message, stack });
        log(
          `[Error] ${status} - ${message}${stack ? `\n${stack}` : ''}`
        );
      }
    );

    if (process.env.NODE_ENV === 'development') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ✅ Start listening
    server.listen(PORT, '0.0.0.0', () => {
      log(`Server running on http://0.0.0.0:${PORT}`);
    });

    // ✅ Start automated trading with error handling
    const status = await storage.getAppStatus();
    if (status.isAutomatedTradingEnabled) {
      log(
        `[Server] Starting automated trading in ${
          status.tradingMode || 'virtual'
        } mode`
      );
      try {
        await startAutomatedTrading(status.tradingMode || 'virtual');
      } catch (error: any) {
        log(`[AutomatedTrading] Failed to start: ${error.message}`);
        // Continue running the server even if automated trading fails
      }
    }
  } catch (error: any) {
    log(`[Server] Failed to start server: ${error.message ?? error}`);
    process.exit(1); // Exit only if server setup fails
  }
})();