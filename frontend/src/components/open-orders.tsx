"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOpenOrders, cancelOrder } from "@/lib/api";
import type { Order } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";

interface OpenOrdersProps {
  orders: Order[];
  userId: number;
  clientId: string;
  marketId: string;
}

export default function OpenOrders({
  orders,
  userId,
  clientId,
  marketId,
}: OpenOrdersProps) {
  const [loading, setLoading] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(
    null,
  );

  const fetchOpenOrders = async () => {
    setLoading(true);
    try {
      await getOpenOrders({
        user_id: userId,
        market_id: marketId,
        client_id: clientId,
      });
      // Orders will be updated via WebSocket
    } catch (err) {
      console.error("Failed to fetch open orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (order: Order) => {
    setCancellingOrderId(order.id);
    try {
      await cancelOrder({
        market_id: order.market_id,
        option: order.option,
        order_type: order.order_type,
        price: order.price,
        order_id: order.id,
        client_id: clientId,
      });
      // Order will be removed via WebSocket
    } catch (err) {
      console.error("Failed to cancel order:", err);
    } finally {
      setCancellingOrderId(null);
    }
  };

  useEffect(() => {
    fetchOpenOrders();
  }, [marketId]);

  const userOrders = orders.filter((order) => order.user_id === userId);

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Open Orders</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOpenOrders}
          disabled={loading}
          className="h-8 border-gray-600"
        >
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {userOrders.length === 0 ? (
          <div className="text-center py-4 text-gray-400">
            No open orders for this market
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead>ID</TableHead>
                  <TableHead>Option</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userOrders.map((order) => (
                  <TableRow key={order.id} className="border-gray-700">
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.option}</TableCell>
                    <TableCell
                      className={
                        order.order_type === "Buy"
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {order.order_type}
                    </TableCell>
                    <TableCell>{order.price.toFixed(1)}</TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>{formatTimestamp(order.timestamp)}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelOrder(order)}
                        disabled={cancellingOrderId === order.id}
                        className="h-7 px-2 bg-red-700 hover:bg-red-800"
                      >
                        {cancellingOrderId === order.id
                          ? "Cancelling..."
                          : "Cancel"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
