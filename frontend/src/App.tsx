import React, { useState, useEffect, useRef } from "react";
import { getPublicKey, signTransaction } from "@stellar/freighter-api";
import { SorobanRpc, TransactionBuilder, Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";

const VITE_SPLIT_CONTRACT_ID = import.meta.env.VITE_SPLIT_CONTRACT_ID || "";
const VITE_NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
const VITE_RPC_URL = import.meta.env.VITE_RPC_URL || "https://soroban-testnet.stellar.org";

const server = new SorobanRpc.Server(VITE_RPC_URL);

function App() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [isLoading, setIsLoading] = useState(false);

  const [newAmount, setNewAmount] = useState("");
  const [newParticipants, setNewParticipants] = useState("");
  const [settleExpenseId, setSettleExpenseId] = useState("");
  const [settleAmount, setSettleAmount] = useState("");

  const [toasts, setToasts] = useState<any[]>([]);
  const toastId = useRef(0);

  const isWalletConnected = address && address.length > 0;

  const addToast = (message: string, type: string = "info") => {
    const id = toastId.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // 🔥 FIXED CONNECT
  const handleConnect = async () => {
    try {
      setIsLoading(true);

      const pubKey = await getPublicKey();

      if (!pubKey) throw new Error("No public key");

      setAddress(pubKey);
      setStatus("Connected to Freighter");
      addToast("Wallet connected", "success");

    } catch (e: any) {
      setStatus("Connection failed");
      addToast(e.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const submitTransaction = async (method: string, args: xdr.ScVal[]) => {
    try {
      setIsLoading(true);

      const account = await server.getAccount(address);

      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: VITE_NETWORK_PASSPHRASE
      })
        .addOperation(
          SorobanRpc.invokeContractOperation(
            VITE_SPLIT_CONTRACT_ID,
            method,
            args
          )
        )
        .setTimeout(30)
        .build();

      const prepared = await server.prepareTransaction(tx);

      const signed = await signTransaction(prepared.toXDR(), {
        networkPassphrase: VITE_NETWORK_PASSPHRASE
      });

      const signedTx = TransactionBuilder.fromXDR(
        signed,
        VITE_NETWORK_PASSPHRASE
      );

      const res = await server.sendTransaction(signedTx);

      addToast("Transaction sent", "success");

      return res;

    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 FIXED CREATE
  const createExpense = async () => {
    if (!isWalletConnected) {
      addToast("Connect wallet first", "error");
      return;
    }

    const args = [
      Address.fromString(address).toScVal(),
      nativeToScVal(Number(newAmount), { type: "i128" }),
      nativeToScVal(Number(newParticipants), { type: "u32" })
    ];

    await submitTransaction("create_expense", args);
  };

  // 🔥 FIXED SETTLE
  const settlePayment = async () => {
    if (!isWalletConnected) {
      addToast("Connect wallet first", "error");
      return;
    }

    const args = [
      Address.fromString(address).toScVal(),
      nativeToScVal(Number(settleExpenseId), { type: "u32" }),
      nativeToScVal(Number(settleAmount), { type: "i128" })
    ];

    await submitTransaction("settle_payment", args);
  };

  return (
    <div className="p-6 space-y-6">

      <h1 className="text-2xl font-bold">SplitPay+</h1>
      <p>{status}</p>

      {!isWalletConnected ? (
        <button onClick={handleConnect} disabled={isLoading}>
          Connect Freighter
        </button>
      ) : (
        <p>Connected: {address.slice(0,6)}...{address.slice(-4)}</p>
      )}

      <div>
        <h2>Create Expense</h2>
        <input placeholder="Amount" onChange={e => setNewAmount(e.target.value)} />
        <input placeholder="Participants" onChange={e => setNewParticipants(e.target.value)} />
        <button onClick={createExpense} disabled={!isWalletConnected}>
          Create
        </button>
      </div>

      <div>
        <h2>Settle Payment</h2>
        <input placeholder="Expense ID" onChange={e => setSettleExpenseId(e.target.value)} />
        <input placeholder="Amount" onChange={e => setSettleAmount(e.target.value)} />
        <button onClick={settlePayment} disabled={!isWalletConnected}>
          Pay
        </button>
      </div>

      <div className="fixed bottom-4 right-4">
        {toasts.map(t => (
          <div key={t.id}>{t.message}</div>
        ))}
      </div>

    </div>
  );
}

export default App;