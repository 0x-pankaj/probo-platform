use crate::{
    api::server::run_api_server, db::processor::DbProcessor, engine::processor::EngineProcessor,
    redis::manager::RedisManager, ws::server::run_ws_server,
};
mod api;
mod db;
mod engine;
mod redis;
mod types;
mod ws;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    let redis = RedisManager::new("redis://127.0.0.1/");

    // Create all the processors and servers
    let engine_processor = EngineProcessor::new(redis.clone());
    let db_processor = DbProcessor::new(redis.clone());

    // Spawning the engine processor in a separate task
    let engine_handle = tokio::spawn(async move {
        engine_processor.run().await;
    });

    // Spawning DB processor in a separate task
    let db_handle = tokio::spawn(async move {
        db_processor.run().await;
    });

    // Run API and WebSocket servers concurrently, but not in separate tokio tasks
    // Use tokio::select! to handle multiple concurrent futures
    tokio::select! {
        // Run the API server directly (not in a separate tokio task)
        api_result = run_api_server(redis.clone(), "0.0.0.0:8000") => {
            if let Err(e) = api_result {
                tracing::error!("API server error: {}", e);
            }
        }
        // Run the WebSocket server directly (not in a separate tokio task)
        ws_result = run_ws_server(redis.clone(), "0.0.0.0:8001") => {
            if let Err(e) = ws_result {
                tracing::error!("WebSocket server error: {}", e);
            }
        }
        // Wait for engine processor to complete (should run indefinitely)
        _ = engine_handle => {
            tracing::error!("Engine processor unexpectedly terminated");
        }
        // Wait for DB processor to complete (should run indefinitely)
        _ = db_handle => {
            tracing::error!("DB processor unexpectedly terminated");
        }
    }
}
