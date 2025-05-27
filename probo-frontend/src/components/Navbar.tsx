"use client";

import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { TrendingUp, Plus, List } from "lucide-react";

export default function Navbar() {
  const { userId, clientId } = useUser();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/events" className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">
                PredictMarket
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/events">
              <Button variant="ghost" className="flex items-center space-x-2">
                <List className="h-4 w-4" />
                <span>Events</span>
              </Button>
            </Link>
            <Link href="/create_market">
              <Button variant="ghost" className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Create Market</span>
              </Button>
            </Link>
            <div className="text-sm text-gray-600">
              User: {userId} | Client: {clientId}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
