use crate::{redis::manager::RedisManager, types::ws::WsMessage};
use actix::{Actor, AsyncContext, Handler, Message, spawn};
use actix_web::{App, HttpResponse, HttpServer, web};
use actix_web_actors::ws;
use futures_util::StreamExt;
use std::sync::Arc;
use std::time::Duration;

pub async fn run_ws_server(redis: RedisManager, addr: &str) -> std::io::Result<()> {
    let state = Arc::new(redis);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/ws", web::get().to(ws_index))
    })
    .bind(addr)?
    .run()
    .await
}

struct WsActor {
    redis: RedisManager,
}

// Message to send within actor system
#[derive(Message)]
#[rtype(result = "()")]
struct TextMessage(String);

impl Handler<TextMessage> for WsActor {
    type Result = ();

    fn handle(&mut self, msg: TextMessage, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

impl Actor for WsActor {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        let redis = self.redis.clone();
        let addr = ctx.address();

        // Spawn a future to listen for Redis messages
        spawn(async move {
            if let Ok(mut pubsub) = redis.subscribe("market_updates").await {
                while let Some(msg) = pubsub.on_message().next().await {
                    if let Ok(payload) = msg.get_payload::<String>() {
                        if let Ok(message) = serde_json::from_str::<WsMessage>(&payload) {
                            if let Ok(json) = serde_json::to_string(&message) {
                                let _ = addr.do_send(TextMessage(json));
                            }
                        }
                    }
                }
            }
        });

        // Set up a heartbeat to keep the connection alive
        ctx.run_interval(Duration::from_secs(30), |_, ctx| {
            ctx.ping(b"");
        });
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
    state: web::Data<Arc<RedisManager>>,
) -> Result<HttpResponse, actix_web::Error> {
    // Extract the RedisManager from the Data<Arc<RedisManager>>
    let redis = state.get_ref().as_ref().clone();

    ws::start(WsActor { redis }, &req, stream)
}
