import { useState } from 'react';
import { requestAccess, setAllowed } from '@stellar/freighter-api';

function App() {
  const [address, setAddress] = useState<string>('');

  const connectWallet = async () => {
    try {
      await setAllowed();
      const pubKey = await requestAccess();
      setAddress(pubKey);
    } catch (e) {
      console.error(e);
      alert('Failed to connect Freighter wallet');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
        SplitPay+
      </h1>
      <p className="text-xl mb-8 opacity-80">
        Manage your Soroban dApp payments effortlessly.
      </p>

      {address ? (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col items-center">
          <p className="text-green-400 font-semibold mb-2">Connected</p>
          <code className="bg-black p-2 rounded text-sm text-cyan-300">
            {address.slice(0, 6)}...{address.slice(-4)}
          </code>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 transform hover:-translate-y-1"
        >
          Connect Freighter
        </button>
      )}
    </div>
  );
}

export default App;
