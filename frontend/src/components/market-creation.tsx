"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMarket } from "@/lib/api";

interface MarketCreationProps {
  clientId: string;
}

export default function MarketCreation({ clientId }: MarketCreationProps) {
  const [marketId, setMarketId] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCreateMarket = async () => {
    if (!marketId || !question) {
      setError("Market ID and question are required");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await createMarket({
        market_id: marketId,
        question,
        client_id: clientId,
      });

      setSuccess(
        "Market creation requested. Check WebSocket for confirmation.",
      );
      setMarketId("");
      setQuestion("");
    } catch (err) {
      setError("Failed to create market. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Create Market</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="marketId">Market ID</Label>
          <Input
            id="marketId"
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            placeholder="e.g., market_3"
            className="bg-gray-700 border-gray-600"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="question">Question</Label>
          <Input
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., Will it rain tomorrow?"
            className="bg-gray-700 border-gray-600"
          />
        </div>

        <Button
          onClick={handleCreateMarket}
          disabled={loading || !marketId || !question}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {loading ? "Creating..." : "Create Market"}
        </Button>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-500 text-sm">{success}</p>}
      </CardContent>
    </Card>
  );
}
