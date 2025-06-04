# Tingle - Telegram Mini App for Video Dating

![Tingle CI Status](https://github.com/your-username/tingle/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Tingle is a modern Telegram WebApp built to connect people through real-time video chat matching, seamlessly integrated with the TON blockchain for secure and easy payments and tipping.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## Features

- **Real-time Video Chat:** High-quality video communication powered by MediaSoup SFU.
- **TON Wallet Integration:** Secure payments, tipping, and potential future subscription models via the TON blockchain.
- **Telegram Mini App:** Native feel and integration within the Telegram ecosystem.
- **User Matching:** Intelligent matchmaking based on user preferences.
- **Profile Management:** Customize profiles and set preferences.
- **Live Streaming Prep:** UI for setting up camera and microphone before calls.
- **Real-time Chat:** Text and media sharing during video calls.

## Tech Stack

- **Frontend:** React, Next.js
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Backend:** Node.js, Express
- **Database:** Supabase (PostgreSQL)
- **Real-time Communication:** Redis Pub/Sub, Socket.IO
- **Video Streaming:** MediaSoup SFU
- **Blockchain:** TON Connect SDK

## Prerequisites

Before running Tingle, ensure you have the following installed:

- Node.js (16.x or later)
- pnpm
- Docker (for running Supabase, Redis, and MediaSoup locally)

You will also need accounts and credentials for:

- Telegram Bot Token
- Supabase project URL and Anon Key
- Redis instance URL and Password
- TON API Key

## Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/tingle.git
cd tingle
```

2. Install dependencies using pnpm:

```bash
pnpm install
```

3. Set up environment variables (see [Environment Variables](#environment-variables)).

4. Start the development server:

```bash
pnpm dev
```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file in the root directory of the project based on the `.env.example` provided. These variables are crucial for the application to connect to external services.

```env
# .env.example

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_USERNAME=your_telegram_bot_username
NEXT_PUBLIC_TELEGRAM_WEBAPP_URL=your_webapp_url

# TON
TON_NETWORK=mainnet # or testnet
TON_API_KEY=your_ton_api_key
TON_WALLET_ADDRESS=your_ton_wallet_address
NEXT_PUBLIC_TON_CONNECT_MANIFEST_URL=your_manifest_url

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Redis
REDIS_URL=your_redis_url
REDIS_PASSWORD=your_redis_password

# MediaSoup
MEDIASOUP_LISTEN_IP=your_listen_ip
MEDIASOUP_ANNOUNCED_IP=your_announced_ip
MEDIASOUP_MIN_PORT=10000 # Example
MEDIASOUP_MAX_PORT=10100 # Example
```

**Note:** `NEXT_PUBLIC_` variables are exposed to the browser.

## Project Structure

```
tingle/
├── app/              # Next.js app directory
│   ├── components/   # Reusable React components
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utility functions and service initializations
│   └── pages/        # Next.js pages (e.g., twa.tsx for the web app)
├── contracts/        # Smart contracts (e.g., TON)
├── public/           # Static assets (e.g., tonconnect-manifest.json)
├── server/           # Backend server code (Node.js/Express)
├── services/         # API clients and external service interactions
├── store/            # Zustand store modules
├── styles/           # Global styles and Tailwind config
├── supabase/         # Supabase migrations and setup
├── types/            # TypeScript type definitions
├── utils/            # General utility functions
└── ...other config files (tailwind.config.js, next.config.js, etc.)
```

## Contributing

We welcome contributions! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for details on how to submit pull requests, report bugs, and suggest features.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/your-feature-name`).
3. Commit your changes (`git commit -m 'Add your commit message'`).
4. Push to the branch (`git push origin feature/your-feature-name`).
5. Open a Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository. 