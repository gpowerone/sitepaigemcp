/*
 * User Management Database Utilities
 * Handles all database operations related to user management
 */

import { db_init, db_query, db_migrate } from './db';
import type { DatabaseClient } from './db';

export interface User {
  userid: string;
  OAuthID: string;
  Source: 'google' | 'facebook' | 'apple' | 'github';
  UserName: string;
  Email?: string;
  AvatarURL?: string;
  UserLevel: number; // 0: everyone, 1: registered user, 2: admin
  LastLoginDate: string;
  CreatedDate: string;
  IsActive: boolean;
}

export interface UserSession {
  ID: string;
  SessionToken: string;
  userid: string;
  ExpirationDate: string;
}

export interface OAuthToken {
  ID: string;
  userid: string;
  Provider: 'google' | 'facebook' | 'apple' | 'github';
  AccessToken: string;
  RefreshToken?: string;
  ExpiresAt?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

/**
 * Ensure the Users table exists with the correct schema
 */
export async function ensureUsersTable(): Promise<void> {
  const client = await db_init();

  // Create or migrate the Users table
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS Users (
      userid VARCHAR(36) PRIMARY KEY NOT NULL,
      OAuthID VARCHAR(255) NOT NULL UNIQUE,
      Source VARCHAR(20) NOT NULL CHECK(Source IN ('google', 'facebook', 'apple', 'github')),
      UserName VARCHAR(255) NOT NULL,
      Email VARCHAR(255),
      AvatarURL TEXT,
      UserLevel INTEGER NOT NULL DEFAULT 1 CHECK(UserLevel IN (0, 1, 2)),
      UserTier INTEGER NOT NULL DEFAULT 0,
      LastLoginDate DATETIME NOT NULL,
      CreatedDate DATETIME NOT NULL,
      IsActive BOOLEAN NOT NULL DEFAULT true
    );
    
    CREATE INDEX IF NOT EXISTS idx_users_oauth ON Users(OAuthID);
    CREATE INDEX IF NOT EXISTS idx_users_permission ON Users(UserLevel);
  `;
  
  // Split and execute statements separately for compatibility
  const statements = createTableSQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const statement of statements) {
    try {
      await db_query(client, statement);
    } catch (error) {
      // Ignore errors for index creation as some databases don't support IF NOT EXISTS for indexes
      if (!statement.includes('CREATE INDEX')) {
        throw error;
      }
    }
  }
}

/**
 * Ensure the UserSession table exists
 */
export async function ensureUserSessionTable(): Promise<void> {
  const client = await db_init();
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS UserSession (
      ID VARCHAR(36) PRIMARY KEY NOT NULL,
      SessionToken VARCHAR(255) NOT NULL UNIQUE,
      userid VARCHAR(36) NOT NULL,
      ExpirationDate DATETIME NOT NULL,
      FOREIGN KEY (userid) REFERENCES Users(userid) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_session_token ON UserSession(SessionToken);
    CREATE INDEX IF NOT EXISTS idx_session_user ON UserSession(userid);
    CREATE INDEX IF NOT EXISTS idx_session_expiry ON UserSession(ExpirationDate);
  `;
  
  // Split and execute statements separately for compatibility
  const statements = createTableSQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const statement of statements) {
    try {
      await db_query(client, statement);
    } catch (error) {
      // Ignore errors for index creation as some databases don't support IF NOT EXISTS for indexes
      if (!statement.includes('CREATE INDEX')) {
        throw error;
      }
    }
  }
}

/**
 * Ensure the OAuthTokens table exists
 */
export async function ensureOAuthTokensTable(): Promise<void> {
  const client = await db_init();
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS OAuthTokens (
      ID VARCHAR(36) PRIMARY KEY NOT NULL,
      userid VARCHAR(36) NOT NULL,
      Provider VARCHAR(20) NOT NULL CHECK(Provider IN ('google', 'facebook', 'apple', 'github')),
      AccessToken TEXT NOT NULL,
      RefreshToken TEXT,
      ExpiresAt DATETIME,
      CreatedAt DATETIME NOT NULL,
      UpdatedAt DATETIME NOT NULL,
      FOREIGN KEY (userid) REFERENCES Users(userid) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_oauth_user ON OAuthTokens(userid);
    CREATE INDEX IF NOT EXISTS idx_oauth_provider ON OAuthTokens(userid, Provider);
  `;
  
  // Split and execute statements separately for compatibility
  const statements = createTableSQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const statement of statements) {
    try {
      await db_query(client, statement);
    } catch (error) {
      // Ignore errors for index creation as some databases don't support IF NOT EXISTS for indexes
      if (!statement.includes('CREATE INDEX')) {
        throw error;
      }
    }
  }
}

/**
 * Ensure all authentication tables exist
 */
export async function ensureAuthTables(): Promise<void> {
  const client = await db_init();
  
  // IMPORTANT: Create Users table first since UserSession and OAuthTokens have foreign keys to it
  await ensureUsersTable();
  await ensureUserSessionTable();
  await ensureOAuthTokensTable();
}

/**
 * Get all users from the database
 */
export async function getAllUsers(): Promise<User[]> {
  const client = await db_init();
  
  const users = await db_query(client, 
    `SELECT * FROM Users 
     WHERE IsActive = ? 
     ORDER BY UserLevel DESC, UserName ASC`,
    [true]
  );
  
  return users as User[];
}

/**
 * Get a user by their OAuth ID
 */
export async function getUserByOAuthID(oauthId: string): Promise<User | null> {
  const client = await db_init();

  const users = await db_query(client, 
    "SELECT * FROM Users WHERE OAuthID = ? AND IsActive = ?",
    [oauthId, true]
  );
  
  return users.length > 0 ? users[0] as User : null;
}

/**
 * Get a user by their userid
 */
export async function getUserByID(userId: string): Promise<User | null> {
  const client = await db_init();
  
  const users = await db_query(client, 
    "SELECT * FROM Users WHERE userid = ? AND IsActive = ?",
    [userId, true]
  );
  
  return users.length > 0 ? users[0] as User : null;
}

/**
 * Create or update a user
 */
export async function upsertUser(
  oauthId: string,
  source: 'google' | 'facebook' | 'apple' | 'github',
  userName: string,
  email?: string,
  avatarUrl?: string
): Promise<User> {
  const client = await db_init();
  
  // Check if user exists
  const existingUser = await getUserByOAuthID(oauthId);
  
  if (existingUser) {
    // Update existing user
    await db_query(client,
      `UPDATE Users 
       SET UserName = ?, Email = COALESCE(?, Email), AvatarURL = ?, 
           LastLoginDate = CURRENT_TIMESTAMP, Source = ?
       WHERE OAuthID = ?`,
      [userName, email, avatarUrl || '', source, oauthId]
    );
    
    return (await getUserByOAuthID(oauthId))!;
  } else {
    // Check if this is the first user (should be admin)
    const allUsers = await db_query(client, "SELECT COUNT(*) as count FROM Users");
    const isFirstUser = allUsers[0].count === 0;
    
    // Create new user
    const userId = crypto.randomUUID();
    const permissionLevel = isFirstUser ? 2 : 1; // First user is admin
    
    await db_query(client,
      `INSERT INTO Users 
       (userid, OAuthID, Source, UserName, Email, AvatarURL, UserLevel, UserTier,
        LastLoginDate, CreatedDate, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
      [userId, oauthId, source, userName, email || null, avatarUrl || '', permissionLevel, true]
    );
    
    return (await getUserByOAuthID(oauthId))!;
  }
}

/**
 * Update a user's permission level
 */
export async function updateUserPermission(
  userId: string, 
  permissionLevel: number
): Promise<boolean> {
  const client = await db_init();

  // Ensure there's always at least one admin
  if (permissionLevel < 2) {
    const admins = await db_query(client,
      "SELECT COUNT(*) as count FROM Users WHERE UserLevel = ? AND userid != ? AND IsActive = ?",
      [2, userId, true]
    );
    
    if (admins[0].count === 0) {
      throw new Error('Cannot demote the last admin user');
    }
  }
  
  const result = await db_query(client,
    "UPDATE Users SET UserLevel = ? WHERE userid = ?",
    [permissionLevel, userId]
  );
  
  return result[0].changes > 0;
}

/**
 * Delete (soft delete) a user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const client = await db_init();
  
  // Ensure there's always at least one admin
  const user = await getUserByID(userId);
  if (user && user.UserLevel === 2) {
    const admins = await db_query(client,
      "SELECT COUNT(*) as count FROM Users WHERE UserLevel = ? AND userid != ? AND IsActive = ?",
      [2, userId, true]
    );
    
    if (admins[0].count === 0) {
      throw new Error('Cannot delete the last admin user');
    }
  }
  
  // Soft delete the user
  const result = await db_query(client,
    "UPDATE Users SET IsActive = ? WHERE userid = ?",
    [false, userId]
  );
  
  return result[0].changes > 0;
}

/**
 * Get user statistics
 */
export async function getUserStats(): Promise<{
  totalUsers: number;
  admins: number;
  registeredUsers: number;
  guestUsers: number;
}> {
  const client = await db_init();
  
  const stats = await db_query(client, `
    SELECT 
      COUNT(*) as totalUsers,
      SUM(CASE WHEN UserLevel = 2 THEN 1 ELSE 0 END) as admins,
      SUM(CASE WHEN UserLevel = 1 THEN 1 ELSE 0 END) as registeredUsers,
      SUM(CASE WHEN UserLevel = 0 THEN 1 ELSE 0 END) as guestUsers
    FROM Users
    WHERE IsActive = ?
  `, [true]);
  
  return stats[0];
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const client = await db_init();
  
  const result = await db_query(client,
    "DELETE FROM UserSession WHERE ExpirationDate < CURRENT_TIMESTAMP"
  );
  
  return result[0].changes;
}

/**
 * Store OAuth tokens securely
 */
export async function storeOAuthToken(
  userId: string,
  provider: 'google' | 'facebook' | 'apple' | 'github',
  accessToken: string,
  refreshToken?: string,
  expiresIn?: number
): Promise<void> {
  const client = await db_init();
  
  const tokenId = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  
  // Delete existing tokens for this user/provider combo
  await db_query(client,
    "DELETE FROM OAuthTokens WHERE userid = ? AND Provider = ?",
    [userId, provider]
  );
  
  // Insert new token
  await db_query(client,
    `INSERT INTO OAuthTokens 
     (ID, userid, Provider, AccessToken, RefreshToken, ExpiresAt, CreatedAt, UpdatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tokenId, userId, provider, accessToken, refreshToken || null, expiresAt, now, now]
  );
}

/**
 * Get OAuth token for a user
 */
export async function getOAuthToken(
  userId: string,
  provider: 'google' | 'facebook' | 'apple' | 'github'
): Promise<OAuthToken | null> {
  const client = await db_init();
  
  const tokens = await db_query(client,
    "SELECT * FROM OAuthTokens WHERE userid = ? AND Provider = ?",
    [userId, provider]
  );
  
  return tokens.length > 0 ? tokens[0] as OAuthToken : null;
}

/**
 * Validate session and check for suspicious activity
 */
export async function validateSession(sessionToken: string): Promise<{
  valid: boolean;
  user?: User;
  needsRotation?: boolean;
}> {
  const client = await db_init();
  
  // Get session details
  const sessions = await db_query(client,
    `SELECT s.*, u.* FROM UserSession s 
     JOIN Users u ON s.userid = u.userid 
     WHERE s.SessionToken = ? AND s.ExpirationDate > CURRENT_TIMESTAMP AND u.IsActive = ?`,
    [sessionToken, true]
  );
  
  if (!sessions || sessions.length === 0) {
    return { valid: false };
  }
  
  const session = sessions[0];
  
  // Check if session needs rotation (older than 24 hours)
  const sessionAge = Date.now() - new Date(session.ID).getTime();
  const needsRotation = sessionAge > 24 * 60 * 60 * 1000; // 24 hours
  
  return {
    valid: true,
    user: {
      userid: session.userid,
      OAuthID: session.OAuthID,
      Source: session.Source,
      UserName: session.UserName,
      Email: session.Email,
      AvatarURL: session.AvatarURL,
      UserLevel: session.UserLevel,
      LastLoginDate: session.LastLoginDate,
      CreatedDate: session.CreatedDate,
      IsActive: session.IsActive
    } as User,
    needsRotation
  };
}

/**
 * Rotate session token for security
 */
export async function rotateSession(oldSessionToken: string): Promise<string | null> {
  const client = await db_init();
  
  // Get existing session
  const sessions = await db_query(client,
    "SELECT * FROM UserSession WHERE SessionToken = ? AND ExpirationDate > CURRENT_TIMESTAMP",
    [oldSessionToken]
  );
  
  if (!sessions || sessions.length === 0) {
    return null;
  }
  
  const session = sessions[0];
  const newSessionToken = crypto.randomBytes(32).toString('base64url');
  
  // Update session with new token
  await db_query(client,
    "UPDATE UserSession SET SessionToken = ?, ExpirationDate = ? WHERE ID = ?",
    [newSessionToken, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), session.ID]
  );
  
  return newSessionToken;
}

/**
 * OAuth token refresh endpoints
 */
const OAUTH_REFRESH_ENDPOINTS = {
  google: 'https://oauth2.googleapis.com/token',
  facebook: 'https://graph.facebook.com/v12.0/oauth/access_token',
  apple: 'https://appleid.apple.com/auth/token',
  github: 'https://github.com/login/oauth/access_token'
};

/**
 * Validate OAuth token with provider
 */
export async function validateOAuthToken(
  userId: string,
  provider: 'google' | 'facebook' | 'apple' | 'github'
): Promise<boolean> {
  const client = await db_init();
  
  // Get stored OAuth token
  const token = await getOAuthToken(userId, provider);
  if (!token) {
    return false;
  }
  
  // Check if token is expired based on stored expiry
  if (token.ExpiresAt && new Date(token.ExpiresAt) < new Date()) {
    // Try to refresh the token
    if (token.RefreshToken) {
      return await refreshOAuthToken(userId, provider);
    }
    return false;
  }
  
  // For providers that don't provide expiry, validate with a test request
  try {
    let validationUrl: string;
    switch (provider) {
      case 'google':
        validationUrl = `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token.AccessToken}`;
        break;
      case 'facebook':
        validationUrl = `https://graph.facebook.com/me?access_token=${token.AccessToken}`;
        break;
      case 'github':
        validationUrl = 'https://api.github.com/user';
        break;
      default:
        return true; // Skip validation for providers without easy validation endpoints
    }
    
    const response = await fetch(validationUrl, {
      headers: provider === 'github' ? {
        Authorization: `Bearer ${token.AccessToken}`
      } : {}
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Refresh OAuth token
 */
export async function refreshOAuthToken(
  userId: string,
  provider: 'google' | 'facebook' | 'apple' | 'github'
): Promise<boolean> {
  const client = await db_init();
  
  // Get stored OAuth token with refresh token
  const token = await getOAuthToken(userId, provider);
  if (!token || !token.RefreshToken) {
    return false;
  }
  
  try {
    const refreshEndpoint = OAUTH_REFRESH_ENDPOINTS[provider];
    
    const params: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: token.RefreshToken,
      client_id: process.env[`NEXT_PUBLIC_${provider.toUpperCase()}_CLIENT_ID`]!,
      client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]!
    };
    
    const response = await fetch(refreshEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams(params).toString()
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    
    // Update stored token
    await storeOAuthToken(
      userId,
      provider,
      data.access_token,
      data.refresh_token || token.RefreshToken, // Some providers don't return new refresh token
      data.expires_in
    );
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create a secure authentication middleware function
 */
export async function createAuthMiddleware(): Promise<{
  validateRequest: (sessionToken: string, userAgent?: string, ipAddress?: string) => Promise<{
    valid: boolean;
    user?: User;
    newSessionToken?: string;
  }>;
}> {
  // Track suspicious activity
  const suspiciousActivity = new Map<string, number>();
  
  return {
    validateRequest: async (sessionToken: string, userAgent?: string, ipAddress?: string) => {
      // Check for suspicious activity (too many requests from same IP)
      if (ipAddress) {
        const requestCount = suspiciousActivity.get(ipAddress) || 0;
        if (requestCount > 100) { // 100 requests per minute threshold
          return { valid: false };
        }
        suspiciousActivity.set(ipAddress, requestCount + 1);
      }
      
      // Validate session
      const sessionData = await validateSession(sessionToken);
      
      if (!sessionData.valid || !sessionData.user) {
        return { valid: false };
      }
      
      // Return validated session with potential rotation
      if (sessionData.needsRotation) {
        const newToken = await rotateSession(sessionToken);
        return {
          valid: true,
          user: sessionData.user,
          newSessionToken: newToken || undefined
        };
      }
      
      return {
        valid: true,
        user: sessionData.user
      };
    }
  };
}

// Clear suspicious activity counter every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const suspiciousActivity = new Map<string, number>();
  }, 60 * 1000);
}
