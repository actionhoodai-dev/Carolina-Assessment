'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Question } from '@/lib/questions-seed';
import { Patient, Assessment } from '@/lib/db-server';
import { dbClient } from '@/lib/db-client';
import { Check, X, AlertTriangle, ChevronLeft, ChevronRight, Save } from 'lucide-react';

interface AssessmentFlowProps {
  patient: Patient;
  assessment: Assessment;
}

export default function AssessmentFlow({ patient, assessment }: AssessmentFlowProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, 'YES' | 'NO' | 'NOT_TESTED'>>({});
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // Navigation states
  const [activeDomain, setActiveDomain] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Load questions and existing responses
  useEffect(() => {
    async function loadData() {
      try {
        const loadedQuestions = await dbClient.getQuestions();
        setQuestions(loadedQuestions);
        
        if (loadedQuestions.length > 0) {
          // Set first domain as active
          const uniqueDomains = Array.from(new Set(loadedQuestions.map(q => q.domain)));
          setActiveDomain(uniqueDomains[0] || '');
        }

        const loadedResponses = await dbClient.getResponses(assessment.assessmentId);
        const responseMap: Record<string, 'YES' | 'NO' | 'NOT_TESTED'> = {};
        loadedResponses.forEach(r => {
          responseMap[r.questionId] = r.answer;
        });
        setResponses(responseMap);
      } catch (e) {
        console.error('Error loading assessment questions/responses', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [assessment.assessmentId]);

  // Filtered questions for active domain
  const domainQuestions = questions.filter(q => q.domain === activeDomain);
  const currentQuestion = domainQuestions[currentQuestionIndex];

  // List of unique domains
  const uniqueDomains = Array.from(new Set(questions.map(q => q.domain)));

  // Calculate stats
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(responses).length;
  const completionPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  
  const yesCount = Object.values(responses).filter(v => v === 'YES').length;
  const noCount = Object.values(responses).filter(v => v === 'NO').length;
  const notTestedCount = Object.values(responses).filter(v => v === 'NOT_TESTED').length;

  const handleAnswer = async (questionId: string, answer: 'YES' | 'NO' | 'NOT_TESTED') => {
    setSavingStatus('saving');
    
    // Update local React state
    setResponses(prev => ({
      ...prev,
      [questionId]: answer
    }));

    try {
      // Save locally & sync to server
      await dbClient.saveResponse(assessment.assessmentId, questionId, answer);
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 1000);
      
      // Auto advance to next question in the domain after brief delay (optional, let's keep it manual or auto-advance on click)
      if (currentQuestionIndex < domainQuestions.length - 1) {
        setTimeout(() => {
          setCurrentQuestionIndex(prev => prev + 1);
        }, 300);
      }
    } catch {
      setSavingStatus('error');
    }
  };

  const handleNextDomain = () => {
    const currentDomainIdx = uniqueDomains.indexOf(activeDomain);
    if (currentDomainIdx < uniqueDomains.length - 1) {
      setActiveDomain(uniqueDomains[currentDomainIdx + 1]);
      setCurrentQuestionIndex(0);
    }
  };

  const handlePrevDomain = () => {
    const currentDomainIdx = uniqueDomains.indexOf(activeDomain);
    if (currentDomainIdx > 0) {
      setActiveDomain(uniqueDomains[currentDomainIdx - 1]);
      setCurrentQuestionIndex(0);
    }
  };

  const handleFinish = async () => {
    // Save final details, recalculate end time and duration
    const endTime = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
    
    // Calculate duration
    let durationStr = '0 minutes';
    try {
      const [startH, startM, startS] = assessment.startTime.split(':').map(Number);
      const [endH, endM, endS] = endTime.split(':').map(Number);
      
      const startMs = (startH * 3600 + startM * 60 + startS) * 1000;
      const endMs = (endH * 3600 + endM * 60 + endS) * 1000;
      
      let diffMs = endMs - startMs;
      if (diffMs < 0) diffMs += 24 * 3600 * 1000; // handle cross-midnight
      
      const diffMins = Math.round(diffMs / (60 * 1000));
      durationStr = `${diffMins} minutes`;
    } catch {}

    const updatedAssessment: Assessment = {
      ...assessment,
      endTime,
      duration: durationStr
    };

    await dbClient.saveAssessment(updatedAssessment);
    router.push(`/reports/${assessment.assessmentId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading clinical assessment data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Patient Card Sticky Top */}
      <div className="bg-white p-4 rounded-lg border border-border shadow-sm">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{patient.name}</h2>
            <p className="text-sm text-slate-500 font-semibold">Patient ID: {patient.patientId} • Age: {patient.age}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-600 border border-border">
              {answeredCount}/{totalQuestions} Answered
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden border border-border">
          <div 
            className="bg-primary h-full transition-all duration-300" 
            style={{ width: `${completionPercent}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-slate-500 font-medium">
          <span>Overall Progress: {completionPercent}%</span>
          <span className="flex items-center space-x-1">
            {savingStatus === 'saving' && <span className="text-primary animate-pulse">Saving...</span>}
            {savingStatus === 'saved' && <span className="text-success flex items-center">Auto-saved <Check className="h-3 w-3 ml-0.5" /></span>}
            {savingStatus === 'error' && <span className="text-danger">Sync offline (Cached locally)</span>}
          </span>
        </div>
      </div>

      {/* Domain Navigation Selector */}
      <div className="bg-white p-4 rounded-lg border border-border shadow-sm space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
          Assessment Curriculum Domain
        </label>
        <select
          value={activeDomain}
          onChange={(e) => {
            setActiveDomain(e.target.value);
            setCurrentQuestionIndex(0);
          }}
          className="w-full p-2.5 rounded border border-border bg-slate-50 text-slate-800 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          {uniqueDomains.map(domain => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>
        
        {/* Domain Navigation Helpers */}
        <div className="flex justify-between items-center text-xs pt-1">
          <button 
            type="button" 
            onClick={handlePrevDomain} 
            disabled={uniqueDomains.indexOf(activeDomain) === 0}
            className="text-primary font-semibold disabled:text-slate-300 flex items-center"
          >
            <ChevronLeft className="h-4 w-4" /> Prev Domain
          </button>
          <span className="text-slate-500 font-medium">
            Domain {uniqueDomains.indexOf(activeDomain) + 1} of {uniqueDomains.length}
          </span>
          <button 
            type="button" 
            onClick={handleNextDomain} 
            disabled={uniqueDomains.indexOf(activeDomain) === uniqueDomains.length - 1}
            className="text-primary font-semibold disabled:text-slate-300 flex items-center"
          >
            Next Domain <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Current Question Card */}
      {currentQuestion ? (
        <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
          {/* Question Header Banner */}
          <div className="bg-slate-50 px-4 py-3 border-b border-border flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Sequence {currentQuestion.questionId}
            </span>
            <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
              Age Level: {currentQuestion.ageLevel} yrs
            </span>
          </div>

          {/* Question Description */}
          <div className="p-6 min-h-[140px] flex items-center justify-center">
            <p className="text-lg font-medium text-slate-800 text-center leading-relaxed">
              {currentQuestion.question}
            </p>
          </div>

          {/* Active Answers */}
          <div className="p-4 bg-slate-50 border-t border-border grid grid-cols-3 gap-2">
            <button
              onClick={() => handleAnswer(currentQuestion.questionId, 'YES')}
              className={`py-4 px-2 rounded-lg font-bold text-sm text-center border transition flex flex-col items-center justify-center space-y-1 ${
                responses[currentQuestion.questionId] === 'YES'
                  ? 'bg-success text-white border-success'
                  : 'bg-white text-slate-700 border-border hover:bg-slate-100'
              }`}
            >
              <Check className="h-5 w-5" />
              <span>YES</span>
            </button>
            <button
              onClick={() => handleAnswer(currentQuestion.questionId, 'NO')}
              className={`py-4 px-2 rounded-lg font-bold text-sm text-center border transition flex flex-col items-center justify-center space-y-1 ${
                responses[currentQuestion.questionId] === 'NO'
                  ? 'bg-danger text-white border-danger'
                  : 'bg-white text-slate-700 border-border hover:bg-slate-100'
              }`}
            >
              <X className="h-5 w-5" />
              <span>NO</span>
            </button>
            <button
              onClick={() => handleAnswer(currentQuestion.questionId, 'NOT_TESTED')}
              className={`py-4 px-2 rounded-lg font-bold text-sm text-center border transition flex flex-col items-center justify-center space-y-1 ${
                responses[currentQuestion.questionId] === 'NOT_TESTED'
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-700 border-border hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>NOT TESTED</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg border border-border text-center">
          <p className="text-slate-500 font-semibold">No questions found for this domain.</p>
        </div>
      )}

      {/* Navigation Buttons for Questions */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded bg-white text-slate-700 border border-border font-semibold hover:bg-slate-50 transition disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Previous</span>
        </button>

        <span className="text-sm text-slate-500 font-semibold">
          Question {currentQuestionIndex + 1} of {domainQuestions.length}
        </span>

        {currentQuestionIndex < domainQuestions.length - 1 ? (
          <button
            onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded bg-white text-slate-700 border border-border font-semibold hover:bg-slate-50 transition"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleNextDomain}
            disabled={uniqueDomains.indexOf(activeDomain) === uniqueDomains.length - 1}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded bg-primary text-white font-semibold hover:bg-blue-600 transition disabled:opacity-50"
          >
            <span>Next Domain</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Finish/Complete Action Block */}
      <div className="bg-white p-4 rounded-lg border border-border shadow-sm flex flex-col space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="font-semibold text-slate-600">Completion Status:</span>
          <span className="font-bold text-slate-800">{answeredCount}/{totalQuestions} questions ({completionPercent}%)</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-center text-slate-500 border-t border-border pt-3">
          <div>YES: <span className="text-success font-bold">{yesCount}</span></div>
          <div>NO: <span className="text-danger font-bold">{noCount}</span></div>
          <div>NOT TESTED: <span className="text-slate-700 font-bold">{notTestedCount}</span></div>
        </div>
        <button
          onClick={handleFinish}
          className="w-full flex items-center justify-center space-x-2 py-3 rounded bg-secondary text-white font-bold hover:bg-slate-800 transition"
        >
          <Save className="h-5 w-5" />
          <span>Complete & Generate Report</span>
        </button>
      </div>
    </div>
  );
}
