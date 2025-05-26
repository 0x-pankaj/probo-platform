use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct BalanceManager {
    balances: RwLock<HashMap<u32, (f64, f64)>>, // (available, locked)
}

impl BalanceManager {
    pub fn new() -> Self {
        BalanceManager {
            balances: RwLock::new(HashMap::new()),
        }
    }

    pub async fn check_balance(
        &self,
        user_id: u32,
        amount: f64,
        commission_rate: f64,
    ) -> Result<(), String> {
        let balances = self.balances.read().await;
        let (available, _) = balances.get(&user_id).unwrap_or(&(1000.0, 0.0));
        let total_needed = amount * (1.0 + commission_rate);
        if *available >= total_needed {
            Ok(())
        } else {
            Err(format!(
                "Insufficient balance: available {}, needed {}",
                available, total_needed
            ))
        }
    }

    pub async fn lock_balance(&self, user_id: u32, amount: f64) -> Result<(), String> {
        let mut balances = self.balances.write().await;
        let (available, locked) = balances.entry(user_id).or_insert((1000.0, 0.0));
        if *available >= amount {
            *available -= amount;
            *locked += amount;
            Ok(())
        } else {
            Err("Insufficient balance to lock".to_string())
        }
    }

    pub async fn unlock_balance(&self, user_id: u32, amount: f64) -> Result<(), String> {
        let mut balances = self.balances.write().await;
        let (available, locked) = balances.entry(user_id).or_insert((1000.0, 0.0));
        if *locked >= amount {
            *locked -= amount;
            *available += amount;
            Ok(())
        } else {
            Err("Insufficient locked balance to unlock".to_string())
        }
    }

    pub async fn deduct_balance(
        &self,
        user_id: u32,
        amount: f64,
        commission_rate: f64,
    ) -> Result<(), String> {
        let mut balances = self.balances.write().await;
        let (available, locked) = balances.entry(user_id).or_insert((1000.0, 0.0));
        let total_deduction = amount * (1.0 + commission_rate);
        if *locked >= amount {
            *locked -= amount;
            if *available >= total_deduction - amount {
                *available -= total_deduction - amount;
                Ok(())
            } else {
                Err("Insufficient available balance for commission".to_string())
            }
        } else {
            Err("Insufficient locked balance to deduct".to_string())
        }
    }

    pub async fn credit_balance(&self, user_id: u32, amount: f64) -> Result<(), String> {
        let mut balances = self.balances.write().await;
        let (available, _) = balances.entry(user_id).or_insert((1000.0, 0.0));
        *available += amount;
        Ok(())
    }

    pub async fn get_balance(&self, user_id: u32) -> (f64, f64) {
        let balances = self.balances.read().await;
        *balances.get(&user_id).unwrap_or(&(1000.0, 0.0))
    }
}
