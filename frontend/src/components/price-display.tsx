import { ArrowDown, ArrowUp } from "lucide-react";

interface PriceDisplayProps {
  prices: {
    Yes?: number;
    No?: number;
  };
  marketId: string;
}

export default function PriceDisplay({ prices, marketId }: PriceDisplayProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="text-xs text-gray-400">Yes Price</div>
        <div className="flex items-center">
          {prices.Yes ? (
            <>
              <span className="text-lg font-bold">{prices.Yes.toFixed(1)}</span>
              <ArrowUp className="h-4 w-4 text-green-500 ml-1" />
            </>
          ) : (
            <span className="text-lg font-bold">-</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="text-xs text-gray-400">No Price</div>
        <div className="flex items-center">
          {prices.No ? (
            <>
              <span className="text-lg font-bold">{prices.No.toFixed(1)}</span>
              <ArrowDown className="h-4 w-4 text-red-500 ml-1" />
            </>
          ) : (
            <span className="text-lg font-bold">-</span>
          )}
        </div>
      </div>
    </div>
  );
}
