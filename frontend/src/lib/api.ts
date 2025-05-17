import axios from "axios";
// import { toast } from "@/components/ui/use-toast";
import { toast } from "sonner";

const API_BASE_URL = "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error);
    toast(
      `title: "error", description: ${error.response?.data || "An error occured"}`,
    );

    return Promise.reject(error);
  },
);

// API Types
export interface CreateMarketRequest {
  market_id: string;
  question: string;
  client_id: string;
}

export interface PlaceOrderRequest {
  user_id: number;
  market_id: string;
  option: "Yes" | "No";
  order_type: "Buy" | "Sell";
  price: number;
  quantity: number;
  client_id: string;
}

export interface CancelOrderRequest {
  market_id: string;
  option: "Yes" | "No";
  order_type: "Buy" | "Sell";
  price: number;
  order_id: number;
  client_id: string;
}

export interface GetOpenOrdersRequest {
  user_id: number;
  market_id: string;
  client_id: string;
}

export interface GetMarketDepthRequest {
  market_id: string;
  client_id: string;
}

// API Functions
export const createMarket = async (
  data: CreateMarketRequest,
): Promise<string> => {
  const response = await api.post("/market", data);
  return response.data;
};

export const placeOrder = async (data: PlaceOrderRequest): Promise<string> => {
  const response = await api.post("/order", data);
  return response.data;
};

export const cancelOrder = async (
  data: CancelOrderRequest,
): Promise<string> => {
  const response = await api.post("/cancel", data);
  return response.data;
};

export const getOpenOrders = async (
  data: GetOpenOrdersRequest,
): Promise<string> => {
  const response = await api.post("/open_orders", data);
  return response.data;
};

export const getMarketDepth = async (
  data: GetMarketDepthRequest,
): Promise<string> => {
  const response = await api.post("/depth", data);
  return response.data;
};
