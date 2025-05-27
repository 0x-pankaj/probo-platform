"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useUser } from "@/contexts/UserContext";
// import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import UserSetup from "@/components/UserSetup";

export default function CreateMarket() {
  const [marketId, setMarketId] = useState("");
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { clientId, isAuthenticated } = useUser();

  if (!isAuthenticated) {
    return <UserSetup />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/market", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          market_id: marketId,
          question: question,
          client_id: clientId,
        }),
      });

      if (response.ok) {
        toast("Your market has been created successfully");

        setMarketId("");
        setQuestion("");
      } else {
        throw new Error("Failed to create market");
      }
    } catch (error) {
      toast(`Failed to create a market . please try again ${error} `);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Create New Market</CardTitle>
            <CardDescription>
              Create a new prediction market for others to trade on
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="marketId">Market ID</Label>
                <Input
                  id="marketId"
                  type="text"
                  placeholder="e.g., market_1"
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="question">Question</Label>
                <Input
                  id="question"
                  type="text"
                  placeholder="e.g., Will RCB win IPL?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Market"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
