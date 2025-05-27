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
import { useUser } from "../contexts/UserContext";

export default function UserSetup() {
  const [userIdInput, setUserIdInput] = useState("");
  const [clientIdInput, setClientIdInput] = useState("");
  const { setUserId, setClientId } = useUser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userIdInput.trim() && clientIdInput.trim()) {
      // Set both values
      setUserId(userIdInput.trim());
      setClientId(clientIdInput.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Prediction Market</CardTitle>
          <CardDescription>
            Please enter your credentials to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                type="text"
                placeholder="Enter your user ID"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                type="text"
                placeholder="Enter your client ID"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
