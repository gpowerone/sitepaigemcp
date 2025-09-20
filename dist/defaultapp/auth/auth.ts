import { cookies } from 'next/headers';

export async function check_auth(db: any, db_query: any): Promise<{ userid: string, UserLevel: number, UserTier: number, IsAdmin: boolean }> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;

  const sessionInfo = {
    userid: '',
    UserLevel: 0,
    UserTier: 0,
    IsAdmin: false
  };

  if (!sessionId) {
    return sessionInfo;
  }

  // SQLite is case-insensitive for identifiers, but use standard column names (no quotes, correct names)
  const session = await db_query(db, 'SELECT userid FROM UserSession WHERE SessionToken = ?', [sessionId]);
  if (session.length > 0) {
    sessionInfo.userid = session[0].userid;

    // In your Users table, the primary key is userid, and there is no IsAdmin column, but UserLevel (2 = admin)
    const user = await db_query(db, 'SELECT UserLevel, UserTier FROM Users WHERE userid = ?', [session[0].userid]);
    if (user.length > 0) {
      sessionInfo.UserLevel = user[0].UserLevel;
      sessionInfo.IsAdmin = user[0].UserLevel === 2;
      sessionInfo.UserTier = user[0].UserTier;
    }
  }
  return sessionInfo;
}
