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
import { 
  TrendingUp, 
  TrendingDown, 
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Target,
  DollarSign
} from "lucide-react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Position, Signal, DashboardStats } from '@shared/schema';

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

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [isAutomatedTradingEnabled, setIsAutomatedTradingEnabled] = useState(false);
  const [tradingMode, setTradingMode] = useState<"virtual" | "real">("virtual");
  const [isScanning, setIsScanning] = useState(false);

  const queryClient = useQueryClient();

  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsHost = window.location.host;

  // Fetch data
  const { data: positions = [], isLoading: loadingPositions, error: errorPositions, refetch: refetchPositions } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: async () => {
      const response = await fetch('/api/positions');
      if (!response.ok) throw new Error('Failed to fetch positions');
      const data = await response.json();
      return data.map((pos: any) => ({
        ...pos,
        openTime: pos.openTime ? new Date(pos.openTime) : null,
        closeTime: pos.closeTime ? new Date(pos.closeTime) : null,
      }));
    },
  });

  const { data: signals = [], isLoading: loadingSignals, error: errorSignals, refetch: refetchSignals } = useQuery<Signal[]>({
    queryKey: ['signals'],
    queryFn: async () => {
      const response = await fetch('/api/signals');
      if (!response.ok) throw new Error('Failed to fetch signals');
      const data = await response.json();
      return data.map((sig: any) => ({
        ...sig,
        createdAt: sig.createdAt ? new Date(sig.createdAt) : null,
      }));
    },
  });

  const { data: marketData = [], isLoading: loadingMarketData, error: errorMarketData } = useQuery<MarketData[]>({
    queryKey: ['market-data'],
    queryFn: async () => {
      const response = await fetch('/api/market-data');
      if (!response.ok) throw new Error('Failed to fetch market data');
      return response.json();
    },
  });

  const { data: balance = { capital: 0, available: 0, used: 0 }, isLoading: loadingBalance, error: errorBalance } = useQuery<Balance>({
    queryKey: ['balance'],
    queryFn: async () => {
      const response = await fetch('/api/balance');
      if (!response.ok) throw new Error('Failed to fetch balance');
      return response.json();
    },
  });

  const { data: appStatus, isLoading: loadingAppStatus, error: errorAppStatus } = useQuery<{
    tradingMode: "virtual" | "real",
    isAutomatedTradingEnabled: boolean
  }>({
    queryKey: ['app-status'],
    queryFn: async () => {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error('Failed to fetch app status');
      return response.json();
    },
  });

  const { data: apiConfig = { bybitApiKey: "", bybitApiSecret: "", bybitTestnet: true } } = useQuery({
    queryKey: ['api-config'],
    queryFn: async () => {
      const response = await fetch('/api/settings/api');
      if (!response.ok) throw new Error('Failed to fetch API config');
      return response.json();
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
  } } = useQuery({
    queryKey: ['notify-config'],
    queryFn: async () => {
      const response = await fetch('/api/settings/notify');
      if (!response.ok) throw new Error('Failed to fetch notification config');
      return response.json();
    },
  });

  const { data: tradingConfig = {
    maxPositions: 5,
    riskPerTrade: 2.0,
    leverage: 10,
    stopLossPercent: 5.0,
    takeProfitPercent: 15.0,
    scanInterval: 300
  } } = useQuery({
    queryKey: ['trading-config'],
    queryFn: async () => {
      const response = await fetch('/api/settings/trade');
      if (!response.ok) throw new Error('Failed to fetch trading config');
      return response.json();
    },
  });

  const { data: connData } = useQuery({
    queryKey: ['connection-status'],
    queryFn: async () => {
      const response = await fetch('/api/connection-status');
      if (!response.ok) throw new Error('Failed to fetch connection status');
      return response.json();
    },
  });
  const connectionStatus = connData?.status || 'disconnected';

  useEffect(() => {
    if (appStatus) {
      setTradingMode(appStatus.tradingMode);
      setIsAutomatedTradingEnabled(appStatus.isAutomatedTradingEnabled);
    }
  }, [appStatus]);

  // Mutations
  const executeTrade = useMutation({
    mutationFn: async (trade: any) => {
      const response = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade),
      });
      if (!response.ok) throw new Error('Failed to execute trade');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['signals'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['app-status'] });
    },
    onError: (error) => {
      console.error('Trade execution failed:', error);
      alert('Failed to execute trade. Please try again.');
    },
  });

  const scanSignals = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/scan-signals', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to scan signals');
      return response.json();
    },
    onSuccess: () => {
      refetchSignals();
    },
    onError: (error) => {
      console.error('Scan failed:', error);
      alert('Failed to scan signals. Please try again.');
    },
    onSettled: () => {
      setIsScanning(false);
    },
  });

  const saveApi = useMutation({
    mutationFn: async (config: any) => {
      const response = await fetch('/api/settings/api', {
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
    onError: (error) => {
      console.error('Failed to save API config:', error);
      alert('Failed to save API configuration. Please try again.');
    },
  });

  const saveNotifications = useMutation({
    mutationFn: async (config: any) => {
      const response = await fetch('/api/settings/notify', {
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
    onError: (error) => {
      console.error('Failed to save notification config:', error);
      alert('Failed to save notification settings. Please try again.');
    },
  });

  const saveTrading = useMutation({
    mutationFn: async (config: any) => {
      const response = await fetch('/api/settings/trade', {
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
    onError: (error) => {
      console.error('Failed to save trading config:', error);
      alert('Failed to save trading settings. Please try again.');
    },
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/test-connection', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to test connection');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
      alert('Connection test successful!');
    },
    onError: (error) => {
      console.error('Connection test failed:', error);
      alert('Connection test failed. Please check your API settings.');
    },
  });

  const toggleAutomatedTrading = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch('/api/automated-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Failed to toggle automated trading');
    },
    onSuccess: (_, enabled) => {
      setIsAutomatedTradingEnabled(enabled);
      queryClient.invalidateQueries({ queryKey: ['app-status'] });
      alert(`Automated trading ${enabled ? 'enabled' : 'disabled'} successfully!`);
    },
    onError: (error) => {
      console.error('Failed to toggle automated trading:', error);
      alert('Failed to toggle automated trading. Please try again.');
    },
  });

  const changeTradingMode = useMutation({
    mutationFn: async (mode: "virtual" | "real") => {
      const response = await fetch('/api/trading-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!response.ok) throw new Error('Failed to change trading mode');
    },
    onSuccess: (_, mode) => {
      setTradingMode(mode);
      queryClient.invalidateQueries({ queryKey: ['app-status'] });
      alert(`Switched to ${mode} trading mode successfully!`);
    },
    onError: (error) => {
      console.error('Failed to change trading mode:', error);
      alert('Failed to change trading mode. Please try again.');
    },
  });

  const emergencyStop = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/emergency-stop', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to activate emergency stop');
    },
    onSuccess: () => {
      setIsAutomatedTradingEnabled(false);
      setTradingMode("virtual");
      queryClient.invalidateQueries({ queryKey: ['app-status'] });
      alert("🛑 EMERGENCY STOP ACTIVATED\n\n• All automated trading disabled\n• Switched to virtual mode\n• Please review your positions");
    },
    onError: (error) => {
      console.error('Emergency stop failed:', error);
      alert('Failed to activate emergency stop. Please try again.');
    },
  });

  // WebSocket setup
  useEffect(() => {
    const wsMarket = new WebSocket(`${wsProtocol}://${wsHost}/ws/market-data`);
    wsMarket.onopen = () => console.log('Market WS connected');
    wsMarket.onmessage = (event) => {
      const update: Partial<MarketData> = JSON.parse(event.data);
      queryClient.setQueryData<MarketData[]>(['market-data'], (old) => {
        if (!old || !update.symbol) return old;
        const index = old.findIndex((d) => d.symbol === update.symbol);
        if (index === -1) return old;
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
    wsMarket.onclose = () => console.log('Market WS closed');
    wsMarket.onerror = (error) => console.error('Market WS error:', error);

    const wsPositions = new WebSocket(`${wsProtocol}://${wsHost}/ws/positions`);
    wsPositions.onopen = () => console.log('Positions WS connected');
    wsPositions.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    };
    wsPositions.onclose = () => console.log('Positions WS closed');
    wsPositions.onerror = (error) => console.error('Positions WS error:', error);

    return () => {
      wsMarket.close();
      wsPositions.close();
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
    return delta * position.size;
  };

  const computePnLPercent = (position: Position) => {
    if (position.status === 'CLOSED') {
      return position.pnlPercent;
    }
    const pnl = computePnL(position);
    return (pnl / (position.entryPrice * position.size)) * 100;
  };

  const formatDateTime = (date: Date | string | null | undefined) => {
    if (!date) return 'N/A';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    
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
      side: signal.signalType,
      quantity: 0, // TODO: Calculate based on risk management
      price: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      leverage: tradingConfig.leverage,
    };
    executeTrade.mutate(trade);
  };

  // Compute dashboard stats
  const stats: DashboardStats = {
    totalPnL: positions.reduce((sum, p) => sum + computePnL(p), 0),
    winRate: positions.filter(p => p.status === "CLOSED" && p.pnl > 0).length / Math.max(positions.filter(p => p.status === "CLOSED").length, 1) * 100,
    totalTrades: positions.length,
    activePositions: positions.filter(p => p.status === "OPEN").length,
  };

  const dailyPnL = positions
    .filter(p => {
      if (p.status !== "CLOSED" || !p.closeTime) return false;
      const closeDate = typeof p.closeTime === 'string' ? new Date(p.closeTime) : p.closeTime;
      return closeDate instanceof Date && !isNaN(closeDate.getTime()) && closeDate.toDateString() === new Date().toDateString();
    })
    .reduce((sum, p) => sum + p.pnl, 0);

  const renderPage = () => {
    switch (currentPage) {
      case "positions":
        return (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Positions</h2>
              <div className="flex gap-2 text-sm text-muted-foreground">
                <span>{positions.filter(p => p.status === "OPEN").length} Open</span>
                <span>•</span>
                <span>{positions.filter(p => p.status === "CLOSED").length} Closed</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{positions.filter(p => p.status === "OPEN").length}</div>
                  <p className="text-xs text-muted-foreground">Active trades</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total PnL</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold font-mono ${stats.totalPnL >= 0 ? "text-trading-profit" : "text-trading-loss"}`}>
                    {stats.totalPnL >= 0 ? "+" : ""}${stats.totalPnL.toFixed(2)}
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
                  <div className={`text-2xl font-bold font-mono ${dailyPnL >= 0 ? "text-trading-profit" : "text-trading-loss"}`}>
                    {dailyPnL >= 0 ? "+" : ""}${dailyPnL.toFixed(2)}
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
                <TabsTrigger value="open">Open ({positions.filter(p => p.status === "OPEN").length})</TabsTrigger>
                <TabsTrigger value="closed">Closed ({positions.filter(p => p.status === "CLOSED").length})</TabsTrigger>
              </TabsList>

              <TabsContent value="open" className="space-y-4">
                {positions.filter(p => p.status === "OPEN").map((position) => (
                  <Card key={position.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {position.side === "BUY" ? (
                              <TrendingUp className="w-4 h-4 text-trading-profit" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-trading-loss" />
                            )}
                            <Badge variant="outline">{position.symbol}</Badge>
                          </div>
                          <div>
                            <div className="font-semibold">Entry: ${position.entryPrice.toFixed(2)}</div>
                            <div className="text-sm text-muted-foreground">
                              Size: {position.size.toFixed(6)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${computePnL(position) >= 0 ? "text-trading-profit" : "text-trading-loss"}`}>
                            {computePnL(position) >= 0 ? "+" : ""}${computePnL(position).toFixed(2)}
                          </div>
                          <div className={`text-sm ${computePnLPercent(position) >= 0 ? "text-trading-profit" : "text-trading-loss"}`}>
                            {computePnLPercent(position).toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex justify-between">
                        <span>Open: {formatDateTime(position.openTime)}</span>
                        <span>Lev: {position.leverage}x</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {positions.filter(p => p.status === "OPEN").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No open positions
                  </div>
                )}
              </TabsContent>

              <TabsContent value="closed" className="space-y-4">
                {positions.filter(p => p.status === "CLOSED").map((position) => (
                  <Card key={position.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {position.side === "BUY" ? (
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
                              Size: {position.size.toFixed(6)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${position.pnl >= 0 ? "text-trading-profit" : "text-trading-loss"}`}>
                            {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)}
                          </div>
                          <div className={`text-sm ${position.pnlPercent >= 0 ? "text-trading-profit" : "text-trading-loss"}`}>
                            {position.pnlPercent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex justify-between">
                        <span>Open: {formatDateTime(position.openTime)}</span>
                        <span>Close: {formatDateTime(position.closeTime)}</span>
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
                {positions.filter(p => p.status === "CLOSED").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No closed positions
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        );

      case "signals":
        return (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Trading Signals</h2>
              <div className="flex items-center gap-4">
                <Button 
                  onClick={handleScanSignals}
                  disabled={isScanning}
                  className="flex items-center gap-2"
                >
                  <Activity className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  {isScanning ? 'Scanning...' : 'Scan Signals'}
                </Button>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <span>{signals.filter(s => s.status === "PENDING").length} Pending</span>
                  <span>•</span>
                  <span>{signals.filter(s => s.status === "EXECUTED").length} Executed</span>
                  <span>•</span>
                  <span>{signals.filter(s => s.status === "EXPIRED").length} Expired</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Signals</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{signals.filter(s => s.status === "PENDING").length}</div>
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
                    {((signals.filter(s => s.status === "EXECUTED").length / Math.max(signals.length, 1)) * 100).toFixed(0)}%
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
                  <div className="text-2xl font-bold font-mono">{signals.filter(s => s.confidence === "HIGH").length}</div>
                  <p className="text-xs text-muted-foreground">Strong signals</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="pending" className="w-full">
              <TabsList>
                <TabsTrigger value="pending">Pending ({signals.filter(s => s.status === "PENDING").length})</TabsTrigger>
                <TabsTrigger value="executed">Executed</TabsTrigger>
                <TabsTrigger value="expired">Expired</TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4">
                {signals.filter(s => s.status === "PENDING").map((signal) => (
                  <Card key={signal.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {signal.signalType === "BUY" ? (
                              <TrendingUp className="w-4 h-4 text-trading-profit" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-trading-loss" />
                            )}
                            <Badge 
                              variant={signal.confidence === "HIGH" ? "default" : 
                                       signal.confidence === "MEDIUM" ? "secondary" : "outline"}
                            >
                              {signal.confidence}
                            </Badge>
                          </div>
                          <div>
                            <div className="font-semibold">{signal.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              {signal.signalType} @ ${signal.entryPrice.toFixed(2)} • Score: {signal.score}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(signal.createdAt)}
                          </div>
                        </div>
                        <Button size="sm" variant="default" onClick={() => handleExecuteSignal(signal)}>
                          Execute Signal
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {signals.filter(s => s.status === "PENDING").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending signals
                  </div>
                )}
              </TabsContent>

              <TabsContent value="executed" className="space-y-4">
                {signals.filter(s => s.status === "EXECUTED").map((signal) => (
                  <Card key={signal.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {signal.signalType === "BUY" ? (
                              <TrendingUp className="w-4 h-4 text-trading-profit" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-trading-loss" />
                            )}
                            <Badge 
                              variant={signal.confidence === "HIGH" ? "default" : 
                                       signal.confidence === "MEDIUM" ? "secondary" : "outline"}
                            >
                              {signal.confidence}
                            </Badge>
                          </div>
                          <div>
                            <div className="font-semibold">{signal.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              {signal.signalType} • Target: ${signal.entryPrice.toFixed(2)} • Executed: ${signal.executedPrice?.toFixed(2) || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(signal.createdAt)}
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
                {signals.filter(s => s.status === "EXECUTED").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No executed signals
                  </div>
                )}
              </TabsContent>

              <TabsContent value="expired" className="space-y-4">
                {signals.filter(s => s.status === "EXPIRED").map((signal) => (
                  <Card key={signal.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {signal.signalType === "BUY" ? (
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
                              {signal.signalType} @ ${signal.entryPrice.toFixed(2)} • Score: ${signal.score}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(signal.createdAt)}
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
                {signals.filter(s => s.status === "EXPIRED").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No expired signals
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        );

      case "analytics":
        return <AnalyticsPage />;

      case "settings":
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
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total PnL</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold font-mono ${stats.totalPnL >= 0 ? "text-trading-profit" : "text-trading-loss"}`}>
                    {stats.totalPnL >= 0 ? "+" : ""}${stats.totalPnL.toFixed(2)}
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
                onExecuteTrade={(trade) => executeTrade.mutate(trade)}
              />
            </div>
          </div>
        );
    }
  };

  // Initialize React Query client
  const queryClientInstance = new QueryClient();

  return (
    <QueryClientProvider client={queryClientInstance}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <SidebarProvider>
          <div className="flex h-screen bg-background">
            <TradingSidebar
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              stats={{
                activePositions: positions.filter(p => p.status === "OPEN").length,
                pendingSignals: signals.filter(s => s.status === "PENDING").length,
                dailyPnL,
                isAutomatedTradingEnabled
              }}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
              <TradingHeader
                tradingMode={tradingMode}
                onTradingModeChange={(mode) => {
                  if (mode === "real") {
                    if (!confirm("⚠️ Warning: You are switching to LIVE trading mode. Real money will be at risk!")) return;
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
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;