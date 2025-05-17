use crate::types::{
    market::Market,
    order::{Order, Trade},
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub enum DbMessage {
    SaveOrder(Order),
    SaveTrade(Trade),
    SaveMarket(Market),
    UpdateBalance { user_id: u32, balance: f64 },
}
