"use client";

import type React from "react";

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
import { stringify } from "querystring";

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
  params: { market_id: string };
}) {
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
      const response = await fetch("http://localhost:8000/depth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          market_id: params.market_id,
          client_id: clientId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("data", data);
        if (data.Depth) {
          setDepth(data.Depth);
        }
      }
    } catch (error) {
      console.error("Failed to fetch depth:", error);
    }
  };

  const fetchOpenOrders = async () => {
    try {
      const response = await fetch("http://localhost:8000/open_orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: Number.parseInt(userId!),
          market_id: params.market_id,
          client_id: clientId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setOpenOrders(data);
      }
    } catch (error) {
      console.error("Failed to fetch open orders:", error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDepth();
      fetchOpenOrders();

      // Refresh data every 5 seconds
      const interval = setInterval(() => {
        fetchDepth();
        fetchOpenOrders();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [params.market_id, clientId, userId, isAuthenticated]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: Number.parseInt(userId!),
          option: option,
          order_type: orderType,
          price: Number.parseFloat(price),
          quantity: Number.parseInt(quantity),
          client_id: clientId,
          market_id: params.market_id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast(`Order placed, Order ${data.id} placed successfully`);

        setPrice("");
        setQuantity("");
        fetchDepth();
        fetchOpenOrders();
      } else {
        throw new Error("Failed to place order");
      }
    } catch (error) {
      toast(`Error Failed to place order. please try again ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
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
                Market: {params.market_id}
              </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Order Book */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Book</CardTitle>
                  <CardDescription>Current market depth</CardDescription>
                </CardHeader>
                <CardContent>
                  {depth ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-green-600 mb-2 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          YES
                        </h4>
                        <div className="space-y-1">
                          <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-600">
                            <span>Bids (Price, Qty)</span>
                            <span>Asks (Price, Qty)</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              {depth.yes_bids.length > 0 ? (
                                depth.yes_bids.map((bid, index) => (
                                  <div
                                    key={index}
                                    className="text-sm bg-green-50 p-2 rounded"
                                  >
                                    ₹{bid[0]} × {bid[1]}
                                  </div>
                                ))
                              ) : (
                                <div className="text-sm text-gray-500">
                                  No bids
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              {depth.yes_asks.length > 0 ? (
                                depth.yes_asks.map((ask, index) => (
                                  <div
                                    key={index}
                                    className="text-sm bg-red-50 p-2 rounded"
                                  >
                                    ₹{ask[0]} × {ask[1]}
                                  </div>
                                ))
                              ) : (
                                <div className="text-sm text-gray-500">
                                  No asks
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-red-600 mb-2 flex items-center">
                          <TrendingDown className="h-4 w-4 mr-2" />
                          NO
                        </h4>
                        <div className="space-y-1">
                          <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-600">
                            <span>Bids (Price, Qty)</span>
                            <span>Asks (Price, Qty)</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              {depth.no_bids.length > 0 ? (
                                depth.no_bids.map((bid, index) => (
                                  <div
                                    key={index}
                                    className="text-sm bg-green-50 p-2 rounded"
                                  >
                                    ₹{bid[0]} × {bid[1]}
                                  </div>
                                ))
                              ) : (
                                <div className="text-sm text-gray-500">
                                  No bids
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              {depth.no_asks.length > 0 ? (
                                depth.no_asks.map((ask, index) => (
                                  <div
                                    key={index}
                                    className="text-sm bg-red-50 p-2 rounded"
                                  >
                                    ₹{ask[0]} × {ask[1]}
                                  </div>
                                ))
                              ) : (
                                <div className="text-sm text-gray-500">
                                  No asks
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      Loading order book...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Place Order */}
              <Card>
                <CardHeader>
                  <CardTitle>Place Order</CardTitle>
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
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
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
                            <SelectItem value="Buy">Buy</SelectItem>
                            <SelectItem value="Sell">Sell</SelectItem>
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
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? "Placing Order..." : "Place Order"}
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
