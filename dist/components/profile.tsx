/* 
Sitepaige Components v1.0.0
Sitepaige components are automatically added to your project the first time it is built, and are only added again if the "Build Components" button is 
checked in the system build settings. It is safe to modify this file without it being overwritten unless that setting is selected. 
*/

'use client';

import { useState, useEffect } from 'react';

interface UserProfile {
  id: string;
  username: string;
  avatarurl: string | null;
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/Auth', {
          method: 'GET',
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        
        if (!data.user) {
          throw new Error('User not authenticated');
        }
        
        // Use the user object from the response
        const userData = data.user;
        setProfile({
          id: userData.userid,
          username: userData.username,
          avatarurl: userData.avatarurl
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center min-h-[200px]">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  if (!profile) {
    return <div className="text-center">No profile found</div>;
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <div className="flex flex-col items-center">
        {profile.avatarurl && (
          <img 
            src={profile.avatarurl}
            alt="Profile avatar"
            className="w-32 h-32 rounded-full mb-4"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        )}
        <h2 className="text-2xl font-semibold text-gray-800">{profile.username}</h2>
        <p className="text-gray-500 mt-2">User ID: {profile.id}</p>
      </div>
    </div>
  );
}
