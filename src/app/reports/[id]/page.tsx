'use client';

import { useEffect, useState, use } from 'react';
import { dbClient } from '@/lib/db-client';
import { Patient, Assessment, Response } from '@/lib/db-server';
import { Question } from '@/lib/questions-seed';
import PdfReport from '@/components/PdfReport';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ReportPageProps {
  params: Promise<{ id: string }>;
}

export default function ClinicalReportPage({ params }: ReportPageProps) {
  const { id: assessmentId } = use(params);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Try loading from local cache first for instant load
    const cachedAssessments = dbClient.getCachedAssessments();
    const cachedPatients = dbClient.getCachedPatients();
    const cachedQuestions = dbClient.getCachedQuestions();
    const cachedResponses = dbClient.getCachedResponses(assessmentId);

    const cachedAssessment = cachedAssessments.find(a => a.assessmentId === assessmentId);
    const cachedPatient = cachedAssessment ? cachedPatients.find(p => p.patientId === cachedAssessment.patientId) : null;

    if (cachedAssessment && cachedPatient && cachedQuestions.length > 0) {
      setAssessment(cachedAssessment);
      setPatient(cachedPatient);
      setQuestions(cachedQuestions);
      setResponses(cachedResponses);
      setLoading(false);
    }

    async function loadReportData() {
      try {
        // Fetch fresh report data in parallel
        const [loadedAssessments, loadedPatients, loadedQuestions, loadedResponses] = await Promise.all([
          dbClient.getAssessments(),
          dbClient.getPatients(),
          dbClient.getQuestions(),
          dbClient.getResponses(assessmentId)
        ]);

        const loadedAssessment = loadedAssessments.find(a => a.assessmentId === assessmentId);
        if (!loadedAssessment) {
          setErrorMsg('Assessment session log not found.');
          setLoading(false);
          return;
        }
        setAssessment(loadedAssessment);

        const loadedPatient = loadedPatients.find(p => p.patientId === loadedAssessment.patientId);
        if (!loadedPatient) {
          setErrorMsg('Patient profile associated with this report not found.');
          setLoading(false);
          return;
        }
        setPatient(loadedPatient);

        setQuestions(loadedQuestions);
        setResponses(loadedResponses);
      } catch (e) {
        console.error('Error loading clinical report page', e);
        setErrorMsg('An error occurred while compilation.');
      } finally {
        setLoading(false);
      }
    }

    loadReportData();
  }, [assessmentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-slate-600 font-medium">Compiling medical report logs...</p>
      </div>
    );
  }

  if (errorMsg || !patient || !assessment) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white p-6 rounded-lg border border-border text-center shadow-sm space-y-4">
        <div className="inline-flex p-3 bg-red-50 text-danger rounded-full">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Report Error</h2>
        <p className="text-sm text-slate-500 font-medium leading-relaxed">{errorMsg || 'Could not load report.'}</p>
        <div className="pt-2 text-xs font-bold uppercase tracking-wider">
          <Link
            href="/"
            className="block w-full py-2.5 rounded bg-primary text-white hover:bg-blue-600 transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PdfReport
      patient={patient}
      assessment={assessment}
      questions={questions}
      responses={responses}
    />
  );
}
