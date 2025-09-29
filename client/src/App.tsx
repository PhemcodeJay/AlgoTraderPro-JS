import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarProvider } from "@/components/ui/sidebar";
import TradingSidebar from "./components/TradingSidebar";
import TradingHeader from "./components/TradingHeader";
import AnalyticsPage from "./components/AnalyticsPage";
import SettingsPanel from "./components/SettingsPanel";
import MarketOverview from "./components/MarketOverview";
import TradeExecutionPanel from "./components/TradeExecutionPanel";
import TradingDashboard from "./components/TradingDashboard"; // Import TradingDashboard
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Target,
  DollarSign,
  Send
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

// Define interfaces matching backend storage.ts
interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  entryPrice: number;
  currentPrice?: number;
  exitPrice?: number;
  pnl: number;
  pnlPercent: number;
  status: 'OPEN' | 'CLOSED';
  openTime: string;
  closeTime?: string;
  leverage: number;
}

interface Signal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  score: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'EXECUTED' | 'EXPIRED';
  timestamp: string;
  executedPrice?: number;
  stopLoss: number;
  takeProfit: number;
  liquidationPrice: number;
  currentMarketPrice: number;
  interval: string;
  signal_type: 'buy' | 'sell';
  indicators: {
    sma20: number[];
    sma50: number[];
    ema20: number[];
    rsi: number[];
    macd: { macd: number[]; signal: number[]; histogram: number[] };
    bollinger: { upper: number[]; middle: number[]; lower: number[] };
    atr: number[];
  };
  entry: number;
  sl: number;
  tp: number;
  trail: number;
  liquidation: number;
  margin_usdt: number;
  bb_slope: string;
  market: string;
  leverage: number;
  risk_reward: number;
  atr_multiplier: number;
  created_at: string;
  signals: string[];
}

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

interface Balance {
  capital: number;
  available: number;
  used: number;
}

interface ApiConfig {
  bybitApiKey: string;
  bybitApiSecret: string;
  bybitTestnet: boolean;
}

interface NotificationConfig {
  discordEnabled: boolean;
  discordWebhook: string;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  whatsappEnabled: boolean;
  whatsappNumber: string;
}

interface TradingConfig {
  maxPositions: number;
  riskPerTrade: number;
  leverage: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  scanInterval: number;
}

interface AppStatus {
  tradingMode: 'virtual' | 'real';
  isAutomatedTradingEnabled: boolean;
}

interface DashboardStats {
  totalPnL: number;
  winRate: number;
  totalTrades: number;
  activePositions: number;
}

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [isAutomatedTradingEnabled, setIsAutomatedTradingEnabled] = useState(false);
  const [tradingMode, setTradingMode] = useState<"virtual" | "real">("virtual");
  const [isScanning, setIsScanning] = useState(false);
  const [scanInterval, setScanInterval] = useState("15");
  const [scanLimit, setScanLimit] = useState(50);

  const queryClient = useQueryClient();

  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsHost = window.location.host;

  // Fetch data
  const { data: positions = [], isLoading: loadingPositions, error: errorPositions, refetch: refetchPositions } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: async () => {
      const response = await fetch('/api/positions');
      if (!response.ok) throw new Error('Failed to fetch positions');
      return await response.json();
    },
  });

  const { data: signals = [], isLoading: loadingSignals, error: errorSignals, refetch: refetchSignals } = useQuery<Signal[]>({
    queryKey: ['signals'],
    queryFn: async () => {
      const response = await fetch('/api/signals');
      if (!response.ok) throw new Error('Failed to fetch signals');
      return await response.json();
    },
  });

  const { data: marketData = [], isLoading: loadingMarketData, error: errorMarketData } = useQuery<MarketData[]>({
    queryKey: ['market-data'],
    queryFn: async () => {
      const response = await fetch('/api/market-data');
      if (!response.ok) throw new Error('Failed to fetch market data');
      return await response.json();
    },
  });

  const { data: balance = { capital: 0, available: 0, used: 0 }, isLoading: loadingBalance, error: errorBalance } = useQuery<Balance>({
    queryKey: ['balance'],
    queryFn: async () => {
      const response = await fetch('/api/balance');
      if (!response.ok) throw new Error('Failed to fetch balance');
      return await response.json();
    },
  });

  const { data: appStatus = { tradingMode: 'virtual', isAutomatedTradingEnabled: false }, isLoading: loadingAppStatus, error: errorAppStatus } = useQuery<AppStatus>({
    queryKey: ['app-status'],
    queryFn: async () => {
      const response = await fetch('/api/app-status');
      if (!response.ok) throw new Error('Failed to fetch app status');
      return await response.json();
    },
  });

  const { data: apiConfig = { bybitApiKey: "", bybitApiSecret: "", bybitTestnet: true } } = useQuery<ApiConfig>({
    queryKey: ['api-config'],
    queryFn: async () => {
      const response = await fetch('/api/api-config');
      if (!response.ok) throw new Error('Failed to fetch API config');
      return await response.json();
    },
  });

  const { data: notificationConfig = {
    discordEnabled: false,
    discordWebhook: "",
    telegramEnabled: false,
    telegramBotToken: "",
    telegramChatId: "",
    whatsappEnabled: false,
    whatsappNumber: ""
  } } = useQuery<NotificationConfig>({
    queryKey: ['notify-config'],
    queryFn: async () => {
      const response = await fetch('/api/notification-config');
      if (!response.ok) throw new Error('Failed to fetch notification config');
      return await response.json();
    },
  });

  const { data: tradingConfig = {
    maxPositions: 5,
    riskPerTrade: 2.0,
    leverage: 10,
    stopLossPercent: 5.0,
    takeProfitPercent: 15.0,
    scanInterval: 300
  } } = useQuery<TradingConfig>({
    queryKey: ['trading-config'],
    queryFn: async () => {
      const response = await fetch('/api/trading-config');
      if (!response.ok) throw new Error('Failed to fetch trading config');
      return await response.json();
    },
  });

  const { data: connectionStatus = 'disconnected' as 'disconnected' | 'connected' | 'testing' | undefined } = useQuery<'disconnected' | 'connected' | 'testing' | undefined>({
    queryKey: ['connection-status'],
    queryFn: async () => {
      const response = await fetch('/api/connection-status');
      if (!response.ok) throw new Error('Failed to fetch connection status');
      const { status } = await response.json();
      return (['disconnected', 'connected', 'testing'].includes(status) ? status : 'disconnected') as 'disconnected' | 'connected' | 'testing' | undefined;
    },
  });

  useEffect(() => {
    if (appStatus) {
      setTradingMode(appStatus.tradingMode);
      setIsAutomatedTradingEnabled(appStatus.isAutomatedTradingEnabled);
    }
  }, [appStatus]);

  // Mutations
  const executeTrade = useMutation({
    mutationFn: async (trade: { symbol: string; side: 'BUY' | 'SELL'; size: number; type: 'market' | 'limit'; price?: number; stopLoss?: number; takeProfit?: number }) => {
      const response = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade),
      });
      if (!response.ok) throw new Error('Failed to execute trade');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['signals'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['app-status'] });
    },
    onError: (error: any) => {
      console.error('[App] Trade execution failed:', error.message ?? error);
      alert('Failed to execute trade. Please try again.');
    },
  });

  const scanSignals = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/scan-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: scanInterval, limit: scanLimit }),
      });
      if (!response.ok) throw new Error('Failed to scan signals');
      return await response.json();
    },
    onSuccess: () => {
      refetchSignals();
      queryClient.invalidateQueries({ queryKey: ['signals'] });
    },
    onError: (error: any) => {
      console.error('[App] Scan signals failed:', error.message ?? error);
      alert('Failed to scan signals. Please try again.');
    },
    onSettled: () => {
      setIsScanning(false);
    },
  });

  const sendNotifications = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/send-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals }),
      });
      if (!response.ok) throw new Error('Failed to send notifications');
      return await response.json();
    },
    onSuccess: () => {
      alert('Notifications sent successfully!');
    },
    onError: (error: any) => {
      console.error('[App] Failed to send notifications:', error.message ?? error);
      alert('Failed to send notifications. Please try again.');
    },
  });

  const saveApi = useMutation({
    mutationFn: async (config: ApiConfig) => {
      const response = await fetch('/api/api-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Failed to save API config');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-config'] });
      alert('API configuration saved successfully!');
    },
    onError: (error: any) => {
      console.error('[App] Failed to save API config:', error.message ?? error);
      alert('Failed to save API configuration. Please try again.');
    },
  });

  const saveNotifications = useMutation({
    mutationFn: async (config: NotificationConfig) => {
      const response = await fetch('/api/notification-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Failed to save notification config');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notify-config'] });
      alert('Notification settings saved successfully!');
    },
    onError: (error: any) => {
      console.error('[App] Failed to save notification config:', error.message ?? error);
      alert('Failed to save notification settings. Please try again.');
    },
  });

  const saveTrading = useMutation({
    mutationFn: async (config: TradingConfig) => {
      const response = await fetch('/api/trading-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Failed to save trading config');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading-config'] });
      alert('Trading settings saved successfully!');
    },
    onError: (error: any) => {
      console.error('[App] Failed to save trading config:', error.message ?? error);
      alert('Failed to save trading settings. Please try again.');
    },
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/test-connection', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to test connection');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
      alert('Connection test successful!');
    },
    onError: (error: any) => {
      console.error('[App] Connection test failed:', error.message ?? error);
      alert('Connection test failed. Please check your API settings.');
    },
  });

  const toggleAutomatedTrading = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch('/api/automated-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, mode: tradingMode }),
      });
      if (!response.ok) throw new Error('Failed to toggle automated trading');
    },
    onSuccess: (_, enabled) => {
      setIsAutomatedTradingEnabled(enabled);
      queryClient.invalidateQueries({ queryKey: ['app-status'] });
      alert(`Automated trading ${enabled ? 'enabled' : 'disabled'} successfully!`);
    },
    onError: (error: any) => {
      console.error('[App] Failed to toggle automated trading:', error.message ?? error);
      alert('Failed to toggle automated trading. Please try again.');
    },
  });

  const changeTradingMode = useMutation({
    mutationFn: async (mode: 'virtual' | 'real') => {
      const response = await fetch('/api/app-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradingMode: mode, isAutomatedTradingEnabled }),
      });
      if (!response.ok) throw new Error('Failed to change trading mode');
    },
    onSuccess: (_, mode) => {
      setTradingMode(mode);
      queryClient.invalidateQueries({ queryKey: ['app-status'] });
      alert(`Switched to ${mode} trading mode successfully!`);
    },
    onError: (error: any) => {
      console.error('[App] Failed to change trading mode:', error.message ?? error);
      alert('Failed to change trading mode. Please try again.');
    },
  });

  const emergencyStop = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/automated-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });
      if (!response.ok) throw new Error('Failed to activate emergency stop');
      await fetch('/api/app-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradingMode: 'virtual', isAutomatedTradingEnabled: false }),
      });
    },
    onSuccess: () => {
      setIsAutomatedTradingEnabled(false);
      setTradingMode('virtual');
      queryClient.invalidateQueries({ queryKey: ['app-status'] });
      alert('🛑 EMERGENCY STOP ACTIVATED\n\n• All automated trading disabled\n• Switched to virtual mode\n• Please review your positions');
    },
    onError: (error: any) => {
      console.error('[App] Emergency stop failed:', error.message ?? error);
      alert('Failed to activate emergency stop. Please try again.');
    },
  });

  // WebSocket setup
  useEffect(() => {
    const wsMarket = new WebSocket(`${wsProtocol}://${wsHost}/ws/market-data`);
    wsMarket.onopen = () => console.log('[WebSocket] Market WS connected');
    wsMarket.onmessage = (event) => {
      const update: Partial<MarketData> = JSON.parse(event.data);
      queryClient.setQueryData<MarketData[]>(['market-data'], (old) => {
        if (!old || !update.symbol) return old;
        const index = old.findIndex((d) => d.symbol === update.symbol);
        if (index === -1) return [...old, update as MarketData];
        const newData = [...old];
        newData[index] = { ...newData[index], ...update };
        return newData;
      });
      // Update positions with new currentPrice from market data
      queryClient.setQueryData<Position[]>(['positions'], (old) => {
        if (!old || !update.symbol || !update.price) return old;
        return old.map((pos) =>
          pos.symbol === update.symbol && pos.status === 'OPEN'
            ? { ...pos, currentPrice: update.price }
            : pos
        );
      });
    };
    wsMarket.onclose = () => console.log('[WebSocket] Market WS closed');
    wsMarket.onerror = (error) => console.error('[WebSocket] Market WS error:', error);

    const wsPositions = new WebSocket(`${wsProtocol}://${wsHost}/ws/positions`);
    wsPositions.onopen = () => console.log('[WebSocket] Positions WS connected');
    wsPositions.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.action === 'update') {
        queryClient.setQueryData<Position[]>(['positions'], message.data);
        queryClient.invalidateQueries({ queryKey: ['balance'] });
      }
    };
    wsPositions.onclose = () => console.log('[WebSocket] Positions WS closed');
    wsPositions.onerror = (error) => console.error('[WebSocket] Positions WS error:', error);

    const wsSignals = new WebSocket(`${wsProtocol}://${wsHost}/ws/signals`);
    wsSignals.onopen = () => console.log('[WebSocket] Signals WS connected');
    wsSignals.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.action === 'update') {
        queryClient.setQueryData<Signal[]>(['signals'], message.data);
      }
    };
    wsSignals.onclose = () => console.log('[WebSocket] Signals WS closed');
    wsSignals.onerror = (error) => console.error('[WebSocket] Signals WS error:', error);

    return () => {
      wsMarket.close();
      wsPositions.close();
      wsSignals.close();
    };
  }, [queryClient, wsProtocol, wsHost]);

  const getCurrentPrice = (symbol: string) => {
    return marketData.find((d) => d.symbol === symbol)?.price || 0;
  };

  const computePnL = (position: Position) => {
    if (position.status === 'CLOSED') {
      return position.pnl;
    }
    const current = position.currentPrice ?? getCurrentPrice(position.symbol);
    const delta = position.side === 'BUY' ? (current - position.entryPrice) : (position.entryPrice - current);
    return delta * position.size * position.leverage;
  };

  const computePnLPercent = (position: Position) => {
    if (position.status === 'CLOSED') {
      return position.pnlPercent;
    }
    const pnl = computePnL(position);
    return position.entryPrice * position.size > 0 ? (pnl / (position.entryPrice * position.size)) * 100 : 0;
  };

  const formatDateTime = (date: string | undefined) => {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'N/A';
    return dateObj.toLocaleDateString() + " " +
           dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleScanSignals = () => {
    setIsScanning(true);
    scanSignals.mutate();
  };

  const handleExecuteSignal = (signal: Signal) => {
    const trade = {
      symbol: signal.symbol,
      side: signal.type,
      size: (tradingConfig.riskPerTrade / 100) * balance.available / signal.currentMarketPrice * signal.leverage,
      type: 'market' as const,
      price: signal.currentMarketPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
    };
    executeTrade.mutate(trade);
  };

  // Compute dashboard stats
  const stats: DashboardStats = {
    totalPnL: positions.reduce((sum, p) => sum + computePnL(p), 0),
    winRate: positions.filter(p => p.status === 'CLOSED' && p.pnl > 0).length /
             Math.max(positions.filter(p => p.status === 'CLOSED').length, 1) * 100,
    totalTrades: positions.length,
    activePositions: positions.filter(p => p.status === 'OPEN').length,
  };

  const dailyPnL = positions
    .filter(p => {
      if (p.status !== 'CLOSED' || !p.closeTime) return false;
      const closeDate = new Date(p.closeTime);
      return closeDate.toDateString() === new Date().toDateString();
    })
    .reduce((sum, p) => sum + p.pnl, 0);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <TradingDashboard
            stats={stats}
            positions={positions.filter(p => p.status === 'OPEN')}
            signals={signals.filter(s => s.status === 'PENDING')}
            isAutomatedTradingEnabled={isAutomatedTradingEnabled}
            onToggleAutomatedTrading={() => toggleAutomatedTrading.mutate(!isAutomatedTradingEnabled)}
            onScanSignals={() => handleScanSignals()}
            isScanning={isScanning}
          />
        );

      case 'positions':
        return (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Positions</h2>
              <div className="flex gap-2 text-sm text-muted-foreground">
                <span>{positions.filter(p => p.status === 'OPEN').length} Open</span>
                <span>•</span>
                <span>{positions.filter(p => p.status === 'CLOSED').length} Closed</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{positions.filter(p => p.status === 'OPEN').length}</div>
                  <p className="text-xs text-muted-foreground">Active trades</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total PnL</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold font-mono ${stats.totalPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                    {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Daily PnL</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold font-mono ${dailyPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                    {dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">Today</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{stats.winRate.toFixed(0)}%</div>
                  <p className="text-xs text-muted-foreground">Closed trades</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="open" className="w-full">
              <TabsList>
                <TabsTrigger value="open">Open ({positions.filter(p => p.status === 'OPEN').length})</TabsTrigger>
                <TabsTrigger value="closed">Closed ({positions.filter(p => p.status === 'CLOSED').length})</TabsTrigger>
              </TabsList>

              <TabsContent value="open" className="space-y-4">
                {positions.filter(p => p.status === 'OPEN').map((position) => (
                  <Card key={position.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {position.side === 'BUY' ? (
                              <TrendingUp className="w-4 h-4 text-trading-profit" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-trading-loss" />
                            )}
                            <Badge variant="outline">{position.symbol}</Badge>
                          </div>
                          <div>
                            <div className="font-semibold">Entry: ${position.entryPrice.toFixed(2)}</div>
                            <div className="text-sm text-muted-foreground">
                              Size: {position.size.toFixed(6)} • Lev: {position.leverage}x
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${computePnL(position) >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                            {computePnL(position) >= 0 ? '+' : ''}${computePnL(position).toFixed(2)}
                          </div>
                          <div className={`text-sm ${computePnLPercent(position) >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                            {computePnLPercent(position).toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex justify-between">
                        <span>Open: {formatDateTime(position.openTime)}</span>
                        <span>Current: ${position.currentPrice?.toFixed(2) ?? getCurrentPrice(position.symbol).toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {positions.filter(p => p.status === 'OPEN').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No open positions
                  </div>
                )}
              </TabsContent>

              <TabsContent value="closed" className="space-y-4">
                {positions.filter(p => p.status === 'CLOSED').map((position) => (
                  <Card key={position.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {position.side === 'BUY' ? (
                              <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-muted-foreground" />
                            )}
                            <Badge variant="outline">{position.symbol}</Badge>
                          </div>
                          <div>
                            <div className="font-semibold text-muted-foreground">
                              Entry: ${position.entryPrice.toFixed(2)} • Exit: ${position.exitPrice?.toFixed(2) ?? 'N/A'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Size: ${position.size.toFixed(6)} • Lev: ${position.leverage}x
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${position.pnl >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                            {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                          </div>
                          <div className={`text-sm ${position.pnlPercent >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                            {position.pnlPercent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex justify-between">
                        <span>Open: ${formatDateTime(position.openTime)}</span>
                        <span>Close: ${formatDateTime(position.closeTime)}</span>
                      </div>
                      <div className="mt-1 flex justify-end">
                        <div className="flex items-center gap-1 text-sm">
                          {position.pnl >= 0 ? (
                            <CheckCircle className="w-4 h-4 text-trading-profit" />
                          ) : (
                            <XCircle className="w-4 h-4 text-trading-loss" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {positions.filter(p => p.status === 'CLOSED').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No closed positions
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        );

      case 'signals':
        return (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Trading Signals</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Interval:</label>
                  <select
                    value={scanInterval}
                    onChange={(e) => setScanInterval(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="5">5m</option>
                    <option value="15">15m</option>
                    <option value="30">30m</option>
                    <option value="60">1h</option>
                    <option value="240">4h</option>
                  </select>
                  <label className="text-sm text-muted-foreground">Limit:</label>
                  <input
                    type="number"
                    value={scanLimit}
                    onChange={(e) => setScanLimit(Number(e.target.value))}
                    className="border rounded px-2 py-1 w-16 text-sm"
                    min="1"
                    max="100"
                  />
                </div>
                <Button
                  onClick={handleScanSignals}
                  disabled={isScanning}
                  className="flex items-center gap-2"
                >
                  <Activity className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  {isScanning ? 'Scanning...' : 'Scan Signals'}
                </Button>
                <Button
                  onClick={() => sendNotifications.mutate()}
                  disabled={signals.length === 0}
                  className="flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Notifications
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Signals</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{signals.filter(s => s.status === 'PENDING').length}</div>
                  <p className="text-xs text-muted-foreground">Awaiting execution</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Execution Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    {((signals.filter(s => s.status === 'EXECUTED').length / Math.max(signals.length, 1)) * 100).toFixed(0)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Success rate</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">High Confidence</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{signals.filter(s => s.confidence === 'HIGH').length}</div>
                  <p className="text-xs text-muted-foreground">Strong signals</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="pending" className="w-full">
              <TabsList>
                <TabsTrigger value="pending">Pending ({signals.filter(s => s.status === 'PENDING').length})</TabsTrigger>
                <TabsTrigger value="executed">Executed</TabsTrigger>
                <TabsTrigger value="expired">Expired</TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4">
                {signals.filter(s => s.status === 'PENDING').map((signal) => (
                  <Card key={signal.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {signal.type === 'BUY' ? (
                              <TrendingUp className="w-4 h-4 text-trading-profit" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-trading-loss" />
                            )}
                            <Badge
                              variant={signal.confidence === 'HIGH' ? 'default' :
                                      signal.confidence === 'MEDIUM' ? 'secondary' : 'outline'}
                            >
                              {signal.confidence}
                            </Badge>
                          </div>
                          <div>
                            <div className="font-semibold">{signal.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              {signal.type} @ ${signal.currentMarketPrice.toFixed(2)} • Score: {signal.score.toFixed(1)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              SL: ${signal.stopLoss.toFixed(2)} • TP: ${signal.takeProfit.toFixed(2)} • Lev: {signal.leverage}x
                            </div>
                            <div className="text-sm text-muted-foreground">
                              R/R: {signal.risk_reward.toFixed(2)} • Interval: {signal.interval}m
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(signal.created_at)}
                          </div>
                        </div>
                        <Button size="sm" variant="default" onClick={() => handleExecuteSignal(signal)}>
                          Execute Signal
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {signals.filter(s => s.status === 'PENDING').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending signals
                  </div>
                )}
              </TabsContent>

              <TabsContent value="executed" className="space-y-4">
                {signals.filter(s => s.status === 'EXECUTED').map((signal) => (
                  <Card key={signal.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {signal.type === 'BUY' ? (
                              <TrendingUp className="w-4 h-4 text-trading-profit" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-trading-loss" />
                            )}
                            <Badge
                              variant={signal.confidence === 'HIGH' ? 'default' :
                                      signal.confidence === 'MEDIUM' ? 'secondary' : 'outline'}
                            >
                              {signal.confidence}
                            </Badge>
                          </div>
                          <div>
                            <div className="font-semibold">{signal.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              {signal.type} • Target: ${signal.price.toFixed(2)} • Executed: ${signal.executedPrice?.toFixed(2) || 'N/A'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              SL: ${signal.stopLoss.toFixed(2)} • TP: ${signal.takeProfit.toFixed(2)} • Lev: ${signal.leverage}x
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(signal.created_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-trading-profit" />
                          <span className="text-sm font-medium">Executed</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {signals.filter(s => s.status === 'EXECUTED').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No executed signals
                  </div>
                )}
              </TabsContent>

              <TabsContent value="expired" className="space-y-4">
                {signals.filter(s => s.status === 'EXPIRED').map((signal) => (
                  <Card key={signal.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {signal.type === 'BUY' ? (
                              <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-muted-foreground" />
                            )}
                            <Badge variant="outline">
                              {signal.confidence}
                            </Badge>
                          </div>
                          <div>
                            <div className="font-semibold text-muted-foreground">{signal.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              {signal.type} @ ${signal.price.toFixed(2)} • Score: ${signal.score.toFixed(1)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              SL: ${signal.stopLoss.toFixed(2)} • TP: ${signal.takeProfit.toFixed(2)} • Lev: ${signal.leverage}x
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(signal.created_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">Expired</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {signals.filter(s => s.status === 'EXPIRED').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No expired signals
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        );

      case 'analytics':
        return <AnalyticsPage />;

      case 'settings':
        return (
          <SettingsPanel
            apiConfig={apiConfig}
            notificationConfig={notificationConfig}
            tradingConfig={tradingConfig}
            onSaveAPI={(config) => saveApi.mutate(config)}
            onSaveNotifications={(config) => saveNotifications.mutate(config)}
            onSaveTrading={(config) => saveTrading.mutate(config)}
            onTestConnection={() => testConnection.mutate()}
            connectionStatus={connectionStatus}
          />
        );

      default: // This case should ideally not be reached if all pages are handled.
        return (
          <div className="p-6 space-y-6">
            <h2 className="text-2xl font-bold">Dashboard</h2>
            {/* Render dashboard content here */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total PnL</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold font-mono ${stats.totalPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                    {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">All positions</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{stats.winRate.toFixed(0)}%</div>
                  <p className="text-xs text-muted-foreground">Closed trades</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{stats.totalTrades}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{stats.activePositions}</div>
                  <p className="text-xs text-muted-foreground">Currently open</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MarketOverview
                marketData={marketData}
                onSymbolSelect={setSelectedSymbol}
                selectedSymbol={selectedSymbol}
              />
              <TradeExecutionPanel
                selectedSymbol={selectedSymbol}
                currentPrice={getCurrentPrice(selectedSymbol)}
                balance={{ available: balance.available, used: balance.used }}
                onExecuteTrade={(trade) => executeTrade.mutate({
                  symbol: trade.symbol,
                  side: trade.side,
                  size: trade.quantity,
                  type: trade.price === getCurrentPrice(trade.symbol) ? 'market' : 'limit',
                  price: trade.price,
                  stopLoss: trade.stopLoss,
                  takeProfit: trade.takeProfit,
                })}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <TradingSidebar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          stats={{
            activePositions: positions.filter(p => p.status === 'OPEN').length,
            pendingSignals: signals.filter(s => s.status === 'PENDING').length,
            dailyPnL,
            isAutomatedTradingEnabled
          }}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TradingHeader
            tradingMode={tradingMode}
            onTradingModeChange={(mode) => {
              if (mode === 'real') {
                if (!confirm('⚠️ Warning: You are switching to LIVE trading mode. Real money will be at risk!')) return;
              }
              changeTradingMode.mutate(mode);
            }}
            isConnected={connectionStatus === 'connected'}
            balance={balance}
            onEmergencyStop={() => emergencyStop.mutate()}
            onSettingsClick={() => setCurrentPage('settings')}
          />
          <main className="flex-1 overflow-auto">
            {renderPage()}
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}

export default App;