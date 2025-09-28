# AlgoTrader Pro Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing inspiration from professional trading platforms like TradingView, Binance, and modern fintech applications such as Robinhood and Coinbase Pro. The design should convey trust, precision, and real-time data clarity.

## Core Design Elements

### A. Color Palette
**Dark Mode Primary** (financial applications work best in dark themes):
- Primary: `220 85% 57%` (Professional blue for actions/CTAs)
- Background: `222 84% 5%` (Deep charcoal for main background)
- Surface: `220 13% 9%` (Elevated surfaces, cards)
- Success: `142 76% 36%` (Green for profits, positive values)
- Danger: `0 84% 60%` (Red for losses, negative values)
- Warning: `45 93% 58%` (Orange/amber for alerts)
- Text Primary: `210 20% 98%` (Near white for high contrast)
- Text Secondary: `215 20% 65%` (Muted for secondary information)

### B. Typography
- **Primary Font**: Inter or Roboto (clean, readable for data-heavy interfaces)
- **Monospace Font**: JetBrains Mono or Fira Code (for prices, numbers, code)
- **Hierarchy**: Large headings (text-2xl), section headers (text-lg), body text (text-sm), data labels (text-xs)

### C. Layout System
**Tailwind Spacing Units**: Consistent use of `2, 4, 6, 8, 12, 16` units
- Tight spacing: `p-2, m-2` for compact data displays
- Standard spacing: `p-4, m-4` for general content
- Generous spacing: `p-8, m-8` for major sections

### D. Component Library

**Navigation & Layout**:
- Fixed sidebar with collapsible menu items
- Top navigation bar with trading mode toggle and account balance
- Breadcrumb navigation for deep sections

**Data Display Components**:
- Real-time price tickers with color-coded changes
- Trading tables with sortable columns and pagination
- Metric cards with large numbers and trend indicators
- Chart containers with dark backgrounds and colored data lines

**Trading Interface**:
- Order forms with clear buy/sell distinction (green/red)
- Position cards showing P&L with appropriate color coding
- Signal cards with confidence scores and action buttons
- Settings panels with grouped form controls

**Interactive Elements**:
- Primary buttons: Solid blue for main actions
- Secondary buttons: Outline style with hover states
- Danger buttons: Red for emergency stops, position closes
- Toggle switches for trading modes and preferences

### E. Trading-Specific Design Patterns

**Real-Time Data Visualization**:
- Use monospace fonts for all numeric data (prices, quantities, P&L)
- Color-code positive values in green, negative in red
- Implement subtle animations for value changes (flash green/red on updates)
- Display timestamps in consistent format

**Status Indicators**:
- Connection status badges (green dot for connected, red for disconnected)
- Trading mode indicators (distinct styling for Virtual vs Real modes)
- Order status with clear visual hierarchy

**Settings Interface**:
- Tabbed interface for API Configuration and Notifications
- Form sections with clear labels and validation states
- Secure input fields for API keys with masking
- Test connection buttons with loading states

**Risk Management UI**:
- Prominent emergency stop button (red, always visible)
- Balance displays with usage indicators (progress bars)
- Risk metrics with warning thresholds
- Clear distinction between virtual and real trading modes

### F. Responsive Considerations
- Sidebar collapses to icons on mobile
- Trading tables become scrollable horizontally on small screens
- Metric cards stack vertically on mobile
- Form inputs maintain adequate touch targets (min 44px height)

This design approach prioritizes clarity, trust, and efficiency - essential for a professional trading platform where users need to make quick, informed decisions with real financial consequences.