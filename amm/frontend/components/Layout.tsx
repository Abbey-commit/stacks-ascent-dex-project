'use client'; // CRITICAL: Must be a client component because it uses hooks and context providers

import { AppShell, MantineProvider, ColorScheme, Container } from "@mantine/core";
// FIX: StacksProvider was renamed to ClientProvider for App Router compatibility
import { ClientProvider as StacksProvider } from '@micro-stacks/react'; 
import NavBar from "./NavBar";
import { getNetwork } from "../lib/amm";
import { useState, useMemo } from 'react';

// Initialize the network once
const network = getNetwork();

export default function Layout({ children }: { children: React.ReactNode }) {
  // Use a simplified approach for theming/color scheme if needed later
  const [colorScheme, setColorScheme] = useState<ColorScheme>('dark');
  
  // Note: We are no longer using ColorSchemeProvider to avoid the Mantine import error

  return (
    <MantineProvider
      withGlobalStyles
      withNormalizeCSS
      theme={{
        colorScheme: 'dark', // Force dark theme for AMM styling
        colors: {
          indigo: ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#2e258f'],
        },
        primaryColor: 'indigo',
      }}
    >
      {/* StacksProvider enables wallet connectivity */}
      <StacksProvider
        authOptions={{
          appDetails: {
            name: 'Stacks AMM',
            icon: 'https://placehold.co/100x100/4f46e5/white?text=AMM',
          },
          network: network,
        }}
        network={network}
      >
        {/* Main layout container (AppShell replacement) */}
        <div className="min-h-screen bg-gray-900 text-white">
          <NavBar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </StacksProvider>
    </MantineProvider>
  );
}
