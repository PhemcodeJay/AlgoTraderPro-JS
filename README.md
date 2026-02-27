
# AlgoTrader Pro - Advanced Trading Platform

A sophisticated algorithmic trading platform built with React, TypeScript, and a modern tech stack. This platform provides real-time market analysis, automated trading capabilities, and comprehensive portfolio management.

## 🚀 Features

- **Real-time Trading Dashboard** - Live market data and position monitoring
- **Automated Trading Bot** - Algorithmic trading with customizable strategies
- **Signal Generation** - AI-powered trading signals with confidence scoring
- **Portfolio Analytics** - Comprehensive performance tracking and analytics
- **Risk Management** - Built-in risk controls and emergency stop functionality
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Virtual Trading Mode** - Practice trading without real money
- **Market Overview** - Real-time market data and trends

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible UI components
- **Recharts** - Data visualization for analytics
- **Framer Motion** - Smooth animations
- **React Query** - Server state management

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **TypeScript** - Type-safe backend development
- **Drizzle ORM** - Database ORM
- **WebSocket** - Real-time data streaming

### Development Tools
- **Vite** - Fast build tool and development server
- **ESBuild** - Fast JavaScript bundler
- **PostCSS** - CSS processing
- **Replit** - Cloud development environment

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Quick Start on Replit

1. **Fork this Repl** or **Import from GitHub**:
   ```
   https://github.com/your-username/algotrader-pro
   ```

2. **Install Dependencies** (automatically handled by Replit):
   ```bash
   npm install
   ```

3. **Start the Development Server**:
   Click the **Run** button in Replit, or use:
   ```bash
   npm run dev
   ```

4. **Access the Application**:
   - The app will be available at the Replit-provided URL
   - Default port: 5000 (automatically configured)

### Local Development Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/algotrader-pro.git
   cd algotrader-pro
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   ```bash
   # No additional environment variables needed for demo mode
   # For live trading, you'll need API keys (see Configuration section)
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Access the Application**:
   Open [http://localhost:5000](http://localhost:5000) in your browser

## 🎛️ Configuration

### Trading Modes

The platform supports two trading modes:

1. **Virtual Mode** (Default):
   - Safe practice environment
   - No real money involved
   - Full feature access for learning

2. **Live Trading Mode**:
   - Requires API configuration
   - Real money trading
   - Additional safety confirmations

### API Configuration

For live trading, configure your exchange API keys in the Settings panel:

1. Navigate to Settings → API Configuration
2. Enter your exchange API credentials:
   - API Key
   - Secret Key
   - Passphrase (if required)
3. Test connection before enabling live trading

**Supported Exchanges:**
- Bybit
- Binance (coming soon)
- Coinbase Pro (coming soon)

## 🖥️ Usage Guide

### Navigation

The application features a collapsible sidebar with the following sections:

- **Dashboard** - Overview of your trading activity
- **Positions** - View and manage open/closed positions
- **Signals** - Trading signals and execution
- **Trading Bot** - Automated trading configuration
- **Analytics** - Performance metrics and charts
- **Settings** - Platform and API configuration

### Key Features

#### 1. Dashboard Overview
- Real-time P&L tracking
- Active positions summary
- Pending signals count
- Quick access to key metrics

#### 2. Position Management
- View open positions with real-time P&L
- Close positions manually
- Historical position tracking
- Performance analytics

#### 3. Signal Generation
- AI-powered trading signals
- Confidence scoring (High/Medium/Low)
- One-click signal execution
- Signal performance tracking

#### 4. Automated Trading
- Enable/disable automated trading
- Strategy configuration
- Risk management settings
- Emergency stop functionality

#### 5. Analytics Dashboard
- Portfolio performance charts
- Win/loss ratio analysis
- Profit/loss distribution
- Monthly performance tracking

### Risk Management

**Emergency Stop**: The red emergency stop button immediately halts all trading activity.

**Position Limits**: Configure maximum position sizes and risk exposure.

**Virtual Mode**: Always start in virtual mode to familiarize yourself with the platform.

## 🔧 Development

### Project Structure

```
algotrader-pro/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── ui/        # Reusable UI components
│   │   │   ├── *.tsx      # Feature-specific components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions
│   │   └── pages/         # Page components
├── server/                # Backend Express application
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API routes
│   └── storage.ts        # Data storage layer
├── shared/               # Shared TypeScript types
└── public/              # Static assets
```

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Type checking
npm run check        # TypeScript type checking

# Database
npm run db:push      # Push database schema changes
```

### Adding New Features

1. **Components**: Add new React components in `client/src/components/`
2. **API Routes**: Add new routes in `server/routes.ts`
3. **Types**: Define shared types in `shared/schema.ts`
4. **Styling**: Use Tailwind CSS classes and the design system

### Design System

The platform uses a consistent design system with:
- **Colors**: Trading-specific color palette (profit green, loss red)
- **Typography**: Monospace fonts for numeric data
- **Components**: Radix UI primitives with custom styling
- **Animations**: Subtle hover and transition effects

## 🚀 Deployment

### Replit Deployment

1. **Prepare for Deployment**:
   - Ensure all tests pass
   - Verify production build works

2. **Deploy on Replit**:
   - Click the "Deploy" button in Replit
   - Choose your deployment tier
   - Configure build and run commands:
     ```bash
     # Build command
     npm run build
     
     # Run command  
     npm run start
     ```

3. **Custom Domain** (Optional):
   - Configure custom domain in deployment settings
   - Update DNS records as instructed

### Self-Hosting

1. **Build the Application**:
   ```bash
   npm run build
   ```

2. **Start Production Server**:
   ```bash
   npm run start
   ```

3. **Environment Configuration**:
   ```bash
   NODE_ENV=production
   PORT=5000
   ```

## 🔒 Security Considerations

- **API Keys**: Never commit API keys to version control
- **Virtual Mode**: Always test in virtual mode first
- **Risk Limits**: Set appropriate position and loss limits
- **Emergency Stop**: Keep emergency stop easily accessible
- **Regular Monitoring**: Monitor positions and bot activity regularly

## 🆘 Troubleshooting

### Common Issues

1. **Application Won't Start**:
   ```bash
   # Clear cache and reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   npm run dev
   ```

2. **Sidebar Not Working**:
   - Ensure SidebarProvider is wrapping the app
   - Check for console errors related to sidebar context

3. **Build Errors**:
   ```bash
   # Type check for errors
   npm run check
   ```

4. **API Connection Issues**:
   - Verify API credentials in Settings
   - Check network connectivity
   - Ensure exchange API is enabled for trading

### Performance Issues

- **Large Position Lists**: Use pagination for large datasets
- **Real-time Updates**: Consider throttling update frequency
- **Memory Usage**: Monitor for memory leaks in long-running sessions

## 📚 API Documentation

### WebSocket Endpoints

- `/ws/market-data` - Real-time market price updates
- `/ws/positions` - Position updates
- `/ws/signals` - New trading signals

### REST API Endpoints

- `GET /api/positions` - Fetch positions
- `POST /api/positions/close` - Close position
- `GET /api/signals` - Fetch signals
- `POST /api/signals/execute` - Execute signal
- `GET /api/analytics` - Fetch analytics data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Use TypeScript for all new code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure responsive design

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs via GitHub Issues
- **Community**: Join our Discord community (link coming soon)
- **Email**: support@algotrader-pro.com

## 🛣️ Roadmap

### Upcoming Features

- [ ] Multiple exchange support
- [ ] Advanced charting with TradingView integration
- [ ] Social trading features
- [ ] Mobile app (React Native)
- [ ] Advanced backtesting capabilities
- [ ] Copy trading functionality
- [ ] Educational content integration

### Recent Updates

- ✅ Resizable sidebar
- ✅ Comprehensive analytics dashboard
- ✅ Virtual trading mode
- ✅ Real-time signal generation
- ✅ Emergency stop functionality

---

**Disclaimer**: This software is for educational and development purposes. Trading involves substantial risk of loss. Never trade with money you cannot afford to lose. Always test strategies in virtual mode before using real money.

**Happy Trading! 📈**
