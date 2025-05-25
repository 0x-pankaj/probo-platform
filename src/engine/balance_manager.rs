use dashmap::DashMap;
use std::sync::Arc;

#[derive(Clone, Debug)]
pub struct BalanceManager {
    balances: Arc<DashMap<u32, (f64, f64)>>, // user_id -> (available, locked)
}

impl BalanceManager {
    pub fn new() -> Self {
        let balances = Arc::new(DashMap::new());
        balances.insert(1, (1000.0, 0.0));
        balances.insert(2, (1000.0, 0.0));
        BalanceManager { balances }
    }

    pub async fn get_balance(&self, user_id: u32) -> (f64, f64) {
        self.balances
            .get(&user_id)
            .map(|entry| *entry)
            .unwrap_or((0.0, 0.0))
    }

    pub async fn check_balance(
        &self,
        user_id: u32,
        amount: f64,
        commission_rate: f64,
    ) -> Result<(), String> {
        let (available, _) = self.get_balance(user_id).await;
        let total_needed = amount * (1.0 + commission_rate);
        if available < total_needed {
            return Err("Insufficient balance including commission".to_string());
        }
        Ok(())
    }

    pub async fn lock_balance(&self, user_id: u32, amount: f64) -> Result<(), String> {
        let mut entry = self.balances.entry(user_id).or_insert((0.0, 0.0));
        if entry.0 < amount {
            return Err("Insufficient available balance to lock".to_string());
        }
        entry.0 -= amount;
        entry.1 += amount;
        Ok(())
    }

    pub async fn unlock_balance(&self, user_id: u32, amount: f64) -> Result<(), String> {
        let mut entry = self.balances.entry(user_id).or_insert((0.0, 0.0));
        if entry.1 < amount {
            return Err("Insufficient locked balance to unlock".to_string());
        }
        entry.1 -= amount;
        entry.0 += amount;
        Ok(())
    }

    pub async fn deduct_balance(
        &self,
        user_id: u32,
        amount: f64,
        commission_rate: f64,
    ) -> Result<(), String> {
        let mut entry = self.balances.entry(user_id).or_insert((0.0, 0.0));
        let total_amount = amount * (1.0 + commission_rate);
        if entry.1 < total_amount {
            return Err("Insufficient locked balance to deduct".to_string());
        }
        entry.1 -= total_amount;
        Ok(())
    }

    pub async fn credit_balance(&self, user_id: u32, amount: f64) -> Result<(), String> {
        let mut entry = self.balances.entry(user_id).or_insert((0.0, 0.0));
        entry.0 += amount;
        Ok(())
    }
}
