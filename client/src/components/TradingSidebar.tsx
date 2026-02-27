import { useState } from "react";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel,
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarRail
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  TrendingUp, 
  BarChart3, 
  Settings, 
  Activity,
  Zap,
  AlertTriangle,
  Clock,
  DollarSign
} from "lucide-react";

interface TradingSidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  stats: {
    activePositions: number;
    pendingSignals: number;
    dailyPnL: number;
    isAutomatedTradingEnabled: boolean;
  };
}

export default function TradingSidebar({ currentPage, onPageChange, stats }: TradingSidebarProps) {
  const menuItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      id: "dashboard",
      badge: null
    },
    {
      title: "Positions",
      icon: Activity,
      id: "positions",
      badge: stats.activePositions > 0 ? stats.activePositions.toString() : null
    },
    {
      title: "Signals",
      icon: TrendingUp,
      id: "signals",
      badge: stats.pendingSignals > 0 ? stats.pendingSignals.toString() : null
    },
    {
      title: "Trading Bot",
      icon: Zap,
      id: "bot",
      badge: stats.isAutomatedTradingEnabled ? "ON" : "OFF"
    },
    {
      title: "Analytics",
      icon: BarChart3,
      id: "analytics",
      badge: null
    },
    {
      title: "Settings",
      icon: Settings,
      id: "settings",
      badge: null
    }
  ];

  const formatPnL = (pnl: number) => {
    const sign = pnl >= 0 ? "+" : "";
    return `${sign}$${Math.abs(pnl).toFixed(2)}`;
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? "text-trading-profit" : "text-trading-loss";
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sidebar-foreground">AlgoTrader</h2>
            <p className="text-xs text-muted-foreground">Pro Trading</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentPage === item.id}
                    onClick={() => onPageChange(item.id)}
                    data-testid={`nav-${item.id}`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                    {item.badge && (
                      <Badge 
                        variant={
                          item.id === "bot" 
                            ? (stats.isAutomatedTradingEnabled ? "default" : "secondary")
                            : "secondary"
                        }
                        className="ml-auto text-xs"
                        data-testid={`badge-${item.id}`}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Quick Stats</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Daily P&L</span>
                <span className={`font-mono font-semibold ${getPnLColor(stats.dailyPnL)}`} data-testid="text-daily-pnl">
                  {formatPnL(stats.dailyPnL)}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Positions</span>
                <span className="font-semibold" data-testid="text-sidebar-positions">
                  {stats.activePositions}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Signals</span>
                <span className="font-semibold" data-testid="text-sidebar-signals">
                  {stats.pendingSignals}
                </span>
              </div>

              <div className="pt-2 border-t border-sidebar-border">
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${stats.isAutomatedTradingEnabled ? 'bg-trading-profit' : 'bg-muted-foreground'}`}></div>
                  <span className="text-muted-foreground">
                    Bot {stats.isAutomatedTradingEnabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="text-xs text-muted-foreground text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="w-3 h-3" />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
          <div>AlgoTrader Pro v1.0</div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}