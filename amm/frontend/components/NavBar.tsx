import { Title, Group, Button, Text } from '@mantine/core';
import { useAuth } from '@micro-stacks/react';
// import { StacksTestnet } from 'micro-stacks/network'; // Removed as it's not needed here

// Function to truncate the STX address for display
const truncateAddress = (address: string) => {
  if (address.length < 10) return address;
  return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
};

export default function NavBar() {
  const { isSignedIn, handleSignIn, handleSignOut, userData } = useAuth();

  // Safely access the user's Testnet address
  const userAddress = isSignedIn
    ? userData?.profile?.stxAddress?.testnet
    : '';

  return (
    <header className="bg-gray-900 border-b border-gray-700 h-16 p-4">
      <div className="flex justify-between items-center h-full max-w-7xl mx-auto">
        <Title order={3} className="text-indigo-400 font-extrabold text-xl">
          Stacks AMM
        </Title>
        <Group>
          {isSignedIn && userAddress ? (
            <div className="flex items-center space-x-3">
              <Text
                size="sm"
                className="text-gray-300 bg-gray-700 p-2 rounded-lg font-mono border border-indigo-500"
              >
                {truncateAddress(userAddress)}
              </Text>
              <Button
                variant="filled"
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
              variant="filled"
              color="indigo"
              size="sm"
              onClick={() => handleSignIn()}
              className="hover:bg-indigo-700 transition duration-150 shadow-lg"
            >
              Connect Wallet
            </Button>
          )}
        </Group>
      </div>
    </header>
  );
}
