"use client";

import { useUser } from "@/contexts/UserContext";
import UserSetup from "@/components/UserSetup";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const { isAuthenticated } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Small delay to ensure context is properly initialized
    const timer = setTimeout(() => {
      setIsLoading(false);
      if (isAuthenticated) {
        router.push("/events");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <UserSetup />;
  }

  return null;
}
