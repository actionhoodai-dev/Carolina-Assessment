'use client';

import { useEffect, useState, use } from 'react';
import { dbClient } from '@/lib/db-client';
import { Patient, Assessment } from '@/lib/db-server';
import AssessmentFlow from '@/components/AssessmentFlow';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface AssessmentPageProps {
  params: Promise<{ id: string }>;
}

export default function ActiveAssessmentPage({ params }: AssessmentPageProps) {
  const { id: assessmentId } = use(params);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Try loading from local cache first for instant load
    const cachedAssessments = dbClient.getCachedAssessments();
    const cachedPatients = dbClient.getCachedPatients();
    const cachedAssessment = cachedAssessments.find(a => a.assessmentId === assessmentId);
    const cachedPatient = cachedAssessment ? cachedPatients.find(p => p.patientId === cachedAssessment.patientId) : null;

    if (cachedAssessment && cachedPatient) {
      setAssessment(cachedAssessment);
      setPatient(cachedPatient);
      setLoading(false);
    }

    async function loadAssessmentData() {
      try {
        // Fetch fresh assessments and patients in parallel
        const [loadedAssessments, loadedPatients] = await Promise.all([
          dbClient.getAssessments(),
          dbClient.getPatients()
        ]);

        const loadedAssessment = loadedAssessments.find(a => a.assessmentId === assessmentId);
        if (!loadedAssessment) {
          // If we already loaded a valid version from local storage cache, do not show error
          if (cachedAssessment && cachedPatient) {
            console.warn('Assessment not found on server during fetch, using cached local version.');
            return;
          }
          setErrorMsg('Assessment session not found.');
          setLoading(false);
          return;
        }
        setAssessment(loadedAssessment);

        const loadedPatient = loadedPatients.find(p => p.patientId === loadedAssessment.patientId);
        if (!loadedPatient) {
          if (cachedAssessment && cachedPatient) {
            console.warn('Patient not found on server during fetch, using cached local version.');
            return;
          }
          setErrorMsg('Patient demographics associated with this assessment not found.');
          setLoading(false);
          return;
        }
        setPatient(loadedPatient);
      } catch (e) {
        console.error('Error loading assessment page', e);
        if (!cachedAssessment || !cachedPatient) {
          setErrorMsg('An error occurred while loading this session.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadAssessmentData();
  }, [assessmentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading clinical testing wizard...</p>
      </div>
    );
  }

  if (errorMsg || !patient || !assessment) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white p-6 rounded-lg border border-border text-center shadow-sm space-y-4">
        <div className="inline-flex p-3 bg-red-50 text-danger rounded-full">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Session Error</h2>
        <p className="text-sm text-slate-500 font-medium leading-relaxed">{errorMsg || 'Could not load profile.'}</p>
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
    <div className="container py-2">
      <AssessmentFlow patient={patient} assessment={assessment} />
    </div>
  );
}
