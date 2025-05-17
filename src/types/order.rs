use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub enum OptionType {
    Yes,
    No,
}

#[derive(Clone, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub enum OrderType {
    Buy,
    Sell,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Order {
    pub id: u64,
    pub user_id: u32,
    pub market_id: String,
    pub option: OptionType,
    pub order_type: OrderType,
    pub price: f64,
    pub quantity: u32,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Trade {
    pub buy_order_id: u64,
    pub sell_order_id: u64,
    pub market_id: String,
    pub option: OptionType,
    pub price: f64,
    pub quantity: u32,
    pub timestamp: u64,
}

impl Order {
    pub fn new(
        id: u64,
        user_id: u32,
        market_id: String,
        option: OptionType,
        order_type: OrderType,
        price: f64,
        quantity: u32,
    ) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        Order {
            id,
            user_id,
            market_id,
            option,
            order_type,
            price,
            quantity,
            timestamp,
        }
    }
}
