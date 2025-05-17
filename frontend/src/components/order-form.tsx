"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { placeOrder } from "@/lib/api";

interface OrderFormProps {
  userId: number;
  clientId: string;
  marketId: string;
}

export default function OrderForm({
  userId,
  clientId,
  marketId,
}: OrderFormProps) {
  const [option, setOption] = useState<"Yes" | "No">("Yes");
  const [orderType, setOrderType] = useState<"Buy" | "Sell">("Buy");
  const [price, setPrice] = useState<string>("5.0");
  const [quantity, setQuantity] = useState<string>("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handlePlaceOrder = async () => {
    // Validate inputs
    const priceNum = Number.parseFloat(price);
    const quantityNum = Number.parseInt(quantity, 10);

    if (isNaN(priceNum) || priceNum < 0.5 || priceNum > 9.5) {
      setError("Price must be between 0.5 and 9.5");
      return;
    }

    if (isNaN(quantityNum) || quantityNum <= 0) {
      setError("Quantity must be a positive number");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await placeOrder({
        user_id: userId,
        market_id: marketId,
        option,
        order_type: orderType,
        price: priceNum,
        quantity: quantityNum,
        client_id: clientId,
      });

      setSuccess("Order placed. Check WebSocket for confirmation.");
    } catch (err) {
      setError("Failed to place order. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Place Order</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Option</Label>
            <RadioGroup
              value={option}
              onValueChange={(value) => setOption(value as "Yes" | "No")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Yes" id="yes" />
                <Label htmlFor="yes" className="cursor-pointer">
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="No" id="no" />
                <Label htmlFor="no" className="cursor-pointer">
                  No
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Order Type</Label>
            <RadioGroup
              value={orderType}
              onValueChange={(value) => setOrderType(value as "Buy" | "Sell")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Buy" id="buy" />
                <Label htmlFor="buy" className="cursor-pointer text-green-500">
                  Buy
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Sell" id="sell" />
                <Label htmlFor="sell" className="cursor-pointer text-red-500">
                  Sell
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price (0.5 - 9.5)</Label>
            <Input
              id="price"
              type="number"
              min="0.5"
              max="9.5"
              step="0.1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-gray-700 border-gray-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-gray-700 border-gray-600"
            />
          </div>
        </div>

        <Button
          onClick={handlePlaceOrder}
          disabled={loading}
          className={`w-full ${
            orderType === "Buy"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {loading ? "Placing Order..." : `${orderType} ${option} @ ${price}`}
        </Button>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-500 text-sm">{success}</p>}

        <div className="text-xs text-gray-400">
          <p>
            Note: Yes Sell only matches Yes Buy (or No Buy at exact 10.0 -
            price), and vice versa.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
