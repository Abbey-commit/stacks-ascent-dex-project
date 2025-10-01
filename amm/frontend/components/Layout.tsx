'use client';

import { Container, Title, Grid } from '@mantine/core';
import { useAuth } from '@micro-stacks/react';
import { useState, useCallback } from 'react';

// Import the components we've built
import PoolsList from '@/components/PoolsList';
import SwapCard from '@/components/SwapCard';
// NEW: Import the component we are about to create
import AddLiquidityCard from '@/components/AddLiquidityCard';

export default function AMMApp() {
  const { isSignedIn, userData } = useAuth();
  
  // State to force components (like PoolsList) to refetch data after a successful transaction
  const [dataVersion, setDataVersion] = useState(0);

  // Callback function passed to transaction components to trigger refetch
  const handlePoolDataChange = useCallback(() => {
    setDataVersion(prev => prev + 1);
  }, []);

  return (
    <Container size="xl" className="min-h-screen pt-10 pb-20">
      <div className="text-center mb-10">
        <Title order={1} className="text-5xl font-extrabold text-indigo-400">
          Stacks AMM DEX
        </Title>
        <p className="text-gray-400 mt-2 max-w-xl mx-auto">
          Decentralized exchange powered by Clarity smart contracts on the Stacks Testnet.
        </p>
      </div>

      <Grid className="mb-16">
        {/* Column 1: Swap Card (Transaction Interface) */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <SwapCard onSwapSuccess={handlePoolDataChange} />
        </Grid.Col>

        {/* Column 2: Pools List (Data Display/Initialization) */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          {/* PoolsList uses dataVersion as a key to force a refresh when it changes */}
          <PoolsList key={dataVersion} onPoolChange={handlePoolDataChange} />
        </Grid.Col>

        {/* NEW Column 3: Add Liquidity Card (Liquidity Management) */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <AddLiquidityCard onLiquidityChange={handlePoolDataChange} />
        </Grid.Col>
      </Grid>
    </Container>
  );
}
