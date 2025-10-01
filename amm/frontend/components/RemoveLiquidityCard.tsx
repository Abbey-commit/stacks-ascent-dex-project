'use client';

import { useState, useMemo, useEffect } from 'react';
// FIX: Using useReadOnlyFunction to match the current micro-stacks naming
import { useAuth, useOpenContractCall, useReadOnlyFunction } from '@micro-stacks/react';
import { uintCV, cvToJSON } from 'micro-stacks/clarity';
import { Card, Title, Button, Text, Loader, Center, Group, Slider } from '@mantine/core';
import { IconLogout, IconCoinOff } from '@tabler/icons-react';
import {
  CONTRACT_ADDRESS,
  AMM_CONTRACT_NAME,
  LIQUIDITY_TOKEN_CONTRACT_NAME, // Now imported correctly
  MOCK_TOKEN_CONTRACT_NAME,
  MOCK_TOKEN_2_CONTRACT_NAME,
  getPoolIdArgs,
  getTraitPrincipal,
} from '../lib/amm';

// Denomination factor (10^6 for u6 decimals)
const UINTS_DENOM = 1000000;
const TOKEN_LP = LIQUIDITY_TOKEN_CONTRACT_NAME.toUpperCase();

export default function RemoveLiquidityCard({ onLiquidityChange }: { onLiquidityChange: () => void }) {
  const { isSignedIn, userData } = useAuth();
  const { openContractCall, isCallPending } = useOpenContractCall();
  const [percentage, setPercentage] = useState<number>(0); // Percentage of LP tokens to remove
  const [error, setError] = useState<string | null>(null);

  const walletAddress = userData?.profile?.stxAddress?.testnet || '';

  // --- 1. Fetch User's LP Token Balance ---
  // FIX: Using useReadOnlyFunction here as well
  const { data: userLpBalanceCv, isFetching: isFetchingLpBalance } = useReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: LIQUIDITY_TOKEN_CONTRACT_NAME,
    functionName: 'get-balance',
    functionArgs: [walletAddress ? standardPrincipalCV(walletAddress) : uintCV(0)], // Use standardPrincipalCV for principal arguments
    // Refetch whenever the user wallet address changes
    skip: !walletAddress,
  });

  const userLpBalance = useMemo(() => {
    if (!userLpBalanceCv?.value) return 0;
    const balanceUints = parseInt(cvToJSON(userLpBalanceCv.value).value, 10);
    return balanceUints / UINTS_DENOM; // Denominated balance
  }, [userLpBalanceCv]);

  // --- 2. Calculate Amount to Burn ---
  const lpTokensToBurn = useMemo(() => {
    if (userLpBalance === 0 || percentage === 0) return 0;
    // Calculate the actual u6 amount based on the percentage
    const amountUints = Math.floor((userLpBalance * UINTS_DENOM) * (percentage / 100));
    return amountUints;
  }, [userLpBalance, percentage]);

  const lpTokensToBurnDenom = lpTokensToBurn / UINTS_DENOM;


  // --- 3. Transaction Handler ---

  const handleRemoveLiquidity = async () => {
    if (!isSignedIn || lpTokensToBurn === 0) {
      setError("Please connect wallet and select an amount greater than zero.");
      return;
    }

    // Set minimum return amounts (slippage protection) to 0 for simplicity in this mock, 
    // but in a real DEX, you'd calculate the expected return and set a minimum > 0
    const minToken0Amount = 0;
    const minToken1Amount = 0;

    try {
      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: AMM_CONTRACT_NAME,
        functionName: 'remove-liquidity',
        functionArgs: [
          getTraitPrincipal(MOCK_TOKEN_CONTRACT_NAME),  // token-0
          getTraitPrincipal(MOCK_TOKEN_2_CONTRACT_NAME), // token-1
          uintCV(500),                                   // fee-bps (for pool ID)
          uintCV(lpTokensToBurn),                        // lp-token-amount
          uintCV(minToken0Amount),                       // min-token-0-amount (slippage protection)
          uintCV(minToken1Amount),                       // min-token-1-amount (slippage protection)
        ],
        onFinish: ({ txId }) => {
          console.log('Remove Liquidity TX Submitted:', txId);
          onLiquidityChange(); // Trigger refetch on the parent component
          setPercentage(0); // Reset slider
        },
      });
    } catch (err) {
      console.error("Remove Liquidity transaction error:", err);
      setError("Transaction failed or was rejected.");
    }
  };


  // --- UI Render ---

  if (!isSignedIn || isFetchingLpBalance || isCallPending) {
    return (
      <Card withBorder padding="xl" radius="lg" className="bg-gray-800 border-indigo-500 shadow-xl h-96">
        <Center className="h-full">
          {isSignedIn && (isFetchingLpBalance || isCallPending) ? (
             <>
               <Loader size="lg" color="indigo" />
               <Text className="ml-4 text-indigo-300">
                 {isCallPending ? 'Submitting Transaction...' : 'Loading LP Balance...'}
               </Text>
             </>
          ) : (
            <Text className="text-gray-400">Connect your wallet to manage liquidity.</Text>
          )}
        </Center>
      </Card>
    );
  }
  
  const isButtonDisabled = isCallPending || percentage === 0;
  const transactionButtonText = isCallPending ? 'Processing...' : `Remove ${percentage}% Liquidity`;


  return (
    <Card
      withBorder
      padding="xl"
      radius="lg"
      className="bg-gray-800 border-indigo-500 shadow-xl w-full max-w-md mx-auto"
    >
      <Group position="apart" className="mb-6 border-b border-gray-700 pb-3">
        <Title order={2} className="text-white">
          Remove Liquidity
        </Title>
        <IconCoinOff className="text-pink-400" size={32} />
      </Group>

      {/* User Balance Display */}
      <div className="mb-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
        <Text className="text-gray-300 mb-2">Your Current Liquidity</Text>
        <Group position="apart">
          <Text className="text-xl font-bold text-white">
            {userLpBalance.toFixed(6)} {TOKEN_LP}
          </Text>
          <Text className="text-sm text-gray-400">LP Tokens</Text>
        </Group>
      </div>

      {/* Slider Input */}
      <div className="mb-8">
        <Text className="text-gray-300 mb-3">
          Percentage to Withdraw: <span className="font-bold text-pink-400">{percentage}%</span>
        </Text>
        
        <Slider
          value={percentage}
          onChange={setPercentage}
          min={0}
          max={100}
          step={1}
          marks={[
            { value: 0, label: '0%' },
            { value: 25, label: '25%' },
            { value: 50, label: '50%' },
            { value: 75, label: '75%' },
            { value: 100, label: '100%' },
          ]}
          color="pink"
          label={(value) => `${value}%`}
          className="mt-6"
        />
      </div>

      {/* Amount to Burn */}
      <div className="mb-6 p-3 bg-gray-700 rounded-lg border border-gray-600">
        <Text className="text-gray-300 text-sm">LP Tokens to Burn:</Text>
        <Text className="text-lg font-mono text-pink-300">
          {lpTokensToBurnDenom.toFixed(6)}
        </Text>
      </div>
      
      {/* Error Message */}
      {error && <Text color="red" size="sm" className="mb-4">{error}</Text>}

      {/* Transaction Button */}
      <Button
        size="lg"
        fullWidth
        color="pink"
        onClick={handleRemoveLiquidity}
        disabled={isButtonDisabled}
        className="hover:bg-pink-600 transition duration-200"
      >
        {transactionButtonText}
      </Button>

    </Card>
  );
}
