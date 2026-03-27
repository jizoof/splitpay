#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env
};

#[contract]
pub struct CustomTokenContract;

#[contracttype]
pub enum TokenDataKey {
    Admin,
    Balance(Address),
}

#[contractimpl]
impl CustomTokenContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&TokenDataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&TokenDataKey::Admin, &admin);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&TokenDataKey::Admin).expect("not initialized");
        admin.require_auth();

        if amount < 0 {
            panic!("amount must be positive");
        }

        let mut balance: i128 = env
            .storage()
            .persistent()
            .get(&TokenDataKey::Balance(to.clone()))
            .unwrap_or(0);

        balance += amount;
        env.storage().persistent().set(&TokenDataKey::Balance(to.clone()), &balance);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&TokenDataKey::Balance(id)).unwrap_or(0)
    }
}
