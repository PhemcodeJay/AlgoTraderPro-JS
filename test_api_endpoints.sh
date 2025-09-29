#!/bin/bash
# Refined test script for AlgoTraderPro backend API endpoints
# Run: bash test_api_endpoints_refined.sh
# Assumes backend is running on http://127.0.0.1:3000

# 1. Test Health Check
echo "Testing Health Check (GET /)"
curl -X GET http://127.0.0.1:3000 -v

# 2. Test Fetch Positions
echo -e "\nTesting Fetch Positions (GET /api/positions)"
curl -X GET http://127.0.0.1:3000/api/positions -v

# 3. Test Fetch Signals
echo -e "\nTesting Fetch Signals (GET /api/signals)"
curl -X GET http://127.0.0.1:3000/api/signals -v

# 4. Test Scan Signals (15m interval, 10 symbols)
echo -e "\nTesting Scan Signals (POST /api/scan-signals)"
curl -X POST http://127.0.0.1:3000/api/scan-signals \
  -H "Content-Type: application/json" \
  -d '{"interval":"15","limit":10}' -v

# 5. Test Execute Trade (Virtual Mode, Small Size)
echo -e "\nTesting Execute Trade (POST /api/trade, Virtual Mode)"
curl -X POST http://127.0.0.1:3000/api/trade \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","side":"BUY","size":0.001,"type":"market","stopLoss":50000,"takeProfit":60000}' -v

# 6. Test Execute Trade (Invalid Parameters)
echo -e "\nTesting Execute Trade (POST /api/trade, Invalid Parameters)"
curl -X POST http://127.0.0.1:3000/api/trade \
  -H "Content-Type: application/json" \
  -d '{"symbol":"INVALID","side":"BUY","size":0,"type":"market"}' -v

# 7. Test Fetch Market Data
echo -e "\nTesting Fetch Market Data (GET /api/market-data)"
curl -X GET http://127.0.0.1:3000/api/market-data -v

# 8. Test Fetch Balance
echo -e "\nTesting Fetch Balance (GET /api/balance)"
curl -X GET http://127.0.0.1:3000/api/balance -v

# 9. Test Connection
echo -e "\nTesting Connection (POST /api/test-connection)"
curl -X POST http://127.0.0.1:3000/api/test-connection -v

# 10. Test Toggle Automated Trading (Enable Virtual)
echo -e "\nTesting Toggle Automated Trading (POST /api/automated-trading)"
curl -X POST http://127.0.0.1:3000/api/automated-trading \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"mode":"virtual"}' -v

# 11. Test Fetch App Status
echo -e "\nTesting Fetch App Status (GET /api/app-status)"
curl -X GET http://127.0.0.1:3000/api/app-status -v

# 12. Test Update App Status
echo -e "\nTesting Update App Status (POST /api/app-status)"
curl -X POST http://127.0.0.1:3000/api/app-status \
  -H "Content-Type: application/json" \
  -d '{"tradingMode":"virtual","isAutomatedTradingEnabled":false}' -v

# 13. Test Fetch API Config
echo -e "\nTesting Fetch API Config (GET /api/api-config)"
curl -X GET http://127.0.0.1:3000/api/api-config -v

# 14. Test Update API Config (Testnet)
echo -e "\nTesting Update API Config (POST /api/api-config)"
curl -X POST http://127.0.0.1:3000/api/api-config \
  -H "Content-Type: application/json" \
  -d '{"bybitApiKey":"your_api_key","bybitApiSecret":"your_api_secret","bybitTestnet":true}' -v

# 15. Test Fetch Notification Config
echo -e "\nTesting Fetch Notification Config (GET /api/notification-config)"
curl -X GET http://127.0.0.1:3000/api/notification-config -v

# 16. Test Update Notification Config
echo -e "\nTesting Update Notification Config (POST /api/notification-config)"
curl -X POST http://127.0.0.1:3000/api/notification-config \
  -H "Content-Type: application/json" \
  -d '{"discordEnabled":false,"discordWebhook":"","telegramEnabled":false,"telegramBotToken":"","telegramChatId":"","whatsappEnabled":false,"whatsappNumber":""}' -v

# 17. Test Fetch Trading Config
echo -e "\nTesting Fetch Trading Config (GET /api/trading-config)"
curl -X GET http://127.0.0.1:3000/api/trading-config -v

# 18. Test Update Trading Config
echo -e "\nTesting Update Trading Config (POST /api/trading-config)"
curl -X POST http://127.0.0.1:3000/api/trading-config \
  -H "Content-Type: application/json" \
  -d '{"maxPositions":5,"riskPerTrade":2.0,"leverage":10,"stopLossPercent":5.0,"takeProfitPercent":15.0,"scanInterval":300}' -v

# 19. Test Fetch Connection Status
echo -e "\nTesting Fetch Connection Status (GET /api/connection-status)"
curl -X GET http://127.0.0.1:3000/api/connection-status -v

# 20. Test Send Notifications (Empty Signals)
echo -e "\nTesting Send Notifications (POST /api/send-notifications, Empty Signals)"
curl -X POST http://127.0.0.1:3000/api/send-notifications \
  -H "Content-Type: application/json" \
  -d '{"signals":[]}' -v

# 21. Test Send Notifications (With Signals from Scan)
echo -e "\nTesting Send Notifications (POST /api/send-notifications, With Signals)"
curl -X POST http://127.0.0.1:3000/api/send-notifications \
  -H "Content-Type: application/json" \
  -d '{"signals":[{"id":"ccfc7dc1-e95d-4c53-8142-bd883f6afe07","symbol":"BTCUSDT","type":"SELL","score":42.00500000000466,"price":114054.2,"stopLoss":119756.91,"takeProfit":96946.07,"liquidationPrice":124319.078,"currentMarketPrice":114054.2,"confidence":"MEDIUM","status":"PENDING","timestamp":"2025-09-29T22:52:54.143Z"}]}' -v

# WebSocket Testing Instructions (requires wscat):
# Install wscat: npm install -g wscat
# 22. Test Market Data WebSocket
wscat -c ws://127.0.0.1:3000/ws/market-data
# 23. Test Positions WebSocket
wscat -c ws://127.0.0.1:3000/ws/positions
# 24. Test Signals WebSocket
wscat -c ws://127.0.0.1:3000/ws/signals