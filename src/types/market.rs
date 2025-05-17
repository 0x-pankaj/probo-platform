use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Market {
    pub market_id: String,
    pub question: String,
    pub created_at: u64,
}

impl Market {
    pub fn new(market_id: String, question: String) -> Self {
        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        Market {
            market_id,
            question,
            created_at,
        }
    }
}
