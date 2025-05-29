"use client";

import React from "react";
import axios from "axios";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
// import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import UserSetup from "@/components/UserSetup";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

interface DepthData {
  market_id: string;
  yes_bids: [number, number][];
  yes_asks: [number, number][];
  no_bids: [number, number][];
  no_asks: [number, number][];
  client_id: string;
}

interface Order {
  id: number;
  market_id: string;
  option: string;
  order_type: string;
  price: number;
  quantity: number;
  timestamp: number;
  user_id: number;
}

export default function EventPage({
  params,
}: {
  params: Promise<{ market_id: string }>;
}) {
  // Unwrap the params Promise
  const resolvedParams = React.use(params);

  const [depth, setDepth] = useState<DepthData | null>(null);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [option, setOption] = useState<string>("");
  const [orderType, setOrderType] = useState<string>("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { userId, clientId, isAuthenticated } = useUser();

  const fetchDepth = async () => {
    try {
      const response = await axios.post("http://localhost:8000/depth", {
        market_id: resolvedParams.market_id,
        client_id: clientId,
      });

      console.log("Raw depth response:", response.data);

      if (response.data && Array.isArray(response.data)) {
        const depthArray = response.data;
        console.log("Depth array:", depthArray);

        // The structure is: [market_id, yes_bids, yes_asks, no_bids, no_asks, client_id]
        const transformedDepth: DepthData = {
          market_id: depthArray[0] || "",
          yes_bids: depthArray[1] || [],
          yes_asks: depthArray[2] || [],
          no_bids: depthArray[3] || [],
          no_asks: depthArray[4] || [],
          client_id: depthArray[5] || "",
        };

        console.log("Transformed depth data:", transformedDepth);
        setDepth(transformedDepth);
      } else {
        console.log("No depth data found in response or data is not an array");
        setDepth(null);
      }
    } catch (error) {
      console.error("Failed to fetch depth:", error);
      if (axios.isAxiosError(error)) {
        console.error("Axios error details:", error.response?.data);
      }
    }
  };

  const fetchOpenOrders = async () => {
    try {
      const response = await axios.post("http://localhost:8000/open_orders", {
        user_id: Number.parseInt(userId!),
        market_id: resolvedParams.market_id,
        client_id: clientId,
      });

      console.log("Open orders response:", response.data);
      setOpenOrders(response.data || []);
    } catch (error) {
      console.error("Failed to fetch open orders:", error);
      if (axios.isAxiosError(error)) {
        console.error("Axios error details:", error.response?.data);
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated && clientId && userId) {
      console.log("Fetching data for:", {
        market_id: resolvedParams.market_id,
        clientId,
        userId,
      });

      fetchDepth();
      fetchOpenOrders();

      // Refresh data every 10 seconds
      const interval = setInterval(() => {
        fetchDepth();
        fetchOpenOrders();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [resolvedParams.market_id, clientId, userId, isAuthenticated]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axios.post("http://localhost:8000/order", {
        user_id: Number.parseInt(userId!),
        option: option,
        order_type: orderType,
        price: Number.parseFloat(price),
        quantity: Number.parseInt(quantity),
        client_id: clientId,
        market_id: resolvedParams.market_id,
      });

      console.log("Order response:", response.data);
      toast(`Order placed, Order ${response.data.id} placed successfully`);

      setPrice("");
      setQuantity("");
      fetchDepth();
      fetchOpenOrders();
    } catch (error) {
      console.error("Failed to place order:", error);
      let errorMessage = "Failed to place order. Please try again.";

      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message || errorMessage;
      }

      toast(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Helper function to get max quantity for visualization
  const getMaxQuantity = (orders: [number, number][]) => {
    if (orders.length === 0) return 1;
    return Math.max(...orders.map(([, quantity]) => quantity));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto py-8 px-4">
        {isAuthenticated ? (
          <>
            <div className="mb-6">
              <Link
                href="/events"
                className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Events
              </Link>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Market: {resolvedParams.market_id}
              </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Order Book */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    📊 Order Book
                  </CardTitle>
                  <CardDescription>
                    Live market depth and liquidity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {depth ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* YES Market */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="text-lg font-bold text-green-600 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            YES Market
                          </h3>
                          <div className="text-sm text-gray-500">
                            ₹ per share
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* YES Bids */}
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-2 text-center bg-green-50 py-1 rounded">
                              BIDS (Buy Orders)
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {depth.yes_bids.length > 0 ? (
                                [...depth.yes_bids]
                                  .reverse()
                                  .map(([price, quantity], index) => {
                                    const total = price * quantity;
                                    const maxQty = getMaxQuantity(
                                      depth.yes_bids,
                                    );
                                    return (
                                      <div
                                        key={index}
                                        className="relative bg-gradient-to-r from-green-500/10 to-transparent border-l-2 border-green-500 pl-3 pr-2 py-2 hover:bg-green-50 transition-colors cursor-pointer group"
                                      >
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="font-mono text-green-700 font-semibold">
                                            ₹{price.toFixed(1)}
                                          </span>
                                          <span className="text-gray-700 font-medium">
                                            {quantity}
                                          </span>
                                        </div>
                                        <div className="text-xs text-gray-500 text-right">
                                          ₹{total.toFixed(1)}
                                        </div>
                                        <div
                                          className="absolute left-0 top-0 bottom-0 bg-green-200/30 transition-all duration-300"
                                          style={{
                                            width: `${Math.min((quantity / maxQty) * 100, 100)}%`,
                                          }}
                                        />
                                      </div>
                                    );
                                  })
                              ) : (
                                <div className="text-center py-6 text-gray-400 text-sm">
                                  No buy orders
                                </div>
                              )}
                            </div>
                          </div>

                          {/* YES Asks */}
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-2 text-center bg-red-50 py-1 rounded">
                              ASKS (Sell Orders)
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {depth.yes_asks.length > 0 ? (
                                depth.yes_asks.map(
                                  ([price, quantity], index) => {
                                    const total = price * quantity;
                                    const maxQty = getMaxQuantity(
                                      depth.yes_asks,
                                    );
                                    return (
                                      <div
                                        key={index}
                                        className="relative bg-gradient-to-l from-red-500/10 to-transparent border-r-2 border-red-500 pr-3 pl-2 py-2 hover:bg-red-50 transition-colors cursor-pointer group"
                                      >
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="font-mono text-red-700 font-semibold">
                                            ₹{price.toFixed(1)}
                                          </span>
                                          <span className="text-gray-700 font-medium">
                                            {quantity}
                                          </span>
                                        </div>
                                        <div className="text-xs text-gray-500 text-right">
                                          ₹{total.toFixed(1)}
                                        </div>
                                        <div
                                          className="absolute right-0 top-0 bottom-0 bg-red-200/30 transition-all duration-300"
                                          style={{
                                            width: `${Math.min((quantity / maxQty) * 100, 100)}%`,
                                          }}
                                        />
                                      </div>
                                    );
                                  },
                                )
                              ) : (
                                <div className="text-center py-6 text-gray-400 text-sm">
                                  No sell orders
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* NO Market */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                            <TrendingDown className="h-5 w-5" />
                            NO Market
                          </h3>
                          <div className="text-sm text-gray-500">
                            ₹ per share
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* NO Bids */}
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-2 text-center bg-green-50 py-1 rounded">
                              BIDS (Buy Orders)
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {depth.no_bids.length > 0 ? (
                                [...depth.no_bids]
                                  .reverse()
                                  .map(([price, quantity], index) => {
                                    const total = price * quantity;
                                    const maxQty = getMaxQuantity(
                                      depth.no_bids,
                                    );
                                    return (
                                      <div
                                        key={index}
                                        className="relative bg-gradient-to-r from-green-500/10 to-transparent border-l-2 border-green-500 pl-3 pr-2 py-2 hover:bg-green-50 transition-colors cursor-pointer group"
                                      >
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="font-mono text-green-700 font-semibold">
                                            ₹{price.toFixed(1)}
                                          </span>
                                          <span className="text-gray-700 font-medium">
                                            {quantity}
                                          </span>
                                        </div>
                                        <div className="text-xs text-gray-500 text-right">
                                          ₹{total.toFixed(1)}
                                        </div>
                                        <div
                                          className="absolute left-0 top-0 bottom-0 bg-green-200/30 transition-all duration-300"
                                          style={{
                                            width: `${Math.min((quantity / maxQty) * 100, 100)}%`,
                                          }}
                                        />
                                      </div>
                                    );
                                  })
                              ) : (
                                <div className="text-center py-6 text-gray-400 text-sm">
                                  No buy orders
                                </div>
                              )}
                            </div>
                          </div>

                          {/* NO Asks */}
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-2 text-center bg-red-50 py-1 rounded">
                              ASKS (Sell Orders)
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {depth.no_asks.length > 0 ? (
                                depth.no_asks.map(
                                  ([price, quantity], index) => {
                                    const total = price * quantity;
                                    const maxQty = getMaxQuantity(
                                      depth.no_asks,
                                    );
                                    return (
                                      <div
                                        key={index}
                                        className="relative bg-gradient-to-l from-red-500/10 to-transparent border-r-2 border-red-500 pr-3 pl-2 py-2 hover:bg-red-50 transition-colors cursor-pointer group"
                                      >
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="font-mono text-red-700 font-semibold">
                                            ₹{price.toFixed(1)}
                                          </span>
                                          <span className="text-gray-700 font-medium">
                                            {quantity}
                                          </span>
                                        </div>
                                        <div className="text-xs text-gray-500 text-right">
                                          ₹{total.toFixed(1)}
                                        </div>
                                        <div
                                          className="absolute right-0 top-0 bottom-0 bg-red-200/30 transition-all duration-300"
                                          style={{
                                            width: `${Math.min((quantity / maxQty) * 100, 100)}%`,
                                          }}
                                        />
                                      </div>
                                    );
                                  },
                                )
                              ) : (
                                <div className="text-center py-6 text-gray-400 text-sm">
                                  No sell orders
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="animate-pulse flex flex-col items-center gap-2">
                        <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                        <div className="text-gray-500">
                          Loading order book...
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Place Order */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    💰 Place Order
                  </CardTitle>
                  <CardDescription>Buy or sell your prediction</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePlaceOrder} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="option">Option</Label>
                        <Select
                          value={option}
                          onValueChange={setOption}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                                Yes
                              </div>
                            </SelectItem>
                            <SelectItem value="No">
                              <div className="flex items-center gap-2">
                                <TrendingDown className="h-4 w-4 text-red-600" />
                                No
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="orderType">Order Type</Label>
                        <Select
                          value={orderType}
                          onValueChange={setOrderType}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Buy">
                              <span className="text-green-600 font-semibold">
                                Buy
                              </span>
                            </SelectItem>
                            <SelectItem value="Sell">
                              <span className="text-red-600 font-semibold">
                                Sell
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Price (₹)</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.1"
                          placeholder="7.3"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          required
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          placeholder="10"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          required
                          className="font-mono"
                        />
                      </div>
                    </div>
                    {price && quantity && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm text-gray-600">
                          Total Value:
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          ₹{(parseFloat(price) * parseInt(quantity)).toFixed(2)}
                        </div>
                      </div>
                    )}
                    <Button
                      type="submit"
                      className={`w-full font-semibold ${
                        orderType === "Buy"
                          ? "bg-green-600 hover:bg-green-700"
                          : orderType === "Sell"
                            ? "bg-red-600 hover:bg-red-700"
                            : ""
                      }`}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                          Placing Order...
                        </div>
                      ) : (
                        `${orderType || "Place"} Order`
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Open Orders */}
            <Card>
              <CardHeader>
                <CardTitle>Your Open Orders</CardTitle>
                <CardDescription>
                  Your active orders for this market
                </CardDescription>
              </CardHeader>
              <CardContent>
                {openOrders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Order ID</th>
                          <th className="text-left p-2">Option</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Price</th>
                          <th className="text-left p-2">Quantity</th>
                          <th className="text-left p-2">Timestamp</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openOrders.map((order) => (
                          <tr key={order.id} className="border-b">
                            <td className="p-2">#{order.id}</td>
                            <td className="p-2">
                              <Badge
                                variant={
                                  order.option === "Yes"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {order.option}
                              </Badge>
                            </td>
                            <td className="p-2">
                              <Badge
                                variant={
                                  order.order_type === "Buy"
                                    ? "default"
                                    : "outline"
                                }
                              >
                                {order.order_type}
                              </Badge>
                            </td>
                            <td className="p-2">₹{order.price}</td>
                            <td className="p-2">{order.quantity}</td>
                            <td className="p-2">
                              {formatTimestamp(order.timestamp)}
                            </td>
                            <td className="p-2">
                              <Badge variant="secondary">Open</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No open orders for this market
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <UserSetup />
        )}
      </div>
    </div>
  );
}
