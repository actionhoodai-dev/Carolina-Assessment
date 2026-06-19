import { NextRequest, NextResponse } from 'next/server';
import { dbServer } from '@/lib/db-server';
import { syncPatientToGoogleSheets, pullFromGoogleSheets } from '@/lib/google-sheets';

export async function GET() {
  try {
    await pullFromGoogleSheets();
    const patients = dbServer.getPatients();
    return NextResponse.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    const { name, gender, dob, age, parentName, phone, place } = body;
    if (!name || !gender || !dob) {
      return NextResponse.json({ error: 'Name, gender and DOB are required' }, { status: 400 });
    }

    const saved = dbServer.savePatient({
      name,
      gender,
      dob,
      age: age || '',
      parentName: parentName || '',
      phone: phone || '',
      place: place || ''
    });

    // Sync to Google Sheets in background
    syncPatientToGoogleSheets(saved).catch(err => {
      console.error('Error syncing patient to Google Sheets:', err);
    });

    return NextResponse.json(saved);
  } catch (error) {
    console.error('Error creating patient:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
