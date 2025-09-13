import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '../../db-users';

/**
 * Example of a secure API route that requires authentication
 * This demonstrates how to properly validate sessions and protect endpoints
 */

export async function GET(request: NextRequest) {
  try {
    // Get session token from cookies
    const sessionCookie = await cookies();
    const sessionToken = sessionCookie.get('session_id')?.value;
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Validate session
    const sessionData = await validateSession(sessionToken);
    
    if (!sessionData.valid || !sessionData.user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }
    
    // Example: Return user-specific secure data
    return NextResponse.json({
      message: 'This is a secure endpoint',
      user: {
        id: sessionData.user.userid,
        name: sessionData.user.UserName,
        level: sessionData.user.UserLevel
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get session token from cookies
    const sessionCookie = await cookies();
    const sessionToken = sessionCookie.get('session_id')?.value;
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Validate session
    const sessionData = await validateSession(sessionToken);
    
    if (!sessionData.valid || !sessionData.user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    
    // Example: Only allow admins to perform certain actions
    if (body.adminAction && sessionData.user.UserLevel < 2) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    // Process the secure request
    return NextResponse.json({
      success: true,
      message: 'Secure action completed',
      performedBy: sessionData.user.UserName,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
