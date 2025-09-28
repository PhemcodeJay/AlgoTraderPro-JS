import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Star,
  Volume2,
  Clock
} from "lucide-react";

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  isFavorite?: boolean;
}

interface MarketOverviewProps {
  marketData: MarketData[];
  onSymbolSelect: (symbol: string) => void;
  selectedSymbol?: string;
}

export default function MarketOverview({ 
  marketData, 
  onSymbolSelect, 
  selectedSymbol 
}: MarketOverviewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"price" | "change" | "volume">("change");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filteredData = marketData
    .filter(item => 
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case "price":
          aValue = a.price;
          bValue = b.price;
          break;
        case "change":
          aValue = a.changePercent24h;
          bValue = b.changePercent24h;
          break;
        case "volume":
          aValue = a.volume24h;
          bValue = b.volume24h;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === "asc") {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

  const toggleFavorite = (symbol: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(symbol)) {
      newFavorites.delete(symbol);
    } else {
      newFavorites.add(symbol);
    }
    setFavorites(newFavorites);
    console.log('Toggled favorite:', symbol);
  };

  const handleSort = (column: "price" | "change" | "volume") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const formatPrice = (price: number) => {
    if (price < 1) {
      return price.toFixed(6);
    } else if (price < 100) {
      return price.toFixed(4);
    } else {
      return price.toFixed(2);
    }
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) {
      return `${(volume / 1e9).toFixed(1)}B`;
    } else if (volume >= 1e6) {
      return `${(volume / 1e6).toFixed(1)}M`;
    } else if (volume >= 1e3) {
      return `${(volume / 1e3).toFixed(1)}K`;
    } else {
      return volume.toFixed(0);
    }
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? "text-trading-profit" : "text-trading-loss";
  };

  const getChangeIcon = (change: number) => {
    return change >= 0 ? TrendingUp : TrendingDown;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Market Overview</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Real-time data</span>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search symbols..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-symbols"
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Column Headers */}
        <div className="grid grid-cols-6 gap-4 pb-2 border-b border-border text-sm font-medium text-muted-foreground">
          <div>Symbol</div>
          <div 
            className="cursor-pointer hover:text-foreground flex items-center gap-1"
            onClick={() => handleSort("price")}
            data-testid="header-price"
          >
            Price {sortBy === "price" && (sortOrder === "desc" ? "↓" : "↑")}
          </div>
          <div 
            className="cursor-pointer hover:text-foreground flex items-center gap-1"
            onClick={() => handleSort("change")}
            data-testid="header-change"
          >
            24h Change {sortBy === "change" && (sortOrder === "desc" ? "↓" : "↑")}
          </div>
          <div 
            className="cursor-pointer hover:text-foreground flex items-center gap-1"
            onClick={() => handleSort("volume")}
            data-testid="header-volume"
          >
            Volume {sortBy === "volume" && (sortOrder === "desc" ? "↓" : "↑")}
          </div>
          <div>24h High/Low</div>
          <div>Actions</div>
        </div>

        {/* Market Data Rows */}
        <div className="space-y-1 mt-2 max-h-96 overflow-y-auto">
          {filteredData.map((item) => {
            const ChangeIcon = getChangeIcon(item.changePercent24h);
            const isSelected = selectedSymbol === item.symbol;
            
            return (
              <div
                key={item.symbol}
                className={`grid grid-cols-6 gap-4 py-2 px-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected 
                    ? "bg-primary/10 border border-primary/20" 
                    : "hover:bg-muted"
                }`}
                onClick={() => onSymbolSelect(item.symbol)}
                data-testid={`market-row-${item.symbol}`}
              >
                {/* Symbol */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(item.symbol);
                    }}
                    data-testid={`button-favorite-${item.symbol}`}
                  >
                    <Star 
                      className={`w-3 h-3 ${favorites.has(item.symbol) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} 
                    />
                  </Button>
                  <div>
                    <div className="font-semibold text-sm">{item.symbol}</div>
                    {favorites.has(item.symbol) && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Favorite
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="font-mono font-semibold" data-testid={`price-${item.symbol}`}>
                  ${formatPrice(item.price)}
                </div>

                {/* 24h Change */}
                <div className="flex items-center gap-1">
                  <ChangeIcon className={`w-3 h-3 ${getChangeColor(item.changePercent24h)}`} />
                  <div className={`font-mono text-sm ${getChangeColor(item.changePercent24h)}`} data-testid={`change-${item.symbol}`}>
                    {item.changePercent24h >= 0 ? "+" : ""}{item.changePercent24h.toFixed(2)}%
                  </div>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-1 text-sm">
                  <Volume2 className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono" data-testid={`volume-${item.symbol}`}>
                    {formatVolume(item.volume24h)}
                  </span>
                </div>

                {/* High/Low */}
                <div className="text-sm">
                  <div className="font-mono text-trading-profit">
                    H: ${formatPrice(item.high24h)}
                  </div>
                  <div className="font-mono text-trading-loss">
                    L: ${formatPrice(item.low24h)}
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSymbolSelect(item.symbol);
                    }}
                    data-testid={`button-select-${item.symbol}`}
                  >
                    {isSelected ? "Selected" : "Trade"}
                  </Button>
                </div>
              </div>
            );
          })}
          
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No symbols found matching "{searchTerm}"
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}