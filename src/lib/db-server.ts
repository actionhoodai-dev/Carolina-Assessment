import fs from 'fs';
import path from 'path';
import { SEED_QUESTIONS, Question } from './questions-seed';

const DB_FILE = path.join(process.cwd(), 'db.json');

export interface Patient {
  id: string;
  patientId: string; // e.g. C100, C101
  name: string;
  gender: string;
  dob: string; // DD/MM/YYYY
  age: string;
  parentName: string;
  phone: string;
  place: string;
  createdAt: string;
}

export interface Assessment {
  id: string;
  assessmentId: string;
  patientId: string;
  therapistName: string;
  assessmentDate: string; // DD/MM/YYYY
  startTime: string; // HH:MM:SS
  endTime: string; // HH:MM:SS
  duration: string; // e.g., "15 minutes" or "00:15:24"
  notes: string;
  createdAt: string;
}

export interface Response {
  id: string;
  assessmentId: string;
  questionId: string;
  answer: 'YES' | 'NO' | 'NOT_TESTED';
}

interface DbSchema {
  patients: Patient[];
  assessments: Assessment[];
  responses: Response[];
}

let memoryDb: DbSchema = {
  patients: [],
  assessments: [],
  responses: []
};

let dbLoaded = false;

function initializeDb(): DbSchema {
  if (dbLoaded) {
    return memoryDb;
  }

  if (!fs.existsSync(DB_FILE)) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), 'utf8');
    } catch (e) {
      console.warn('Vercel or Read-only filesystem detected. Running database in-memory.');
    }
    dbLoaded = true;
    return memoryDb;
  }
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    memoryDb = JSON.parse(content);
    dbLoaded = true;
    return memoryDb;
  } catch (error) {
    console.error('Error reading DB file, returning empty schema', error);
    dbLoaded = true;
    return memoryDb;
  }
}

function saveDb(data: DbSchema) {
  memoryDb = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    // Gracefully catch read-only filesystem errors on Vercel
  }
}

export const dbServer = {
  replaceDb(patients: Patient[], assessments: Assessment[], responses: Response[]) {
    const data = initializeDb();
    
    // Merge patients: keep sheets ones, plus local ones not in sheets
    const mergedPatients = [...patients];
    for (const cp of data.patients) {
      if (!mergedPatients.some(p => p.patientId === cp.patientId)) {
        mergedPatients.push(cp);
      }
    }

    // Merge assessments: keep sheets ones, plus local ones not in sheets
    const mergedAssessments = [...assessments];
    for (const ca of data.assessments) {
      if (!mergedAssessments.some(a => a.assessmentId === ca.assessmentId)) {
        mergedAssessments.push(ca);
      }
    }

    // Merge responses: keep sheets ones, plus local ones where assessmentId & questionId are not in sheets responses
    const mergedResponses = [...responses];
    for (const cr of data.responses) {
      if (!mergedResponses.some(r => r.assessmentId === cr.assessmentId && r.questionId === cr.questionId)) {
        mergedResponses.push(cr);
      }
    }

    saveDb({
      patients: mergedPatients,
      assessments: mergedAssessments,
      responses: mergedResponses
    });
  },

  getQuestions(): Question[] {
    return SEED_QUESTIONS;
  },

  getPatients(): Patient[] {
    const data = initializeDb();
    return data.patients;
  },

  getPatientById(patientId: string): Patient | undefined {
    const data = initializeDb();
    return data.patients.find(p => p.patientId === patientId);
  },

  savePatient(patient: Omit<Patient, 'id' | 'patientId' | 'createdAt'>): Patient {
    const data = initializeDb();
    
    // Auto-generate patient ID: C100, C101...
    // Rule: Next patient ID = highest existing patient ID + 1. Start at C100 if none.
    let nextNum = 100;
    if (data.patients.length > 0) {
      const ids = data.patients.map(p => {
        const match = p.patientId.match(/^C(\d+)$/);
        return match ? parseInt(match[1], 10) : 99;
      });
      const maxId = Math.max(...ids, 99);
      nextNum = maxId + 1;
    }
    const patientId = `C${nextNum}`;

    const newPatient: Patient = {
      ...patient,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      patientId,
      createdAt: new Date().toISOString()
    };

    data.patients.push(newPatient);
    saveDb(data);
    return newPatient;
  },

  getAssessments(): Assessment[] {
    const data = initializeDb();
    return data.assessments;
  },

  getAssessmentById(assessmentId: string): Assessment | undefined {
    const data = initializeDb();
    return data.assessments.find(a => a.assessmentId === assessmentId);
  },

  getAssessmentsByPatientId(patientId: string): Assessment[] {
    const data = initializeDb();
    return data.assessments.filter(a => a.patientId === patientId);
  },

  saveAssessment(assessment: Omit<Assessment, 'createdAt'>): Assessment {
    const data = initializeDb();
    
    // Check if assessment already exists to update notes/endTime/duration, otherwise create
    const idx = data.assessments.findIndex(a => a.assessmentId === assessment.assessmentId);
    const newAssessment: Assessment = {
      ...assessment,
      createdAt: idx >= 0 ? data.assessments[idx].createdAt : new Date().toISOString()
    };

    if (idx >= 0) {
      data.assessments[idx] = newAssessment;
    } else {
      data.assessments.push(newAssessment);
    }
    
    saveDb(data);
    return newAssessment;
  },

  getResponses(assessmentId: string): Response[] {
    const data = initializeDb();
    return data.responses.filter(r => r.assessmentId === assessmentId);
  },

  saveResponses(assessmentId: string, responses: Omit<Response, 'id'>[]): Response[] {
    const data = initializeDb();
    
    // Remove existing responses for this assessment to prevent duplicates
    data.responses = data.responses.filter(r => r.assessmentId !== assessmentId);

    const newResponses: Response[] = responses.map(r => ({
      ...r,
      assessmentId,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)
    }));

    data.responses.push(...newResponses);
    saveDb(data);
    return newResponses;
  },

  saveSingleResponse(assessmentId: string, questionId: string, answer: 'YES' | 'NO' | 'NOT_TESTED'): Response {
    const data = initializeDb();
    const idx = data.responses.findIndex(r => r.assessmentId === assessmentId && r.questionId === questionId);
    
    const response: Response = {
      id: idx >= 0 ? data.responses[idx].id : (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
      assessmentId,
      questionId,
      answer
    };

    if (idx >= 0) {
      data.responses[idx] = response;
    } else {
      data.responses.push(response);
    }

    saveDb(data);
    return response;
  }
};
