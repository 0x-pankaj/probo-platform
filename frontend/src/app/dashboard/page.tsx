"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import MarketSelector from "@/components/market-selector";
import OrderForm from "@/components/order-form";
import OpenOrders from "@/components/open-orders";
import DepthChart from "@/components/depth-chart";
import BalanceDisplay from "@/components/balance-display";
import MarketCreation from "@/components/market-creation";
import PriceDisplay from "@/components/price-display";
import { setupWebSockets, closeWebSockets } from "@/lib/websocket";
import type { Market, Order, Depth, Price } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [markets, setMarkets] = useState<Market[]>([
    { market_id: "market_1", question: "Will it rain tomorrow?" },
    { market_id: "market_2", question: "Will stocks rise?" },
  ]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [depth, setDepth] = useState<Depth | null>(null);
  const [prices, setPrices] = useState<Record<string, Price>>({});
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const storedUserId = localStorage.getItem("userId");
    const storedClientId = localStorage.getItem("clientId");

    if (!storedUserId || !storedClientId) {
      router.push("/");
      return;
    }

    setUserId(Number(storedUserId));
    setClientId(storedClientId);

    // For demo purposes, user 1 is admin
    setIsAdmin(Number(storedUserId) === 1);

    // Set default selected market
    if (markets.length > 0) {
      setSelectedMarket(markets[0]);
    }

    // Setup WebSockets
    const { handleClientMessage, handleMarketMessage } = setupWebSockets({
      clientId: storedClientId,
      onOrderPlaced: (order) => {
        setOrders((prev) => [...prev, order]);
      },
      onOrderMatched: (trade) => {
        // Update orders after a match
        // In a real app, we would fetch updated orders
      },
      onOrderCancelled: (data) => {
        setOrders((prev) => prev.filter((order) => order.id !== data.order_id));
      },
      onOpenOrders: (data) => {
        setOrders(data.orders);
      },
      onDepth: (depthData) => {
        setDepth(depthData);
      },
      onMarketCreated: (data) => {
        // Add the new market to the list
        // In a real app, we would fetch market details
        const newMarket = { market_id: data.market_id, question: "New Market" };
        setMarkets((prev) => [...prev, newMarket]);
      },
      onError: (error) => {
        console.error("WebSocket error:", error);
      },
      onPrice: (priceData) => {
        setPrices((prev) => ({
          ...prev,
          [priceData.market_id]: {
            ...prev[priceData.market_id],
            [priceData.option]: priceData.price,
          },
        }));
      },
    });

    return () => {
      closeWebSockets();
    };
  }, [router, markets]);

  const handleMarketSelect = (market: Market) => {
    setSelectedMarket(market);
    setOrders([]);
    setDepth(null);
  };

  if (!userId || !clientId) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Probo Trading Platform</h1>
          <div className="flex items-center gap-4">
            <BalanceDisplay userId={userId} />
            <button
              onClick={() => {
                localStorage.removeItem("userId");
                localStorage.removeItem("clientId");
                router.push("/");
              }}
              className="text-sm text-gray-400 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3 space-y-4">
          <MarketSelector
            markets={markets}
            selectedMarket={selectedMarket}
            onSelectMarket={handleMarketSelect}
          />

          {isAdmin && <MarketCreation clientId={clientId} />}
        </aside>

        <main className="lg:col-span-9 space-y-4">
          {selectedMarket && (
            <>
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold">
                        {selectedMarket.question}
                      </h2>
                      <p className="text-sm text-gray-400">
                        Market ID: {selectedMarket.market_id}
                      </p>
                    </div>
                    <PriceDisplay
                      prices={prices[selectedMarket.market_id] || {}}
                      marketId={selectedMarket.market_id}
                    />
                  </div>
                </CardContent>
              </Card>

              <OrderForm
                userId={userId}
                clientId={clientId}
                marketId={selectedMarket.market_id}
              />

              <Tabs defaultValue="orders" className="w-full">
                <TabsList className="bg-gray-800">
                  <TabsTrigger value="orders">Open Orders</TabsTrigger>
                  <TabsTrigger value="depth">Market Depth</TabsTrigger>
                </TabsList>
                <TabsContent value="orders" className="mt-4">
                  <OpenOrders
                    orders={orders}
                    userId={userId}
                    clientId={clientId}
                    marketId={selectedMarket.market_id}
                  />
                </TabsContent>
                <TabsContent value="depth" className="mt-4">
                  <DepthChart
                    depth={depth}
                    clientId={clientId}
                    marketId={selectedMarket.market_id}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
