import type { Order, Trade, Depth, Price } from "./types";
import { toast } from "sonner";

// WebSocket URLs
const CLIENT_WS_URL = "ws://localhost:8001/ws";
const MARKET_WS_URL = "ws://localhost:8001/ws";

// WebSocket instances
let clientWs: WebSocket | null = null;
let marketWs: WebSocket | null = null;

// WebSocket message handlers
interface WebSocketHandlers {
  clientId: string;
  onOrderPlaced: (order: Order) => void;
  onOrderMatched: (trade: Trade) => void;
  onOrderCancelled: (data: {
    order_id: number;
    market_id: string;
    client_id: string;
  }) => void;
  onOpenOrders: (data: { orders: Order[]; client_id: string }) => void;
  onDepth: (data: Depth) => void;
  onMarketCreated: (data: { market_id: string; client_id: string }) => void;
  onError: (error: { message: string; client_id: string }) => void;
  onPrice: (data: Price) => void;
}

export const setupWebSockets = (handlers: WebSocketHandlers) => {
  // Close existing connections
  closeWebSockets();

  // Setup client WebSocket
  clientWs = new WebSocket(`${CLIENT_WS_URL}?client_id=${handlers.clientId}`);

  clientWs.onopen = () => {
    console.log("Client WebSocket connected");
    toast("Connected, Client websocket connected successfully");
  };

  clientWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Client WebSocket message:", data);

      // Handle different message types
      if (data.OrderPlaced) {
        handlers.onOrderPlaced(data.OrderPlaced.order);
        toast(
          `Order PLaced,  description: ${data.OrderPlaced.order.order_type} ${data.OrderPlaced.order.option} order placed at ${data.OrderPlaced.order.price}`,
        );
      } else if (data.OrderMatched) {
        handlers.onOrderMatched(data.OrderMatched.trade);
        toast(
          `Order Matched,  description: ${data.OrderMatched.trade.option} order matched at ${data.OrderMatched.trade.price} for ${data.OrderMatched.trade.quantity} units`,
        );
      } else if (data.OrderCancelled) {
        handlers.onOrderCancelled(data.OrderCancelled);
        toast(
          `title: Order Cancelled,  description: Order ${data.OrderCancelled.order_id} cancelled`,
        );
      } else if (data.OpenOrders) {
        handlers.onOpenOrders(data.OpenOrders);
      } else if (data.Depth && data.Depth.client_id) {
        handlers.onDepth(data.Depth);
      } else if (data.MarketCreated) {
        handlers.onMarketCreated(data.MarketCreated);
        toast(
          `title: Market Created, description: Market ${data.MarketCreated.market_id} created successfully `,
        );
      } else if (data.Error) {
        handlers.onError(data.Error);
        toast(`title: Error, description: ${data.Error.message} `);
      }
    } catch (err) {
      console.error("Error parsing client WebSocket message:", err);
    }
  };

  clientWs.onerror = (error) => {
    console.error("Client WebSocket error:", error);
    toast(
      `title: Connection Error , description: Client websocket connection error`,
    );
  };

  clientWs.onclose = () => {
    console.log("Client WebSocket disconnected");

    toast(`Client websocket disconnected`);
  };

  // Setup market WebSocket
  marketWs = new WebSocket(MARKET_WS_URL);

  marketWs.onopen = () => {
    console.log("Market WebSocket connected");
  };

  marketWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Market WebSocket message:", data);

      // Handle different message types
      if (data.Price) {
        handlers.onPrice(data.Price);
      } else if (data.Depth && !data.Depth.client_id) {
        handlers.onDepth(data.Depth);
      }
    } catch (err) {
      console.error("Error parsing market WebSocket message:", err);
    }
  };

  marketWs.onerror = (error) => {
    console.error("Market WebSocket error:", error);
  };

  marketWs.onclose = () => {
    console.log("Market WebSocket disconnected");
  };

  // Return message handlers for external use
  return {
    handleClientMessage: (message: any) => {
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(message));
      }
    },
    handleMarketMessage: (message: any) => {
      if (marketWs && marketWs.readyState === WebSocket.OPEN) {
        marketWs.send(JSON.stringify(message));
      }
    },
  };
};

export const closeWebSockets = () => {
  if (clientWs) {
    clientWs.close();
    clientWs = null;
  }

  if (marketWs) {
    marketWs.close();
    marketWs = null;
  }
};
