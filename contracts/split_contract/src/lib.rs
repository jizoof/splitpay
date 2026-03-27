#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, Symbol, IntoVal
};

#[contract]
pub struct SplitContract;

#[contracttype]
pub struct Expense {
    pub creator: Address,
    pub total_amount: i128,
    pub amount_per_participant: i128,
    pub participants: u32,
    pub paid_count: u32,
    pub is_settled: bool,
}

#[contracttype]
pub enum SplitDataKey {
    ExpenseCount,
    Expense(u32),
    HasPaid(u32, Address),
    RewardToken,
}

#[contractimpl]
impl SplitContract {
    pub fn initialize(env: Env, reward_token: Address) {
        if env.storage().instance().has(&SplitDataKey::RewardToken) {
            panic!("already initialized");
        }
        env.storage().instance().set(&SplitDataKey::RewardToken, &reward_token);
    }

    pub fn create_expense(
        env: Env,
        creator: Address,
        total_amount: i128,
        participants: u32,
    ) -> u32 {
        creator.require_auth();

        if total_amount <= 0 {
            panic!("amount must be positive");
        }
        if participants == 0 {
            panic!("participants must be greater than zero");
        }

        let mut count: u32 = env
            .storage()
            .instance()
            .get(&SplitDataKey::ExpenseCount)
            .unwrap_or(0);
        
        count += 1;

        let amount_per_participant = total_amount / (participants as i128);

        let expense = Expense {
            creator: creator.clone(),
            total_amount,
            amount_per_participant,
            participants,
            paid_count: 0,
            is_settled: false,
        };

        env.storage().persistent().set(&SplitDataKey::Expense(count), &expense);
        env.storage().instance().set(&SplitDataKey::ExpenseCount, &count);

        env.events().publish(
            (symbol_short!("expense"), symbol_short!("created")),
            (count, creator, total_amount, participants),
        );

        count
    }

    pub fn get_balances(env: Env, expense_id: u32) -> Expense {
        env.storage()
            .persistent()
            .get(&SplitDataKey::Expense(expense_id))
            .expect("expense not found")
    }

    pub fn settle_payment(env: Env, payer: Address, expense_id: u32, payment_amount: i128) {
        payer.require_auth();

        let mut expense: Expense = env
            .storage()
            .persistent()
            .get(&SplitDataKey::Expense(expense_id))
            .expect("expense not found");

        if expense.is_settled {
            panic!("expense already settled");
        }

        if payment_amount != expense.amount_per_participant {
            panic!("incorrect payment amount");
        }

        let has_paid_key = SplitDataKey::HasPaid(expense_id, payer.clone());
        let has_paid: bool = env
            .storage()
            .persistent()
            .get(&has_paid_key)
            .unwrap_or(false);

        if has_paid {
            panic!("already paid");
        }

        env.storage().persistent().set(&has_paid_key, &true);
        expense.paid_count += 1;

        if expense.paid_count == expense.participants {
            expense.is_settled = true;
        }

        env.storage()
            .persistent()
            .set(&SplitDataKey::Expense(expense_id), &expense);

        env.events().publish(
            (symbol_short!("payment"), symbol_short!("settled")),
            (expense_id, payer.clone(), payment_amount),
        );

        let reward_token: Address = env
            .storage()
            .instance()
            .get(&SplitDataKey::RewardToken)
            .expect("reward token not set");

        let reward_amount: i128 = 10_0000000;

        env.invoke_contract::<()>(
            &reward_token,
            &Symbol::new(&env, "mint"),
            vec![
                &env,
                payer.into_val(&env),
                reward_amount.into_val(&env),
            ],
        );

        env.events().publish(
            (symbol_short!("reward"), symbol_short!("issued")),
            (payer, reward_amount),
        );
    }
}

mod test;
