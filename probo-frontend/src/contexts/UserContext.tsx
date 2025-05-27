"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";

interface UserContextType {
  userId: string | null;
  clientId: string | null;
  setUserId: (id: string) => void;
  setClientId: (id: string) => void;
  isAuthenticated: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [clientId, setClientIdState] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    const savedUserId = localStorage.getItem("userId");
    const savedClientId = localStorage.getItem("clientId");

    if (savedUserId && savedClientId) {
      setUserIdState(savedUserId);
      setClientIdState(savedClientId);
      setIsAuthenticated(true);
    }
  }, []);

  const setUserId = (id: string) => {
    setUserIdState(id);
    localStorage.setItem("userId", id);
    // Check if both userId and clientId are now available
    const currentClientId = clientId || localStorage.getItem("clientId");
    if (id && currentClientId) {
      setIsAuthenticated(true);
    }
  };

  const setClientId = (id: string) => {
    setClientIdState(id);
    localStorage.setItem("clientId", id);
    // Check if both userId and clientId are now available
    const currentUserId = userId || localStorage.getItem("userId");
    if (id && currentUserId) {
      setIsAuthenticated(true);
    }
  };

  return (
    <UserContext.Provider
      value={{
        userId,
        clientId,
        setUserId,
        setClientId,
        isAuthenticated,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
