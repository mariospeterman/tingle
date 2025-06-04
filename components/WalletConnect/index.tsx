import React from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useStore } from '../../store';
import { handleError, logInfo } from '../../utils/error';
import { validateWalletAddress } from '../../utils/wallet';

export default function WalletConnect() {
  const [tonConnectUI] = useTonConnectUI();
  const { walletInfo, setWalletInfo } = useStore();

  const handleConnect = async () => {
    try {
      if (!tonConnectUI.connected) {
        await tonConnectUI.connectWallet();
        logInfo('Wallet connected', { address: tonConnectUI.account?.address });
      }
    } catch (error) {
      handleError(error, { action: 'wallet_connect' });
    }
  };

  const handleDisconnect = async () => {
    try {
      if (tonConnectUI.connected) {
        await tonConnectUI.disconnect();
        setWalletInfo(null);
        logInfo('Wallet disconnected');
      }
    } catch (error) {
      handleError(error, { action: 'wallet_disconnect' });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">TON Wallet</h2>
      
      {tonConnectUI.connected ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Connected</span>
            <span className="text-green-600">●</span>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm text-gray-600">Address</p>
            <p className="font-mono text-sm break-all">
              {tonConnectUI.account?.address}
            </p>
          </div>

          {walletInfo && (
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm text-gray-600">Balance</p>
              <p className="font-mono text-sm">
                {walletInfo.balance} TON
              </p>
            </div>
          )}

          <button
            onClick={handleDisconnect}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Disconnect Wallet
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600">
            Connect your TON wallet to enable tipping and subscriptions
          </p>
          
          <button
            onClick={handleConnect}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Connect Wallet
          </button>
        </div>
      )}
    </div>
  );
} 