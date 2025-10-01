'use client';

import { useState, useMemo, useEffect } from 'react';
// FIX: Replacing useClarityFn with the latest name: useReadOnlyFunction
import { useAuth, useOpenContractCall, useReadOnlyFunction } from '@micro-stacks/react'; 
import { uintCV, cvToJSON } from 'micro-stacks/clarity';
import { Card, Title, Button, TextInput, Text, Loader, Center, Group } from '@mantine/core';
import { IconCoins, IconExchange } from '@tabler/icons-react';
import {
  CONTRACT_ADDRESS,
  AMM_CONTRACT_NAME,
  MOCK_TOKEN_CONTRACT_NAME,
  MOCK_TOKEN_2_CONTRACT_NAME,
  FEE_BPS,
  getPoolIdArgs,
  getTraitPrincipal,
} from '../lib/amm';

// Denomination factor (10^6 for u6 decimals)
const UINTS_DENOM = 1000000;

// Token names for display
const TOKEN_0 = MOCK_TOKEN_CONTRACT_NAME.toUpperCase(); // MT
const TOKEN_1 = MOCK_TOKEN_2_CONTRACT_NAME.toUpperCase(); // MT2

export default function AddLiquidityCard({ onLiquidityChange }: { onLiquidityChange: () => void }) {
  const { isSignedIn } = useAuth();
  const { openContractCall, isCallPending } = useOpenContractCall();

  // Component State
  const [token0Input, setToken0Input] = useState<number | ''>(''); // Amount of MT (Token 0)
  const [token1Required, setToken1Required] = useState<number | null>(null); // Required amount of MT2 (Token 1)
  const [error, setError] = useState<string | null>(null);

  // --- Read Pool Data ---
  const readOnlyFnArgs = useMemo(() => getPoolIdArgs(), []);
  
  // FIX USAGE: Use the new hook name useReadOnlyFunction
  const { data: poolDataCv, isFetching } = useReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: AMM_CONTRACT_NAME,
    functionName: 'get-pool-data',
    functionArgs: readOnlyFnArgs,
  });

  const poolData = useMemo(() => {
    if (!poolDataCv?.value) return null;
    const data = cvToJSON(poolDataCv.value).value;
    const cvNum = (key: string) => parseInt(data[key]?.value || '0', 10);
    return {
      balance0: cvNum('balance-0'),
      balance1: cvNum('balance-1'),
    };
  }, [poolDataCv]);

  const isPoolInitialized = poolData && poolData.balance0 > 0 && poolData.balance1 > 0;

  // --- Ratio Calculation Logic ---
  useEffect(() => {
    if (poolData && typeof token0Input === 'number' && token0Input > 0) {
      const { balance0, balance1 } = poolData;

      // The pool ratio must be maintained for new deposits: balance1 / balance0
      // Required Token 1 Amount = Input Token 0 Amount * (Balance 1 / Balance 0)
      const ratio = balance1 / balance0;
      const requiredAmount = token0Input * ratio;
      
      setToken1Required(requiredAmount);
      setError(null);
    } else {
      setToken1Required(null);
      if (token0Input !== '') setError('Enter a valid amount');
    }
  }, [token0Input, poolData]);


  // --- Transaction Handler ---

  const handleAddLiquidity = async () => {
    if (!isSignedIn || !isPoolInitialized || !token0Input || !token1Required) {
      setError("Please connect wallet, ensure the pool is initialized, and enter a valid amount.");
      return;
    }

    // Convert denominated numbers (e.g., 1.5) to u6 integers (1,500,000)
    const amount0Uints = Math.floor(token0Input * UINTS_DENOM);
    const amount1Uints = Math.floor(token1Required * UINTS_DENOM);

    // The AMM contract function requires minimum amounts for slippage protection.
    // For now, we set a high minimum (99% of input) since the ratio is calculated based on current state.
    const minAmount0 = Math.floor(amount0Uints * 0.99);
    const minAmount1 = Math.floor(amount1Uints * 0.99);

    try {
      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: AMM_CONTRACT_NAME,
        functionName: 'add-liquidity',
        functionArgs: [
          getTraitPrincipal(MOCK_TOKEN_CONTRACT_NAME),  // token-0
          getTraitPrincipal(MOCK_TOKEN_2_CONTRACT_NAME), // token-1
          uintCV(FEE_BPS),                               // fee-bps (for pool ID)
          uintCV(amount0Uints),                          // token-0-amount
          uintCV(amount1Uints),                          // token-1-amount
          uintCV(minAmount0),                            // min-token-0-amount (slippage protection)
          uintCV(minAmount1),                            // min-token-1-amount (slippage protection)
        ],
        onFinish: ({ txId }) => {
          console.log('Add Liquidity TX Submitted:', txId);
          onLiquidityChange(); // Trigger refetch on the parent component
          setToken0Input('');
          setToken1Required(null);
        },
      });
    } catch (err) {
      console.error("Add Liquidity transaction error:", err);
      setError("Transaction failed or was rejected.");
    }
  };


  // --- UI Render ---

  if (isFetching || isCallPending) {
    return (
      <Card withBorder padding="xl" radius="lg" className="bg-gray-800 border-indigo-500 shadow-xl h-96">
        <Center className="h-full">
          <Loader size="lg" color="indigo" />
          <Text className="ml-4 text-indigo-300">
            {isCallPending ? 'Submitting Transaction...' : 'Loading Pool Data...'}
          </Text>
        </Center>
      </Card>
    );
  }
  
  const isButtonDisabled = !isSignedIn || !isPoolInitialized || isCallPending || !token0Input || error !== null;
  const transactionButtonText = isCallPending ? 'Processing...' : (
    !isSignedIn ? 'Connect Wallet' : 
    !isPoolInitialized ? 'Pool Not Initialized' : 
    'Supply Liquidity'
  );

  return (
    <Card
      withBorder
      padding="xl"
      radius="lg"
      className="bg-gray-800 border-indigo-500 shadow-xl w-full max-w-md mx-auto"
    >
      <Group position="apart" className="mb-6 border-b border-gray-700 pb-3">
        <Title order={2} className="text-white">
          Add Liquidity
        </Title>
        <IconCoins className="text-indigo-400" size={32} />
      </Group>

      {!isPoolInitialized && (
        <Text color="red" className="mb-4 p-2 bg-red-900/50 rounded-md border border-red-500">
          Pool not initialized. Cannot add liquidity yet.
        </Text>
      )}

      {/* Token 0 Input Field */}
      <div className="mb-4 relative">
        <TextInput
          label={`Amount of ${TOKEN_0} to Deposit`}
          placeholder="0.0"
          type="number"
          value={token0Input}
          onChange={(event) => {
            const val = parseFloat(event.currentTarget.value);
            setToken0Input(isNaN(val) ? '' : val);
          }}
          className="w-full"
          disabled={!isPoolInitialized}
          classNames={{ input: 'py-6 text-lg border-gray-600 bg-gray-700 text-white', label: 'text-gray-300' }}
        />
      </div>
      
      <Center className="my-2">
        <IconExchange className="text-gray-400" size={24} />
      </Center>

      {/* Token 1 Required Output Field */}
      <div className="mb-6 relative">
        <TextInput
          label={`Required Amount of ${TOKEN_1}`}
          placeholder="Calculated automatically"
          value={token1Required !== null ? token1Required.toFixed(6) : ''}
          readOnly
          className="w-full"
          classNames={{ input: 'py-6 text-lg border-gray-600 bg-gray-700 text-white', label: 'text-gray-300' }}
        />
      </div>

      {/* Ratio Display */}
      {poolData && isPoolInitialized && (
        <div className="text-sm text-gray-400 mb-4 p-3 bg-gray-700 rounded-lg">
          <p>
            Pool Ratio: 1 {TOKEN_0} requires{' '}
            {(poolData.balance1 / poolData.balance0).toFixed(6)}{' '}
            {TOKEN_1}
          </p>
        </div>
      )}
      
      {/* Error Message */}
      {error && <Text color="red" size="sm" className="mb-4">{error}</Text>}

      {/* Transaction Button */}
      <Button
        size="lg"
        fullWidth
        color="indigo"
        onClick={handleAddLiquidity}
        disabled={isButtonDisabled}
        className="hover:bg-indigo-600 transition duration-200"
      >
        {transactionButtonText}
      </Button>

    </Card>
  );
}
