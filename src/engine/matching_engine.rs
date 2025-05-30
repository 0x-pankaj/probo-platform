use crate::{
    engine::{balance_manager::BalanceManager, order_book::OrderBook},
    redis::manager::RedisManager,
    types::{
        api::MessageToApi,
        db::DbMessage,
        market::Market,
        order::{OptionType, Order, OrderType, Trade},
        ws::WsMessage,
    },
};
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct MatchingEngine {
    markets: RwLock<HashMap<String, (OrderBook, OrderBook)>>,
    balances: BalanceManager,
    redis: RedisManager,
    next_order_id: RwLock<u64>,
    commission_rate: f64,
}

impl MatchingEngine {
    pub fn new(redis: RedisManager) -> Self {
        MatchingEngine {
            markets: RwLock::new(HashMap::new()),
            balances: BalanceManager::new(),
            redis,
            next_order_id: RwLock::new(1),
            commission_rate: 0.0223,
        }
    }

    pub async fn create_market(
        &self,
        market_id: String,
        question: String,
        client_id: String,
    ) -> Result<(), String> {
        let mut markets = self.markets.write().await;
        println!("existing market: {:?}", markets);
        if markets.contains_key(&market_id) {
            return Err("Market already exists".to_string());
        }
        markets.insert(
            market_id.clone(),
            (
                OrderBook::new(OptionType::Yes),
                OrderBook::new(OptionType::No),
            ),
        );
        let market = Market::new(market_id.clone(), question);
        self.redis
            .push_message("db_queue", &DbMessage::SaveMarket(market))
            .await
            .map_err(|e| e.to_string())?;
        self.redis
            .publish_message(
                "responses",
                &MessageToApi::MarketCreated {
                    market_id,
                    client_id,
                },
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    async fn generate_order_id(&self) -> u64 {
        let mut id = self.next_order_id.write().await;
        let order_id = *id;
        *id += 1;
        order_id
    }

    pub async fn place_order(
        &self,
        user_id: u32,
        market_id: String,
        option: OptionType,
        order_type: OrderType,
        price: f64,
        quantity: u32,
        client_id: String,
    ) -> Result<(Order, Vec<Trade>), String> {
        if price < 0.5 || price > 9.5 {
            return Err("Price must be between 0.5 and 9.5".to_string());
        }

        let amount = price * quantity as f64;
        if order_type == OrderType::Buy {
            self.balances
                .check_balance(user_id, amount, self.commission_rate)
                .await?;
            self.balances.lock_balance(user_id, amount).await?;
        }

        let order_id = self.generate_order_id().await;
        println!("OrderId: {:?}", order_id);
        let mut order = Order::new(
            order_id,
            user_id,
            market_id.clone(),
            option,
            order_type.clone(),
            price,
            quantity,
        );
        println!("order: {:?}", order);

        // Acquire write lock and perform all operations within the scope
        let (trades, bids, asks) = {
            let mut markets = self.markets.write().await;
            println!("Acquired markets lock in place_order");
            let (yes_book, no_book) = markets
                .get_mut(&market_id)
                .ok_or("Market not found".to_string())?;

            // Running matching logic without moving yes_book and no_book
            let trades = self
                .match_order(
                    &mut order,
                    &market_id,
                    yes_book, // Pass mutable reference without moving
                    no_book,  // Pass mutable reference without moving
                    client_id.clone(),
                )
                .await?;
            println!("matched_order: {:?}", trades);
            println!("remaining order quantity: {:?}", order.quantity);

            // Handle order placement based on option type
            let (bids, asks) = match option {
                OptionType::Yes => {
                    if order.quantity == 0 {
                        yes_book.remove_order(order_type, price, order_id);
                    } else {
                        yes_book.add_order(order.clone());
                    }

                    // Save order if quantity remains
                    if order.quantity > 0 {
                        self.redis
                            .push_message("db_queue", &DbMessage::SaveOrder(order.clone()))
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                    yes_book.get_depth()
                }
                OptionType::No => {
                    if order.quantity == 0 {
                        no_book.remove_order(order_type, price, order_id);
                    } else {
                        no_book.add_order(order.clone());
                    }

                    // Save order if quantity remains
                    if order.quantity > 0 {
                        self.redis
                            .push_message("db_queue", &DbMessage::SaveOrder(order.clone()))
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                    no_book.get_depth()
                }
            };

            println!(
                "Placed order: {:?}",
                match option {
                    OptionType::Yes => yes_book,
                    OptionType::No => no_book,
                }
            );

            (trades, bids, asks)
        };

        // Publish order placement response
        self.redis
            .publish_message(
                "responses",
                &MessageToApi::OrderPlaced {
                    order: order.clone(),
                    client_id: client_id.clone(),
                },
            )
            .await
            .map_err(|e| e.to_string())?;

        // Publish market depth update
        self.redis
            .publish_message(
                "market_updates",
                &crate::types::ws::WsMessage::Depth {
                    market_id: market_id.clone(),
                    bids: bids.clone(),
                    asks: asks.clone(),
                },
            )
            .await
            .map_err(|e| e.to_string())?;

        Ok((order, trades))
    }

    async fn match_order(
        &self,
        order: &mut Order,
        market_id: &str,
        yes_book: &mut OrderBook,
        no_book: &mut OrderBook,
        client_id: String,
    ) -> Result<Vec<Trade>, String> {
        let mut trades = Vec::new();
        let mut remaining_quantity = order.quantity;

        if order.option == OptionType::Yes {
            remaining_quantity = self
                .match_with_book(yes_book, order, remaining_quantity, &mut trades, &client_id)
                .await?;
        } else {
            remaining_quantity = self
                .match_with_book(no_book, order, remaining_quantity, &mut trades, &client_id)
                .await?;
        };
        let counter_book = if order.option == OptionType::Yes {
            no_book
        } else {
            yes_book
        };

        let counter_price = 10.0 - order.price;

        remaining_quantity = self
            .match_with_counter_book(
                counter_book,
                order,
                remaining_quantity,
                counter_price,
                &mut trades,
                &client_id,
            )
            .await?;

        remaining_quantity = self
            .match_with_counter_book_same_type(
                counter_book,
                order,
                remaining_quantity,
                counter_price,
                &mut trades,
                &client_id,
            )
            .await?;

        order.quantity = remaining_quantity;

        if !trades.is_empty() {
            let last_price = trades.last().unwrap().price;
            self.redis
                .publish_message(
                    "market_updates",
                    &crate::types::ws::WsMessage::Price {
                        market_id: market_id.to_string(),
                        option: order.option,
                        price: last_price,
                    },
                )
                .await
                .map_err(|e| e.to_string())?;
        }
        println!("trades from matching engine: {:?}", trades);
        Ok(trades)
    }

    async fn match_with_book(
        &self,
        book: &mut OrderBook,
        order: &mut Order,
        mut remaining_quantity: u32,
        trades: &mut Vec<Trade>,
        client_id: &str,
    ) -> Result<u32, String> {
        // let mut redis_messages = Vec::new();

        match order.order_type {
            OrderType::Buy => {
                while remaining_quantity > 0 {
                    if let Some((&ask_price_cents, asks)) = book.asks.iter_mut().next() {
                        let ask_price = ask_price_cents as f64 / 100.0;
                        println!(
                            "Buy: checking ask_price={} vs order_price={}",
                            ask_price, order.price
                        );

                        if ask_price <= order.price {
                            if let Some(ask) = asks.pop_front() {
                                let matched_quantity = remaining_quantity.min(ask.quantity);
                                println!("BUY: matched_quantity={}", matched_quantity);

                                let trade = Trade {
                                    buy_order_id: order.id,
                                    sell_order_id: ask.id,
                                    market_id: order.market_id.clone(),
                                    option: order.option,
                                    price: ask_price,
                                    quantity: matched_quantity,
                                    timestamp: std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap()
                                        .as_secs(),
                                };
                                trades.push(trade.clone());

                                let amount = ask_price * matched_quantity as f64;
                                self.balances
                                    .deduct_balance(order.user_id, amount, self.commission_rate)
                                    .await?;
                                self.balances.credit_balance(ask.user_id, amount).await?;

                                // redis_messages.push(DbMessage::UpdateBalance {
                                //     user_id: order.user_id,
                                //     balance: self.balances.get_balance(order.user_id).await.0,
                                // });
                                // redis_messages.push(DbMessage::UpdateBalance {
                                //     user_id: ask.user_id,
                                //     balance: self.balances.get_balance(ask.user_id).await.0,
                                // });
                                // redis_messages.push(DbMessage::SaveMarket(trade.clone()));
                                // redis_messages.push(MessageToApi::OrderMatched {
                                //     trade: trade.clone(),
                                //     client_id: client_id.to_string(),
                                // });

                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: order.user_id,
                                            balance: self
                                                .balances
                                                .get_balance(order.user_id)
                                                .await
                                                .0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: ask.user_id,
                                            balance: self.balances.get_balance(ask.user_id).await.0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message("db_queue", &DbMessage::SaveTrade(trade.clone()))
                                    .await
                                    .map_err(|e| e.to_string())?;

                                self.redis
                                    .publish_message(
                                        "responses",
                                        &MessageToApi::OrderMatched {
                                            trade: trade.clone(),
                                            client_id: client_id.to_string(),
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;

                                self.redis
                                    .publish_message(
                                        &format!("market_updates_{}", order.market_id),
                                        &WsMessage::Trade {
                                            trade: trade.clone(),
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string());

                                remaining_quantity -= matched_quantity;
                                if ask.quantity > matched_quantity {
                                    let mut new_ask = ask.clone();
                                    new_ask.quantity -= matched_quantity;
                                    asks.push_front(new_ask);
                                }
                                if asks.is_empty() {
                                    book.asks.remove(&ask_price_cents);
                                }
                            }
                        } else {
                            println!(
                                "BUY: no match , ask_price={} > order.price={}",
                                ask_price, order.price
                            );
                            break;
                        }
                    } else {
                        println!("Buy: no asks available");
                        break;
                    }
                }
            }
            OrderType::Sell => {
                while remaining_quantity > 0 {
                    if let Some((&bid_price_cents, bids)) = book.bids.iter_mut().rev().next() {
                        let bid_price = bid_price_cents as f64 / 100.0;
                        println!(
                            "Sell: checking bid_price={} vs order_price={}",
                            bid_price, order.price
                        );

                        if bid_price >= order.price {
                            if let Some(bid) = bids.pop_front() {
                                let matched_quantity = remaining_quantity.min(bid.quantity);
                                println!("Sell: matched_quantity={}", matched_quantity);

                                let trade = Trade {
                                    buy_order_id: bid.id,
                                    sell_order_id: order.id,
                                    market_id: order.market_id.clone(),
                                    option: order.option,
                                    price: bid_price,
                                    quantity: matched_quantity,
                                    timestamp: std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap()
                                        .as_secs(),
                                };
                                trades.push(trade.clone());

                                let amount = bid_price * matched_quantity as f64;
                                self.balances
                                    .deduct_balance(bid.user_id, amount, self.commission_rate)
                                    .await?;
                                self.balances.credit_balance(order.user_id, amount).await?;

                                // redis_messages.push(DbMessage::UpdateBalance {
                                //     user_id: bid.user_id,
                                //     balance: self.balances.get_balance(bid.user_id),
                                // });
                                // redis_messages.push(DbMessage::UpdateBalance {
                                //     user_id: order.user_id,
                                //     balance: self.balances.get_balance(order.user_id),
                                // });
                                // redis_messages.push(DbMessage::SaveTrade(trade.clone()));
                                // redis_messages.push(MessageToApi::OrderMatched {
                                //     trade: trade.clone(),
                                //     client_id: client_id.to_string(),
                                // });

                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: bid.user_id,
                                            balance: self.balances.get_balance(bid.user_id).await.0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: order.user_id,
                                            balance: self
                                                .balances
                                                .get_balance(order.user_id)
                                                .await
                                                .0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message("db_queue", &DbMessage::SaveTrade(trade.clone()))
                                    .await
                                    .map_err(|e| e.to_string())?;

                                self.redis
                                    .publish_message(
                                        "responses",
                                        &MessageToApi::OrderMatched {
                                            trade: trade.clone(),
                                            client_id: client_id.to_string(),
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;

                                self.redis
                                    .publish_message(
                                        &format!("market_updates_{}", order.market_id),
                                        &WsMessage::Trade {
                                            trade: trade.clone(),
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string());

                                remaining_quantity -= matched_quantity;
                                if bid.quantity > matched_quantity {
                                    let mut new_bid = bid.clone();
                                    new_bid.quantity -= matched_quantity;
                                    bids.push_front(new_bid);
                                }
                                if bids.is_empty() {
                                    book.bids.remove(&bid_price_cents);
                                }
                            }
                        } else {
                            println!(
                                "Sell: no_match, bid_price={} < order.price={}",
                                bid_price, order.price
                            );
                            break;
                        }
                    } else {
                        println!("Sell: no bids available");
                        break;
                    }
                }
            }
        }

        //sending batched redis message
        // for msg in redis_messages {
        //     match msg {
        //         DbMessage::UpdateBalance { user_id, balance } => {
        //             self.redis
        //                 .push_message("db_queue", &DbMessage::UpdateBalance { user_id, balance })
        //                 .await
        //                 .map_err(|e| e.to_string())?;
        //         }
        //         DbMessage::SaveTrade(trade) => {
        //             self.redis
        //                 .push_message("db_queue", &DbMessage::SaveTrade(trade))
        //                 .await
        //                 .map_err(|e| e.to_string())?;
        //         }
        //         _ => {
        //             self.redis
        //                 .publish_message("responses", &msg)
        //                 .await
        //                 .map_err(|e| e.to_string())?;
        //         }
        //     }
        // }

        println!("match_with_book: remaing_quantitiy={}", remaining_quantity);

        Ok(remaining_quantity)
    }

    async fn match_with_counter_book(
        &self,
        counter_book: &mut OrderBook,
        order: &mut Order,
        mut remaining_quantity: u32,
        counter_price: f64,
        trades: &mut Vec<Trade>,
        client_id: &str,
    ) -> Result<u32, String> {
        match order.order_type {
            OrderType::Buy => {
                while remaining_quantity > 0 {
                    if let Some((&ask_price_cents, asks)) = counter_book.asks.iter_mut().next() {
                        let ask_price = ask_price_cents as f64 / 100.0;
                        if ask_price <= counter_price {
                            if let Some(ask) = asks.pop_front() {
                                let matched_quantity = remaining_quantity.min(ask.quantity);
                                let trade = Trade {
                                    buy_order_id: order.id,
                                    sell_order_id: ask.id,
                                    market_id: order.market_id.clone(),
                                    option: order.option,
                                    price: order.price,
                                    quantity: matched_quantity,
                                    timestamp: std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap()
                                        .as_secs(),
                                };
                                trades.push(trade.clone());

                                let amount = order.price * matched_quantity as f64;
                                self.balances
                                    .deduct_balance(order.user_id, amount, self.commission_rate)
                                    .await?;
                                self.balances.credit_balance(ask.user_id, amount).await?;
                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: order.user_id,
                                            balance: self
                                                .balances
                                                .get_balance(order.user_id)
                                                .await
                                                .0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: ask.user_id,
                                            balance: self.balances.get_balance(ask.user_id).await.0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message("db_queue", &DbMessage::SaveTrade(trade.clone()))
                                    .await
                                    .map_err(|e| e.to_string())?;

                                self.redis
                                    .publish_message(
                                        "responses",
                                        &MessageToApi::OrderMatched {
                                            trade: trade.clone(),
                                            client_id: client_id.to_string(),
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;

                                remaining_quantity -= matched_quantity;
                                if ask.quantity > matched_quantity {
                                    let mut new_ask = ask.clone();
                                    new_ask.quantity -= matched_quantity;
                                    asks.push_front(new_ask);
                                }
                                if asks.is_empty() {
                                    counter_book.asks.remove(&ask_price_cents);
                                }
                            }
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
            OrderType::Sell => {
                while remaining_quantity > 0 {
                    if let Some((&bid_price_cents, bids)) =
                        counter_book.bids.iter_mut().rev().next()
                    {
                        let bid_price = bid_price_cents as f64 / 100.0;
                        if bid_price >= counter_price {
                            if let Some(bid) = bids.pop_front() {
                                let matched_quantity = remaining_quantity.min(bid.quantity);
                                let trade = Trade {
                                    buy_order_id: bid.id,
                                    sell_order_id: order.id,
                                    market_id: order.market_id.clone(),
                                    option: order.option,
                                    price: order.price,
                                    quantity: matched_quantity,
                                    timestamp: std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap()
                                        .as_secs(),
                                };
                                trades.push(trade.clone());

                                let amount = order.price * matched_quantity as f64;
                                self.balances
                                    .deduct_balance(bid.user_id, amount, self.commission_rate)
                                    .await?;
                                self.balances.credit_balance(order.user_id, amount).await?;
                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: bid.user_id,
                                            balance: self.balances.get_balance(bid.user_id).await.0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: order.user_id,
                                            balance: self
                                                .balances
                                                .get_balance(order.user_id)
                                                .await
                                                .0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message("db_queue", &DbMessage::SaveTrade(trade.clone()))
                                    .await
                                    .map_err(|e| e.to_string())?;

                                self.redis
                                    .publish_message(
                                        "responses",
                                        &MessageToApi::OrderMatched {
                                            trade: trade.clone(),
                                            client_id: client_id.to_string(),
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;

                                remaining_quantity -= matched_quantity;
                                if bid.quantity > matched_quantity {
                                    let mut new_bid = bid.clone();
                                    new_bid.quantity -= matched_quantity;
                                    bids.push_front(new_bid);
                                }
                                if bids.is_empty() {
                                    counter_book.bids.remove(&bid_price_cents);
                                }
                            }
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        Ok(remaining_quantity)
    }

    async fn match_with_counter_book_same_type(
        &self,
        counter_book: &mut OrderBook,
        order: &mut Order,
        mut remaining_quantity: u32,
        counter_price: f64,
        trades: &mut Vec<Trade>,
        client_id: &str,
    ) -> Result<u32, String> {
        match order.order_type {
            OrderType::Buy => {
                while remaining_quantity > 0 {
                    if let Some((&bid_price_cents, bids)) =
                        counter_book.bids.iter_mut().rev().next()
                    {
                        let bid_price = bid_price_cents as f64 / 100.0;
                        if bid_price >= counter_price {
                            if let Some(bid) = bids.pop_front() {
                                let matched_quantity = remaining_quantity.min(bid.quantity);
                                let trade = Trade {
                                    buy_order_id: order.id,
                                    sell_order_id: bid.id,
                                    market_id: order.market_id.clone(),
                                    option: order.option,
                                    price: order.price,
                                    quantity: matched_quantity,
                                    timestamp: std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap()
                                        .as_secs(),
                                };
                                trades.push(trade.clone());

                                let amount = order.price * matched_quantity as f64;
                                self.balances
                                    .deduct_balance(order.user_id, amount, self.commission_rate)
                                    .await?;
                                self.balances.credit_balance(bid.user_id, amount).await?;
                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: order.user_id,
                                            balance: self
                                                .balances
                                                .get_balance(order.user_id)
                                                .await
                                                .0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: bid.user_id,
                                            balance: self.balances.get_balance(bid.user_id).await.0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message("db_queue", &DbMessage::SaveTrade(trade.clone()))
                                    .await
                                    .map_err(|e| e.to_string())?;

                                self.redis
                                    .publish_message(
                                        "responses",
                                        &MessageToApi::OrderMatched {
                                            trade: trade.clone(),
                                            client_id: client_id.to_string(),
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;

                                remaining_quantity -= matched_quantity;
                                if bid.quantity > matched_quantity {
                                    let mut new_bid = bid.clone();
                                    new_bid.quantity -= matched_quantity;
                                    bids.push_front(new_bid);
                                }
                                if bids.is_empty() {
                                    counter_book.bids.remove(&bid_price_cents);
                                }
                            }
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
            OrderType::Sell => {
                while remaining_quantity > 0 {
                    if let Some((&ask_price_cents, asks)) = counter_book.asks.iter_mut().next() {
                        let ask_price = ask_price_cents as f64 / 100.0;
                        if ask_price <= counter_price {
                            if let Some(ask) = asks.pop_front() {
                                let matched_quantity = remaining_quantity.min(ask.quantity);
                                let trade = Trade {
                                    buy_order_id: ask.id,
                                    sell_order_id: order.id,
                                    market_id: order.market_id.clone(),
                                    option: order.option,
                                    price: order.price,
                                    quantity: matched_quantity,
                                    timestamp: std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap()
                                        .as_secs(),
                                };
                                trades.push(trade.clone());

                                let amount = order.price * matched_quantity as f64;
                                self.balances
                                    .deduct_balance(ask.user_id, amount, self.commission_rate)
                                    .await?;
                                self.balances.credit_balance(order.user_id, amount).await?;
                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: ask.user_id,
                                            balance: self.balances.get_balance(ask.user_id).await.0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message(
                                        "db_queue",
                                        &DbMessage::UpdateBalance {
                                            user_id: order.user_id,
                                            balance: self
                                                .balances
                                                .get_balance(order.user_id)
                                                .await
                                                .0,
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;
                                self.redis
                                    .push_message("db_queue", &DbMessage::SaveTrade(trade.clone()))
                                    .await
                                    .map_err(|e| e.to_string())?;

                                self.redis
                                    .publish_message(
                                        "responses",
                                        &MessageToApi::OrderMatched {
                                            trade: trade.clone(),
                                            client_id: client_id.to_string(),
                                        },
                                    )
                                    .await
                                    .map_err(|e| e.to_string())?;

                                remaining_quantity -= matched_quantity;
                                if ask.quantity > matched_quantity {
                                    let mut new_ask = ask.clone();
                                    new_ask.quantity -= matched_quantity;
                                    asks.push_front(new_ask);
                                }
                                if asks.is_empty() {
                                    counter_book.asks.remove(&ask_price_cents);
                                }
                            }
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        Ok(remaining_quantity)
    }

    pub async fn cancel_order(
        &self,
        market_id: String,
        option: OptionType,
        order_type: OrderType,
        price: f64,
        order_id: u64,
        client_id: String,
    ) -> Result<(), String> {
        let mut markets = self.markets.write().await;
        let (yes_book, no_book) = markets
            .get_mut(&market_id)
            .ok_or("Market not found".to_string())?;

        let book = match option {
            OptionType::Yes => yes_book,
            OptionType::No => no_book,
        };

        let price_cents = OrderBook::price_to_cents(price);
        let orders = match order_type {
            OrderType::Buy => &book.bids,
            OrderType::Sell => &book.asks,
        };
        if let Some(queue) = orders.get(&price_cents) {
            if let Some(order) = queue.iter().find(|o| o.id == order_id) {
                if order_type == OrderType::Buy {
                    let amount = order.price * order.quantity as f64;
                    self.balances.unlock_balance(order.user_id, amount).await?;
                    self.redis
                        .push_message(
                            "db_queue",
                            &DbMessage::UpdateBalance {
                                user_id: order.user_id,
                                balance: self.balances.get_balance(order.user_id).await.0,
                            },
                        )
                        .await
                        .map_err(|e| e.to_string())?;
                }
            }
        }

        book.remove_order(order_type, price, order_id);

        self.redis
            .publish_message(
                "responses",
                &MessageToApi::OrderCancelled {
                    order_id,
                    market_id,
                    client_id,
                },
            )
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn get_open_orders(
        &self,
        user_id: u32,
        market_id: String,
        client_id: String,
    ) -> Result<Vec<Order>, String> {
        println!(
            "inside engine get open id called for : userId: {}, market_id: {}",
            user_id, market_id
        );
        let markets = self.markets.read().await;
        let (yes_book, no_book) = markets
            .get(&market_id)
            .ok_or("Market not found".to_string())?;

        let mut orders = yes_book.get_open_orders(user_id);
        orders.extend(no_book.get_open_orders(user_id));

        self.redis
            .publish_message(
                "responses",
                &MessageToApi::OpenOrders {
                    orders: orders.clone(),
                    client_id,
                },
            )
            .await
            .map_err(|e| e.to_string())?;

        println!("printing open orders: {:?}", orders);

        Ok(orders)
    }

    pub async fn get_depth(
        &self,
        market_id: String,
        client_id: String,
    ) -> Result<
        (
            Vec<(f64, u32)>,
            Vec<(f64, u32)>,
            Vec<(f64, u32)>,
            Vec<(f64, u32)>,
        ),
        String,
    > {
        let markets = self.markets.read().await;
        let (yes_book, no_book) = markets
            .get(&market_id)
            .ok_or("Market not found".to_string())?;

        let (yes_bids, yes_asks) = yes_book.get_depth();
        let (no_bids, no_asks) = no_book.get_depth();

        println!("YEs: depth: {:?} , no depth: {:?}", yes_bids, no_bids);

        self.redis
            .publish_message(
                "responses",
                &MessageToApi::Depth {
                    market_id,
                    yes_bids: yes_bids.clone(),
                    yes_asks: yes_asks.clone(),
                    no_bids: no_bids.clone(),
                    no_asks: no_asks.clone(),
                    client_id,
                },
            )
            .await
            .map_err(|e| e.to_string())?;

        Ok((yes_bids, yes_asks, no_bids, no_asks))
    }
}
