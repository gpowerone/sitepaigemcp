import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageid');

    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Download the image from Supabase storage
    const { data, error } = await supabase
      .storage
      .from('images')
      .download(`${imageId}`);

    if (error || !data) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: 404 }
      );
    }

    // Convert blob to base64
    const buffer = await data.arrayBuffer();
    const base64String = Buffer.from(buffer).toString('base64');
    
    // Return the base64-encoded image
    return NextResponse.json({ 
      image: base64String 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve image' },
      { status: 500 }
    );
  }
} 