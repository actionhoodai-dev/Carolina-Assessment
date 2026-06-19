import { Patient, Assessment, Response, dbServer } from './db-server';

const WEB_APP_URL = process.env.GOOGLE_SHEETS_WEB_APP_URL;

if (!WEB_APP_URL) {
  console.warn(
    'Google Sheets Integration is offline. To enable, configure GOOGLE_SHEETS_WEB_APP_URL in your environment variables.'
  );
}

async function postToSheets(payload: any) {
  if (!WEB_APP_URL) return;

  try {
    const res = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    if (!res.ok) {
      console.error(`Failed to sync to Google Sheets. Status: ${res.status}`);
      return;
    }

    const data = await res.json();
    if (!data.success) {
      console.error('Apps Script reported failure on sync:', data.error);
    } else {
      console.log('Successfully synced data to Google Sheets.');
    }
  } catch (error) {
    console.error('Error sending request to Google Sheets Web App:', error);
  }
}

export async function pullFromGoogleSheets() {
  if (!WEB_APP_URL) return;

  try {
    const res = await fetch(WEB_APP_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      redirect: 'follow',
      cache: 'no-store'
    });

    if (!res.ok) {
      console.warn(`Failed to pull from Google Sheets. Status: ${res.status}`);
      return;
    }

    const data = await res.json();
    if (!data.success) {
      console.warn('Apps Script reported failure on pull:', data.error);
      return;
    }

    // Map patients
    const patients: Patient[] = (data.patients || []).map((gp: any) => ({
      id: gp.PatientID ? gp.PatientID.toString() : Math.random().toString(),
      patientId: gp.PatientID ? gp.PatientID.toString() : '',
      name: gp.Name ? gp.Name.toString() : '',
      dob: gp.DOB ? gp.DOB.toString() : '',
      age: gp.Age ? gp.Age.toString() : '',
      gender: gp.Gender ? gp.Gender.toString() : '',
      parentName: gp.ParentName ? gp.ParentName.toString() : '',
      phone: gp.Phone ? gp.Phone.toString() : '',
      place: gp.Address ? gp.Address.toString() : '',
      createdAt: gp.CreatedAt ? gp.CreatedAt.toString() : new Date().toISOString()
    }));

    // Map assessments
    const assessments: Assessment[] = (data.assessments || []).map((ga: any) => ({
      id: ga.AssessmentID ? ga.AssessmentID.toString() : '',
      assessmentId: ga.AssessmentID ? ga.AssessmentID.toString() : '',
      patientId: ga.PatientID ? ga.PatientID.toString() : '',
      therapistName: ga.Therapist ? ga.Therapist.toString() : '',
      assessmentDate: ga.AssessmentDate ? ga.AssessmentDate.toString() : '',
      startTime: ga.StartTime ? ga.StartTime.toString() : '',
      endTime: ga.EndTime ? ga.EndTime.toString() : '',
      duration: ga.Duration ? ga.Duration.toString() : '',
      notes: ga.Notes ? ga.Notes.toString() : '',
      createdAt: ga.CreatedAt ? ga.CreatedAt.toString() : new Date().toISOString()
    }));

    // Map responses
    const responses: Response[] = (data.responses || []).map((gr: any) => ({
      id: Math.random().toString(),
      assessmentId: gr.AssessmentID ? gr.AssessmentID.toString() : '',
      questionId: gr.QuestionID ? gr.QuestionID.toString() : '',
      answer: gr.Response ? gr.Response.toString() as 'YES' | 'NO' | 'NOT_TESTED' : 'NOT_TESTED'
    }));

    // Overwrite local database state
    dbServer.replaceDb(patients, assessments, responses);
    console.log('Successfully pulled and synchronized database from Google Sheets.');
  } catch (error) {
    console.warn('Error pulling from Google Sheets (running in offline fallback mode):', error);
  }
}

export async function syncPatientToGoogleSheets(patient: Patient) {
  await postToSheets({
    action: 'syncPatient',
    patient
  });
}

export async function syncAssessmentToGoogleSheets(assessment: Assessment) {
  // Calculate score counts from responses
  const allResponses = dbServer.getResponses(assessment.assessmentId);
  const yesCount = allResponses.filter(r => r.answer === 'YES').length;
  const noCount = allResponses.filter(r => r.answer === 'NO').length;
  const notTestedCount = allResponses.filter(r => r.answer === 'NOT_TESTED').length;

  await postToSheets({
    action: 'syncAssessment',
    assessment,
    counts: {
      yesCount,
      noCount,
      notTestedCount
    }
  });
}

export async function syncResponsesToGoogleSheets(assessmentId: string, responsesToSync: Response[]) {
  const assessment = dbServer.getAssessmentById(assessmentId);
  if (!assessment) {
    console.warn(`Assessment ${assessmentId} not found, skipping responses sync.`);
    return;
  }

  const patient = dbServer.getPatientById(assessment.patientId);
  const patientName = patient ? patient.name : 'Unknown';

  // Get all seed questions to look up question text/domain
  const questions = dbServer.getQuestions();
  const questionMap = new Map<string, typeof questions[0]>();
  questions.forEach(q => questionMap.set(q.questionId, q));

  const formattedResponses = responsesToSync.map(r => {
    const qInfo = questionMap.get(r.questionId);
    return {
      questionId: r.questionId,
      domain: qInfo ? qInfo.domain : 'Unknown',
      ageLevel: qInfo ? qInfo.ageLevel : '',
      questionText: qInfo ? qInfo.question : '',
      answer: r.answer
    };
  });

  await postToSheets({
    action: 'syncResponses',
    assessmentId,
    patientId: assessment.patientId,
    patientName,
    responses: formattedResponses
  });
}
