# SplitPay+ Monorepo

Welcome to the **SplitPay+** monorepo! This is a Stellar Soroban dApp containing a Rust smart contract, a Node.js Express backend, and a React + Vite + Tailwind frontend.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)
- [Freighter Wallet](https://www.freighter.app/) browser extension.

## Directory Structure

- `/contracts`: Soroban smart contracts written in Rust.
- `/frontend`: React frontend built with Vite and Tailwind CSS.
- `/backend`: Node.js Express server to handle optional off-chain logic.

## Setup Instructions

### 1. Install Dependencies

Run the following command in the root directory to install all npm dependencies for the frontend and backend using npm workspaces:

```bash
npm install
```

### 2. Build Smart Contracts

Compile the Soroban smart contracts directly from the root:

```bash
npm run build:contracts
```
*(This simply runs `cargo build --target wasm32-unknown-unknown --release` inside the `contracts` folder)*

### 3. Run the Applications

You can start both the frontend and backend simultaneously using:

```bash
npm run dev
```

Alternatively, you can run them individually:

- **Frontend:** `npm run dev:frontend` (starts the Vite dev server)
- **Backend:** `npm run dev:backend` (starts the Express server with live reload)

## Testing

To run the smart contract tests:

```bash
npm run test:contracts
```

## Environment Variables

Check the `/backend/.env` file to configure backend variables (for example `PORT=3001`).

Enjoy building on Stellar!
