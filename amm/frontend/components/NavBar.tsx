'use client';

// Removed Header from this import as it's deprecated in Mantine v7
import { Group, Title, Button, Container } from '@mantine/core'; 
import { useAuth } from '@micro-stacks/react';

export default function NavBar() {
  // CRITICAL: Must be destructured from the useAuth hook inside a Client Component
  const { isSignedIn, handleSignIn, handleSignOut, userData } = useAuth();

  // Safely extract the user address for display
  const userAddress = userData?.profile?.stxAddress?.testnet;

  return (
    // Changed Mantine <Header> to a standard HTML <header> tag, preserving styling via Tailwind.
    // h-16 (64px) approximates the old height.
    <header className="bg-gray-900 border-b border-indigo-700 shadow-xl h-16 p-4"> 
      <Container size="lg" className="h-full flex justify-between items-center">
        <Title order={3} className="text-white font-extrabold text-xl sm:text-2xl">
          Stacks AMM
        </Title>
        <Group>
          {isSignedIn ? (
            <div className="flex items-center space-x-3">
              {/* Display a truncated address */}
              <span className="text-sm text-indigo-300 hidden sm:inline">
                {userAddress?.substring(0, 4)}...{userAddress?.substring(userAddress.length - 4)}
              </span>
              <Button
                color="red"
                size="sm"
                onClick={() => handleSignOut()}
                className="hover:bg-red-700 transition duration-150 shadow-md"
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <Button
              color="indigo"
              size="sm"
              onClick={() => handleSignIn()} 
              className="hover:bg-indigo-700 transition duration-150 shadow-lg"
            >
              Connect Wallet
            </Button>
          )}
        </Group>
      </Container>
    </header>
  );
}
