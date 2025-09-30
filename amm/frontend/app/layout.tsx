import './globals.css'; // Global styles (includes Tailwind imports)
import Layout from '../components/Layout'; // The Mantine/Stacks provider wrapper

export const metadata = {
  title: 'Stacks AMM',
  description: 'Decentralized Exchange built on Stacks.',
};

// The Root Layout component
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Mantine requires setting color scheme in head */}
        <meta name="color-scheme" content="dark" /> 
      </head>
      <body>
        {/* Our custom Layout component provides StacksProvider and MantineProvider */}
        <Layout>
          {children}
        </Layout>
      </body>
    </html>
  );
}