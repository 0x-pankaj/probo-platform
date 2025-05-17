"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMarketDepth } from "@/lib/api";
import type { Depth } from "@/lib/types";
import { Chart, registerables } from "chart.js";

// Register Chart.js components
Chart.register(...registerables);

interface DepthChartProps {
  depth: Depth | null;
  clientId: string;
  marketId: string;
}

export default function DepthChart({
  depth,
  clientId,
  marketId,
}: DepthChartProps) {
  const [loading, setLoading] = useState(false);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const fetchDepth = async () => {
    setLoading(true);
    try {
      await getMarketDepth({
        market_id: marketId,
        client_id: clientId,
      });
      // Depth will be updated via WebSocket
    } catch (err) {
      console.error("Failed to fetch market depth:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepth();
  }, [marketId]);

  useEffect(() => {
    if (!depth || !chartRef.current) return;

    // Destroy previous chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    // Prepare data for chart
    const bidPrices = depth.bids.map((bid) => bid[0]);
    const bidQuantities = depth.bids.map((bid) => bid[1]);
    const askPrices = depth.asks.map((ask) => ask[0]);
    const askQuantities = depth.asks.map((ask) => ask[1]);

    // Create chart
    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: [...bidPrices.reverse(), ...askPrices].map((price) =>
          price.toFixed(1),
        ),
        datasets: [
          {
            label: "Bids",
            data: bidQuantities.reverse(),
            borderColor: "rgba(34, 197, 94, 1)",
            backgroundColor: "rgba(34, 197, 94, 0.2)",
            fill: true,
            tension: 0.1,
            pointRadius: 3,
          },
          {
            label: "Asks",
            data: Array(bidPrices.length).fill(null).concat(askQuantities),
            borderColor: "rgba(239, 68, 68, 1)",
            backgroundColor: "rgba(239, 68, 68, 0.2)",
            fill: true,
            tension: 0.1,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: "Price",
              color: "#e5e7eb",
            },
            grid: {
              color: "rgba(75, 85, 99, 0.2)",
            },
            ticks: {
              color: "#e5e7eb",
            },
          },
          y: {
            title: {
              display: true,
              text: "Quantity",
              color: "#e5e7eb",
            },
            grid: {
              color: "rgba(75, 85, 99, 0.2)",
            },
            ticks: {
              color: "#e5e7eb",
            },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: "#e5e7eb",
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => `Quantity: ${context.raw}`,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [depth]);

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Market Depth</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDepth}
          disabled={loading}
          className="h-8 border-gray-600"
        >
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {!depth ? (
          <div className="text-center py-4 text-gray-400">
            No depth data available for this market
          </div>
        ) : (
          <div className="space-y-6">
            <div className="h-64 w-full">
              <canvas ref={chartRef}></canvas>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-2 text-green-500">
                  Bids (Buy Orders)
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700">
                        <TableHead>Price</TableHead>
                        <TableHead>Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depth.bids.length === 0 ? (
                        <TableRow className="border-gray-700">
                          <TableCell
                            colSpan={2}
                            className="text-center text-gray-400"
                          >
                            No bids
                          </TableCell>
                        </TableRow>
                      ) : (
                        depth.bids.map(([price, quantity], index) => (
                          <TableRow key={index} className="border-gray-700">
                            <TableCell className="text-green-500">
                              {price.toFixed(1)}
                            </TableCell>
                            <TableCell>{quantity}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2 text-red-500">
                  Asks (Sell Orders)
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700">
                        <TableHead>Price</TableHead>
                        <TableHead>Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depth.asks.length === 0 ? (
                        <TableRow className="border-gray-700">
                          <TableCell
                            colSpan={2}
                            className="text-center text-gray-400"
                          >
                            No asks
                          </TableCell>
                        </TableRow>
                      ) : (
                        depth.asks.map(([price, quantity], index) => (
                          <TableRow key={index} className="border-gray-700">
                            <TableCell className="text-red-500">
                              {price.toFixed(1)}
                            </TableCell>
                            <TableCell>{quantity}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
