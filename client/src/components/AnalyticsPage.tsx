
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Target,
  Calendar,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
  created_at: string;
  leverage: number;
  risk_reward: number;
}

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"1M" | "3M" | "6M" | "1Y">("3M");

  // Fetch real data from API
  const { data: positions = [], isLoading: loadingPositions } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: async () => {
      const response = await fetch('/api/positions');
      if (!response.ok) throw new Error('Failed to fetch positions');
      return await response.json();
    },
  });

  const { data: signals = [], isLoading: loadingSignals } = useQuery<Signal[]>({
    queryKey: ['signals'],
    queryFn: async () => {
      const response = await fetch('/api/signals');
      if (!response.ok) throw new Error('Failed to fetch signals');
      return await response.json();
    },
  });

  // Calculate analytics from real data
  const closedPositions = positions.filter(p => p.status === 'CLOSED');
  const openPositions = positions.filter(p => p.status === 'OPEN');
  
  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const winningTrades = closedPositions.filter(p => p.pnl > 0);
  const losingTrades = closedPositions.filter(p => p.pnl <= 0);
  const winRate = closedPositions.length > 0 ? (winningTrades.length / closedPositions.length) * 100 : 0;
  
  const avgWinAmount = winningTrades.length > 0 ? winningTrades.reduce((sum, p) => sum + p.pnl, 0) / winningTrades.length : 0;
  const avgLossAmount = losingTrades.length > 0 ? losingTrades.reduce((sum, p) => sum + p.pnl, 0) / losingTrades.length : 0;
  
  const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(p => p.pnl)) : 0;
  const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(p => p.pnl)) : 0;
  
  const profitFactor = avgLossAmount !== 0 ? Math.abs(avgWinAmount / avgLossAmount) : 0;

  // Generate weekly stats
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const thisWeekPositions = closedPositions.filter(p => p.closeTime && new Date(p.closeTime) >= oneWeekAgo);
  const lastWeekPositions = closedPositions.filter(p => p.closeTime && new Date(p.closeTime) >= twoWeeksAgo && new Date(p.closeTime) < oneWeekAgo);
  
  const thisWeekPnL = thisWeekPositions.reduce((sum, p) => sum + p.pnl, 0);
  const lastWeekPnL = lastWeekPositions.reduce((sum, p) => sum + p.pnl, 0);
  const weeklyChangePercent = lastWeekPnL !== 0 ? ((thisWeekPnL - lastWeekPnL) / Math.abs(lastWeekPnL)) * 100 : 0;

  // Generate monthly stats
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  
  const thisMonthPositions = closedPositions.filter(p => p.closeTime && new Date(p.closeTime) >= oneMonthAgo);
  const lastMonthPositions = closedPositions.filter(p => p.closeTime && new Date(p.closeTime) >= twoMonthsAgo && new Date(p.closeTime) < oneMonthAgo);
  
  const thisMonthPnL = thisMonthPositions.reduce((sum, p) => sum + p.pnl, 0);
  const lastMonthPnL = lastMonthPositions.reduce((sum, p) => sum + p.pnl, 0);
  const monthlyChangePercent = lastMonthPnL !== 0 ? ((thisMonthPnL - lastMonthPnL) / Math.abs(lastMonthPnL)) * 100 : 0;

  // Generate daily P&L data for chart
  const dailyPnLData = closedPositions
    .filter(p => p.closeTime)
    .sort((a, b) => new Date(a.closeTime!).getTime() - new Date(b.closeTime!).getTime())
    .reduce((acc, position) => {
      const date = new Date(position.closeTime!).toISOString().split('T')[0];
      const existing = acc.find(d => d.date === date);
      if (existing) {
        existing.pnl += position.pnl;
      } else {
        acc.push({ date, pnl: position.pnl, cumulative: 0 });
      }
      return acc;
    }, [] as { date: string; pnl: number; cumulative: number }[])
    .slice(-10); // Last 10 days

  // Calculate cumulative P&L
  let cumulativePnL = 0;
  dailyPnLData.forEach(day => {
    cumulativePnL += day.pnl;
    day.cumulative = cumulativePnL;
  });

  // Generate monthly data for chart
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
    
    const monthPositions = closedPositions.filter(p => {
      if (!p.closeTime) return false;
      const closeDate = new Date(p.closeTime);
      return closeDate >= monthDate && closeDate < nextMonthDate;
    });
    
    const profit = monthPositions.reduce((sum, p) => sum + p.pnl, 0);
    const trades = monthPositions.length;
    const wins = monthPositions.filter(p => p.pnl > 0).length;
    const winRate = trades > 0 ? (wins / trades) * 100 : 0;
    
    return {
      month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
      profit,
      trades,
      winRate,
    };
  });

  // Generate asset performance data
  const assetPerformance = Object.entries(
    positions.reduce((acc, position) => {
      if (!acc[position.symbol]) {
        acc[position.symbol] = { trades: 0, pnl: 0, wins: 0 };
      }
      acc[position.symbol].trades++;
      acc[position.symbol].pnl += position.pnl;
      if (position.pnl > 0) acc[position.symbol].wins++;
      return acc;
    }, {} as Record<string, { trades: number; pnl: number; wins: number }>)
  ).map(([symbol, data]) => ({
    symbol,
    trades: data.trades,
    pnl: data.pnl,
    winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
  })).sort((a, b) => b.pnl - a.pnl).slice(0, 5); // Top 5 assets

  const analytics = {
    performance: {
      totalReturn: totalPnL,
      totalReturnPercent: totalPnL > 0 ? (totalPnL / 10000) * 100 : 0, // Assuming 10k starting capital
      weeklyStats: {
        thisWeek: thisWeekPnL,
        lastWeek: lastWeekPnL,
        changePercent: weeklyChangePercent,
      },
      monthlyStats: {
        thisMonth: thisMonthPnL,
        lastMonth: lastMonthPnL,
        changePercent: monthlyChangePercent,
      },
      yearToDate: {
        return: totalPnL,
        returnPercent: totalPnL > 0 ? (totalPnL / 10000) * 100 : 0,
      },
    },
    trading: {
      totalTrades: positions.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      avgWinAmount,
      avgLossAmount,
      largestWin,
      largestLoss,
      profitFactor,
    },
    monthly: monthlyData,
    daily: dailyPnLData,
    assets: assetPerformance,
  };

  const formatPnL = (pnl: number) => {
    const sign = pnl >= 0 ? "+" : "";
    return `${sign}$${pnl.toFixed(2)}`;
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? "text-trading-profit" : "text-trading-loss";
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(2)}%`;
  };

  const chartConfig = {
    profit: {
      label: "Profit",
      color: "hsl(var(--chart-1))",
    },
    loss: {
      label: "Loss", 
      color: "hsl(var(--chart-2))",
    },
    cumulative: {
      label: "Cumulative P&L",
      color: "hsl(var(--chart-3))",
    },
  };

  const pieData = [
    { name: "Winning Trades", value: analytics.trading.winningTrades, color: "#22c55e" },
    { name: "Losing Trades", value: analytics.trading.losingTrades, color: "#ef4444" },
  ];

  if (loadingPositions || loadingSignals) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading analytics data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Comprehensive trading performance analysis</p>
        </div>
        <div className="flex gap-2">
          {(["1M", "3M", "6M", "1Y"] as const).map((period) => (
            <Button
              key={period}
              variant={timeframe === period ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeframe(period)}
              data-testid={`button-timeframe-${period.toLowerCase()}`}
            >
              {period}
            </Button>
          ))}
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Return</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${getPnLColor(analytics.performance.totalReturn)}`}>
              {formatPnL(analytics.performance.totalReturn)}
            </div>
            <p className={`text-xs ${getPnLColor(analytics.performance.totalReturnPercent)}`}>
              {formatPercent(analytics.performance.totalReturnPercent)} total return
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{analytics.trading.winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.trading.winningTrades} wins, {analytics.trading.losingTrades} losses
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{analytics.trading.totalTrades}</div>
            <p className="text-xs text-muted-foreground">Executed positions</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{analytics.trading.profitFactor.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Profit to loss ratio</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance" data-testid="tab-performance">
            <BarChart3 className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="trades" data-testid="tab-trades">
            <PieChartIcon className="w-4 h-4 mr-2" />
            Trade Analysis
          </TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">
            <Calendar className="w-4 h-4 mr-2" />
            Monthly View
          </TabsTrigger>
          <TabsTrigger value="assets" data-testid="tab-assets">
            <Activity className="w-4 h-4 mr-2" />
            Asset Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Weekly Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Weekly Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">This Week</div>
                    <div className={`text-xl font-bold font-mono ${getPnLColor(analytics.performance.weeklyStats.thisWeek)}`}>
                      {formatPnL(analytics.performance.weeklyStats.thisWeek)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Last Week</div>
                    <div className={`text-lg font-mono ${getPnLColor(analytics.performance.weeklyStats.lastWeek)}`}>
                      {formatPnL(analytics.performance.weeklyStats.lastWeek)}
                    </div>
                  </div>
                  <div className="pt-2">
                    <Badge variant={analytics.performance.weeklyStats.changePercent >= 0 ? "default" : "destructive"}>
                      {formatPercent(analytics.performance.weeklyStats.changePercent)} vs last week
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Monthly Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">This Month</div>
                    <div className={`text-xl font-bold font-mono ${getPnLColor(analytics.performance.monthlyStats.thisMonth)}`}>
                      {formatPnL(analytics.performance.monthlyStats.thisMonth)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Last Month</div>
                    <div className={`text-lg font-mono ${getPnLColor(analytics.performance.monthlyStats.lastMonth)}`}>
                      {formatPnL(analytics.performance.monthlyStats.lastMonth)}
                    </div>
                  </div>
                  <div className="pt-2">
                    <Badge variant={analytics.performance.monthlyStats.changePercent >= 0 ? "default" : "destructive"}>
                      {formatPercent(analytics.performance.monthlyStats.changePercent)} vs last month
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Year to Date */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Year to Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">YTD Return</div>
                    <div className={`text-xl font-bold font-mono ${getPnLColor(analytics.performance.yearToDate.return)}`}>
                      {formatPnL(analytics.performance.yearToDate.return)}
                    </div>
                  </div>
                  <div className="pt-2">
                    <Badge variant={analytics.performance.yearToDate.returnPercent >= 0 ? "default" : "destructive"}>
                      {formatPercent(analytics.performance.yearToDate.returnPercent)} return
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cumulative P&L Chart */}
          {analytics.daily.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cumulative P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <AreaChart data={analytics.daily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="hsl(var(--chart-1))"
                      fill="hsl(var(--chart-1))"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trades" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Win/Loss Pie Chart */}
            {analytics.trading.totalTrades > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Win/Loss Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {/* Trade Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Trade Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Average Win</span>
                    <span className="font-mono font-semibold text-trading-profit">
                      +${analytics.trading.avgWinAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Average Loss</span>
                    <span className="font-mono font-semibold text-trading-loss">
                      ${analytics.trading.avgLossAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Largest Win</span>
                    <span className="font-mono font-semibold text-trading-profit">
                      +${analytics.trading.largestWin.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Largest Loss</span>
                    <span className="font-mono font-semibold text-trading-loss">
                      ${analytics.trading.largestLoss.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          {analytics.monthly.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Monthly Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[400px]">
                  <BarChart data={analytics.monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="profit" fill="hsl(var(--chart-1))" />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.assets.length > 0 ? (
                  analytics.assets.map((asset) => (
                    <div key={asset.symbol} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="font-semibold">{asset.symbol}</div>
                        <Badge variant="secondary">{asset.trades} trades</Badge>
                        <Badge variant={asset.winRate >= 60 ? "default" : "outline"}>
                          {asset.winRate.toFixed(0)}% win rate
                        </Badge>
                      </div>
                      <div className={`font-mono font-semibold ${getPnLColor(asset.pnl)}`}>
                        {formatPnL(asset.pnl)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No asset performance data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
