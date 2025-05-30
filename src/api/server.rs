use crate::{
    redis::manager::RedisManager,
    types::api::{MessageFromApi, MessageToApi},
};
use actix::AsyncContext;
use actix_cors::Cors;
use actix_web::{App, HttpResponse, HttpServer, Responder, web};
use actix_web_actors::ws;
use futures_util::StreamExt;
use serde::Deserialize;
use std::{sync::Arc, time::Duration};
use tokio::time::timeout;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    redis: RedisManager,
}

pub async fn run_api_server(redis: RedisManager, addr: &str) -> std::io::Result<()> {
    let state = Arc::new(AppState { redis });
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_header()
            .allow_any_method();
        App::new()
            .wrap(cors)
            .app_data(web::Data::new(state.clone()))
            .route("/order", web::post().to(place_order))
            .route("/cancel", web::post().to(cancel_order))
            .route("/open_orders", web::post().to(get_open_orders))
            .route("/depth", web::post().to(get_depth))
            .route("/market", web::post().to(create_market))
            .route("/ws", web::get().to(ws_index))
            .route("/events", web::get().to(get_events))
    })
    .bind(addr)?
    .run()
    .await
}

async fn get_events(state: web::Data<Arc<AppState>>) -> impl Responder {
    let mut markets = Vec::new();
    match state.redis.pop_message::<Vec<String>>("markets_list").await {
        Ok(Some(market_ids)) => {
            for market_id in market_ids {
                markets.push(serde_json::json!({ "market_id": market_id }));
            }
            HttpResponse::Ok().json(markets)
        }
        _ => HttpResponse::Ok().json(Vec::<String>::new()),
    }
}

#[derive(Deserialize)]
struct PlaceOrderRequest {
    user_id: u32,
    market_id: String,
    option: String,
    order_type: String,
    price: f64,
    quantity: u32,
    client_id: String,
}

async fn place_order(
    state: web::Data<Arc<AppState>>,
    req: web::Json<PlaceOrderRequest>,
) -> impl Responder {
    let option = match req.option.as_str() {
        "Yes" => crate::types::order::OptionType::Yes,
        "No" => crate::types::order::OptionType::No,
        _ => return HttpResponse::BadRequest().body("Invalid option"),
    };
    let order_type = match req.order_type.as_str() {
        "Buy" => crate::types::order::OrderType::Buy,
        "Sell" => crate::types::order::OrderType::Sell,
        _ => return HttpResponse::BadRequest().body("Invalid order type"),
    };

    let message = MessageFromApi::CreateOrder {
        user_id: req.user_id,
        market_id: req.market_id.clone(),
        option,
        order_type,
        price: req.price,
        quantity: req.quantity,
        client_id: req.client_id.clone(),
    };

    state
        .redis
        .push_message("engine_queue", &message)
        .await
        .unwrap();

    // Subscribe temporarily to get the response
    let response = wait_for_response(&state.redis, &req.client_id).await;
    match response {
        Some(MessageToApi::OrderPlaced { order, .. }) => {
            HttpResponse::Ok().json(serde_json::to_value(&order).unwrap())
        }
        Some(MessageToApi::OrderMatched { trade, .. }) => {
            HttpResponse::Ok().json(serde_json::to_value(&trade).unwrap())
        }
        Some(MessageToApi::Error { message, .. }) => HttpResponse::BadRequest().body(message),
        _ => HttpResponse::InternalServerError().body("No response received"),
    }
}

#[derive(Deserialize)]
struct CancelOrderRequest {
    market_id: String,
    option: String,
    order_type: String,
    price: f64,
    order_id: u64,
    client_id: String,
}

async fn cancel_order(
    state: web::Data<Arc<AppState>>,
    req: web::Json<CancelOrderRequest>,
) -> impl Responder {
    let option = match req.option.as_str() {
        "Yes" => crate::types::order::OptionType::Yes,
        "No" => crate::types::order::OptionType::No,
        _ => return HttpResponse::BadRequest().body("Invalid option"),
    };
    let order_type = match req.order_type.as_str() {
        "Buy" => crate::types::order::OrderType::Buy,
        "Sell" => crate::types::order::OrderType::Sell,
        _ => return HttpResponse::BadRequest().body("Invalid order type"),
    };

    let message = MessageFromApi::CancelOrder {
        market_id: req.market_id.clone(),
        option,
        order_type,
        price: req.price,
        order_id: req.order_id,
        client_id: req.client_id.clone(),
    };

    state
        .redis
        .push_message("engine_queue", &message)
        .await
        .unwrap();

    let response = wait_for_response(&state.redis, &req.client_id).await;
    match response {
        Some(MessageToApi::OrderCancelled { order_id, .. }) => {
            HttpResponse::Ok().json(serde_json::json!({ "order_id": order_id }))
        }
        Some(MessageToApi::Error { message, .. }) => HttpResponse::BadRequest().body(message),
        _ => HttpResponse::InternalServerError().body("No response received"),
    }
}

#[derive(Deserialize)]
struct OpenOrdersRequest {
    user_id: u32,
    market_id: String,
    client_id: String,
}

async fn get_open_orders(
    state: web::Data<Arc<AppState>>,
    req: web::Json<OpenOrdersRequest>,
) -> impl Responder {
    println!("called open orders");

    // Generate a unique client_id server-side
    let client_id = Uuid::new_v4().to_string();
    println!("Generated client_id: {}", client_id);

    // Subscribe to the responses channel *before* pushing the message
    let mut pubsub = match state.redis.subscribe("responses").await {
        Ok(pubsub) => pubsub,
        Err(e) => {
            tracing::error!("Failed to subscribe to responses: {}", e);
            return HttpResponse::InternalServerError().body("Failed to subscribe to responses");
        }
    };

    // Create the message to send to the engine
    let message = MessageFromApi::GetOpenOrders {
        user_id: req.user_id,
        market_id: req.market_id.clone(),
        client_id: client_id.clone(),
    };

    // Push the message to the engine queue *after* subscribing
    if let Err(e) = state.redis.push_message("engine_queue", &message).await {
        tracing::error!("Failed to push message to engine_queue: {}", e);
        return HttpResponse::InternalServerError().body("Failed to send open orders request");
    }
    println!("after sending to queue");

    // Wait for the response with a timeout
    let response = timeout(Duration::from_secs(5), pubsub.on_message().next()).await;
    match response {
        Ok(Some(msg)) => {
            if let Ok(payload) = msg.get_payload::<String>() {
                if let Ok(message) = serde_json::from_str::<MessageToApi>(&payload) {
                    if matches_client_id(&message, &client_id) {
                        match message {
                            MessageToApi::OpenOrders { orders, .. } => {
                                return HttpResponse::Ok()
                                    .json(serde_json::to_value(&orders).unwrap());
                            }
                            MessageToApi::Error { message, .. } => {
                                return HttpResponse::BadRequest().body(message);
                            }
                            _ => {
                                return HttpResponse::InternalServerError()
                                    .body("Unexpected response type");
                            }
                        }
                    }
                }
            }
            HttpResponse::InternalServerError().body("Invalid response format")
        }
        Ok(None) => {
            tracing::warn!("No message received for client_id: {}", client_id);
            HttpResponse::InternalServerError().body("No response received")
        }
        Err(_) => {
            tracing::warn!("Timeout waiting for response for client_id: {}", client_id);
            HttpResponse::InternalServerError().body("Response timeout")
        }
    }
}

#[derive(Deserialize)]
struct DepthRequest {
    market_id: String,
    client_id: String,
}

async fn get_depth(
    state: web::Data<Arc<AppState>>,
    req: web::Json<DepthRequest>,
) -> impl Responder {
    println!("finding depth hitted:");

    // Subscribe to the responses channel *before* pushing the message
    let mut pubsub = match state.redis.subscribe("responses").await {
        Ok(pubsub) => pubsub,
        Err(e) => {
            tracing::error!("Failed to subscribe to responses: {}", e);
            return HttpResponse::InternalServerError().body("Failed to subscribe to responses");
        }
    };

    // Create the message to send to the engine
    let message = MessageFromApi::GetDepth {
        market_id: req.market_id.clone(),
        client_id: req.client_id.clone(),
    };

    // Push the message to the engine queue *after* subscribing
    if let Err(e) = state.redis.push_message("engine_queue", &message).await {
        tracing::error!("Failed to push message to engine_queue: {}", e);
        return HttpResponse::InternalServerError().body("Failed to send depth request");
    }
    println!("after sending to queue");

    // Wait for the response with a timeout
    let response = timeout(Duration::from_secs(5), pubsub.on_message().next()).await;
    match response {
        Ok(Some(msg)) => {
            if let Ok(payload) = msg.get_payload::<String>() {
                if let Ok(message) = serde_json::from_str::<MessageToApi>(&payload) {
                    if matches_client_id(&message, &req.client_id) {
                        match message {
                            MessageToApi::Depth {
                                market_id,
                                yes_bids,
                                yes_asks,
                                no_bids,
                                no_asks,
                                client_id,
                                ..
                            } => {
                                return HttpResponse::Ok().json(
                                    serde_json::to_value(&(
                                        market_id, yes_bids, yes_asks, no_bids, no_asks, client_id,
                                    ))
                                    .unwrap(),
                                );
                            }
                            MessageToApi::Error { message, .. } => {
                                return HttpResponse::BadRequest().body(message);
                            }
                            _ => {
                                return HttpResponse::InternalServerError()
                                    .body("Unexpected response type");
                            }
                        }
                    }
                }
            }
            HttpResponse::InternalServerError().body("Invalid response format")
        }
        _ => HttpResponse::InternalServerError().body("No response received"),
    }
}

#[derive(Deserialize)]
struct CreateMarketRequest {
    market_id: String,
    question: String,
    client_id: String,
}

async fn create_market(
    state: web::Data<Arc<AppState>>,
    req: web::Json<CreateMarketRequest>,
) -> impl Responder {
    let message = MessageFromApi::CreateMarket {
        market_id: req.market_id.clone(),
        question: req.question.clone(),
        client_id: req.client_id.clone(),
    };

    state
        .redis
        .push_message("engine_queue", &message)
        .await
        .unwrap();

    let response = wait_for_response(&state.redis, &req.client_id).await;
    match response {
        Some(MessageToApi::MarketCreated { market_id, .. }) => {
            HttpResponse::Ok().json(serde_json::json!({ "market_id": market_id }))
        }
        Some(MessageToApi::Error { message, .. }) => HttpResponse::BadRequest().body(message),
        _ => HttpResponse::InternalServerError().body("No response received"),
    }
}

// Helper function to wait for a response from the "responses" channel
async fn wait_for_response(redis: &RedisManager, client_id: &str) -> Option<MessageToApi> {
    let mut pubsub = redis.subscribe("responses").await.unwrap();
    let result = timeout(Duration::from_secs(5), pubsub.on_message().next()).await;
    match result {
        Ok(Some(msg)) => {
            if let Ok(payload) = msg.get_payload::<String>() {
                if let Ok(message) = serde_json::from_str::<MessageToApi>(&payload) {
                    if matches_client_id(&message, client_id) {
                        return Some(message);
                    }
                }
            }
            None
        }
        _ => None,
    }
}

fn matches_client_id(message: &MessageToApi, client_id: &str) -> bool {
    match message {
        MessageToApi::OrderPlaced { client_id: cid, .. } => cid == client_id,
        MessageToApi::OrderMatched { client_id: cid, .. } => cid == client_id,
        MessageToApi::OrderCancelled { client_id: cid, .. } => cid == client_id,
        MessageToApi::OpenOrders { client_id: cid, .. } => cid == client_id,
        MessageToApi::MarketCreated { client_id: cid, .. } => cid == client_id,
        MessageToApi::Error { client_id: cid, .. } => cid == client_id,
        MessageToApi::Depth { client_id: cid, .. } => cid == client_id,
    }
}

struct WsActor {
    redis: RedisManager,
    client_id: String,
}

impl actix::Actor for WsActor {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        let redis = self.redis.clone();
        let client_id = self.client_id.clone();
        let addr = ctx.address();

        // Create a future to handle Redis subscription
        let fut = async move {
            if let Ok(mut pubsub) = redis.subscribe("responses").await {
                while let Some(msg) = pubsub.on_message().next().await {
                    if let Ok(payload) = msg.get_payload::<String>() {
                        if let Ok(message) = serde_json::from_str::<MessageToApi>(&payload) {
                            // Filter by client_id
                            let message_client_id = match &message {
                                MessageToApi::OrderPlaced { client_id, .. } => client_id,
                                MessageToApi::OrderMatched { client_id, .. } => client_id,
                                MessageToApi::OrderCancelled { client_id, .. } => client_id,
                                MessageToApi::OpenOrders { client_id, .. } => client_id,
                                MessageToApi::Depth { client_id, .. } => client_id,
                                MessageToApi::MarketCreated { client_id, .. } => client_id,
                                MessageToApi::Error { client_id, .. } => client_id,
                            };

                            if message_client_id == &client_id {
                                if let Ok(json) = serde_json::to_string(&message) {
                                    let _ = addr.do_send(WsMessage(json));
                                }
                            }
                        }
                    }
                }
            }
        };

        // Spawn the future as an actor context future
        actix::spawn(fut);
    }
}

// Message to send within actor system
#[derive(actix::Message)]
#[rtype(result = "()")]
struct WsMessage(String);

impl actix::Handler<WsMessage> for WsActor {
    type Result = ();

    fn handle(&mut self, msg: WsMessage, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

impl actix::StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsActor {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => ctx.text(text),
            Ok(ws::Message::Close(reason)) => ctx.close(reason),
            _ => (),
        }
    }
}

async fn ws_index(
    req: actix_web::HttpRequest,
    stream: web::Payload,
    state: web::Data<Arc<AppState>>,
) -> Result<HttpResponse, actix_web::Error> {
    let client_id = req
        .query_string()
        .split("client_id=")
        .collect::<Vec<&str>>()
        .get(1)
        .map(|s| s.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let ws = WsActor {
        redis: state.redis.clone(),
        client_id,
    };

    ws::start(ws, &req, stream)
}
