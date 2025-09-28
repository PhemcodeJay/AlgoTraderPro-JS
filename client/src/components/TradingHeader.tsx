import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Settings, Bell, Power } from "lucide-react";
import logoUrl from "@assets/generated_images/AlgoTrader_Pro_logo_fc41ae5b.png";

interface TradingHeaderProps {
  tradingMode: "virtual" | "real";
  onTradingModeChange: (mode: "virtual" | "real") => void;
  isConnected: boolean;
  balance: {
    capital?: number;
    available: number;
    used: number;
  };
  onEmergencyStop: () => void;
  onSettingsClick: () => void;
}

export default function TradingHeader({
  tradingMode,
  onTradingModeChange,
  isConnected,
  balance,
  onEmergencyStop,
  onSettingsClick,
}: TradingHeaderProps) {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <header className="bg-card border-b border-card-border px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="AlgoTrader Pro" className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">AlgoTrader Pro</h1>
            <div className="flex items-center gap-2">
              <Badge
                variant={isConnected ? "default" : "destructive"}
                className="text-xs"
                data-testid="status-connection"
              >
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              <Badge
                variant={tradingMode === "real" ? "destructive" : "secondary"}
                className="text-xs"
                data-testid="status-trading-mode"
              >
                {tradingMode === "real" ? "LIVE" : "VIRTUAL"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Trading Mode Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Virtual</span>
            <Switch
              checked={tradingMode === "real"}
              onCheckedChange={(checked) =>
                onTradingModeChange(checked ? "real" : "virtual")
              }
              data-testid="switch-trading-mode"
            />
            <span className="text-sm text-muted-foreground">Live</span>
          </div>
        </div>

        {/* Balance Display */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Capital</div>
            <div className="font-mono font-semibold text-foreground" data-testid="text-capital">
              ${(balance?.capital || 0).toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Available</div>
            <div className="font-mono font-semibold text-trading-profit" data-testid="text-available">
              ${(balance?.available?.toFixed(2) || '0.00')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Used</div>
            <div className="font-mono font-semibold text-trading-loss" data-testid="text-used">
              ${(balance?.used?.toFixed(2) || '0.00')}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {isDarkMode ? "🌙" : "☀️"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsClick}
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-notifications"
          >
            <Bell className="w-4 h-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onEmergencyStop}
            data-testid="button-emergency-stop"
            className="gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            Emergency Stop
          </Button>
        </div>
      </div>
    </header>
  );
}