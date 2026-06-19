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
      console.error('Apps Script reported failure:', data.error);
    } else {
      console.log('Successfully synced data to Google Sheets.');
    }
  } catch (error) {
    console.error('Error sending request to Google Sheets Web App:', error);
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
