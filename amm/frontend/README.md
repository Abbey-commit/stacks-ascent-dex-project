The Struggle: AMM Frontend Instability
The Backend Logic that Worked
The foundation of the entire project—the Clarity smart contract logic—worked robustly from the start.

Contracts: We defined the amm.clar contract along with two fungible tokens, mock-token.clar and mock-token-2.clar.

Core Functions: The functions for create-pool, add-liquidity, remove-liquidity, and swap were written correctly and followed the necessary SIP-010 trait standards.

Testing: We confirmed that the core logic passed the included unit tests (amm.test.ts), validating the AMM's mathematical principles (like the constant product formula and slippage protection).

The Frontend Start and Initial Success
Initially, the frontend was set up with a Next.js App Router structure, using Mantine for UI components and @micro-stacks/react for blockchain integration.

Initial Success: We successfully implemented the ClientProvider wrapper, configured the Stacks Testnet, and confirmed that the useAuth hook worked for wallet connection and sign-in/sign-out.

What Later Failed (The Instability)
The persistent issue was a continuous stream of Build Errors stemming from the @micro-stacks/react library, specifically related to named exports.

Dependency Volatility: The library kept renaming its read-only function hook. We initially started with useClarityFn.

The Loop of Errors: When useClarityFn failed, we updated the files (like AddLiquidityCard.tsx) to use useReadOnlyFunction. This fix worked briefly, but the error quickly resurfaced, claiming useReadOnlyFunction did not exist.

The Culprit: The dependency was causing static analysis failures, preventing the build from completing, even after verifying the hook names in the project's source. This led to a cycle where the build repeatedly failed, forcing us to revert or try new names (useClarityFn again in the last attempt).

