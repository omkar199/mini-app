'use client'
import React, { useState, useEffect } from 'react'
import { useTurnkey } from '@turnkey/sdk-react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import { bytesToHex } from '@noble/hashes/utils'
import { sha256 } from '@noble/hashes/sha2'
import { jwtDecode } from 'jwt-decode'
import { generateP256KeyPair } from '@turnkey/crypto'
import { DEFAULT_ETHEREUM_ACCOUNTS } from '@turnkey/sdk-browser'

import dotenv from 'dotenv'

import { retrieveLaunchParams } from '@telegram-apps/sdk'
import { isTMA } from '@telegram-apps/bridge'

const App = () => {
  const [telegramUser, setTelegramUser] = useState(null)
  const [tgInitData, setTgInitData] = useState(null)

  useEffect(() => {
    try {
      // Method 1: Using TMA SDK
      const { initDataRaw, initData } = retrieveLaunchParams()
      if (initData?.user) {
        console.log('TMA SDK User data:', initData.user)
        setTelegramUser(initData.user)
      }

      // Method 2: Using window.Telegram.WebApp
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp
        console.log('WebApp initialization data:', tg.initData)
        console.log('WebApp user data:', tg.initDataUnsafe?.user)

        // Initialize WebApp
        tg.ready()
        tg.expand()

        // Try to get user from initDataUnsafe
        if (tg.initDataUnsafe?.user) {
          setTelegramUser(tg.initDataUnsafe.user)
        }
      }

      // Method 3: Parse initData manually if available in URL
      const urlParams = new URLSearchParams(window.location.search)
      const initDataParam = urlParams.get('tgWebAppData')
      if (initDataParam) {
        try {
          const decodedData = decodeURIComponent(initDataParam)
          const parsedData = JSON.parse(decodedData)
          console.log('URL parsed initData:', parsedData)
          if (parsedData.user) {
            setTelegramUser(parsedData.user)
          }
        } catch (e) {
          console.log('Failed to parse URL initData:', e)
        }
      }

      // Log final result
      console.log('Final user data state:', telegramUser)
    } catch (error) {
      console.error('Error accessing Telegram user data:', error)
    }
  }, [])

  console.log('🚀 ~ App ~ telegramUser:', telegramUser)
  const { turnkey, passkeyClient, authIframeClient } = useTurnkey()
  console.log({ turnkey, passkeyClient, authIframeClient })

  const handleGoogleLogin = async (response) => {
    console.log('handleGoogleLogin', response)
    // 'credential' is the ID token returned from Google
    const token = response.credential

    // Decode the token using jwt-decode
    try {
      const decoded = jwtDecode(token)
      console.log('Decoded Token: ', decoded)

      // Access the email directly
      const userEmail = decoded.email
      console.log("User's Email: ", userEmail)

      const keyPair = generateP256KeyPair()
      const privateKey = keyPair.privateKey
      const publicKey = keyPair.publicKey
      console.log({ privateKey, publicKey })

      const subOrgIds = await turnkey.serverSign(
        'getSubOrgIds',
        [
          {
            filterType: 'NAME',
            filterValue: userEmail,
          },
        ],
        'http://localhost:5010/api/get-sub-org-ids'
      )

      console.log(subOrgIds)

      const subOrg = await turnkey.serverSign(
        'createSubOrganization',
        [
          {
            organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID,
            subOrganizationName: userEmail,
            rootUsers: [
              {
                userName: userEmail,
                userEmail: userEmail,
                apiKeys: [],
                oauthProviders: [
                  {
                    providerName: 'Google Auth - Embedded Wallet',
                    oidcToken: response.credential,
                  },
                ],
                authenticators: [],
              },
            ],
            rootQuorumThreshold: 1,
            wallet: {
              walletName: 'Default Wallet',
              accounts: DEFAULT_ETHEREUM_ACCOUNTS, // Add your accounts here
            },
          },
        ],
        'http://localhost:5010/api/create-sub-organization'
      )

      const delegateUserConfig = [
        {
          userName: `delegate user - ${userEmail}`,
          apiKeys: [
            {
              apiKeyName: `Wallet Auth - ${publicKey}`,
              publicKey: publicKey,
              curveType: 'API_KEY_CURVE_SECP256K1', // Adjust based on your wallet type
            },
          ],
          authenticators: [],
          userTags: [],
        },
      ]

      const delegateUserResponse = await turnkey.serverSign(
        'addUserToSubOrganization',
        [subOrg.subOrganizationId, delegateUserConfig],
        'http://localhost:5010/api/create-user'
      )

      console.log(subOrg)

      const walletData = {
        userID: '6690017035',
        username: 'omkarudhane',
        walletAddress: subOrg.wallet.addresses[0],
        publicKey: publicKey,
        privateKey: privateKey,
        subOrgID: subOrg.subOrganizationId,
        walletID: subOrg.wallet.walletId,
      }
      // const walletData = {
      //   userID: '6690017035',
      //   username: 'omkarudhane',
      //   walletAddress: "asdbasd",
      //   publicKey: "asdadsa",
      //   privateKey: "asdasd",
      //   subOrgID: "cxzczcz",
      //   walletID: "asdaas",
      // }
      console.log('🚀 ~ handleGoogleLogin ~ walletData:', walletData)

      const createWalletResponse = await fetch('http://localhost:5010/api/add-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(walletData),
      })
      console.log("🚀 ~ handleGoogleLogin ~ createWalletResponse:", createWalletResponse)
  
    } catch (err) {
      console.log(err)
    }
  }

  return (
    <div className='auth-container'>
      <h1>Authentication</h1>
      {/* {error && <p className="error">{error}</p>}
      <form onSubmit={handleEmailSignIn}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Sign In with Email</button>
      </form>
      <button onClick={handleGoogleSignIn}>Sign In with Google</button> */}

      {authIframeClient?.iframePublicKey ? (
        <GoogleOAuthProvider clientId='457197742728-o6gcr5ooleqpumlhio9702dsrufs34sc.apps.googleusercontent.com'>
          <GoogleLogin
            nonce={bytesToHex(sha256(authIframeClient.iframePublicKey))}
            onSuccess={handleGoogleLogin}
            useOneTap
          />
        </GoogleOAuthProvider>
      ) : null}
    </div>
  )
}

export default App
