use crate::{
    redis::manager::RedisManager,
    types::api::{MessageFromApi, MessageToApi},
};
use actix::AsyncContext;
use actix_web::{App, HttpResponse, HttpServer, Responder, web};
use actix_web_actors::ws;
use futures_util::StreamExt;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Clone)]
struct AppState {
    redis: RedisManager,
}

pub async fn run_api_server(redis: RedisManager, addr: &str) -> std::io::Result<()> {
    let state = Arc::new(AppState { redis });
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/order", web::post().to(place_order))
            .route("/cancel", web::post().to(cancel_order))
            .route("/open_orders", web::post().to(get_open_orders))
            .route("/depth", web::post().to(get_depth))
            .route("/market", web::post().to(create_market))
            .route("/ws", web::get().to(ws_index))
    })
    .bind(addr)?
    .run()
    .await
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
    HttpResponse::Ok().body("Order placed")
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
    HttpResponse::Ok().body("Order cancellation requested")
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
    let message = MessageFromApi::GetOpenOrders {
        user_id: req.user_id,
        market_id: req.market_id.clone(),
        client_id: req.client_id.clone(),
    };

    state
        .redis
        .push_message("engine_queue", &message)
        .await
        .unwrap();
    HttpResponse::Ok().body("Open orders requested")
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
    let message = MessageFromApi::GetDepth {
        market_id: req.market_id.clone(),
        client_id: req.client_id.clone(),
    };

    state
        .redis
        .push_message("engine_queue", &message)
        .await
        .unwrap();
    HttpResponse::Ok().body("Depth requested")
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
    HttpResponse::Ok().body("Market creation requested")
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
