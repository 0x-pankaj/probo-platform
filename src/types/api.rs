use crate::types::order::{OptionType, Order, OrderType, Trade};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub enum MessageFromApi {
    CreateOrder {
        user_id: u32,
        market_id: String,
        option: OptionType,
        order_type: OrderType,
        price: f64,
        quantity: u32,
        client_id: String,
    },
    CancelOrder {
        market_id: String,
        option: OptionType,
        order_type: OrderType,
        price: f64,
        order_id: u64,
        client_id: String,
    },
    GetOpenOrders {
        user_id: u32,
        market_id: String,
        client_id: String,
    },
    GetDepth {
        market_id: String,
        client_id: String,
    },
    CreateMarket {
        market_id: String,
        question: String,
        client_id: String,
    },
}

#[derive(Serialize, Deserialize, Debug)]
pub enum MessageToApi {
    OrderPlaced {
        order: Order,
        client_id: String,
    },
    OrderMatched {
        trade: Trade,
        client_id: String,
    },
    OrderCancelled {
        order_id: u64,
        market_id: String,
        client_id: String,
    },
    OpenOrders {
        orders: Vec<Order>,
        client_id: String,
    },
    Depth {
        market_id: String,
        bids: Vec<(f64, u32)>,
        asks: Vec<(f64, u32)>,
        client_id: String,
    },
    MarketCreated {
        market_id: String,
        client_id: String,
    },
    Error {
        message: String,
        client_id: String,
    },
}
