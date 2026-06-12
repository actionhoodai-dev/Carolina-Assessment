'use client';

import { useState } from 'react';
import { Question } from '@/lib/questions-seed';
import { Patient, Assessment, Response } from '@/lib/db-server';
import { FileDown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PdfReportProps {
  patient: Patient;
  assessment: Assessment;
  questions: Question[];
  responses: Response[];
}

export default function PdfReport({ patient, assessment, questions, responses }: PdfReportProps) {
  const [filterType, setFilterType] = useState<'ALL' | 'YES' | 'NO' | 'NOT_TESTED'>('ALL');
  const [downloading, setDownloading] = useState(false);

  // Map responses for easy lookup
  const responseMap = new Map<string, string>();
  responses.forEach(r => {
    responseMap.set(r.questionId, r.answer);
  });

  // Calculate statistics only for screen filters, not for report display
  const totalQuestions = questions.length;
  const yesCount = responses.filter(r => r.answer === 'YES').length;
  const noCount = responses.filter(r => r.answer === 'NO').length;
  const notTestedCount = responses.filter(r => r.answer === 'NOT_TESTED').length;

  // Filtered rows for the screen-only table
  const filteredQuestions = questions.filter(q => {
    const ans = responseMap.get(q.questionId) || 'NOT_TESTED';
    if (filterType === 'ALL') return true;
    return ans === filterType;
  });

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const page1Element = document.getElementById('report-page-1');
      const page2Element = document.getElementById('report-page-2');

      if (!page1Element || !page2Element) {
        throw new Error('Report sections not found in DOM.');
      }

      // Generate page 1 canvas
      const canvas1 = await html2canvas(page1Element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData1 = canvas1.toDataURL('image/png');

      // Initialize A4 PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;

      // Draw Page 1
      const imgHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
      pdf.addImage(imgData1, 'PNG', 0, 0, pdfWidth, imgHeight1);

      // Generate page 2 canvas (which includes the entire full table)
      // Since it can be very long, we temporarily unhide it from display constraints
      const canvas2 = await html2canvas(page2Element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData2 = canvas2.toDataURL('image/png');

      // Draw Page 2 and slice across subsequent pages
      const imgHeight2 = (canvas2.height * pdfWidth) / canvas2.width;
      let heightLeft = imgHeight2;
      let position = 0;

      pdf.addPage();
      pdf.addImage(imgData2, 'PNG', 0, position, pdfWidth, imgHeight2);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight2;
        pdf.addPage();
        pdf.addImage(imgData2, 'PNG', 0, position, pdfWidth, imgHeight2);
        heightLeft -= pdfHeight;
      }

      // Save PDF
      pdf.save(`CDAS_Assessment_Report_${patient.patientId}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Error generating PDF report. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Control Panel (no-print) */}
      <div className="bg-white p-4 rounded-lg border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 no-print shadow-sm">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Assessment Report</h1>
            <p className="text-xs text-slate-500 font-semibold">Patient: {patient.name} ({patient.patientId})</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Table filter options */}
          <div className="flex rounded border border-border overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-2 ${filterType === 'ALL' ? 'bg-secondary text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              All ({totalQuestions})
            </button>
            <button
              onClick={() => setFilterType('YES')}
              className={`px-3 py-2 border-l border-border ${filterType === 'YES' ? 'bg-success text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              YES ({yesCount})
            </button>
            <button
              onClick={() => setFilterType('NO')}
              className={`px-3 py-2 border-l border-border ${filterType === 'NO' ? 'bg-danger text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              NO ({noCount})
            </button>
            <button
              onClick={() => setFilterType('NOT_TESTED')}
              className={`px-3 py-2 border-l border-border ${filterType === 'NOT_TESTED' ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              Not Tested ({notTestedCount})
            </button>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary text-white rounded font-bold text-xs hover:bg-blue-600 transition disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            <span>{downloading ? 'Downloading...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* A4 Page Layout Container */}
      <div 
        id="a4-report" 
        className="bg-white border border-slate-300 p-8 md:p-12 shadow-md max-w-[210mm] mx-auto text-black font-sans leading-normal relative"
      >
        {/* Page 1: Demographics Cover Page */}
        <div id="report-page-1" className="bg-white pb-6">
          {/* PDF Header Section */}
          <div className="border-b-2 border-slate-800 pb-4 mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                Carolina Developmental Assessment System (CDAS)
              </h1>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Clinical Assessment Report
              </p>
            </div>
            <div className="text-right text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Clinical Document<br />Confidential
            </div>
          </div>

          {/* Info Grid (Demographics + Therapist) */}
          <div className="grid grid-cols-2 gap-6 text-sm mb-6 border-b border-slate-200 pb-6">
            {/* Patient Details */}
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider border-b border-slate-100 pb-1 mb-2">
                Patient Information
              </h3>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Name:</span>
                <span className="col-span-2 font-bold text-slate-900">{patient.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Patient ID:</span>
                <span className="col-span-2 font-bold text-slate-900">{patient.patientId}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Gender:</span>
                <span className="col-span-2 font-semibold text-slate-800">{patient.gender}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">DOB:</span>
                <span className="col-span-2 font-semibold text-slate-800">{patient.dob}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Age:</span>
                <span className="col-span-2 font-semibold text-slate-800">{patient.age}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Place:</span>
                <span className="col-span-2 font-semibold text-slate-800">{patient.place || 'N/A'}</span>
              </div>
            </div>

            {/* Assessment / Parent Details */}
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider border-b border-slate-100 pb-1 mb-2">
                Assessment Details
              </h3>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Therapist:</span>
                <span className="col-span-2 font-bold text-slate-900">{assessment.therapistName || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500 font-medium">Date:</span>
                <span className="col-span-2 font-semibold text-slate-800">{assessment.assessmentDate}</span>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Parent / Guardian</span>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-500 font-medium">Name:</span>
                  <span className="col-span-2 font-semibold text-slate-800">{patient.parentName || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-500 font-medium">Phone:</span>
                  <span className="col-span-2 font-semibold text-slate-800">{patient.phone || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Clinician Notes Section */}
          {assessment.notes && (
            <div className="border border-slate-200 p-4 rounded">
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Therapist Notes</h4>
              <p className="text-sm text-slate-800 italic whitespace-pre-line">{assessment.notes}</p>
            </div>
          )}
        </div>

        {/* Page break before table in print view */}
        <div className="hidden print:block print-page-break mb-6"></div>

        {/* Page 2: Question Report Section */}
        <div id="report-page-2" className="bg-white pt-4">
          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-3">
            Question Response Breakdowns
          </h3>
          
          {/* 1. Screen Only Table (Filterable by YES/NO/NOT_TESTED) */}
          <table className="w-full text-left border-collapse text-xs border border-slate-200 print:hidden">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <th className="p-2 border-r border-slate-200 w-16">ID</th>
                <th className="p-2 border-r border-slate-200 w-32">Domain</th>
                <th className="p-2 border-r border-slate-200 w-16">Age Level</th>
                <th className="p-2 border-r border-slate-200">Curriculum Sequence Text</th>
                <th className="p-2 w-20 text-center">Response</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.length > 0 ? (
                filteredQuestions.map((q) => {
                  const ans = responseMap.get(q.questionId) || 'NOT_TESTED';
                  return (
                    <tr key={q.questionId} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-900 border-r border-slate-200">{q.questionId}</td>
                      <td className="p-2 text-slate-600 border-r border-slate-200 font-medium">{q.domain}</td>
                      <td className="p-2 text-slate-600 border-r border-slate-200 text-center font-medium">{q.ageLevel} yrs</td>
                      <td className="p-2 text-slate-800 border-r border-slate-200">{q.question}</td>
                      <td className="p-2 font-bold text-center text-slate-800">
                        {ans}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500 font-semibold">
                    No sequences found matching the filter selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* 2. Print Only Table (Always displays ALL 372 questions for the physical PDF) */}
          <table className="w-full text-left border-collapse text-xs border border-slate-200 hidden print:table">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <th className="p-2 border-r border-slate-200 w-16">ID</th>
                <th className="p-2 border-r border-slate-200 w-32">Domain</th>
                <th className="p-2 border-r border-slate-200 w-16">Age Level</th>
                <th className="p-2 border-r border-slate-200">Curriculum Sequence Text</th>
                <th className="p-2 w-20 text-center">Response</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => {
                const ans = responseMap.get(q.questionId) || 'NOT_TESTED';
                return (
                  <tr key={q.questionId} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 font-bold text-slate-900 border-r border-slate-200">{q.questionId}</td>
                    <td className="p-2 text-slate-600 border-r border-slate-200 font-medium">{q.domain}</td>
                    <td className="p-2 text-slate-600 border-r border-slate-200 text-center font-medium">{q.ageLevel} yrs</td>
                    <td className="p-2 text-slate-800 border-r border-slate-200">{q.question}</td>
                    <td className="p-2 font-bold text-center text-slate-800">
                      {ans}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer info */}
          <div className="mt-12 pt-8 border-t border-slate-200 text-xs text-slate-400">
            <p>Carolina Developmental Assessment System (CDAS)</p>
            <p className="mt-1">Generated on {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
