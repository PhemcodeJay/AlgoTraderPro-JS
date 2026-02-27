import { Signal, storage } from './storage';
import fetch from 'node-fetch';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'fs';
import * as dotenv from 'dotenv';
import { IndicatorData } from './indicators';
import FormData from 'form-data';

dotenv.config();

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WHATSAPP_NUMBER = process.env.WHATSAPP_TO || '';

// Format a single signal block for messaging
function formatSignalBlock(signal: Signal): string {
  return `💹 **${signal.symbol}**\n` +
         `🔹 **${signal.type}** | Score: ${signal.score.toFixed(1)}\n` +
         `🔹 Entry: ${signal.entry.toFixed(2)} | Confidence: ${signal.confidence}\n` +
         `🔹 Stop Loss: ${signal.sl.toFixed(2)} | Take Profit: ${signal.tp.toFixed(2)}\n` +
         `🔹 Leverage: ${signal.leverage}x | Risk/Reward: ${signal.risk_reward.toFixed(2)}\n` +
         `🔹 Interval: ${signal.interval} | Market: ${signal.market}\n` +
         `🔹 Generated: ${signal.created_at}\n`;
}

// Generate PDF bytes from signals
export async function generatePDFBytes(signals: Signal[]): Promise<Uint8Array> {
  if (!signals.length) return new Uint8Array();

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;

  let y = 800;

  page.drawText('AlgoTrader Pro - Trading Signals', {
    x: 50,
    y,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  for (let i = 0; i < signals.length && i < 25; i++) {
    const s = signals[i];
    const lines = [
      `Signal #${i + 1}: ${s.symbol}`,
      `Type: ${s.type} | Score: ${s.score.toFixed(1)}`,
      `Entry: ${s.entry.toFixed(2)} | Confidence: ${s.confidence}`,
      `Stop Loss: ${s.sl.toFixed(2)} | Take Profit: ${s.tp.toFixed(2)}`,
      `Leverage: ${s.leverage}x | Risk/Reward: ${s.risk_reward.toFixed(2)}`,
      `Interval: ${s.interval} | Market: ${s.market}`,
      `Generated: ${s.created_at}`,
      '----------------------------------------',
    ];
    for (const line of lines) {
      page.drawText(line, { x: 50, y, size: fontSize, font, color: rgb(0, 0, 0) });
      y -= 12;
    }
    y -= 5;
    if (y < 50) break; // prevent overflow
  }

  return await pdfDoc.save();
}

// Send to Discord
export async function sendDiscord(signals: Signal[]): Promise<void> {
  if (!DISCORD_WEBHOOK_URL || !signals.length) {
    console.warn('[sendDiscord] No webhook URL or signals provided');
    return;
  }

  try {
    const message = signals.slice(0, 5).map(formatSignalBlock).join('\n');
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });

    if (!response.ok) {
      console.error(`[sendDiscord] Failed to send message: ${response.statusText}`);
      return;
    }

    const pdfBytes = await generatePDFBytes(signals);
    if (pdfBytes.length) {
      const formData = new FormData();
      formData.append('file', Buffer.from(pdfBytes), { filename: 'signals.pdf', contentType: 'application/pdf' });
      formData.append('payload_json', JSON.stringify({ content: 'Trading Signals PDF' }));

      const fileResponse = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
          'Content-Length': formData.getLengthSync().toString(),
        },
        body: formData.getBuffer(),
      });

      if (!fileResponse.ok) {
        console.error(`[sendDiscord] Failed to send PDF: ${fileResponse.statusText}`);
      } else {
        console.info('[sendDiscord] PDF sent successfully');
      }
    }
  } catch (err: any) {
    console.error(`[sendDiscord] Error:`, err.message ?? err);
  }
}

// Send to Telegram
export async function sendTelegram(signals: Signal[]): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !signals.length) {
    console.warn('[sendTelegram] Missing bot token, chat ID, or signals');
    return;
  }

  try {
    const message = signals.slice(0, 5).map(formatSignalBlock).join('\n');
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' }),
    });

    if (!response.ok) {
      console.error(`[sendTelegram] Failed to send message: ${response.statusText}`);
      return;
    }

    const pdfBytes = await generatePDFBytes(signals);
    if (pdfBytes.length) {
      const formData = new FormData();
      formData.append('chat_id', TELEGRAM_CHAT_ID);
      formData.append('document', Buffer.from(pdfBytes), { filename: 'signals.pdf', contentType: 'application/pdf' });

      const fileUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
      const fileResponse = await fetch(fileUrl, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
          'Content-Length': formData.getLengthSync().toString(),
        },
        body: formData.getBuffer(),
      });

      if (!fileResponse.ok) {
        console.error(`[sendTelegram] Failed to send PDF: ${fileResponse.statusText}`);
      } else {
        console.info('[sendTelegram] PDF sent successfully');
      }
    }
  } catch (err: any) {
    console.error(`[sendTelegram] Error:`, err.message ?? err);
  }
}

// Send to WhatsApp via Web
export function sendWhatsApp(signals: Signal[], toNumber?: string): void {
  toNumber = toNumber || WHATSAPP_NUMBER;
  if (!toNumber || !signals.length) {
    console.warn('[sendWhatsApp] Missing phone number or signals');
    return;
  }

  try {
    const message = signals.slice(0, 3).map(formatSignalBlock).join('\n');
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${toNumber}?text=${encoded}`;
    console.info(`[sendWhatsApp] WhatsApp URL generated: ${url}`);
    // Note: Actual sending requires opening the URL in a browser or using a WhatsApp API
  } catch (err: any) {
    console.error(`[sendWhatsApp] Error:`, err.message ?? err);
  }
}

// Send to all channels
export async function sendAllNotifications(signals: Signal[]): Promise<void> {
  if (!signals.length) {
    console.warn('[sendAllNotifications] No signals to send');
    return;
  }

  await Promise.all([
    sendDiscord(signals),
    sendTelegram(signals),
    sendWhatsApp(signals),
  ]);
}

// Test notifications
export async function testNotifications(): Promise<void> {
  const testSignal: Signal = {
    id: 'test-1',
    symbol: 'BTCUSDT',
    type: 'BUY',
    price: 50000,
    score: 85,
    confidence: 'HIGH',
    status: 'PENDING',
    timestamp: new Date().toISOString(),
    stopLoss: 49000,
    takeProfit: 52000,
    liquidationPrice: 48500,
    currentMarketPrice: 50000,
    interval: '60',
    signal_type: 'buy',
    indicators: {
      sma20: [],
      sma50: [],
      ema20: [],
      rsi: [],
      macd: { macd: [], signal: [], histogram: [] },
      bollinger: { upper: [], middle: [], lower: [] },
      atr: [],
    },
    entry: 50000,
    sl: 49000,
    tp: 52000,
    trail: 49500,
    liquidation: 48500,
    margin_usdt: 1.0,
    bb_slope: 'Contracting',
    market: 'Normal',
    leverage: 10,
    risk_reward: 2,
    atr_multiplier: 2,
    created_at: new Date().toISOString(),
    signals: ['RSI_OVERSOLD', 'MACD_BULLISH'],
  };

  await sendAllNotifications([testSignal]);
}