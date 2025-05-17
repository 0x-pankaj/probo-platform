"use client";

import { useEffect, useState } from "react";

interface BalanceDisplayProps {
  userId: number;
}

interface Balance {
  available: number;
  locked: number;
}

export default function BalanceDisplay({ userId }: BalanceDisplayProps) {
  const [balance, setBalance] = useState<Balance>({ available: 0, locked: 0 });

  useEffect(() => {
    // Get balance from localStorage (mock data)
    const storedBalance = localStorage.getItem("balance");
    if (storedBalance) {
      setBalance(JSON.parse(storedBalance));
    }

    // In a real app, we would fetch balance from an API
    // and update it based on WebSocket messages
  }, [userId]);

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm">
        <span className="text-gray-400">Available:</span>{" "}
        <span className="font-medium">{balance.available.toFixed(2)}</span>
      </div>
      <div className="text-sm">
        <span className="text-gray-400">Locked:</span>{" "}
        <span className="font-medium">{balance.locked.toFixed(2)}</span>
      </div>
    </div>
  );
}
