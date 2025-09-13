/* 
Sitepaige Components v1.0.0
Sitepaige components are automatically added to your project the first time it is built, and are only added again if the "Build Components" button is 
checked in the system build settings. It is safe to modify this file without it being overwritten unless that setting is selected. 
*/

'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/store/user';

interface AuthProps {
  auth: {
    ID: string;
    UserName: string;
    AvatarURL: string;
    UserLevel: string;
    IsAdmin: boolean;
  } | null;
}

export default function Auth({ auth }: AuthProps) {
  const { setUserLevel, setIsAuthenticated, setUserName, setAvatarURL, setIsAdmin } = useUserStore();

  useEffect(() => {
    if (auth) {
      setIsAuthenticated(true);
      setUserLevel(auth.UserLevel);
      setIsAdmin(auth.IsAdmin);
      setUserName(auth.UserName);
      setAvatarURL(auth.AvatarURL);
    } else {
      setIsAuthenticated(false); 
      setUserLevel('0');
      setUserName('');
      setAvatarURL('');
      setIsAdmin(false);
    }
  }, [auth, setIsAuthenticated, setUserLevel, setIsAdmin, setUserName, setAvatarURL]);

  return <></>;
}
