"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import Navbar from "@/components/Navbar";
import UserSetup from "@/components/UserSetup";
import { TrendingUp, Users } from "lucide-react";

interface Market {
  market_id: string;
  question: string;
  client_id: string;
}

export default function Events() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const { isAuthenticated } = useUser();

  useEffect(() => {
    // Mock data for now - in sync with created markets
    const mockMarkets: Market[] = [
      {
        market_id: "market_1",
        question: "Will Bitcoin reach $100,000 by end of 2024?",
        client_id: "admin_1",
      },
      {
        market_id: "market_2",
        question: "Will RCB win IPL?",
        client_id: "admin_1",
      },
      {
        market_id: "market_3",
        question: "Will it rain tomorrow in Mumbai?",
        client_id: "admin_2",
      },
    ];
    setMarkets(mockMarkets);
  }, []);

  if (!isAuthenticated) {
    return <UserSetup />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Active Markets
          </h1>
          <p className="text-gray-600">Trade on the outcome of future events</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map((market) => (
            <Link key={market.market_id} href={`/event/${market.market_id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg leading-tight">
                      {market.question}
                    </CardTitle>
                    <Badge variant="secondary" className="ml-2">
                      Active
                    </Badge>
                  </div>
                  <CardDescription>
                    Market ID: {market.market_id}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>Created by {market.client_id}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="h-4 w-4" />
                      <span>Trade Now</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {markets.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No markets available
            </h3>
            <p className="text-gray-600">Create a new market to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
