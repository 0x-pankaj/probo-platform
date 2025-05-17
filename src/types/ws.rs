use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub enum WsMessage {
    Price {
        market_id: String,
        option: super::order::OptionType,
        price: f64,
    },
    Depth {
        market_id: String,
        bids: Vec<(f64, u32)>,
        asks: Vec<(f64, u32)>,
    },
}
