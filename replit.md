# AlgoTrader Pro

## Overview

AlgoTrader Pro is a professional algorithmic trading platform that provides real-time market analysis, automated trading capabilities, and comprehensive portfolio management. The platform integrates with Bybit exchange for live trading and market data, supporting both virtual (paper trading) and real trading modes.

Key features include:
- Real-time trading dashboard with live market data
- Automated trading bot with customizable strategies
- AI-powered trading signal generation with confidence scoring
- Portfolio analytics and performance tracking
- Risk management with stop-loss, take-profit, and emergency stop functionality
- Multi-channel notifications (Discord, Telegram, WhatsApp)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React 18 with TypeScript**: Single-page application using functional components and hooks
- **Vite**: Build tool and development server running on port 8000
- **Tailwind CSS with shadcn/ui**: Component library built on Radix UI primitives for accessible, consistent UI
- **React Query**: Server state management for API data fetching and caching
- **Recharts**: Data visualization for trading analytics and charts

The frontend lives in `/client` with the main entry at `/client/src/main.tsx`. Components are organized into:
- `/client/src/components/` - Main application components (TradingDashboard, SettingsPanel, etc.)
- `/client/src/components/ui/` - Reusable shadcn/ui components
- `/client/src/components/examples/` - Example implementations with mock data

### Backend Architecture
- **Express.js with TypeScript**: REST API server running on port 3000
- **File-based storage**: JSON storage in `/server/data.json` for configuration and state
- **WebSocket**: Real-time data streaming for market updates

Key backend modules:
- `/server/routes.ts` - REST API endpoints
- `/server/bybitClient.ts` - Bybit exchange integration (REST and WebSocket)
- `/server/automatedTrader.ts` - Automated trading loop logic
- `/server/indicators.ts` - Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR)
- `/server/ml.ts` - ML-based signal filtering and scoring
- `/server/scanSignals.ts` - Market scanning and signal generation
- `/server/storage.ts` - Data persistence layer
- `/server/notifications.ts` - Multi-channel notification system

### Data Flow
1. Frontend makes API calls to `/api/*` endpoints
2. Vite proxies requests to Express backend on port 3000
3. Backend fetches data from Bybit exchange or local storage
4. Real-time updates pushed via WebSocket connections

### Trading Modes
- **Virtual Mode**: Paper trading with simulated balance, no real orders
- **Real Mode**: Live trading through Bybit API with actual funds

## External Dependencies

### Exchange Integration
- **Bybit API**: Primary exchange for market data and order execution
  - REST API for orders, positions, and market data
  - WebSocket for real-time price streams
  - Supports both mainnet and testnet environments
  - Configured via `BYBIT_API_KEY`, `BYBIT_API_SECRET`, and `BYBIT_MAINNET` environment variables

### Database
- **PostgreSQL with Drizzle ORM**: Database schema defined in `/shared/schema.ts`
  - Tables: trades, signals, settings, wallet_balances, users
  - Connection via `DATABASE_URL` environment variable
  - Neon serverless adapter for connection pooling

### Notification Services
- **Discord**: Webhook-based notifications
- **Telegram**: Bot API integration
- **WhatsApp**: Message delivery support
- **PDF Generation**: pdf-lib for generating signal reports

### Key NPM Packages
- `bybit-api`: Official Bybit SDK for exchange integration
- `drizzle-orm` + `drizzle-kit`: Type-safe database ORM
- `@neondatabase/serverless`: Serverless Postgres adapter
- `@tanstack/react-query`: Data fetching and caching
- `recharts`: Trading charts and analytics visualization
- `zod`: Runtime type validation for API schemas