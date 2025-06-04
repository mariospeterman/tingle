# Tingle - Telegram Mini App for Video Dating

Tingle is a Telegram Mini App that facilitates real-time video chat with integrated TON wallet functionalities. It provides a seamless dating experience through Telegram's platform with blockchain integration.

## Features

- Real-time video chat using MediaSoup SFU
- TON wallet integration for tips and subscriptions
- Telegram Mini App integration
- User preferences and matchmaking
- Gamification elements (daily rewards, achievements)

## Tech Stack

- Frontend: React with TypeScript
- Styling: Tailwind CSS
- State Management: Zustand
- Backend: Node.js with Express
- Database: Supabase (PostgreSQL)
- Real-time Communication: Redis Pub/Sub
- Video Streaming: MediaSoup SFU
- Blockchain: TON

## Prerequisites

- Node.js 16.x or later
- npm or yarn
- Telegram Bot Token
- Supabase account
- Redis instance
- MediaSoup server

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_USERNAME=your_bot_username

# TON
TON_NETWORK=mainnet
TON_API_KEY=your_api_key
TON_WALLET_ADDRESS=your_wallet_address

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Redis
REDIS_URL=your_redis_url
REDIS_PASSWORD=your_redis_password

# MediaSoup
MEDIASOUP_LISTEN_IP=your_listen_ip
MEDIASOUP_ANNOUNCED_IP=your_announced_ip
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/tingle.git
cd tingle
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/tingle
├── /components
│   ├── PreCallSetup/
│   ├── VideoChat/
│   ├── WalletConnect/
│   └── Matchmaking/
├── /pages
│   ├── index.tsx
│   └── twa.tsx
├── /services
│   ├── api.ts
│   ├── ton.ts
│   └── telegram.ts
├── /utils
│   ├── matchmaking.ts
│   └── helpers.ts
├── /public
│   └── tonconnect-manifest.json
└── tailwind.config.js
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team. 