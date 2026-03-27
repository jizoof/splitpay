#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Env};

#[contracttype]
pub enum DataKey {
    Counter,
}

#[contract]
pub struct SplitPayContract;

#[contractimpl]
impl SplitPayContract {
    pub fn increment(env: Env) -> u32 {
        let mut count: u32 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::Counter, &count);
        env.events().publish((symbol_short!("increment"),), count);
        count
    }

    pub fn get_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
    }
}

mod test;
