import { Patient, Assessment, Response } from './db-server';
import { Question } from './questions-seed';

const STORAGE_KEYS = {
  PATIENTS: 'cdas_patients',
  ASSESSMENTS: 'cdas_assessments',
  RESPONSES: 'cdas_responses',
  QUESTIONS: 'cdas_questions'
};

// Simple fetch wrapper to handle errors gracefully
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, options);
    if (res.ok) {
      return await res.json();
    }
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
  }
  return null;
}

export const dbClient = {
  // --- Questions ---
  async getQuestions(): Promise<Question[]> {
    if (typeof window === 'undefined') return [];
    
    // Check local storage first
    const cached = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }

    // Fetch from API
    const questions = await fetchJson<Question[]>('/api/questions');
    if (questions) {
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
      return questions;
    }
    return [];
  },

  // --- Patients ---
  async getPatients(): Promise<Patient[]> {
    if (typeof window === 'undefined') return [];

    // Attempt to fetch fresh from server
    const serverPatients = await fetchJson<Patient[]>('/api/patients');
    if (serverPatients) {
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(serverPatients));
      return serverPatients;
    }

    // Offline fallback
    const cached = localStorage.getItem(STORAGE_KEYS.PATIENTS);
    return cached ? JSON.parse(cached) : [];
  },

  async savePatient(patient: Omit<Patient, 'id' | 'patientId' | 'createdAt'>): Promise<Patient> {
    if (typeof window === 'undefined') {
      throw new Error('Window is undefined');
    }

    // Try saving on the server
    const saved = await fetchJson<Patient>('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient)
    });

    if (saved) {
      // Update local storage
      const patients = await this.getPatients();
      const updated = patients.filter(p => p.patientId !== saved.patientId);
      updated.push(saved);
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(updated));
      return saved;
    }

    // If server is offline, simulate locally (we use standard fallback ID generation)
    const cached = localStorage.getItem(STORAGE_KEYS.PATIENTS);
    const localPatients: Patient[] = cached ? JSON.parse(cached) : [];
    
    let nextNum = 100;
    if (localPatients.length > 0) {
      const ids = localPatients.map(p => {
        const match = p.patientId.match(/^C(\d+)$/);
        return match ? parseInt(match[1], 10) : 99;
      });
      const maxId = Math.max(...ids, 99);
      nextNum = maxId + 1;
    }
    const patientId = `C${nextNum}`;

    const tempPatient: Patient = {
      ...patient,
      id: Math.random().toString(36).substring(2, 9),
      patientId,
      createdAt: new Date().toISOString()
    };

    localPatients.push(tempPatient);
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(localPatients));
    
    // Store in a queue to sync later when online
    this.queueForSync('PATIENT', tempPatient);

    return tempPatient;
  },

  // --- Assessments ---
  async getAssessments(patientId?: string): Promise<Assessment[]> {
    if (typeof window === 'undefined') return [];

    let url = '/api/assessments';
    if (patientId) {
      url += `?patientId=${patientId}`;
    }

    const serverAssessments = await fetchJson<Assessment[]>(url);
    if (serverAssessments) {
      // Cache them locally
      const cached = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
      let localList: Assessment[] = cached ? JSON.parse(cached) : [];
      
      if (patientId) {
        // Replace matching patient ones
        localList = localList.filter(a => a.patientId !== patientId);
        localList.push(...serverAssessments);
      } else {
        localList = serverAssessments;
      }
      
      localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(localList));
      return serverAssessments;
    }

    // Offline fallback
    const cached = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
    const localList: Assessment[] = cached ? JSON.parse(cached) : [];
    if (patientId) {
      return localList.filter(a => a.patientId === patientId);
    }
    return localList;
  },

  async getAssessmentById(assessmentId: string): Promise<Assessment | null> {
    const assessments = await this.getAssessments();
    return assessments.find(a => a.assessmentId === assessmentId) || null;
  },

  async saveAssessment(assessment: Assessment): Promise<Assessment> {
    if (typeof window === 'undefined') return assessment;

    // Try server sync
    const saved = await fetchJson<Assessment>('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assessment)
    });

    // Update local cache
    const cached = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
    const localAssessments: Assessment[] = cached ? JSON.parse(cached) : [];
    const idx = localAssessments.findIndex(a => a.assessmentId === assessment.assessmentId);
    if (idx >= 0) {
      localAssessments[idx] = assessment;
    } else {
      localAssessments.push(assessment);
    }
    localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(localAssessments));

    if (!saved) {
      this.queueForSync('ASSESSMENT', assessment);
    }

    return assessment;
  },

  // --- Responses ---
  async getResponses(assessmentId: string): Promise<Response[]> {
    if (typeof window === 'undefined') return [];

    const url = `/api/assessments/responses?assessmentId=${assessmentId}`;
    const serverResponses = await fetchJson<Response[]>(url);
    if (serverResponses) {
      // Cache them locally
      const cached = localStorage.getItem(STORAGE_KEYS.RESPONSES);
      let localResponses: Response[] = cached ? JSON.parse(cached) : [];
      localResponses = localResponses.filter(r => r.assessmentId !== assessmentId);
      localResponses.push(...serverResponses);
      localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(localResponses));
      return serverResponses;
    }

    // Offline fallback
    const cached = localStorage.getItem(STORAGE_KEYS.RESPONSES);
    const localResponses: Response[] = cached ? JSON.parse(cached) : [];
    return localResponses.filter(r => r.assessmentId === assessmentId);
  },

  async saveResponse(assessmentId: string, questionId: string, answer: 'YES' | 'NO' | 'NOT_TESTED'): Promise<Response> {
    if (typeof window === 'undefined') {
      return { id: Math.random().toString(), assessmentId, questionId, answer };
    }

    // Update local cache immediately for fast offline UI feedback
    const cached = localStorage.getItem(STORAGE_KEYS.RESPONSES);
    const localResponses: Response[] = cached ? JSON.parse(cached) : [];
    const idx = localResponses.findIndex(r => r.assessmentId === assessmentId && r.questionId === questionId);
    
    const response: Response = {
      id: idx >= 0 ? localResponses[idx].id : Math.random().toString(36).substring(2, 9),
      assessmentId,
      questionId,
      answer
    };

    if (idx >= 0) {
      localResponses[idx] = response;
    } else {
      localResponses.push(response);
    }
    localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(localResponses));

    // Async server update
    fetchJson<Response>('/api/assessments/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId, questionId, answer })
    }).then(saved => {
      if (!saved) {
        this.queueForSync('RESPONSE', response);
      }
    });

    return response;
  },

  // --- Offline Sync Queue ---
  queueForSync(type: 'PATIENT' | 'ASSESSMENT' | 'RESPONSE', data: Patient | Assessment | Response) {
    if (typeof window === 'undefined') return;
    const key = 'cdas_sync_queue';
    const queue = JSON.parse(localStorage.getItem(key) || '[]');
    queue.push({ type, data, timestamp: Date.now() });
    localStorage.setItem(key, JSON.stringify(queue));
  },

  async runSync() {
    if (typeof window === 'undefined') return;
    const key = 'cdas_sync_queue';
    const queue = JSON.parse(localStorage.getItem(key) || '[]');
    if (queue.length === 0) return;

    console.log(`Running sync queue with ${queue.length} items...`);
    const remaining = [];

    for (const item of queue) {
      try {
        let success = false;
        if (item.type === 'PATIENT') {
          const res = await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
          });
          success = res.ok;
        } else if (item.type === 'ASSESSMENT') {
          const res = await fetch('/api/assessments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
          });
          success = res.ok;
        } else if (item.type === 'RESPONSE') {
          const res = await fetch('/api/assessments/responses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assessmentId: item.data.assessmentId,
              questionId: item.data.questionId,
              answer: item.data.answer
            })
          });
          success = res.ok;
        }

        if (!success) {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    localStorage.setItem(key, JSON.stringify(remaining));
  }
};
