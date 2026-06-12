'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { dbClient } from '@/lib/db-client';
import { Patient, Assessment } from '@/lib/db-server';
import { Search, User, Calendar, PlusCircle, FileText, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('query') || '';

  // Data states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(true);

  // UI toggle states
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [quickAssessPatient, setQuickAssessPatient] = useState<Patient | null>(null);
  const [therapistName, setTherapistName] = useState('');
  const [startError, setStartError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const loadedPatients = await dbClient.getPatients();
        const loadedAssessments = await dbClient.getAssessments();
        setPatients(loadedPatients);
        setAssessments(loadedAssessments);
      } catch (e) {
        console.error('Error loading search directories', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter patients based on query (ID or Name)
  const filteredPatients = patients.filter(p => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return p.patientId.toLowerCase().includes(query) || p.name.toLowerCase().includes(query);
  });

  // Helper to find latest assessment date for a patient
  const getLastAssessmentDate = (patientId: string): string => {
    const patientAssessments = assessments
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return patientAssessments.length > 0 ? patientAssessments[0].assessmentDate : 'No assessment yet';
  };

  // Helper to get all assessments for a patient
  const getPatientAssessments = (patientId: string): Assessment[] => {
    return assessments
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const handleCreateNewAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartError('');
    if (!quickAssessPatient) return;
    if (!therapistName.trim()) {
      setStartError('Therapist Name is required to start.');
      return;
    }

    try {
      const assessmentId = Math.random().toString(36).substring(2, 9) + '-' + Date.now();
      const startTime = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
      
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const assessmentDate = `${dd}/${mm}/${yyyy}`;

      const newAssessment: Assessment = {
        id: assessmentId,
        assessmentId,
        patientId: quickAssessPatient.patientId,
        therapistName: therapistName.trim(),
        assessmentDate,
        startTime,
        endTime: '',
        duration: '',
        notes: '',
        createdAt: new Date().toISOString()
      };

      await dbClient.saveAssessment(newAssessment);
      router.push(`/assessment/${assessmentId}`);
    } catch {
      setStartError('Failed to initialize assessment. Please retry.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading directories...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Search Input Card */}
      <div className="bg-white p-6 rounded-lg border border-border shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-1">
          Patient Search & Directory
        </h1>
        <p className="text-xs text-slate-500 font-semibold mb-4">
          Query by ID or Name to start assessments, view summaries, or examine previous records.
        </p>

        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="h-5 w-5" />
          </span>
          <input
            type="text"
            placeholder="Search by Patient ID (e.g. C100) or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-3 rounded border border-border bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium text-sm"
          />
        </div>
      </div>

      {/* Quick Start Assessment Overlay Modal */}
      {quickAssessPatient && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-border max-w-sm w-full p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Start New Assessment</h3>
            <p className="text-xs text-slate-500 font-semibold mb-4">
              Patient: {quickAssessPatient.name} ({quickAssessPatient.patientId})
            </p>

            {startError && (
              <div className="mb-4 bg-red-50 text-danger p-3 rounded text-xs font-semibold flex items-center space-x-1.5 border border-red-200">
                <AlertCircle className="h-4 w-4" />
                <span>{startError}</span>
              </div>
            )}

            <form onSubmit={handleCreateNewAssessment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Therapist Name
                </label>
                <input
                  type="text"
                  placeholder="Enter therapist name..."
                  value={therapistName}
                  onChange={(e) => setTherapistName(e.target.value)}
                  className="w-full p-2.5 rounded border border-border text-sm font-medium"
                />
              </div>

              <div className="flex space-x-2 pt-2 text-xs font-bold uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => {
                    setQuickAssessPatient(null);
                    setTherapistName('');
                    setStartError('');
                  }}
                  className="flex-1 py-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-border text-center transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded bg-primary text-white hover:bg-blue-600 text-center transition"
                >
                  Begin Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Directory Search Results */}
      <div className="space-y-4">
        {filteredPatients.length > 0 ? (
          filteredPatients.map(patient => {
            const isExpanded = expandedPatientId === patient.patientId;
            const patientAssessments = getPatientAssessments(patient.patientId);
            const lastDate = getLastAssessmentDate(patient.patientId);

            return (
              <div key={patient.patientId} className="bg-white rounded-lg border border-border shadow-sm overflow-hidden transition">
                {/* Result Card Header Row */}
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-lg flex items-center">
                      <User className="h-4 w-4 text-slate-400 mr-1.5 flex-shrink-0" />
                      {patient.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Patient ID: <span className="text-slate-800 font-bold">{patient.patientId}</span> • Age: {patient.age}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Last Assessment</span>
                    <span className="text-xs font-semibold text-slate-700 flex items-center mt-0.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 mr-1" />
                      {lastDate}
                    </span>
                  </div>
                </div>

                {/* Main Action Buttons */}
                <div className="px-4 pb-4 border-b border-slate-100 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
                  <button
                    onClick={() => setQuickAssessPatient(patient)}
                    className="flex items-center space-x-1 px-3 py-2 bg-primary text-white hover:bg-blue-600 rounded transition"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>New Assessment</span>
                  </button>

                  <button
                    onClick={() => setExpandedPatientId(isExpanded ? null : patient.patientId)}
                    className="flex items-center space-x-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-border rounded transition"
                  >
                    <span>View Profile & Reports</span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Expanded Profile and Historical Assessment Reports Panel */}
                {isExpanded && (
                  <div className="bg-slate-50 p-4 border-t border-slate-100 text-sm space-y-4">
                    {/* Patient Profile Demographics Metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded border border-border text-xs font-semibold">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Demographics</span>
                        <div>Place: <span className="text-slate-800">{patient.place || 'N/A'}</span></div>
                        <div>Gender: <span className="text-slate-800">{patient.gender}</span></div>
                        <div>Date of Birth: <span className="text-slate-800">{patient.dob}</span></div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Parent Information</span>
                        <div>Guardian: <span className="text-slate-800">{patient.parentName || 'N/A'}</span></div>
                        <div>Phone: <span className="text-slate-800">{patient.phone || 'N/A'}</span></div>
                        <div>Registered: <span className="text-slate-800">{new Date(patient.createdAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>

                    {/* Historical Reports List */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Previous Assessment Reports ({patientAssessments.length})
                      </h4>
                      <div className="space-y-2">
                        {patientAssessments.length > 0 ? (
                          patientAssessments.map(ass => (
                            <div key={ass.assessmentId} className="flex justify-between items-center p-3 bg-white border border-border rounded hover:bg-slate-50 transition">
                              <div>
                                <span className="block text-xs font-bold text-slate-700">
                                  Assessment Session
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                                  Therapist: {ass.therapistName || 'Staff'} • Date: {ass.assessmentDate} • Duration: {ass.duration || 'Incomplete'}
                                </span>
                              </div>

                              <div className="flex items-center space-x-1.5 text-xs font-bold">
                                {ass.endTime ? (
                                  <a
                                    href={`/reports/${ass.assessmentId}`}
                                    className="flex items-center space-x-1 bg-green-50 text-success border border-green-200 px-2.5 py-1.5 rounded hover:bg-green-100 transition"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    <span>View Report</span>
                                  </a>
                                ) : (
                                  <a
                                    href={`/assessment/${ass.assessmentId}`}
                                    className="flex items-center space-x-1 bg-amber-50 text-amber-500 border border-amber-200 px-2.5 py-1.5 rounded hover:bg-amber-100 transition animate-pulse"
                                  >
                                    <PlusCircle className="h-3.5 w-3.5" />
                                    <span>Resume</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 italic">No assessments conducted yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white p-8 rounded-lg border border-border text-center shadow-sm">
            <p className="text-slate-500 font-semibold">No patients found matching your search.</p>
            <p className="text-xs text-slate-400 mt-1">Check the spelling or register a new patient profile.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PatientSearch() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading search component...</p>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
