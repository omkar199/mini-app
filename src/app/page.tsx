'use client'
import App from "@/components/app";
import { useEffect, useState } from "react";


import { TurnkeyProvider } from "@turnkey/sdk-react";

const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? '',
  defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? '',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY ?? '',
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY ?? '',
  serverSignUrl: process.env.NEXT_PUBLIC_SERVER_SIGN_URL ?? '',
};

export default function Home() {
  const [client, setClient] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setClient(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during initialization')
      console.error('Initialization error:', err)
    }
  }, [])
  
  if (error) {
    return <div className="error-message">Error: {error}</div>
  }

  return client ? (
    <TurnkeyProvider config={config}>
      <App />
    </TurnkeyProvider>
  ) : (
    <div className="loading-state">Loading...</div>
  )
}
