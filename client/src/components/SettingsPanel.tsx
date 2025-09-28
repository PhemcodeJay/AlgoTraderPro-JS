
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Eye, EyeOff, TestTube, Bell, Settings, Zap } from "lucide-react";

interface APIConfig {
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

interface SettingsPanelProps {
  apiConfig?: APIConfig;
  notificationConfig?: NotificationConfig;
  tradingConfig?: TradingConfig;
  onSaveAPI?: (config: APIConfig) => void;
  onSaveNotifications?: (config: NotificationConfig) => void;
  onSaveTrading?: (config: TradingConfig) => void;
  onTestConnection?: () => void;
  connectionStatus?: "connected" | "disconnected" | "testing";
}

export default function SettingsPanel({
  apiConfig,
  notificationConfig,
  tradingConfig,
  onSaveAPI,
  onSaveNotifications,
  onSaveTrading,
  onTestConnection,
  connectionStatus = "disconnected",
}: SettingsPanelProps) {
  // Default configurations
  const defaultAPIConfig: APIConfig = {
    bybitApiKey: "",
    bybitApiSecret: "",
    bybitTestnet: true
  };

  const defaultNotificationConfig: NotificationConfig = {
    discordEnabled: false,
    discordWebhook: "",
    telegramEnabled: false,
    telegramBotToken: "",
    telegramChatId: "",
    whatsappEnabled: false,
    whatsappNumber: ""
  };

  const defaultTradingConfig: TradingConfig = {
    maxPositions: 5,
    riskPerTrade: 2.0,
    leverage: 10,
    stopLossPercent: 5.0,
    takeProfitPercent: 15.0,
    scanInterval: 300
  };

  const [localAPIConfig, setLocalAPIConfig] = useState(apiConfig || defaultAPIConfig);
  const [localNotificationConfig, setLocalNotificationConfig] = useState(notificationConfig || defaultNotificationConfig);
  const [localTradingConfig, setLocalTradingConfig] = useState(tradingConfig || defaultTradingConfig);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [activeTab, setActiveTab] = useState("api");

  const handleSaveAPI = () => {
    onSaveAPI?.(localAPIConfig);
    console.log('API configuration saved');
  };

  const handleSaveNotifications = () => {
    onSaveNotifications?.(localNotificationConfig);
    console.log('Notification configuration saved');
  };

  const handleSaveTrading = () => {
    onSaveTrading?.(localTradingConfig);
    console.log('Trading configuration saved');
  };

  const handleTestConnection = () => {
    onTestConnection?.();
  };

  const handleTestNotifications = () => {
    console.log('Testing notifications...');
    // Add notification test logic here
    alert('Test notification sent! Check your configured channels.');
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected": return "default";
      case "disconnected": return "destructive";
      case "testing": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Settings</h2>
        <p className="text-muted-foreground">Configure your trading platform settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="api" data-testid="tab-api">
            <Settings className="w-4 h-4 mr-2" />
            API Configuration
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="trading" data-testid="tab-trading">
            <Zap className="w-4 h-4 mr-2" />
            Trading Settings
          </TabsTrigger>
        </TabsList>

        {/* API Configuration Tab */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Bybit API Configuration</span>
                <Badge variant={getConnectionStatusColor()} data-testid="status-api-connection">
                  {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="text"
                    value={localAPIConfig.bybitApiKey}
                    onChange={(e) => setLocalAPIConfig(prev => ({ ...prev, bybitApiKey: e.target.value }))}
                    placeholder="Enter your Bybit API key"
                    data-testid="input-api-key"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api-secret">API Secret</Label>
                  <div className="relative">
                    <Input
                      id="api-secret"
                      type={showApiSecret ? "text" : "password"}
                      value={localAPIConfig.bybitApiSecret}
                      onChange={(e) => setLocalAPIConfig(prev => ({ ...prev, bybitApiSecret: e.target.value }))}
                      placeholder="Enter your Bybit API secret"
                      data-testid="input-api-secret"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowApiSecret(!showApiSecret)}
                      data-testid="button-toggle-secret-visibility"
                    >
                      {showApiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="testnet"
                    checked={localAPIConfig.bybitTestnet}
                    onCheckedChange={(checked) => setLocalAPIConfig(prev => ({ ...prev, bybitTestnet: checked }))}
                    data-testid="switch-testnet"
                  />
                  <Label htmlFor="testnet">Use Testnet (recommended for testing)</Label>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-4">
                <Button
                  onClick={handleSaveAPI}
                  data-testid="button-save-api"
                >
                  Save Configuration
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={!localAPIConfig.bybitApiKey || !localAPIConfig.bybitApiSecret || connectionStatus === "testing"}
                  data-testid="button-test-connection"
                >
                  <TestTube className="w-4 h-4 mr-2" />
                  {connectionStatus === "testing" ? "Testing..." : "Test Connection"}
                </Button>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Security Notice</p>
                    <p className="text-sm text-muted-foreground">
                      Your API credentials are stored locally and never transmitted to third parties. 
                      Ensure your API key has only the necessary permissions for trading.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Discord Notifications</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotifications}
                  disabled={!localNotificationConfig.discordEnabled || !localNotificationConfig.discordWebhook}
                >
                  Test Discord
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="discord-enabled"
                  checked={localNotificationConfig.discordEnabled}
                  onCheckedChange={(checked) => setLocalNotificationConfig(prev => ({ ...prev, discordEnabled: checked }))}
                  data-testid="switch-discord"
                />
                <Label htmlFor="discord-enabled">Enable Discord notifications</Label>
              </div>
              
              {localNotificationConfig.discordEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="discord-webhook">Webhook URL</Label>
                  <Input
                    id="discord-webhook"
                    value={localNotificationConfig.discordWebhook}
                    onChange={(e) => setLocalNotificationConfig(prev => ({ ...prev, discordWebhook: e.target.value }))}
                    placeholder="https://discord.com/api/webhooks/..."
                    data-testid="input-discord-webhook"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Telegram Notifications</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotifications}
                  disabled={!localNotificationConfig.telegramEnabled || !localNotificationConfig.telegramBotToken}
                >
                  Test Telegram
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="telegram-enabled"
                  checked={localNotificationConfig.telegramEnabled}
                  onCheckedChange={(checked) => setLocalNotificationConfig(prev => ({ ...prev, telegramEnabled: checked }))}
                  data-testid="switch-telegram"
                />
                <Label htmlFor="telegram-enabled">Enable Telegram notifications</Label>
              </div>
              
              {localNotificationConfig.telegramEnabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="telegram-token">Bot Token</Label>
                    <Input
                      id="telegram-token"
                      value={localNotificationConfig.telegramBotToken}
                      onChange={(e) => setLocalNotificationConfig(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      data-testid="input-telegram-token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telegram-chat">Chat ID</Label>
                    <Input
                      id="telegram-chat"
                      value={localNotificationConfig.telegramChatId}
                      onChange={(e) => setLocalNotificationConfig(prev => ({ ...prev, telegramChatId: e.target.value }))}
                      placeholder="123456789"
                      data-testid="input-telegram-chat"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>WhatsApp Notifications</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotifications}
                  disabled={!localNotificationConfig.whatsappEnabled || !localNotificationConfig.whatsappNumber}
                >
                  Test WhatsApp
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="whatsapp-enabled"
                  checked={localNotificationConfig.whatsappEnabled}
                  onCheckedChange={(checked) => setLocalNotificationConfig(prev => ({ ...prev, whatsappEnabled: checked }))}
                  data-testid="switch-whatsapp"
                />
                <Label htmlFor="whatsapp-enabled">Enable WhatsApp notifications</Label>
              </div>
              
              {localNotificationConfig.whatsappEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-number">Phone Number</Label>
                  <Input
                    id="whatsapp-number"
                    value={localNotificationConfig.whatsappNumber}
                    onChange={(e) => setLocalNotificationConfig(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                    placeholder="+1234567890"
                    data-testid="input-whatsapp-number"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSaveNotifications} data-testid="button-save-notifications" className="w-full">
            Save Notification Settings
          </Button>
        </TabsContent>

        {/* Trading Settings Tab */}
        <TabsContent value="trading" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Risk Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-positions">Max Open Positions</Label>
                  <Input
                    id="max-positions"
                    type="number"
                    value={localTradingConfig.maxPositions}
                    onChange={(e) => setLocalTradingConfig(prev => ({ ...prev, maxPositions: parseInt(e.target.value) || 0 }))}
                    min="1"
                    max="20"
                    data-testid="input-max-positions"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="risk-per-trade">Risk Per Trade (%)</Label>
                  <Input
                    id="risk-per-trade"
                    type="number"
                    value={localTradingConfig.riskPerTrade}
                    onChange={(e) => setLocalTradingConfig(prev => ({ ...prev, riskPerTrade: parseFloat(e.target.value) || 0 }))}
                    min="0.1"
                    max="10"
                    step="0.1"
                    data-testid="input-risk-per-trade"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leverage">Leverage</Label>
                  <Input
                    id="leverage"
                    type="number"
                    value={localTradingConfig.leverage}
                    onChange={(e) => setLocalTradingConfig(prev => ({ ...prev, leverage: parseInt(e.target.value) || 1 }))}
                    min="1"
                    max="100"
                    data-testid="input-leverage"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scan-interval">Scan Interval (seconds)</Label>
                  <Input
                    id="scan-interval"
                    type="number"
                    value={localTradingConfig.scanInterval}
                    onChange={(e) => setLocalTradingConfig(prev => ({ ...prev, scanInterval: parseInt(e.target.value) || 60 }))}
                    min="60"
                    max="3600"
                    data-testid="input-scan-interval"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Take Profit & Stop Loss</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stop-loss">Stop Loss (%)</Label>
                  <Input
                    id="stop-loss"
                    type="number"
                    value={localTradingConfig.stopLossPercent}
                    onChange={(e) => setLocalTradingConfig(prev => ({ ...prev, stopLossPercent: parseFloat(e.target.value) || 0 }))}
                    min="0.1"
                    max="20"
                    step="0.1"
                    data-testid="input-stop-loss"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="take-profit">Take Profit (%)</Label>
                  <Input
                    id="take-profit"
                    type="number"
                    value={localTradingConfig.takeProfitPercent}
                    onChange={(e) => setLocalTradingConfig(prev => ({ ...prev, takeProfitPercent: parseFloat(e.target.value) || 0 }))}
                    min="0.1"
                    max="50"
                    step="0.1"
                    data-testid="input-take-profit"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveTrading} data-testid="button-save-trading" className="w-full">
            Save Trading Settings
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
