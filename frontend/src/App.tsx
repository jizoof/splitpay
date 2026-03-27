import React, { useState, useEffect, useRef } from "react";
import { isConnected, getPublicKey, signTransaction } from "@stellar/freighter-api";
import { SorobanRpc, TransactionBuilder, Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";

const VITE_TOKEN_CONTRACT_ID = import.meta.env.VITE_TOKEN_CONTRACT_ID || "";
const VITE_SPLIT_CONTRACT_ID = import.meta.env.VITE_SPLIT_CONTRACT_ID || "";
const VITE_NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
const VITE_RPC_URL = import.meta.env.VITE_RPC_URL || "https://soroban-testnet.stellar.org";

const server = new SorobanRpc.Server(VITE_RPC_URL);

interface Expense {
  creator: string;
  total_amount: number;
  amount_per_participant: number;
  participants: number;
  paid_count: number;
  is_settled: boolean;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "info" | "error";
}

function App() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [isLoading, setIsLoading] = useState(false);

  // Dashboard State
  const [totalOwed, setTotalOwed] = useState(0);
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  // Action State
  const [expenseIdInput, setExpenseIdInput] = useState("");
  const [expenseData, setExpenseData] = useState<Expense | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [newParticipants, setNewParticipants] = useState("");
  const [settleExpenseId, setSettleExpenseId] = useState("");
  const [settleAmount, setSettleAmount] = useState("");

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  let toastIdCounter = useRef(0);

  const addToast = (message: string, type: "success" | "info" | "error" = "info") => {
    const id = toastIdCounter.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Poll Events
  const lastLedgerRef = useRef<number>(0);
  useEffect(() => {
    if (!VITE_SPLIT_CONTRACT_ID) return;

    const pollEvents = async () => {
      try {
        if (lastLedgerRef.current === 0) {
          const latestInfo = await server.getLatestLedger();
          lastLedgerRef.current = latestInfo.sequence; // Start polling from the current ledger
        }

        const eventsResponse = await server.getEvents({
          startLedger: lastLedgerRef.current,
          filters: [
            {
              type: "contract",
              contractIds: [VITE_SPLIT_CONTRACT_ID],
              topics: [],
            },
          ],
          limit: 100,
        });

        if (eventsResponse.events && eventsResponse.events.length > 0) {
          eventsResponse.events.forEach((ev: any) => {
            // Simplified parsing based on what we emitted in Rust
            // [symbol_short!("expense"), symbol_short!("created")] etc
            const topic = ev.topic[0];
            const type = topic ? topic.val : "";

            setRecentTransactions((prev) => [
              { id: ev.id, type: "Event Received", ledger: ev.ledger, data: type },
              ...prev,
            ].slice(0, 10));

            addToast(`New Event: ${ev.topic.join(', ')}`, "success");
            
            // Re-fetch standard UI components potentially
          });
          lastLedgerRef.current = eventsResponse.latestLedger;
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    };

    const intervalId = setInterval(pollEvents, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      if (await isConnected()) {
        const pubKey = await getPublicKey();
        setAddress(pubKey);
        setStatus("Connected to Freighter");
        addToast("Wallet Connected Successfully!", "success");
      } else {
        setStatus("Freighter not installed!");
        addToast("Freighter not installed!", "error");
      }
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const submitTransaction = async (method: string, args: xdr.ScVal[]) => {
    try {
      setIsLoading(true);
      setStatus(`Preparing to ${method}...`);
      
      const account = await server.getAccount(address);
      const contractId = VITE_SPLIT_CONTRACT_ID;
      
      const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: VITE_NETWORK_PASSPHRASE })
        .addOperation(
          SorobanRpc.invokeContractOperation(contractId, method, args)
        )
        .setTimeout(30)
        .build();
        
      const preparedTx = await server.prepareTransaction(tx);
      
      setStatus(`Signing ${method}...`);
      const signedXdr = await signTransaction(preparedTx.toXDR(), { networkPassphrase: VITE_NETWORK_PASSPHRASE });
      if (signedXdr.error) throw new Error(signedXdr.error);
      
      const signedTx = TransactionBuilder.fromXDR(signedXdr, VITE_NETWORK_PASSPHRASE);
      
      setStatus(`Submitting ${method}...`);
      const response = await server.sendTransaction(signedTx);
      
      if (response.status === "ERROR") {
        throw new Error("Transaction submission failed");
      }
      
      setStatus(`Transaction Pending... (${response.hash})`);
      addToast(`Transaction submitted: ${response.hash.slice(0, 8)}...`, "info");
      
      let txStatus;
      for (let i = 0; i < 15; i++) {
        await new Promise((res) => setTimeout(res, 2000));
        txStatus = await server.getTransaction(response.hash);
        if (txStatus.status !== "PENDING") break;
      }
      
      if (txStatus?.status === "SUCCESS") {
         addToast("Transaction successful!", "success");
         setStatus(`Success: ${response.hash}`);
         // Update local mock total variables just for the dashboard UX
         if (method === "create_expense") setTotalReceivable(prev => prev + Number(newAmount));
         if (method === "settle_payment") setTotalOwed(prev => prev > Number(settleAmount) ? prev - Number(settleAmount) : 0);
      } else {
         addToast("Transaction failed", "error");
         setStatus(`Failed: ${response.hash}`);
      }
      
      return txStatus;
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
      addToast(`Error: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const createExpense = async () => {
    if (!address) {
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

  const settlePayment = async () => {
    if (!address) {
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

  const getBalances = async () => {
    try {
      setIsLoading(true);
      setStatus("Fetching expense...");
      const contractId = VITE_SPLIT_CONTRACT_ID;
      
      const args = [nativeToScVal(Number(expenseIdInput), { type: "u32" })];
      
      const tx = new TransactionBuilder(await server.getAccount("GA" + "0".repeat(54)), { fee: "100", networkPassphrase: VITE_NETWORK_PASSPHRASE })
        .addOperation(SorobanRpc.invokeContractOperation(contractId, "get_balances", args))
        .setTimeout(30)
        .build();
        
      const response = await server.simulateTransaction(tx);
      
      if (SorobanRpc.Api.isSimulationSuccess(response) && response.result) {
         setStatus("Expense Loaded!");
         addToast("Expense found!", "success");
      } else {
         setStatus("Simulate failed or no result");
         addToast("Failed to simulate reading expense", "error");
      }
    } catch (e: any) {
      setStatus("Error fetching: " + e.message);
      addToast("Error fetching expense", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-4 relative">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header & Connection */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow border border-gray-100">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">SplitPay+</h1>
            <p className="text-sm text-gray-400 mt-1">{status}</p>
          </div>
          <div className="mt-4 md:mt-0">
            {address ? (
              <span className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-semibold shadow-sm border border-indigo-100">
                {address.substring(0, 6)}...{address.slice(-4)}
              </span>
            ) : (
              <button 
                onClick={handleConnect} 
                disabled={isLoading}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? "Loading..." : "Connect Freighter"}
              </button>
            )}
          </div>
        </header>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100 flex flex-col justify-center">
            <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Total Owed</h3>
            <p className="text-4xl font-extrabold text-red-500">${totalOwed.toFixed(2)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100 flex flex-col justify-center">
            <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Total Receivable</h3>
            <p className="text-4xl font-extrabold text-green-500">${totalReceivable.toFixed(2)}</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100 flex flex-col overflow-auto h-40">
            <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2 sticky top-0 bg-white">Recent Transactions</h3>
            {recentTransactions.length === 0 ? (
              <p className="text-gray-400 text-sm">No recent network events...</p>
            ) : (
              <ul className="text-sm space-y-2">
                {recentTransactions.map((t, idx) => (
                  <li key={idx} className="flex justify-between border-b pb-1 last:border-0 border-gray-50">
                    <span className="font-mono text-xs text-indigo-500">{t.type}</span>
                    <span className="text-gray-400 text-xs">Ledger: {t.ledger}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Forms Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Create Expense */}
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Create Expense</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Amount (XLM)</label>
                <input 
                  type="number"
                  className="w-full mt-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none transition" 
                  placeholder="e.g. 100" 
                  value={newAmount} 
                  onChange={e=>setNewAmount(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Participants</label>
                <input 
                  type="number"
                  className="w-full mt-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none transition" 
                  placeholder="e.g. 3" 
                  value={newParticipants} 
                  onChange={e=>setNewParticipants(e.target.value)} 
                />
              </div>
              <button 
                onClick={createExpense}
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium shadow transition disabled:opacity-50"
              >
                {isLoading ? "Processing..." : "Create Request"}
              </button>
            </div>
          </div>

          {/* Settle Payment */}
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Settle Payment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Expense ID</label>
                <input 
                  type="text"
                  className="w-full mt-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-400 outline-none transition" 
                  placeholder="e.g. 1" 
                  value={settleExpenseId} 
                  onChange={e=>setSettleExpenseId(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Payment Amount</label>
                <input 
                  type="number"
                  className="w-full mt-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-400 outline-none transition" 
                  placeholder="e.g. 33.33" 
                  value={settleAmount} 
                  onChange={e=>setSettleAmount(e.target.value)} 
                />
              </div>
              <button 
                onClick={settlePayment}
                disabled={isLoading}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-medium shadow transition disabled:opacity-50"
              >
                {isLoading ? "Processing..." : "Pay Now & Get SPAY Reward"}
              </button>
            </div>
          </div>

          {/* View Event */}
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Lookup Expense</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Expense ID</label>
                <input 
                  type="text"
                  className="w-full mt-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none transition" 
                  placeholder="e.g. 1" 
                  value={expenseIdInput} 
                  onChange={e=>setExpenseIdInput(e.target.value)} 
                />
              </div>
              <button 
                onClick={getBalances}
                disabled={isLoading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium shadow transition disabled:opacity-50"
              >
                {isLoading ? "Loading..." : "Query Status"}
              </button>
            </div>
          </div>
          
        </div>

      </div>

      {/* Toast Notifier */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => {
          let color = "bg-gray-800";
          if (toast.type === "success") color = "bg-green-600";
          if (toast.type === "error") color = "bg-red-600";
          return (
            <div key={toast.id} className={`${color} text-white px-4 py-3 rounded shadow-lg flex items-center gap-3 animate-fade-in-up text-sm font-medium`}>
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
