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
import TradingDashboard from "./components/TradingDashboard";
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

// Define interfaces matching backend storage.ts and bybitClient.ts
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

interface EnhancedSignal {
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

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [tradingMode, setTradingMode] = useState<"virtual" | "real">("virtual");
  const [isAutomatedTradingEnabled, setIsAutomatedTradingEnabled] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanInterval, setScanInterval] = useState<"1" | "3" | "5" | "15" | "30" | "60" | "120" | "240" | "360" | "720" | "D" | "W" | "M">("15");
  const [scanLimit, setScanLimit] = useState(50);

  const queryClient = useQueryClient();

  // Valid intervals from bybitClient.ts
  const validIntervals: Array<"1" | "3" | "5" | "15" | "30" | "60" | "120" | "240" | "360" | "720" | "D" | "W" | "M"> = [
    "1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "W", "M"
  ];

  // Fetch data
  const { data: positions = [] } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: async () => {
      const response = await fetch('/api/positions');
      if (!response.ok) throw new Error('Failed to fetch positions');
      return await response.json();
    },
  });

  const { data: signals = [] } = useQuery<EnhancedSignal[]>({
    queryKey: ['signals'],
    queryFn: async () => {
      const response = await fetch('/api/signals');
      if (!response.ok) throw new Error('Failed to fetch signals');
      return await response.json();
    },
  });

  const { data: marketData = [] } = useQuery<MarketData[]>({
    queryKey: ['market-data'],
    queryFn: async () => {
      const response = await fetch('/api/market-data');
      if (!response.ok) throw new Error('Failed to fetch market data');
      return await response.json();
    },
  });

  const { data: balance = { capital: 0, available: 0, used: 0 } } = useQuery<Balance>({
    queryKey: ['balance'],
    queryFn: async () => {
      const response = await fetch('/api/balance');
      if (!response.ok) throw new Error('Failed to fetch balance');
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

  const { data: notificationConfig = { discordEnabled: false, discordWebhook: "", telegramEnabled: false, telegramBotToken: "", telegramChatId: "", whatsappEnabled: false, whatsappNumber: "" } } = useQuery<NotificationConfig>({
    queryKey: ['notification-config'],
    queryFn: async () => {
      const response = await fetch('/api/notification-config');
      if (!response.ok) throw new Error('Failed to fetch notification config');
      return await response.json();
    },
  });

  const { data: tradingConfig = { maxPositions: 5, riskPerTrade: 2.0, leverage: 10, stopLossPercent: 5.0, takeProfitPercent: 15.0, scanInterval: 300 } } = useQuery<TradingConfig>({
    queryKey: ['trading-config'],
    queryFn: async () => {
      const response = await fetch('/api/trading-config');
      if (!response.ok) throw new Error('Failed to fetch trading config');
      return await response.json();
    },
  });

  const { data: appStatus } = useQuery<AppStatus>({
    queryKey: ['app-status'],
    queryFn: async () => {
      const response = await fetch('/api/app-status');
      if (!response.ok) throw new Error('Failed to fetch app status');
      return await response.json();
    },
  });

  const { data: connectionStatus = 'disconnected' } = useQuery<"connected" | "disconnected" | "testing">({
    queryKey: ['connection-status'],
    queryFn: async () => {
      const response = await fetch('/api/connection-status');
      if (!response.ok) throw new Error('Failed to fetch connection status');
      const data = await response.json();
      if (data === 'connected' || data === 'disconnected' || data === 'testing') return data;
      return 'disconnected';
    },
  });

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
  });

  const scanSignalsMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      const response = await fetch('/api/scan-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: scanInterval, limit: scanLimit }),
      });
      if (!response.ok) throw new Error('Failed to scan signals');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals'] });
    },
    onSettled: () => setIsScanning(false),
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
  });

  const emergencyStop = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/emergency-stop', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to emergency stop');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['app-status'] });
    },
  });

  const changeTradingMode = useMutation({
    mutationFn: async (mode: 'virtual' | 'real') => {
      const response = await fetch('/api/trading-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!response.ok) throw new Error('Failed to change trading mode');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-status'] });
    },
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to test connection');
      return await response.json();
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
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-config'] });
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
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
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-config'] });
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
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading-config'] });
    },
  });

  // Effect for appStatus
  useEffect(() => {
    if (appStatus) {
      setTradingMode(appStatus.tradingMode);
      setIsAutomatedTradingEnabled(appStatus.isAutomatedTradingEnabled);
    }
  }, [appStatus]);

  const dailyPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleExecuteSignal = (signal: EnhancedSignal) => {
    executeTrade.mutate({
      symbol: signal.symbol,
      side: signal.type,
      size: signal.margin_usdt / signal.entry,
      type: 'market',
      stopLoss: signal.sl,
      takeProfit: signal.tp,
    });
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <TradingDashboard
          stats={{ totalPnL: dailyPnL, winRate: 0, totalTrades: positions.length, activePositions: positions.filter(p => p.status === 'OPEN').length }}
          positions={positions}
          signals={signals.map(s => ({
            id: s.id,
            symbol: s.symbol,
            signalType: s.type,
            entryPrice: s.entry,
            confidence: s.confidence,
            score: s.score
          }))}
          isAutomatedTradingEnabled={isAutomatedTradingEnabled}
          onToggleAutomatedTrading={() => setIsAutomatedTradingEnabled(!isAutomatedTradingEnabled)}
          onScanSignals={() => scanSignalsMutation.mutate()}
          isScanning={isScanning}
        />;

      case 'bot':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Trading Bot</h2>
            <p>Placeholder for Trading Bot page. Implement bot-specific features here.</p>
          </div>
        );

      case 'positions':
        return (
          <div className="p-6 space-y-4">
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
                        <div className="font-semibold">{position.symbol}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Entry: ${position.entryPrice.toFixed(2)} • Size: {position.size}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          PNL: ${position.pnl.toFixed(2)} ({position.pnlPercent.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(position.openTime)}
                      </div>
                    </div>
                    <Badge variant={position.status === 'OPEN' ? 'default' : 'secondary'}>
                      {position.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {positions.filter(p => p.status === 'OPEN').length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No open positions
              </div>
            )}
          </div>
        );

      case 'signals':
        return (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium">Scan Interval</label>
                <select
                  value={scanInterval}
                  onChange={(e) => setScanInterval(e.target.value as any)}
                  className="w-full p-2 border rounded"
                >
                  {validIntervals.map((interval) => (
                    <option key={interval} value={interval}>
                      {interval === 'D' ? 'Daily' : interval === 'W' ? 'Weekly' : interval === 'M' ? 'Monthly' : `${interval} minutes`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Symbol Limit</label>
                <input
                  type="number"
                  value={scanLimit}
                  onChange={(e) => setScanLimit(parseInt(e.target.value))}
                  className="w-full p-2 border rounded"
                />
              </div>
              <Button
                onClick={() => scanSignalsMutation.mutate()}
                disabled={isScanning}
              >
                {isScanning ? 'Scanning...' : 'Scan Signals'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => sendNotifications.mutate()}>
                <Send className="w-4 h-4 mr-2" />
                Notify
              </Button>
            </div>

            <Tabs defaultValue="pending" className="relative mr-auto w-full">
              <TabsList>
                <TabsTrigger value="pending">Pending</TabsTrigger>
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
                            <Badge variant="outline">
                              {signal.confidence}
                            </Badge>
                          </div>
                          <div>
                            <div className="font-semibold">{signal.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              {signal.type} @ ${signal.entry.toFixed(2)} • Score: {signal.score.toFixed(1)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              SL: ${signal.sl.toFixed(2)} • TP: ${signal.tp.toFixed(2)} • Lev: {signal.leverage}x
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
                          <Button size="sm" variant="default" onClick={() => handleExecuteSignal(signal)}>
                            Execute Signal
                          </Button>
                        </div>
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
                              {signal.type} @ ${signal.entry.toFixed(2)} • Score: {signal.score.toFixed(1)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              SL: ${signal.sl.toFixed(2)} • TP: ${signal.tp.toFixed(2)} • Lev: {signal.leverage}x
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
                              {signal.type} @ ${signal.entry.toFixed(2)} • Score: {signal.score.toFixed(1)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              SL: ${signal.sl.toFixed(2)} • TP: ${signal.tp.toFixed(2)} • Lev: {signal.leverage}x
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

      default:
        return (
          <div className="p-6 text-center text-muted-foreground">
            Page not found
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