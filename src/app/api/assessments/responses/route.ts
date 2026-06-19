import { NextRequest, NextResponse } from 'next/server';
import { dbServer } from '@/lib/db-server';
import { syncResponsesToGoogleSheets, pullFromGoogleSheets } from '@/lib/google-sheets';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assessmentId = searchParams.get('assessmentId');
    
    if (!assessmentId) {
      return NextResponse.json({ error: 'assessmentId is required' }, { status: 400 });
    }

    await pullFromGoogleSheets();
    const responses = dbServer.getResponses(assessmentId);
    return NextResponse.json(responses);
  } catch (error) {
    console.error('Error fetching responses:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Check if saving a list or a single response
    if (body.responses && Array.isArray(body.responses)) {
      const { assessmentId, responses } = body;
      if (!assessmentId) {
        return NextResponse.json({ error: 'assessmentId is required' }, { status: 400 });
      }
      const saved = dbServer.saveResponses(assessmentId, responses);
      
      // Sync list responses to Google Sheets in background
      syncResponsesToGoogleSheets(assessmentId, saved).catch(err => {
        console.error('Error syncing responses list to Google Sheets:', err);
      });

      return NextResponse.json(saved);
    } else {
      const { assessmentId, questionId, answer } = body;
      if (!assessmentId || !questionId || !answer) {
        return NextResponse.json({ error: 'assessmentId, questionId and answer are required' }, { status: 400 });
      }
      
      const saved = dbServer.saveSingleResponse(assessmentId, questionId, answer);
      
      // Sync single response to Google Sheets in background
      syncResponsesToGoogleSheets(assessmentId, [saved]).catch(err => {
        console.error('Error syncing single response to Google Sheets:', err);
      });

      return NextResponse.json(saved);
    }
  } catch (error) {
    console.error('Error saving response:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
