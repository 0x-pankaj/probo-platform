use crate::types::order::{OptionType, Order, OrderType};
use std::collections::{BTreeMap, VecDeque};

#[derive(Clone, Debug)]
pub struct OrderBook {
    pub option: OptionType,
    pub bids: BTreeMap<u64, VecDeque<Order>>,
    pub asks: BTreeMap<u64, VecDeque<Order>>,
}

impl OrderBook {
    pub fn new(option: OptionType) -> Self {
        OrderBook {
            option,
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
        }
    }

    pub fn price_to_cents(price: f64) -> u64 {
        (price * 100.0).round() as u64
    }

    pub fn add_order(&mut self, order: Order) {
        println!("add order called");
        let price_cents = Self::price_to_cents(order.price);
        let orders = match order.order_type {
            OrderType::Buy => &mut self.bids,
            OrderType::Sell => &mut self.asks,
        };
        orders
            .entry(price_cents)
            .or_insert_with(VecDeque::new)
            .push_back(order);
    }

    pub fn remove_order(&mut self, order_type: OrderType, price: f64, order_id: u64) {
        let price_cents = Self::price_to_cents(price);
        let orders = match order_type {
            OrderType::Buy => &mut self.bids,
            OrderType::Sell => &mut self.asks,
        };
        if let Some(queue) = orders.get_mut(&price_cents) {
            queue.retain(|o| o.id != order_id);
            if queue.is_empty() {
                orders.remove(&price_cents);
            }
        }
    }

    pub fn get_open_orders(&self, user_id: u32) -> Vec<Order> {
        let mut orders = Vec::new();
        for queue in self.bids.values() {
            for order in queue {
                if order.user_id == user_id {
                    orders.push(order.clone());
                }
            }
        }
        for queue in self.asks.values() {
            for order in queue {
                if order.user_id == user_id {
                    orders.push(order.clone());
                }
            }
        }
        orders
    }

    pub fn get_depth(&self) -> (Vec<(f64, u32)>, Vec<(f64, u32)>) {
        let bids: Vec<(f64, u32)> = self
            .bids
            .iter()
            .map(|(&price_cents, queue)| {
                let price = price_cents as f64 / 100.0;
                let quantity = queue.iter().map(|o| o.quantity).sum();
                (price, quantity)
            })
            .collect();
        let asks: Vec<(f64, u32)> = self
            .asks
            .iter()
            .map(|(&price_cents, queue)| {
                let price = price_cents as f64 / 100.0;
                let quantity = queue.iter().map(|o| o.quantity).sum();
                (price, quantity)
            })
            .collect();
        (bids, asks)
    }
}
