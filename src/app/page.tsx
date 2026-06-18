'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { dbClient } from '@/lib/db-client';
import { Patient, Assessment } from '@/lib/db-server';
import { Users, ClipboardCheck, Calendar, UserPlus, Search, ArrowRight, Activity, FileText } from 'lucide-react';

export default function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load cached data first for instant layout
    const cachedPatients = dbClient.getCachedPatients();
    const cachedAssessments = dbClient.getCachedAssessments();
    if (cachedPatients.length > 0 || cachedAssessments.length > 0) {
      setPatients(cachedPatients.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setAssessments(cachedAssessments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    }

    async function loadDashboardData() {
      try {
        // Fetch fresh data from the server in parallel immediately
        const [loadedPatients, loadedAssessments] = await Promise.all([
          dbClient.getPatients(),
          dbClient.getAssessments()
        ]);
        
        setPatients(loadedPatients.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setAssessments(loadedAssessments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLoading(false);

        // Run sync in the background without blocking the UI
        const syncQueueKey = 'cdas_sync_queue';
        const hasQueuedItems = typeof window !== 'undefined' && 
          JSON.parse(localStorage.getItem(syncQueueKey) || '[]').length > 0;

        if (hasQueuedItems) {
          dbClient.runSync().then(async () => {
            const currentQueue = JSON.parse(localStorage.getItem(syncQueueKey) || '[]');
            if (currentQueue.length === 0) {
              console.log('Background sync complete, refetching dashboard data...');
              const [syncedPatients, syncedAssessments] = await Promise.all([
                dbClient.getPatients(),
                dbClient.getAssessments()
              ]);
              setPatients(syncedPatients.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
              setAssessments(syncedAssessments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            }
          }).catch(err => {
            console.error('Background sync failed:', err);
          });
        }
      } catch (error) {
        console.error('Error loading dashboard data', error);
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // Compute metrics
  const totalPatients = patients.length;
  const totalAssessments = assessments.length;
  
  // Today's assessments: date matches today's date in local DD/MM/YYYY
  const todayStr = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
  const todaysAssessmentsCount = assessments.filter(a => a.assessmentDate === todayStr).length;

  const recentPatients = patients.slice(0, 5);
  const recentAssessments = assessments.slice(0, 5);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-slate-600 font-medium animate-pulse">Initializing dashboard stats...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Clinician Welcome Banner */}
      <div className="bg-white p-6 rounded-lg border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Carolina Developmental Assessment</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Digital evaluation platform for child growth and sequence benchmarks.</p>
        </div>
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-primary border border-blue-100 text-xs font-bold uppercase tracking-wider">
          <Activity className="h-4 w-4" />
          <span>System Online</span>
        </div>
      </div>

      {/* Landing Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/patients/new"
          className="flex items-center justify-between p-6 rounded-lg bg-primary text-white hover:bg-blue-600 transition shadow-sm group"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/10 rounded-lg">
              <UserPlus className="h-8 w-8" />
            </div>
            <div className="text-left">
              <span className="block text-xl font-bold">New Patient</span>
              <span className="text-xs text-white/80 font-medium">Register details & start assessment</span>
            </div>
          </div>
          <ArrowRight className="h-6 w-6 transform group-hover:translate-x-1.5 transition" />
        </Link>

        <Link
          href="/patients/search"
          className="flex items-center justify-between p-6 rounded-lg bg-secondary text-white hover:bg-slate-800 transition shadow-sm group"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/10 rounded-lg">
              <Search className="h-8 w-8" />
            </div>
            <div className="text-left">
              <span className="block text-xl font-bold">Existing Patient</span>
              <span className="text-xs text-white/80 font-medium">Search profile, logs & reports</span>
            </div>
          </div>
          <ArrowRight className="h-6 w-6 transform group-hover:translate-x-1.5 transition" />
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-primary rounded">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-sm text-slate-500 font-bold uppercase tracking-wider">Total Patients</span>
            <span className="text-2xl font-bold text-slate-800">{totalPatients}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-green-50 text-success rounded">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-sm text-slate-500 font-bold uppercase tracking-wider">Total Assessments</span>
            <span className="text-2xl font-bold text-slate-800">{totalAssessments}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-500 rounded">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-sm text-slate-500 font-bold uppercase tracking-wider">Today&apos;s Sessions</span>
            <span className="text-2xl font-bold text-slate-800">{todaysAssessmentsCount}</span>
          </div>
        </div>
      </div>

      {/* Dashboard Tables (Recents) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Patients */}
        <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Recent Patients</h2>
            <Link href="/patients/search" className="text-xs font-semibold text-primary hover:underline">
              View All
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentPatients.length > 0 ? (
              recentPatients.map(patient => (
                <div key={patient.patientId} className="p-4 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <span className="block font-bold text-slate-800 text-sm">{patient.name}</span>
                    <span className="text-xs text-slate-500 font-semibold">ID: {patient.patientId} • Age: {patient.age}</span>
                  </div>
                  <Link 
                    href={`/patients/search?query=${patient.patientId}`}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No patients registered yet. Click &quot;New Patient&quot; above to start.
              </div>
            )}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Recent Reports</h2>
            <Link href="/patients/search" className="text-xs font-semibold text-primary hover:underline">
              Search Logs
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentAssessments.length > 0 ? (
              recentAssessments.map(assessment => {
                const pat = patients.find(p => p.patientId === assessment.patientId);
                return (
                  <div key={assessment.assessmentId} className="p-4 flex justify-between items-center hover:bg-slate-50">
                    <div>
                      <span className="block font-bold text-slate-800 text-sm">{pat ? pat.name : 'Unknown Patient'}</span>
                      <span className="text-xs text-slate-500 font-semibold">
                        ID: {assessment.patientId} • Date: {assessment.assessmentDate}
                      </span>
                    </div>
                    <Link
                      href={`/reports/${assessment.assessmentId}`}
                      className="flex items-center space-x-1 text-xs font-bold text-primary bg-blue-50 px-2.5 py-1.5 rounded hover:bg-blue-100 transition"
                    >
                      <FileText className="h-3 w-3" />
                      <span>Report</span>
                    </Link>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No assessments conducted yet. Register a patient to conduct one.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
