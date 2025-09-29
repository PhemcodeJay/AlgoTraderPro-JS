import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Target,
  BarChart3,
  Zap
} from "lucide-react";
// Define interfaces locally since import is not working
interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  entryPrice: number;
  currentPrice?: number;
  pnl: number;
  pnlPercent: number;
  status: 'OPEN' | 'CLOSED';
  leverage: number;
}

interface Signal {
  id: string;
  symbol: string;
  signalType: 'BUY' | 'SELL';
  entryPrice: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
}

interface DashboardStats {
  totalPnL: number;
  winRate: number;
  totalTrades: number;
  activePositions: number;
}

interface TradingDashboardProps {
  stats: DashboardStats;
  positions: Position[];
  signals: Signal[];
  isAutomatedTradingEnabled: boolean;
  onToggleAutomatedTrading: () => void;
  onScanSignals: () => void;
  isScanning: boolean;
}

export default function TradingDashboard({
  stats,
  positions,
  signals,
  isAutomatedTradingEnabled,
  onToggleAutomatedTrading,
  onScanSignals,
  isScanning,
}: TradingDashboardProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("24h");

  const formatPnL = (pnl: number) => {
    const sign = pnl >= 0 ? "+" : "";
    return `${sign}$${pnl.toFixed(2)}`;
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? "text-trading-profit" : "text-trading-loss";
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString() + " " + 
           date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  return (
    <div className="space-y-6 p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${getPnLColor(stats.totalPnL)}`} data-testid="text-total-pnl">
              {formatPnL(stats.totalPnL)}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedTimeframe} period
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-win-rate">{stats.winRate.toFixed(0)}%</div>
            <Progress value={stats.winRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-total-trades">{stats.totalTrades}</div>
            <p className="text-xs text-muted-foreground">
              This period
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-active-positions">{stats.activePositions}</div>
            <p className="text-xs text-muted-foreground">
              Currently open
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Automated Trading Control */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Trading Bot Control
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onScanSignals}
                disabled={isScanning}
                data-testid="button-scan-signals"
              >
                <Activity className={`w-4 h-4 mr-2 ${isScanning ? "animate-spin" : ""}`} />
                {isScanning ? "Scanning..." : "Scan Signals"}
              </Button>
              <Button
                variant={isAutomatedTradingEnabled ? "destructive" : "default"}
                onClick={onToggleAutomatedTrading}
                data-testid="button-toggle-automated-trading"
              >
                {isAutomatedTradingEnabled ? "Stop Bot" : "Start Bot"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge
              variant={isAutomatedTradingEnabled ? "default" : "secondary"}
              data-testid="status-bot"
            >
              {isAutomatedTradingEnabled ? "Running" : "Stopped"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {isAutomatedTradingEnabled 
                ? "Bot is actively scanning for signals and executing trades automatically"
                : "Bot is stopped - use 'Scan Signals' for manual analysis or 'Start Bot' for automated trading"
              }
            </span>
          </div>
          {isAutomatedTradingEnabled && (
            <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium">Automated Trading Active</span>
              </div>
              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                The bot will automatically scan for signals and execute trades based on your configured settings.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Positions */}
        <Card>
          <CardHeader>
            <CardTitle>Active Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {positions.length > 0 ? (
                positions.map((position) => (
                  <div
                    key={position.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    data-testid={`position-${position.symbol}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={position.side === "BUY" ? "default" : "destructive"}>
                        {position.side}
                      </Badge>
                      <div>
                        <div className="font-semibold">{position.symbol}</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {position.size} @ ${position.entryPrice.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold font-mono ${getPnLColor(position.pnl)}`}>
                        {formatPnL(position.pnl)}
                      </div>
                      <div className={`text-sm font-mono ${getPnLColor(position.pnl)}`}>
                        ({position.pnlPercent >= 0 ? "+" : ""}{position.pnlPercent.toFixed(2)}%)
                      </div>
                      <div className="text-sm text-muted-foreground font-mono">
                        Current: ${position.currentPrice != null ? position.currentPrice.toFixed(2) : 'N/A'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No active positions
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Trading Signals */}
        <Card>
          <CardHeader>
            <CardTitle>Latest Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {signals.length > 0 ? (
                signals.map((signal) => (
                  <div
                    key={signal.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    data-testid={`signal-${signal.symbol}`}
                  >
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
                        <div className="text-sm text-muted-foreground font-mono">
                          ${signal.entryPrice?.toFixed(2) || 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold font-mono">{signal.score?.toFixed(1) || 0}%</div>
                      <Button size="sm" variant="outline" data-testid={`button-execute-${signal.symbol}`}>
                        Execute
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No signals available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}