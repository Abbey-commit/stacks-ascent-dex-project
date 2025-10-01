import { StacksNetwork, StacksTestnet, StacksMainnet } from "micro-stacks/network";
import { contractPrincipalCV, standardPrincipalCV, uintCV } from "micro-stacks/clarity";
import { c32address } from "c32check";

// --- DEPLOYMENT CONSTANTS ---
// CRITICAL: ACTUAL TESTNET DEPLOYER ADDRESS
export const CONTRACT_ADDRESS = "STTGMHNSGEDHMK15KY3C4TAN5NDQ1Z8FJN1YV757";
export const AMM_CONTRACT_NAME = "amm";
export const MOCK_TOKEN_CONTRACT_NAME = "mock-token";
export const MOCK_TOKEN_2_CONTRACT_NAME = "mock-token-2";

// NEW: This is the contract name for the token created by the AMM for liquidity providers (LP tokens).
// Based on the contract logic, the LP token contract name will be generated using this pattern:
// 'amm-lp-MOCK-TOKEN-MOCK-TOKEN-2-500' (token-0-token-1-fee-bps)
export const LIQUIDITY_TOKEN_CONTRACT_NAME = `amm-lp-${MOCK_TOKEN_CONTRACT_NAME}-${MOCK_TOKEN_2_CONTRACT_NAME}-500`;

// Pool Fee (500 bps = 5%)
export const FEE_BPS = 500;


// --- Data Structures ---

export interface PoolData {
    token0: string; // Contract name of token 0
    token1: string; // Contract name of token 1
    lpToken: string; // Contract name of LP token
    balance0: number; // Token 0 reserve (u6)
    balance1: number; // Token 1 reserve (u6)
    reserve0: number; // Token 0 reserve (u6)
    reserve1: number; // Token 1 reserve (u6)
    fee: number; // Fee basis points (u10000)
    totalLPSupply: number; // Total supply of LP tokens (u6)
}


// --- Helper Functions ---

// Helper to get the network instance (Testnet for this project)
export const getNetwork = (): StacksNetwork => {
  // Always use StacksTestnet for this project setup
  return new StacksTestnet();
};

// Helper to wrap a token name as a contract principal trait reference (::ft-trait)
export const getTraitPrincipal = (contractName: string): ClarityValue => {
  return contractPrincipalCV(CONTRACT_ADDRESS, contractName);
};

// Returns the arguments required to generate the unique pool ID (AMM contract's get-pool-data)
export const getPoolIdArgs = (): ClarityValue[] => {
    return [
        getTraitPrincipal(MOCK_TOKEN_CONTRACT_NAME),
        getTraitPrincipal(MOCK_TOKEN_2_CONTRACT_NAME),
        uintCV(FEE_BPS),
    ];
};

// Returns the arguments required for the create-pool public function
export const getCreatePoolArgs = (): ClarityValue[] => {
    return [
        getTraitPrincipal(MOCK_TOKEN_CONTRACT_NAME),
        getTraitPrincipal(MOCK_TOKEN_2_CONTRACT_NAME),
        uintCV(FEE_BPS),
    ];
};
