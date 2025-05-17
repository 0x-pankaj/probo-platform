// Market type
export interface Market {
  market_id: string;
  question: string;
}

// Order type
export interface Order {
  id: number;
  user_id: number;
  market_id: string;
  option: "Yes" | "No";
  order_type: "Buy" | "Sell";
  price: number;
  quantity: number;
  timestamp: number;
}

// Trade type
export interface Trade {
  buy_order_id: number;
  sell_order_id: number;
  market_id: string;
  option: "Yes" | "No";
  price: number;
  quantity: number;
  timestamp: number;
}

// Depth type
export interface Depth {
  market_id: string;
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][]; // [price, quantity]
  client_id?: string;
}

// Price type
export interface Price {
  market_id: string;
  option: "Yes" | "No";
  price: number;
}
