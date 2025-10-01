'use client';

// FIX: Renamed useReadOnlyFn to useReadOnlyFunction
import { useReadOnlyFunction, useOpenContractCall, useAuth } from '@micro-stacks/react';
import { contractPrincipalCV, uintCV, cvToJSON } from 'micro-stacks/clarity';
import { Title, Card, Text, Badge, Group, Loader, Center, Button } from '@mantine/core';
import { useMemo } from 'react'; // Added explicit import for useMemo
import {
  CONTRACT_ADDRESS,
  AMM_CONTRACT_NAME,
  getPoolIdArgs,
  getCreatePoolArgs, // Imported for transaction arguments
  PoolData,
} from '../lib/amm';

// Function to safely extract the pool data from the Clarity response
const parsePoolData = (cvData: any): PoolData | null => {
  if (!cvData?.value) return null;

  const data = cvToJSON(cvData.value);

  // Helper to convert Clarity UINT string (u123456) to standard number
  const cvNum = (key: string) => parseInt(data.value[key].value, 10);

  return {
    balance0: cvNum('balance-0'),
    balance1: cvNum('balance-1'),
    fee: cvNum('fee-bps'),
    totalLPSupply: cvNum('total-lp-supply'),
    // Note: The tokens in Clarity are contract principals, which we treat as strings
    token0: data.value['token-0'].value.contractName.value,
    token1: data.value['token-1'].value.contractName.value,
    // The LP token is also a contract principal
    lpToken: data.value['lp-token'].value.contractName.value,
    // Reserves are the same as balances in this simple AMM
    reserve0: cvNum('balance-0'),
    reserve1: cvNum('balance-1'),
  };
};

// Component to fetch and display the AMM pool details
export default function PoolsList() {
  // Authentication and Write Hooks
  const { isSignedIn } = useAuth();
  const { openContractCall, isCallPending } = useOpenContractCall();

  // Define the arguments for the 'get-pool-data' read-only function
  const readOnlyFnArgs = useMemo(() => getPoolIdArgs(), []);
  
  // FIX USAGE: useReadOnlyFunction is the correct name
  const { data: poolDataCv, isFetching, refetch } = useReadOnlyFunction({ // Added refetch
    contractAddress: CONTRACT_ADDRESS,
    contractName: AMM_CONTRACT_NAME,
    functionName: 'get-pool-data',
    functionArgs: readOnlyFnArgs,
  });

  const pool = poolDataCv ? parsePoolData(poolDataCv) : null;
  const isPoolExists = pool && pool.balance0 > 0 && pool.balance1 > 0;

  // --- Handler for Create Pool Transaction ---
  const handleCreatePool = async () => {
    if (!isSignedIn) {
        console.error("Wallet not connected.");
        return;
    }

    try {
        await openContractCall({
            contractAddress: CONTRACT_ADDRESS,
            contractName: AMM_CONTRACT_NAME,
            functionName: 'create-pool',
            functionArgs: getCreatePoolArgs(), // Gets token and fee arguments
            // Use onFinish to refresh the pool state after the transaction is submitted
            onFinish: ({ txId }) => {
                console.log('Pool Creation TX Submitted:', txId);
                // Give the network a few seconds to confirm the transaction
                setTimeout(() => refetch(), 5000); 
            },
        });
    } catch (error) {
        console.error("Error initiating create-pool transaction:", error);
    }
  };
  // ----------------------------------------------


  if (isFetching || isCallPending) {
    return (
      <Center className="h-48">
        <Loader size="lg" color="indigo" />
        <Text className="ml-4 text-indigo-300">
            {isCallPending ? 'Submitting Transaction...' : 'Fetching Pool Data...'}
        </Text>
      </Center>
    );
  }

  if (!isPoolExists) {
    return (
      <Card
        withBorder
        padding="xl"
        radius="lg"
        className="mt-8 bg-gray-800 border-gray-700 text-center"
      >
        <Title order={3} className="text-white">
          No Liquidity Pool Found
        </Title>
        <Text className="text-gray-400 mt-2">
          The mock token pool has not been created or initialized on the network.
        </Text>
        
        {/* Added: Create Pool Button */}
        <Button
            mt="md"
            variant="filled"
            color="indigo"
            size="lg"
            disabled={!isSignedIn || isCallPending}
            onClick={handleCreatePool}
            className="hover:bg-indigo-700 transition duration-150 shadow-lg"
        >
            {isSignedIn ? 'Initialize Pool' : 'Connect Wallet to Initialize'}
        </Button>
      </Card>
    );
  }

  // Display the pool details
  return (
    <div className="mt-12">
      <Title order={2} className="text-white mb-6 border-b border-indigo-500 pb-2">
        Active Liquidity Pools
      </Title>

      <Card
        withBorder
        padding="xl"
        radius="lg"
        className="bg-gray-800 border-indigo-600 shadow-2xl"
      >
        <Group position="apart">
          <Title order={3} className="text-indigo-400">
            {pool.token0.toUpperCase()} / {pool.token1.toUpperCase()}
          </Title>
          <Badge size="lg" color="green" variant="filled" className="font-semibold">
            Fee: {pool.fee / 100}%
          </Badge>
        </Group>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="p-4 bg-gray-700 rounded-lg">
            <Text className="text-gray-300 text-sm">Reserve ({pool.token0.toUpperCase()})</Text>
            <Text className="text-2xl font-bold text-white mt-1">
              {(pool.reserve0 / 1000000).toFixed(6)}
            </Text>
          </div>
          <div className="p-4 bg-gray-700 rounded-lg">
            <Text className="text-gray-300 text-sm">Reserve ({pool.token1.toUpperCase()})</Text>
            <Text className="text-2xl font-bold text-white mt-1">
              {(pool.reserve1 / 1000000).toFixed(6)}
            </Text>
          </div>
        </div>

        <Text className="text-gray-500 mt-4 text-sm">
          LP Token: {CONTRACT_ADDRESS.substring(0, 4)}...{CONTRACT_ADDRESS.substring(CONTRACT_ADDRESS.length - 4)}.{pool.lpToken}
        </Text>
      </Card>
    </div>
  );
}
