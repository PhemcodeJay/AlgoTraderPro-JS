
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Zap, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  History,
  Shield,
  Settings2
} from "lucide-react";

interface TradingBotPageProps {
  isAutomatedTradingEnabled: boolean;
  onToggleAutomatedTrading: () => void;
  tradingConfig: any;
  positions: any[];
  signals: any[];
  onScanSignals: () => void;
  isScanning: boolean;
}

export default function TradingBotPage({
  isAutomatedTradingEnabled,
  onToggleAutomatedTrading,
  tradingConfig,
  positions,
  signals,
  onScanSignals,
  isScanning
}: TradingBotPageProps) {
  const activePositions = positions.filter(p => p.status === 'OPEN');
  
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Trading Bot</h2>
          <p className="text-muted-foreground">Manage your automated trading strategies and bot status.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Timeframe</Label>
            <div className="flex gap-1">
              {['5', '60', '240', 'D'].map((interval) => (
                <Button
                  key={interval}
                  variant={tradingConfig?.scanInterval === interval ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => {/* Update interval logic */}}
                >
                  {interval === '5' ? '5m' : interval === '60' ? '1h' : interval === '240' ? '4h' : '1d'}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-xl border border-border">
            <div className="flex flex-col items-end mr-2">
              <Label htmlFor="bot-toggle" className="text-sm font-medium mb-1">
                {isAutomatedTradingEnabled ? "Bot Active" : "Bot Inactive"}
              </Label>
              <div className="text-xs text-muted-foreground">
                {isAutomatedTradingEnabled ? "Executing trades" : "Paused"}
              </div>
            </div>
            <Switch 
              id="bot-toggle" 
              checked={isAutomatedTradingEnabled}
              onCheckedChange={onToggleAutomatedTrading}
              className="data-[state=checked]:bg-trading-profit"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 overflow-hidden border-none shadow-lg bg-gradient-to-br from-card to-muted/30">
          <CardHeader className="border-b bg-card/50 backdrop-blur-sm">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Live Execution Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${isAutomatedTradingEnabled ? 'bg-trading-profit animate-pulse' : 'bg-muted-foreground'}`} />
                  <div>
                    <div className="font-medium">Market Scanner</div>
                    <div className="text-sm text-muted-foreground">Interval: {tradingConfig?.scanInterval || 60}s</div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={onScanSignals}
                  disabled={isScanning}
                >
                  {isScanning ? <Activity className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  Force Scan
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-background/50">
                  <div className="text-sm text-muted-foreground mb-1">Risk Exposure</div>
                  <div className="text-2xl font-bold">{tradingConfig?.riskPerTrade || 0}% <span className="text-xs font-normal text-muted-foreground">per trade</span></div>
                  <Progress value={(tradingConfig?.riskPerTrade || 0) * 10} className="h-1.5 mt-2" />
                </div>
                <div className="p-4 rounded-lg border bg-background/50">
                  <div className="text-sm text-muted-foreground mb-1">Max Positions</div>
                  <div className="text-2xl font-bold">{activePositions.length} / {tradingConfig?.maxPositions || 5}</div>
                  <Progress value={(activePositions.length / (tradingConfig?.maxPositions || 5)) * 100} className="h-1.5 mt-2" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</Label>
                <div className="space-y-2">
                  {signals.slice(0, 3).map((signal, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-md bg-muted/30 text-sm">
                      <div className="flex items-center gap-3">
                        {signal.type === 'BUY' ? <TrendingUp className="w-4 h-4 text-trading-profit" /> : <TrendingDown className="w-4 h-4 text-trading-loss" />}
                        <span className="font-medium">{signal.symbol}</span>
                        <Badge variant="outline" className="text-[10px] px-1 h-4">{signal.confidence}</Badge>
                      </div>
                      <span className="text-muted-foreground">Score: {signal.score.toFixed(1)}%</span>
                    </div>
                  ))}
                  {signals.length === 0 && <div className="text-sm text-center py-4 text-muted-foreground">No recent signals found</div>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Safety Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Emergency Stop</span>
                <Button size="sm" variant="destructive">Disable All</Button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trailing SL</span>
                <Badge variant="outline">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Max Drawdown</span>
                <span className="font-medium">15.0%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Strategy Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs font-medium">Indicator Mix</div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px]">RSI</Badge>
                  <Badge variant="secondary" className="text-[10px]">MACD</Badge>
                  <Badge variant="secondary" className="text-[10px]">EMA 20/50</Badge>
                  <Badge variant="secondary" className="text-[10px]">BB</Badge>
                </div>
              </div>
              <div className="pt-2 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  ML Score Filter: {">"}75%
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
