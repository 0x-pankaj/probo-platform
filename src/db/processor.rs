use crate::{redis::manager::RedisManager, types::db::DbMessage};
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct DbProcessor {
    redis: RedisManager,
    orders: RwLock<HashMap<u64, crate::types::order::Order>>,
    trades: RwLock<Vec<crate::types::order::Trade>>,
    markets: RwLock<HashMap<String, crate::types::market::Market>>,
    balances: RwLock<HashMap<u32, f64>>,
}

impl DbProcessor {
    pub fn new(redis: RedisManager) -> Self {
        DbProcessor {
            redis,
            orders: RwLock::new(HashMap::new()),
            trades: RwLock::new(Vec::new()),
            markets: RwLock::new(HashMap::new()),
            balances: RwLock::new(HashMap::new()),
        }
    }

    pub async fn run(&self) {
        loop {
            match self.redis.pop_message::<DbMessage>("db_queue").await {
                Ok(Some(message)) => {
                    if let Err(e) = self.process(message).await {
                        tracing::error!("Error processing DB message: {}", e);
                    }
                }
                Ok(None) => continue,
                Err(e) => {
                    tracing::error!("Redis error: {}", e);
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            }
        }
    }

    async fn process(&self, message: DbMessage) -> Result<(), String> {
        match message {
            DbMessage::SaveOrder(order) => {
                self.orders.write().await.insert(order.id, order);
            }
            DbMessage::SaveTrade(trade) => {
                self.trades.write().await.push(trade);
            }
            DbMessage::SaveMarket(market) => {
                self.markets
                    .write()
                    .await
                    .insert(market.market_id.clone(), market);
            }
            DbMessage::UpdateBalance { user_id, balance } => {
                self.balances.write().await.insert(user_id, balance);
            }
        }
        Ok(())
    }
}
