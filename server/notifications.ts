import { Signal, storage } from './storage';
import fetch from 'node-fetch';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WHATSAPP_NUMBER = process.env.WHATSAPP_TO || '';

// Format a single signal block for messaging
function formatSignalBlock(signal: Signal): string {
  return `💹 **${signal.symbol}**\n` +
         `🔹 **${signal.type}** | Score: ${signal.score.toFixed(1)}\n` +
         `🔹 Price: ${signal.price.toFixed(2)} | Confidence: ${signal.confidence}\n` +
         `🔹 Generated: ${signal.timestamp}\n`;
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
      `Price: ${s.price.toFixed(2)} | Confidence: ${s.confidence}`,
      `Generated: ${s.timestamp}`,
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
export async function sendDiscord(signals: Signal[]) {
  if (!DISCORD_WEBHOOK_URL || !signals.length) return;
  const message = signals.slice(0, 5).map(formatSignalBlock).join('\n');
  await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message }),
  });
  const pdfBytes = await generatePDFBytes(signals);
  if (pdfBytes.length) {
    // Discord file upload (requires multipart form-data; simplified here)
    console.log('PDF ready to send to Discord (implement multipart if needed)');
  }
}

// Send to Telegram
export async function sendTelegram(signals: Signal[]) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !signals.length) return;
  const message = signals.slice(0, 5).map(formatSignalBlock).join('\n');
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    body: new URLSearchParams({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' }),
  });
  const pdfBytes = await generatePDFBytes(signals);
  if (pdfBytes.length) {
    console.log('PDF ready to send to Telegram (implement multipart if needed)');
  }
}

// Send to WhatsApp via Web
export function sendWhatsApp(signals: Signal[], toNumber?: string) {
  toNumber = toNumber || WHATSAPP_NUMBER;
  if (!toNumber || !signals.length) return;
  const message = signals.slice(0, 3).map(formatSignalBlock).join('\n');
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${toNumber}?text=${encoded}`;
  console.log(`Open WhatsApp URL: ${url}`); // you can open in browser if needed
}

// Send to all channels
export async function sendAllNotifications(signals: Signal[]) {
  if (!signals.length) return;
  await sendDiscord(signals);
  await sendTelegram(signals);
  sendWhatsApp(signals);
}

// Test notifications
export async function testNotifications() {
  const testSignal: Signal = {
    id: 'test-1',
    symbol: 'BTCUSDT',
    type: 'BUY',
    price: 50000,
    score: 85,
    confidence: 'HIGH',
    status: 'PENDING',
    timestamp: new Date().toISOString(),
  };
  await sendAllNotifications([testSignal]);
}
