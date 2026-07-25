import SettingsPanel from '../SettingsPanel';

export default function SettingsPanelExample() {
  // todo: remove mock functionality
  const mockAPIConfig = {
    bybitApiKey: "F7aQeUkd3obyUSDeNJ",
    bybitApiSecret: "A8WNJSiQodExiy2U2GsKTp2Na5ytSwBlK7iD",
    bybitTestnet: false
  };

  const mockNotificationConfig = {
    discordEnabled: true,
    discordWebhook: "https://discord.com/api/webhooks/1398790878755295343/...",
    telegramEnabled: true,
    telegramBotToken: "8160938302:AAFUmPahGk14OY8F1v5FLHGoVRD-pGTvSOY",
    telegramChatId: "5852301284",
    whatsappEnabled: false,
    whatsappNumber: "+254101674289"
  };

  const mockTradingConfig = {
    maxPositions: 10,
    riskPerTrade: 2.0,
    leverage: 10,
    stopLossPercent: 5.0,
    takeProfitPercent: 15.0,
    scanInterval: 3600
  };

  return (
    <SettingsPanel
      apiConfig={mockAPIConfig}
      notificationConfig={mockNotificationConfig}
      tradingConfig={mockTradingConfig}
      onSaveAPI={(config) => console.log('Save API config:', config)}
      onSaveNotifications={(config) => console.log('Save notification config:', config)}
      onSaveTrading={(config) => console.log('Save trading config:', config)}
      onTestConnection={() => console.log('Test API connection')}
      connectionStatus="connected"
    />
  );
}