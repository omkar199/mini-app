'use client'
import React, { useState, useEffect } from 'react'
import { useTurnkey } from '@turnkey/sdk-react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import { bytesToHex } from '@noble/hashes/utils'
import { sha256 } from '@noble/hashes/sha2'
import { jwtDecode } from 'jwt-decode'
import { generateP256KeyPair } from '@turnkey/crypto'
import { DEFAULT_ETHEREUM_ACCOUNTS } from '@turnkey/sdk-browser'
export const App = () => {
    const [telegramUser, setTelegramUser] = useState(null)
    const [tgInitData, setTgInitData] = useState(null)
    const [isMounted, setIsMounted] = useState(false)
    const { turnkey, passkeyClient, authIframeClient } = useTurnkey()
    console.log({ turnkey, passkeyClient, authIframeClient })
    useEffect(() => {
      setIsMounted(true)
    }, [])
  
    useEffect(() => {
      if (!isMounted) return
      
      const initializeTelegram = () => {
        try {
          if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
            const tg = (window as any).Telegram.WebApp
            console.log('WebApp initialization data:', tg.initData)
            console.log('WebApp user data:', tg.initDataUnsafe?.user)
  
            tg.ready()
            tg.expand()
  
            if (tg.initDataUnsafe?.user) {
              setTelegramUser(tg.initDataUnsafe.user)
            }
          }
  
          if (typeof window !== 'undefined') {
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
          }
  
          console.log('Final user data state:', telegramUser)
        } catch (error) {
          console.error('Error accessing Telegram user data:', error)
        }
      }
  
      initializeTelegram()
    }, [isMounted, telegramUser])
  
   console.log(process.env.NEXT_PUBLIC_ORGANIZATION_ID,"process.env.NEXT_PUBLIC_ORGANIZATION_ID");
   
   
  
    const handleGoogleLogin = async (response :any) => {
      console.log('handleGoogleLogin', response)
      // 'credential' is the ID token returned from Google
      const token = response.credential
  
      // Decode the token using jwt-decode
      try {
        const decoded :any= jwtDecode(token)
        console.log('Decoded Token: ', decoded)
  
        // Access the email directly
        const userEmail = decoded.email
        console.log("User's Email: ", userEmail)
  
        const keyPair = generateP256KeyPair()
        const privateKey = keyPair.privateKey
        const publicKey = keyPair.publicKey
        console.log({ privateKey, publicKey })
  
        const subOrgIds = await (turnkey as any).serverSign(
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
  
        const subOrg = await (turnkey as any).serverSign(
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
  
        const delegateUserResponse = await (turnkey as any).serverSign(
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
    console.log(authIframeClient?.iframePublicKey,"authIframeClient?.iframePublicKey");
    
    return (
      <div className='auth-container'>
        <h1>Authentication</h1>
        
        {isMounted && authIframeClient?.iframePublicKey && (
          <GoogleOAuthProvider clientId='457197742728-o6gcr5ooleqpumlhio9702dsrufs34sc.apps.googleusercontent.com'>
            <GoogleLogin
              nonce={authIframeClient.iframePublicKey ? bytesToHex(sha256(authIframeClient.iframePublicKey)) : undefined}
              onSuccess={handleGoogleLogin}
              useOneTap
            />
          </GoogleOAuthProvider>
        )}
      </div>
    );
}

export default App