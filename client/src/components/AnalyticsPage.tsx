
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

interface AnalyticsData {
  performance: {
    totalReturn: number;
    totalReturnPercent: number;
    weeklyStats: {
      thisWeek: number;
      lastWeek: number;
      changePercent: number;
    };
    monthlyStats: {
      thisMonth: number;
      lastMonth: number;
      changePercent: number;
    };
    yearToDate: {
      return: number;
      returnPercent: number;
    };
  };
  trading: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWinAmount: number;
    avgLossAmount: number;
    largestWin: number;
    largestLoss: number;
    profitFactor: number;
  };
  monthly: Array<{
    month: string;
    profit: number;
    trades: number;
    winRate: number;
  }>;
  daily: Array<{
    date: string;
    pnl: number;
    cumulative: number;
  }>;
  assets: Array<{
    symbol: string;
    trades: number;
    pnl: number;
    winRate: number;
  }>;
}

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"1M" | "3M" | "6M" | "1Y">("3M");

  const Analytics: AnalyticsData = {
    performance: {
      totalReturn: 2847.56,
      totalReturnPercent: 28.48,
      weeklyStats: {
        thisWeek: 245.75,
        lastWeek: 189.23,
        changePercent: 29.85,
      },
      monthlyStats: {
        thisMonth: 1024.67,
        lastMonth: 896.34,
        changePercent: 14.32,
      },
      yearToDate: {
        return: 2847.56,
        returnPercent: 28.48,
      },
    },
    trading: {
      totalTrades: 142,
      winningTrades: 89,
      losingTrades: 53,
      winRate: 62.68,
      avgWinAmount: 45.67,
      avgLossAmount: -28.34,
      largestWin: 234.56,
      largestLoss: -156.78,
      profitFactor: 1.85,
    },
    monthly: [
      { month: "Jan", profit: 567.89, trades: 25, winRate: 64 },
      { month: "Feb", profit: 423.45, trades: 32, winRate: 59 },
      { month: "Mar", profit: 789.23, trades: 28, winRate: 68 },
      { month: "Apr", profit: 345.67, trades: 31, winRate: 61 },
      { month: "May", profit: 612.34, trades: 26, winRate: 65 },
      { month: "Jun", profit: 109.98, trades: 30, winRate: 57 },
    ],
    daily: [
      { date: "2024-01-01", pnl: 45.67, cumulative: 45.67 },
      { date: "2024-01-02", pnl: -23.45, cumulative: 22.22 },
      { date: "2024-01-03", pnl: 78.90, cumulative: 101.12 },
      { date: "2024-01-04", pnl: 34.56, cumulative: 135.68 },
      { date: "2024-01-05", pnl: -12.34, cumulative: 123.34 },
      { date: "2024-01-06", pnl: 89.23, cumulative: 212.57 },
      { date: "2024-01-07", pnl: 56.78, cumulative: 269.35 },
      { date: "2024-01-08", pnl: -34.12, cumulative: 235.23 },
      { date: "2024-01-09", pnl: 67.89, cumulative: 303.12 },
      { date: "2024-01-10", pnl: 23.45, cumulative: 326.57 },
    ],
    assets: [
      { symbol: "BTCUSDT", trades: 45, pnl: 1245.67, winRate: 67 },
      { symbol: "ETHUSDT", trades: 38, pnl: 892.34, winRate: 63 },
      { symbol: "SOLUSDT", trades: 29, pnl: 456.78, winRate: 59 },
      { symbol: "XRPUSDT", trades: 22, pnl: 234.56, winRate: 64 },
      { symbol: "DOGEUSDT", trades: 8, pnl: 18.21, winRate: 50 },
    ],
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
    { name: "Winning Trades", value: Analytics.trading.winningTrades, color: "#22c55e" },
    { name: "Losing Trades", value: Analytics.trading.losingTrades, color: "#ef4444" },
  ];

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
            <div className={`text-2xl font-bold font-mono ${getPnLColor(Analytics.performance.totalReturn)}`}>
              {formatPnL(Analytics.performance.totalReturn)}
            </div>
            <p className={`text-xs ${getPnLColor(Analytics.performance.totalReturnPercent)}`}>
              {formatPercent(Analytics.performance.totalReturnPercent)} total return
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{Analytics.trading.winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {Analytics.trading.winningTrades} wins, {Analytics.trading.losingTrades} losses
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{Analytics.trading.totalTrades}</div>
            <p className="text-xs text-muted-foreground">Executed positions</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{Analytics.trading.profitFactor.toFixed(2)}</div>
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
                    <div className={`text-xl font-bold font-mono ${getPnLColor(Analytics.performance.weeklyStats.thisWeek)}`}>
                      {formatPnL(Analytics.performance.weeklyStats.thisWeek)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Last Week</div>
                    <div className={`text-lg font-mono ${getPnLColor(Analytics.performance.weeklyStats.lastWeek)}`}>
                      {formatPnL(Analytics.performance.weeklyStats.lastWeek)}
                    </div>
                  </div>
                  <div className="pt-2">
                    <Badge variant={Analytics.performance.weeklyStats.changePercent >= 0 ? "default" : "destructive"}>
                      {formatPercent(Analytics.performance.weeklyStats.changePercent)} vs last week
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
                    <div className={`text-xl font-bold font-mono ${getPnLColor(Analytics.performance.monthlyStats.thisMonth)}`}>
                      {formatPnL(Analytics.performance.monthlyStats.thisMonth)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Last Month</div>
                    <div className={`text-lg font-mono ${getPnLColor(Analytics.performance.monthlyStats.lastMonth)}`}>
                      {formatPnL(Analytics.performance.monthlyStats.lastMonth)}
                    </div>
                  </div>
                  <div className="pt-2">
                    <Badge variant={Analytics.performance.monthlyStats.changePercent >= 0 ? "default" : "destructive"}>
                      {formatPercent(Analytics.performance.monthlyStats.changePercent)} vs last month
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
                    <div className={`text-xl font-bold font-mono ${getPnLColor(Analytics.performance.yearToDate.return)}`}>
                      {formatPnL(Analytics.performance.yearToDate.return)}
                    </div>
                  </div>
                  <div className="pt-2">
                    <Badge variant={Analytics.performance.yearToDate.returnPercent >= 0 ? "default" : "destructive"}>
                      {formatPercent(Analytics.performance.yearToDate.returnPercent)} return
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cumulative P&L Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cumulative P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <AreaChart data={Analytics.daily}>
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
        </TabsContent>

        <TabsContent value="trades" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Win/Loss Pie Chart */}
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
                      +${Analytics.trading.avgWinAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Average Loss</span>
                    <span className="font-mono font-semibold text-trading-loss">
                      ${Analytics.trading.avgLossAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Largest Win</span>
                    <span className="font-mono font-semibold text-trading-profit">
                      +${Analytics.trading.largestWin.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Largest Loss</span>
                    <span className="font-mono font-semibold text-trading-loss">
                      ${Analytics.trading.largestLoss.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[400px]">
                <BarChart data={Analytics.monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="profit" fill="hsl(var(--chart-1))" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Analytics.assets.map((asset) => (
                  <div key={asset.symbol} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="font-semibold">{asset.symbol}</div>
                      <Badge variant="secondary">{asset.trades} trades</Badge>
                      <Badge variant={asset.winRate >= 60 ? "default" : "outline"}>
                        {asset.winRate}% win rate
                      </Badge>
                    </div>
                    <div className={`font-mono font-semibold ${getPnLColor(asset.pnl)}`}>
                      {formatPnL(asset.pnl)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
