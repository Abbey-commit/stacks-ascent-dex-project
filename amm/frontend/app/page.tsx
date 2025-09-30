'use client';

import { Container, Title } from '@mantine/core';
import { useAuth } from '@micro-stacks/react'; // Only need useAuth for sign-in state

// We will import constants and functions from '../lib/amm' as needed
// For now, we only need useAuth to check connection status.

export default function AMMApp() {
  // We no longer need useOpenContractCall or local network state here.
  const { isSignedIn, userData } = useAuth();
  
  // Note: handleSignIn/handleSignOut logic is now only in NavBar.tsx

  return (
    // We are now inside the <AppShell> provided by the <Layout> wrapper
    <Container size="lg" className="min-h-screen pt-10 pb-20">
      <div className="text-center">
        <Title order={1} className="text-4xl font-extrabold text-indigo-400 mb-6">
          Stacks AMM DEX
        </Title>
        <p className="text-gray-300 mb-8 max-w-xl mx-auto">
          Welcome! Your contract is deployed to Testnet. Use the **Connect Wallet** button above to get started.
        </p>

        {isSignedIn ? (
          <div className="mt-8 p-4 bg-gray-800 rounded-xl shadow-lg border border-green-500/50">
            <p className="text-green-400 font-semibold">
              Wallet Connected! Ready for the next step.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Address: {userData?.profile.stxAddress.testnet}
            </p>
          </div>
        ) : (
          <div className="mt-8 p-4 bg-gray-800 rounded-xl shadow-lg border border-yellow-500/50">
             <p className="text-yellow-400 font-semibold">
               Please connect your wallet using the button in the top right to access the AMM features.
            </p>
          </div>
        )}
      </div>

      <div className="mt-16 p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
        <Title order={3} className="text-white mb-4 border-b border-gray-600 pb-2">
          Project Next Step
        </Title>
        <p className="text-gray-300">
          We have the core layout and wallet connection ready. The next logical step, following the tutorial, is to create the **Pools listing component** to fetch and display data from your deployed `amm` contract.
        </p>
      </div>

      {/* Placeholder for future components like PoolList */}

    </Container>
  );
}
