/* 
Sitepaige Components v1.0.0
Sitepaige components are automatically added to your project the first time it is built, and are only added again if the "Build Components" button is 
checked in the system build settings. It is safe to modify this file without it being overwritten unless that setting is selected. 
*/

'use client';

import React, { useState } from 'react';

interface LoginProps {
  providers: ('apple' | 'facebook' | 'github' | 'google')[];
}

export default function Login({ providers }: LoginProps) {
  const [error, setError] = useState<string | null>(null);


  const handleProviderLogin = async (provider: string) => {
  
      // Generate random state for CSRF protection
      const state = Math.random().toString(36).substring(7) + Date.now().toString(36);
      sessionStorage.setItem('auth_nonce', state);
      sessionStorage.setItem('auth_provider', provider);
      
      // Construct redirect URI
      const redirectUri = `${window.location.origin}/logincallback`;
      
      // Configure OAuth URLs for different providers
      const providerUrls = {
        google: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email profile&state=${state}`,
        apple: `https://appleid.apple.com/auth/authorize?client_id=${process.env.NEXT_PUBLIC_APPLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=name email&state=${state}`,    
        facebook: `https://www.facebook.com/v12.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID}&redirect_uri=${redirectUri}&scope=email&state=${state}`,
        github: `https://github.com/login/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user:email&state=${state}`
      };

      // Redirect to appropriate provider
      if (provider in providerUrls) {
        window.location.href = providerUrls[provider as keyof typeof providerUrls];
      } else {
        setError(`Unsupported provider: ${provider}`);
      }
    
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Sign in to your account</h2>
        </div>

        {(
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {providers?.map(provider => 
                 (
                  <button
                    key={provider}
                    onClick={() => handleProviderLogin(provider)}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 classButtonRounding classButtonBackground classButtonFontType  classButtonFontSize"
                  >
                    {provider}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 text-red-600 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
