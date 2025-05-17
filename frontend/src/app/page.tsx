"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (!userId || isNaN(Number(userId))) {
      return;
    }

    setLoading(true);

    // Generate a unique client ID
    const clientId = uuidv4();

    // Store user info in localStorage
    localStorage.setItem("userId", userId);
    localStorage.setItem("clientId", clientId);

    // Mock balance data (would come from API in a real app)
    const mockBalances = {
      "1": { available: 10000, locked: 0 },
      "2": { available: 10000, locked: 0 },
    };

    localStorage.setItem(
      "balance",
      JSON.stringify(mockBalances[userId] || { available: 10000, locked: 0 }),
    );

    // Redirect to dashboard
    router.push("/dashboard");
  };

  useEffect(() => {
    // Check if user is already logged in
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-900 text-white">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Probo Trading Platform
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                type="number"
                placeholder="Enter user ID (e.g., 1 or 2)"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="bg-gray-700 border-gray-600"
              />
              <p className="text-xs text-gray-400">
                For testing, use user ID 1 or 2
              </p>
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={handleLogin}
              disabled={loading || !userId}
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
