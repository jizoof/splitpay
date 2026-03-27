#!/bin/bash
set -e

echo "Building contracts..."
soroban contract build

echo "Deploying Token Contract..."
TOKEN_WASM="contracts/target/wasm32-unknown-unknown/release/token_contract.wasm"
TOKEN_ID=$(soroban contract deploy --wasm $TOKEN_WASM --source test-account --network testnet)
echo "Token ID: $TOKEN_ID"

echo "Deploying Split Contract..."
SPLIT_WASM="contracts/target/wasm32-unknown-unknown/release/split_contract.wasm"
SPLIT_ID=$(soroban contract deploy --wasm $SPLIT_WASM --source test-account --network testnet)
echo "Split Contract ID: $SPLIT_ID"

echo "Writing IDs to frontend/.env..."
cat <<EOF > frontend/.env
VITE_TOKEN_CONTRACT_ID=$TOKEN_ID
VITE_SPLIT_CONTRACT_ID=$SPLIT_ID
VITE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
VITE_RPC_URL="https://soroban-testnet.stellar.org"
EOF

echo "Done!"
