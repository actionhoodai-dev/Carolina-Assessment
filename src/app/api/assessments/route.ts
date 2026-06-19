import { NextRequest, NextResponse } from 'next/server';
import { dbServer } from '@/lib/db-server';
import { syncAssessmentToGoogleSheets } from '@/lib/google-sheets';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');
    
    let assessments;
    if (patientId) {
      assessments = dbServer.getAssessmentsByPatientId(patientId);
    } else {
      assessments = dbServer.getAssessments();
    }
    
    return NextResponse.json(assessments);
  } catch (error) {
    console.error('Error fetching assessments:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { assessmentId, patientId, therapistName, assessmentDate, startTime, endTime, duration, notes } = body;
    
    if (!assessmentId || !patientId) {
      return NextResponse.json({ error: 'assessmentId and patientId are required' }, { status: 400 });
    }

    const saved = dbServer.saveAssessment({
      id: assessmentId,
      assessmentId,
      patientId,
      therapistName: therapistName || '',
      assessmentDate: assessmentDate || '',
      startTime: startTime || '',
      endTime: endTime || '',
      duration: duration || '',
      notes: notes || ''
    });

    // Sync to Google Sheets in background
    syncAssessmentToGoogleSheets(saved).catch(err => {
      console.error('Error syncing assessment to Google Sheets:', err);
    });

    return NextResponse.json(saved);
  } catch (error) {
    console.error('Error saving assessment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
