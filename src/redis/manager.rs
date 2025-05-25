use redis::{AsyncCommands, Client, aio::MultiplexedConnection, aio::PubSub};
use serde::{Serialize, de::DeserializeOwned};
use std::sync::Arc;

#[derive(Clone)]
pub struct RedisManager {
    client: Arc<Client>,
}

impl RedisManager {
    pub fn new(redis_url: &str) -> Self {
        let client = Client::open(redis_url).expect("Failed to connect to Redis");
        Self {
            client: Arc::new(client),
        }
    }

    async fn get_conn(&self) -> Result<MultiplexedConnection, redis::RedisError> {
        self.client.get_multiplexed_async_connection().await
    }

    pub async fn push_message<T: Serialize>(
        &self,
        queue: &str,
        message: &T,
    ) -> Result<(), redis::RedisError> {
        let serialized = serde_json::to_string(message).expect("Failed to serialize message");
        let mut conn = self.get_conn().await?;
        // Retry once on failure
        match conn.lpush(queue, &serialized).await {
            Ok(()) => Ok(()),
            Err(e) => {
                tracing::warn!("Redis push failed, retrying: {}", e);
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                conn.lpush(queue, &serialized).await
            }
        }
    }

    pub async fn pop_message<T: DeserializeOwned>(
        &self,
        queue: &str,
    ) -> Result<Option<T>, redis::RedisError> {
        let mut conn = self.get_conn().await?;
        // Blocking pop with timeout in seconds
        let result: Option<(String, String)> = conn.brpop(queue, 1.0).await?;

        match result {
            Some((_queue_name, serialized_value)) => {
                match serde_json::from_str(&serialized_value) {
                    Ok(message) => Ok(Some(message)),
                    Err(e) => {
                        tracing::error!("Failed to deserialized message: {}", e);
                        Err(redis::RedisError::from((
                            redis::ErrorKind::TypeError,
                            "Deserialization error",
                            e.to_string(),
                        )))
                    }
                }
            }
            None => Ok(None),
        }
    }

    pub async fn publish_message<T: Serialize>(
        &self,
        channel: &str,
        message: &T,
    ) -> Result<(), redis::RedisError> {
        let serialized = serde_json::to_string(message).expect("Failed to serialize message");
        let mut conn = self.get_conn().await?;
        match conn.publish(channel, &serialized).await {
            Ok(()) => Ok(()),
            Err(e) => {
                tracing::warn!("Redis publish failed, retrying: {}", e);
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                conn.publish(channel, &serialized).await
            }
        }
    }

    pub async fn subscribe(&self, channel: &str) -> Result<PubSub, redis::RedisError> {
        let mut pubsub = self.client.get_async_pubsub().await?;
        pubsub.subscribe(channel).await?;
        Ok(pubsub)
    }
}
