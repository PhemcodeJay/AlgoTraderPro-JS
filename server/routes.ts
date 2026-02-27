import type { Express, Request, Response } from 'express';
import { createServer, type Server } from 'http';
import { WebSocketServer } from 'ws';
import { storage, Signal } from './storage';
import { getMarketData, getPositions, getBalance, executeTrade, testConnection, bybitWsClient, closePosition } from './bybitClient';
import { scanSignals } from './scanSignals';
import { startAutomatedTrading, stopAutomatedTrading } from './automatedTrader';
import { sendAllNotifications } from './notifications';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.get('/api/market-data', async (req: Request, res: Response) => {
    const symbols = req.query.symbols ? (req.query.symbols as string).split(',') : undefined;
    res.json(await getMarketData(symbols));
  });

  app.get('/api/positions', async (_req, res) => res.json(await getPositions()));
  app.get('/api/balance', async (_req, res) => res.json(await getBalance()));

  app.get('/api/signals', async (req: Request, res: Response) => {
    try {
      const interval = (req.query.interval as string) || '60';
      const signals = await storage.getSignals();
      
      // Filter by interval AND check if they are "fresh" (e.g., within last 5 minutes)
      const now = new Date().getTime();
      const filtered = signals.filter(s => {
        const signalTime = new Date(s.timestamp).getTime();
        return s.interval === interval && (now - signalTime) < 5 * 60 * 1000;
      });
      
      // If no fresh signals found for this interval, trigger a scan
      if (filtered.length === 0) {
        const status = await storage.getAppStatus();
        const newSignals = await scanSignals(interval as any, 10, status.tradingMode);
        return res.json(newSignals);
      }
      res.json(filtered);
    } catch (err: any) {
      console.error('API /api/signals error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/scan-signals', async (req, res) => {
    const { interval = '60' } = req.body;
    const status = await storage.getAppStatus();
    const signals = await scanSignals(interval as any, 10, status.tradingMode);
    await sendAllNotifications(signals);
    res.json(signals);
  });

  app.post('/api/trade', async (req, res) => {
    const status = await storage.getAppStatus();
    res.json(await executeTrade(req.body, status.tradingMode));
  });

  app.post('/api/close-position', async (req, res) => {
    const { id } = req.body;
    const status = await storage.getAppStatus();
    res.json(await closePosition(id, status.tradingMode));
  });

  app.post('/api/test-connection', async (_req, res) => res.json({ success: await testConnection() }));

  app.post('/api/automated-trading', async (req, res) => {
    const { enabled, mode = 'virtual' } = req.body;
    enabled ? await startAutomatedTrading(mode) : await stopAutomatedTrading();
    res.json({ success: true });
  });

  app.get('/api/app-status', async (_req, res) => res.json(await storage.getAppStatus()));
  app.post('/api/app-status', async (req, res) => {
    await storage.setAppStatus(req.body);
    res.json({ success: true });
  });

  app.get('/api/api-config', async (_req, res) => res.json(await storage.getApiConfig()));
  app.post('/api/api-config', async (req, res) => {
    await storage.setApiConfig(req.body);
    res.json({ success: true });
  });

  app.get('/api/trading-config', async (_req, res) => res.json(await storage.getTradingConfig()));
  app.post('/api/trading-config', async (req, res) => {
    await storage.setTradingConfig(req.body);
    res.json({ success: true });
  });

  app.get('/api/export-pdf', async (_req, res) => {
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 800]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      const positions = await storage.getPositions();
      const signals = await storage.getSignals();
      
      page.drawText('AlgoTrader Pro - Trading Report', { x: 50, y: 750, size: 20, font: boldFont });
      page.drawText(`Generated: ${new Date().toLocaleString()}`, { x: 50, y: 730, size: 10, font });

      let y = 700;
      page.drawText('Open Positions', { x: 50, y, size: 15, font: boldFont });
      y -= 25;

      if (positions.length === 0) {
        page.drawText('No open positions.', { x: 50, y, size: 12, font });
        y -= 20;
      } else {
        positions.forEach(p => {
          if (y < 100) return;
          page.drawText(`${p.symbol} ${p.side} ${p.size} @ $${p.entryPrice.toFixed(2)} (PNL: $${p.pnl.toFixed(2)})`, { x: 50, y, size: 10, font });
          y -= 15;
        });
      }

      y -= 20;
      page.drawText('Recent Signals', { x: 50, y, size: 15, font: boldFont });
      y -= 25;

      if (signals.length === 0) {
        page.drawText('No signals found.', { x: 50, y, size: 12, font });
      } else {
        signals.slice(0, 20).forEach(s => {
          if (y < 50) return;
          page.drawText(`${s.symbol} ${s.type} @ $${s.price.toFixed(2)} - Score: ${s.score.toFixed(1)}% (${s.interval}m)`, { x: 50, y, size: 10, font });
          y -= 15;
        });
      }

      const pdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=trading_report.pdf');
      res.send(Buffer.from(pdfBytes));
    } catch (err: any) {
      console.error('PDF generation error:', err);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });

  const marketWSS = new WebSocketServer({ server: httpServer, path: '/ws/market-data' });
  bybitWsClient.on('update', (data: any) => {
    if (data.topic?.startsWith('tickers.')) {
      marketWSS.clients.forEach(c => c.readyState === c.OPEN && c.send(JSON.stringify(data.data)));
    }
  });

  return httpServer;
}
