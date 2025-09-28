import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Calculator, AlertTriangle } from "lucide-react";

interface TradeExecutionPanelProps {
  selectedSymbol: string;
  currentPrice: number;
  balance: {
    available: number;
    used: number;
  };
  onExecuteTrade: (trade: {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage: number;
  }) => void;
}

export default function TradeExecutionPanel({
  selectedSymbol,
  currentPrice,
  balance,
  onExecuteTrade,
}: TradeExecutionPanelProps) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(currentPrice.toString());
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [leverage, setLeverage] = useState("10");

  const calculatePositionValue = () => {
    const qty = parseFloat(quantity) || 0;
    const prc = parseFloat(price) || currentPrice;
    return qty * prc;
  };

  const calculateMarginRequired = () => {
    const positionValue = calculatePositionValue();
    const lev = parseInt(leverage) || 1;
    return positionValue / lev;
  };

  const calculateMaxQuantity = () => {
    const lev = parseInt(leverage) || 1;
    const prc = parseFloat(price) || currentPrice;
    return (balance.available * lev) / prc;
  };

  const handleExecute = () => {
    const trade = {
      symbol: selectedSymbol,
      side,
      quantity: parseFloat(quantity),
      price: orderType === "market" ? currentPrice : parseFloat(price),
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      leverage: parseInt(leverage),
    };
    onExecuteTrade(trade);
    console.log('Trade executed:', trade);
    
    // Reset form
    setQuantity("");
    setStopLoss("");
    setTakeProfit("");
  };

  const isValidTrade = () => {
    const qty = parseFloat(quantity) || 0;
    const marginRequired = calculateMarginRequired();
    return qty > 0 && marginRequired <= balance.available && marginRequired > 0;
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Trade Execution</span>
          <Badge variant="outline" data-testid="badge-symbol">
            {selectedSymbol}
          </Badge>
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Current Price: <span className="font-mono font-semibold" data-testid="text-current-price">${currentPrice.toFixed(4)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Buy/Sell Toggle */}
        <Tabs value={side} onValueChange={(value) => setSide(value as "BUY" | "SELL")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="BUY" className="text-trading-profit" data-testid="tab-buy">
              <TrendingUp className="w-4 h-4 mr-2" />
              BUY
            </TabsTrigger>
            <TabsTrigger value="SELL" className="text-trading-loss" data-testid="tab-sell">
              <TrendingDown className="w-4 h-4 mr-2" />
              SELL
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Order Type */}
        <div className="space-y-2">
          <Label>Order Type</Label>
          <Select value={orderType} onValueChange={(value) => setOrderType(value as "market" | "limit")}>
            <SelectTrigger data-testid="select-order-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="market">Market Order</SelectItem>
              <SelectItem value="limit">Limit Order</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Price (for limit orders) */}
        {orderType === "limit" && (
          <div className="space-y-2">
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              step="0.0001"
              data-testid="input-price"
            />
          </div>
        )}

        {/* Leverage */}
        <div className="space-y-2">
          <Label>Leverage</Label>
          <Select value={leverage} onValueChange={setLeverage}>
            <SelectTrigger data-testid="select-leverage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1x</SelectItem>
              <SelectItem value="2">2x</SelectItem>
              <SelectItem value="5">5x</SelectItem>
              <SelectItem value="10">10x</SelectItem>
              <SelectItem value="20">20x</SelectItem>
              <SelectItem value="50">50x</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="quantity">Quantity</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQuantity(calculateMaxQuantity().toFixed(6))}
              data-testid="button-max-quantity"
            >
              Max
            </Button>
          </div>
          <Input
            id="quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            step="0.000001"
            placeholder="0.000000"
            data-testid="input-quantity"
          />
          <div className="text-xs text-muted-foreground">
            Max: {calculateMaxQuantity().toFixed(6)}
          </div>
        </div>

        <Separator />

        {/* Stop Loss & Take Profit */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="stop-loss">Stop Loss</Label>
            <Input
              id="stop-loss"
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              step="0.0001"
              placeholder="Optional"
              data-testid="input-stop-loss"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="take-profit">Take Profit</Label>
            <Input
              id="take-profit"
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              step="0.0001"
              placeholder="Optional"
              data-testid="input-take-profit"
            />
          </div>
        </div>

        <Separator />

        {/* Position Summary */}
        <div className="space-y-2 bg-muted p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            <span className="font-semibold text-sm">Position Summary</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Position Value:</span>
              <span className="font-mono" data-testid="text-position-value">
                ${calculatePositionValue().toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Margin Required:</span>
              <span className="font-mono" data-testid="text-margin-required">
                ${calculateMarginRequired().toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Available Balance:</span>
              <span className="font-mono" data-testid="text-available-balance">
                ${balance.available.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Execute Button */}
        <Button
          className={`w-full ${side === "BUY" ? "bg-trading-profit hover:bg-trading-profit/90" : "bg-trading-loss hover:bg-trading-loss/90"}`}
          disabled={!isValidTrade()}
          onClick={handleExecute}
          data-testid="button-execute-trade"
        >
          {side === "BUY" ? "Buy" : "Sell"} {selectedSymbol}
        </Button>

        {!isValidTrade() && quantity && (
          <div className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="w-4 h-4" />
            <span>Insufficient balance or invalid quantity</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}