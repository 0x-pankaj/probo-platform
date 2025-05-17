"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Market } from "@/lib/types";

interface MarketSelectorProps {
  markets: Market[];
  selectedMarket: Market | null;
  onSelectMarket: (market: Market) => void;
}

export default function MarketSelector({
  markets,
  selectedMarket,
  onSelectMarket,
}: MarketSelectorProps) {
  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Markets</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-700">
          {markets.map((market) => (
            <li key={market.market_id}>
              <button
                className={`w-full text-left p-3 hover:bg-gray-700 transition-colors ${
                  selectedMarket?.market_id === market.market_id
                    ? "bg-gray-700"
                    : ""
                }`}
                onClick={() => onSelectMarket(market)}
              >
                <div className="font-medium truncate">{market.question}</div>
                <div className="text-xs text-gray-400 truncate">
                  ID: {market.market_id}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
