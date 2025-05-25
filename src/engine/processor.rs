use crate::{
    engine::matching_engine::MatchingEngine, redis::manager::RedisManager,
    types::api::MessageFromApi,
};
// use actix::{Actor, Context, Handler, Message};

pub struct EngineProcessor {
    engine: MatchingEngine,
    redis: RedisManager,
}

impl EngineProcessor {
    pub fn new(redis: RedisManager) -> Self {
        EngineProcessor {
            engine: MatchingEngine::new(redis.clone()),
            redis,
        }
    }

    pub async fn run(&self) {
        loop {
            match self
                .redis
                .pop_message::<MessageFromApi>("engine_queue")
                .await
            {
                Ok(Some(message)) => {
                    println!("message from api: {:?}", message);
                    if let Err(e) = self.process(message).await {
                        tracing::error!("Error processing message: {}", e);
                    }
                }
                Ok(None) => {
                    //if queue is empty
                    tokio::time::sleep(std::time::Duration::from_micros(100)).await;
                    continue;
                }
                Err(e) => {
                    tracing::error!("Redis error: {}", e);
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            }
        }
    }

    async fn process(&self, message: MessageFromApi) -> Result<(), String> {
        match message {
            MessageFromApi::CreateOrder {
                user_id,
                market_id,
                option,
                order_type,
                price,
                quantity,
                client_id,
            } => {
                self.engine
                    .place_order(
                        user_id, market_id, option, order_type, price, quantity, client_id,
                    )
                    .await?;
            }
            MessageFromApi::CancelOrder {
                market_id,
                option,
                order_type,
                price,
                order_id,
                client_id,
            } => {
                self.engine
                    .cancel_order(market_id, option, order_type, price, order_id, client_id)
                    .await?;
            }
            MessageFromApi::GetOpenOrders {
                user_id,
                market_id,
                client_id,
            } => {
                self.engine
                    .get_open_orders(user_id, market_id, client_id)
                    .await?;
            }
            MessageFromApi::GetDepth {
                market_id,
                client_id,
            } => {
                self.engine.get_depth(market_id, client_id).await?;
            }
            MessageFromApi::CreateMarket {
                market_id,
                question,
                client_id,
            } => {
                self.engine
                    .create_market(market_id, question, client_id)
                    .await?;
            }
        }
        Ok(())
    }
}

// impl Actor for EngineProcessor {
//     type Context = Context<Self>;
// }

// #[derive(Message)]
// #[rtype(result = "Result<(), String>")]
// struct ProcessMessage(MessageFromApi);

// impl Handler<ProcessMessage> for EngineProcessor {
//     type Result = Result<(), String>;

//     fn handle(&mut self, msg: ProcessMessage, _ctx: &mut Context<Self>) -> Self::Result {
//         futures::executor::block_on(self.process(msg.0))
//     }
// }
