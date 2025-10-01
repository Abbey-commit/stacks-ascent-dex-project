'use client';

import { useState, useMemo, useEffect } from 'react';
// FIX: Renamed useReadOnlyFn to useReadOnlyFunction
import { useAuth, useOpenContractCall, useReadOnlyFunction } from '@micro-stacks/react';
import { uintCV, cvToJSON, contractPrincipalCV } from 'micro-stacks/clarity';
import { Card, Title, Button, Group, TextInput, Select, Text, Loader, Center } from '@mantine/core';
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

// The available tokens in our pool
const TOKEN_OPTIONS = [
  { value: MOCK_TOKEN_CONTRACT_NAME, label: MOCK_TOKEN_CONTRACT_NAME.toUpperCase() },
  { value: MOCK_TOKEN_2_CONTRACT_NAME, label: MOCK_TOKEN_2_CONTRACT_NAME.toUpperCase() },
];

export default function SwapCard({ onSwapSuccess }: { onSwapSuccess: () => void }) {
  const { isSignedIn } = useAuth();
  const { openContractCall, isCallPending } = useOpenContractCall();

  // Component State
  const [inputToken, setInputToken] = useState(MOCK_TOKEN_CONTRACT_NAME);
  const [outputToken, setOutputToken] = useState(MOCK_TOKEN_2_CONTRACT_NAME);
  const [inputAmount, setInputAmount] = useState<number | ''>('');
  const [outputAmount, setOutputAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Read Pool Data ---
  const readOnlyFnArgs = useMemo(() => getPoolIdArgs(), []);
  // FIX USAGE: useReadOnlyFunction is the correct name
  const { data: poolDataCv } = useReadOnlyFunction({
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
      token0: data['token-0'].value.contractName.value,
      balance0: cvNum('balance-0'),
      token1: data['token-1'].value.contractName.value,
      balance1: cvNum('balance-1'),
    };
  }, [poolDataCv]);


  // --- Calculation Logic ---

  // Check if we are swapping from token0 to token1 (zero-for-one is false)
  const isZeroForOne = useMemo(() => {
    if (!poolData) return null;
    return inputToken === poolData.token1; // Swapping T1 for T0 (token 1 is input)
  }, [inputToken, poolData]);

  const reserveIn = isZeroForOne ? poolData?.balance1 : poolData?.balance0;
  const reserveOut = isZeroForOne ? poolData?.balance0 : poolData?.balance1;

  // Function to calculate the output amount using the constant product formula (x*y = k)
  const calculateSwap = (amountIn: number) => {
    if (!reserveIn || !reserveOut || amountIn <= 0) return 0;

    // Convert input amount to u6 units
    const amountInUints = amountIn * UINTS_DENOM;

    // k = x * y
    // New reserve in: R_in + Amount_in
    // Amount Out = R_out - (R_in * R_out) / (R_in + Amount_in)
    // Formula from amm.clar: get-amount-out = (r-in * amount-in * (u10000 - fee-bps)) / ((r-in + amount-in) * u10000)

    const numerator = amountInUints * reserveOut * (UINTS_DENOM * 10 - FEE_BPS); // Use UINTS_DENOM * 10 (10000)
    const denominator = (reserveIn + amountInUints) * (UINTS_DENOM * 10);

    const amountOutUints = Math.floor(numerator / denominator);
    return amountOutUints / UINTS_DENOM; // Return denominated number
  };

  useEffect(() => {
    if (poolData && typeof inputAmount === 'number' && inputAmount > 0) {
      const calculatedOutput = calculateSwap(inputAmount);
      setOutputAmount(calculatedOutput);
      setError(null);
    } else {
      setOutputAmount(null);
      if (inputAmount !== '') setError('Enter a valid amount');
    }
  }, [inputAmount, poolData, isZeroForOne]);


  // --- Swap Handlers ---

  const handleTokenSwap = () => {
    // Simply swap the input and output tokens
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setInputAmount('');
    setOutputAmount(null);
  };

  const handleSwapTransaction = async () => {
    if (!isSignedIn || !poolData || !outputAmount || !inputAmount || inputAmount <= 0) {
      setError("Please connect wallet and enter a valid swap amount.");
      return;
    }

    const inputPrincipal = getTraitPrincipal(inputToken);
    const outputPrincipal = getTraitPrincipal(outputToken);

    // Swap function signature in amm.clar:
    // (swap (token-in <ft-trait>) (token-out <ft-trait>) (input-amount uint) (min-output-amount uint))
    
    // We expect the user to receive at least 90% of the calculated output (simple slippage protection)
    const minOutputAmount = Math.floor(outputAmount * UINTS_DENOM * 0.99); // 1% slippage

    try {
      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: AMM_CONTRACT_NAME,
        functionName: 'swap',
        functionArgs: [
          inputPrincipal,
          outputPrincipal,
          uintCV(inputAmount * UINTS_DENOM),
          uintCV(minOutputAmount),
        ],
        onFinish: ({ txId }) => {
          console.log('Swap TX Submitted:', txId);
          onSwapSuccess(); // Trigger refetch on the parent component (PoolsList)
          setInputAmount('');
        },
      });
    } catch (err) {
      console.error("Swap transaction error:", err);
      setError("Transaction failed or was rejected.");
    }
  };

  const isPoolInitialized = poolData && poolData.balance0 > 0 && poolData.balance1 > 0;
  const isButtonDisabled = !isSignedIn || !isPoolInitialized || isCallPending || !outputAmount || error !== null;
  const transactionButtonText = isCallPending ? 'Processing...' : (
    !isSignedIn ? 'Connect Wallet to Swap' : 
    !isPoolInitialized ? 'Pool Not Initialized' : 
    'Execute Swap'
  );


  // --- UI Render ---

  if (isCallPending) {
    return (
      <Center className="h-48">
        <Loader size="lg" color="indigo" />
        <Text className="ml-4 text-indigo-300">Submitting Swap Transaction...</Text>
      </Center>
    );
  }

  return (
    <Card
      withBorder
      padding="xl"
      radius="lg"
      className="bg-gray-800 border-indigo-500 shadow-xl w-full max-w-md mx-auto"
    >
      <Title order={2} className="text-white mb-6">
        Swap Tokens
      </Title>

      {/* Input Field */}
      <div className="mb-4 relative">
        <TextInput
          label="You Pay"
          placeholder="0.0"
          type="number"
          value={inputAmount}
          onChange={(event) => {
            const val = parseFloat(event.currentTarget.value);
            setInputAmount(isNaN(val) ? '' : val);
          }}
          className="w-full"
          classNames={{ input: 'py-6 text-lg border-gray-600 bg-gray-700 text-white', label: 'text-gray-300' }}
        />
        <Select
          data={TOKEN_OPTIONS.filter(t => t.value !== outputToken)}
          value={inputToken}
          onChange={(value) => setInputToken(value || MOCK_TOKEN_CONTRACT_NAME)}
          className="absolute top-8 right-3 w-28"
          classNames={{ input: 'bg-indigo-600 text-white font-bold', label: 'hidden' }}
        />
      </div>

      {/* Swap Button */}
      <Center className="my-2">
        <Button 
          variant="light" 
          color="indigo" 
          onClick={handleTokenSwap}
          className="rounded-full shadow-lg"
        >
          ⬇️
        </Button>
      </Center>

      {/* Output Field */}
      <div className="mb-6 relative">
        <TextInput
          label="You Receive (Approx.)"
          placeholder="0.0"
          value={outputAmount !== null ? outputAmount.toFixed(6) : ''}
          readOnly
          className="w-full"
          classNames={{ input: 'py-6 text-lg border-gray-600 bg-gray-700 text-white', label: 'text-gray-300' }}
        />
        <Select
          data={TOKEN_OPTIONS.filter(t => t.value !== inputToken)}
          value={outputToken}
          onChange={(value) => setOutputToken(value || MOCK_TOKEN_2_CONTRACT_NAME)}
          className="absolute top-8 right-3 w-28"
          classNames={{ input: 'bg-indigo-600 text-white font-bold', label: 'hidden' }}
        />
      </div>
      
      {/* Rate and Fee Display */}
      {outputAmount !== null && inputAmount > 0 && (
        <div className="text-sm text-gray-400 mb-4 p-3 bg-gray-700 rounded-lg">
          <p>Rate: 1 {inputToken.toUpperCase()} ≈ {(outputAmount / inputAmount).toFixed(6)} {outputToken.toUpperCase()}</p>
          <p>Fee: {(FEE_BPS / 100)}% included</p>
        </div>
      )}

      {/* Error Message */}
      {error && <Text color="red" size="sm" className="mb-4">{error}</Text>}

      {/* Transaction Button */}
      <Button
        size="lg"
        fullWidth
        color="indigo"
        onClick={handleSwapTransaction}
        disabled={isButtonDisabled}
        className="hover:bg-indigo-600 transition duration-200"
      >
        {transactionButtonText}
      </Button>

    </Card>
  );
}
