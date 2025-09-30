import { StacksNetwork, StacksTestnet, StacksMainnet } from "micro-stacks/network";
import { contractPrincipalCV, standardPrincipalCV, uintCV } from "micro-stacks/clarity";
import { c32address } from "c32check";

// --- DEPLOYMENT CONSTANTS ---
// CRITICAL: ACTUAL TESTNET DEPLOYER ADDRESS
export const CONTRACT_ADDRESS = "STTGMHNSGEDHMK15KY3C4TAN5NDQ1Z8FJN1YV757";
export const AMM_CONTRACT_NAME = "amm";
export const MOCK_TOKEN_CONTRACT_NAME = "mock-token";
export const MOCK_TOKEN_2_CONTRACT_NAME = "mock-token-2";

// The address of the standard trait for SIP-010 (FUNGIBLE TOKENs)
export const FT_TRAIT_CONTRACT = "sip-010-trait-ft-standard";
export const FEE_BPS = 500; // 0.50% fee

// --- Helper Functions ---

// Function to get the current netword instance
export const getNetwork = (): StacksNetwork => {
    if (process.env.NEXT_PUBLIC_NETWORK == 'mainnet') {
        return new StacksMainnet();
    }
    return new StacksTestnet(); // Default to testnet
};

/**
 * Creates the clarity value for the contract trait (like the FT standard).
 * @param contractName The name of the contract implementing the trait (e.g., "mock-token")
 * @returns a ContractPrincipalCV pointing to the trait definition.
 */
export const getTraitPrincipal = (contractName: string) => {
    // The trait principal references the contract that *implements* the TransitionEvent,
    // using the hardcoded trait name defines in the AMM contract's requirements.
    return contractPrincipalCV(CONTRACT_ADDRESS, contractName);
}

// These are the tokens used in our AMM pool
export const mockTokenOnePrincipal = getTraitPrincipal(MOCK_TOKEN_CONTRACT_NAME);
export const mockTokenTwoPrincipal = getTraitPrincipal(MOCK_TOKEN_2_CONTRACT_NAME)

// --- Type Definitions (for future  components) ---

export type PoolData = {
    balance0: number;
    balance1: number;
    fee: number;
    token0: string;
    token1: string;
    lpToken: string;
    totalLPSupply: number;
    reserve0: number; // Placeholder for display
    reserve1: number; // Placeholder for display
}

// --- Call Structures (examples for references) ---

/**
 * Gets the arguements needed for the AMM create-pool function.
 */
export const getCreatePoolArgs = () => [
    mockTokenOnePrincipal, // token-0
    mockTokenTwoPrincipal, // token-1
    uintCV(FEE_BPS), // fee-bps
]

/*
    Helper to  construct the pool identofier structure used in many AMM functions.
*/
export const getPoolIdArgs = () => [
    {
        'token-0': mockTokenOnePrincipal,
        'token-1': mockTokenTwoPrincipal,
        'fee-bps': uintCV(FEE_BPS)
    }
]