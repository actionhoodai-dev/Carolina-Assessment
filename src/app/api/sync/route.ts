import { NextResponse } from 'next/server';
import { pullFromGoogleSheets } from '@/lib/google-sheets';

export async function POST() {
  try {
    await pullFromGoogleSheets();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in sync endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
