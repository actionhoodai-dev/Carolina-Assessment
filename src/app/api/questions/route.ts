import { NextResponse } from 'next/server';
import { dbServer } from '@/lib/db-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const questions = dbServer.getQuestions();
    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
