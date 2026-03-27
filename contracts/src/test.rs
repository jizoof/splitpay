#![cfg(test)]
use super::{CustomTokenContract, CustomTokenContractClient, SplitContract, SplitContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_split_and_reward() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_contract(None, CustomTokenContract);
    let token_client = CustomTokenContractClient::new(&env, &token_id);

    let split_id = env.register_contract(None, SplitContract);
    let split_client = SplitContractClient::new(&env, &split_id);

    // The split contract will act as the admin to mint rewards
    token_client.initialize(&split_id);

    // Initialize Split contract with the token
    split_client.initialize(&token_id);

    // Create Expense
    let creator = Address::generate(&env);
    let expense_id = split_client.create_expense(&creator, &100, &2);
    assert_eq!(expense_id, 1);

    let expense = split_client.get_balances(&expense_id);
    assert_eq!(expense.total_amount, 100);
    assert_eq!(expense.amount_per_participant, 50);
    assert_eq!(expense.paid_count, 0);
    assert_eq!(expense.is_settled, false);

    // Settle payment
    let participant = Address::generate(&env);
    split_client.settle_payment(&participant, &expense_id, &50);

    // Check expense updated
    let updated_expense = split_client.get_balances(&expense_id);
    assert_eq!(updated_expense.paid_count, 1);

    // Check token reward issued
    let balance = token_client.balance(&participant);
    assert_eq!(balance, 10_0000000);
}

#[test]
#[should_panic(expected = "incorrect payment amount")]
fn test_invalid_payment() {
    let env = Env::default();
    env.mock_all_auths();

    let token_id = env.register_contract(None, CustomTokenContract);
    let token_client = CustomTokenContractClient::new(&env, &token_id);

    let split_id = env.register_contract(None, SplitContract);
    let split_client = SplitContractClient::new(&env, &split_id);

    token_client.initialize(&split_id);
    split_client.initialize(&token_id);

    let creator = Address::generate(&env);
    let expense_id = split_client.create_expense(&creator, &100, &2);

    let participant = Address::generate(&env);
    split_client.settle_payment(&participant, &expense_id, &10); // Should panic
}
