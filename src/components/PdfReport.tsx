'use client';

import { useState } from 'react';
import { Question } from '@/lib/questions-seed';
import { Patient, Assessment, Response } from '@/lib/db-server';
import { FileDown, ArrowLeft, ClipboardCheck, ArrowRight, User, Calendar, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';

interface PdfReportProps {
  patient: Patient;
  assessment: Assessment;
  questions: Question[];
  responses: Response[];
}

export default function PdfReport({ patient, assessment, questions, responses }: PdfReportProps) {
  const [downloading, setDownloading] = useState(false);

  // Map responses for easy lookup
  const responseMap = new Map<string, string>();
  responses.forEach(r => {
    responseMap.set(r.questionId, r.answer);
  });

  const totalQuestions = questions.length;
  const yesCount = responses.filter(r => r.answer === 'YES').length;
  const noCount = responses.filter(r => r.answer === 'NO').length;
  const notTestedCount = responses.filter(r => r.answer === 'NOT_TESTED').length;

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
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* On-Screen Responsive Portal UI */}
      <div className="bg-white rounded-lg border border-border shadow-sm p-6 space-y-6">
        
        {/* Success Header */}
        <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-border">
          <div className="p-3 bg-emerald-50 rounded-full text-success">
            <ClipboardCheck className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Assessment Session Complete</h1>
            <p className="text-sm text-slate-500 font-semibold mt-1">
              All responses have been successfully compiled and saved to the patient log.
            </p>
          </div>
        </div>

        {/* Patient & Assessment Details Grid */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Session Summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-border text-sm">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Patient Name:</span>
                <span className="font-bold text-slate-900">{patient.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <ClipboardCheck className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Patient ID:</span>
                <span className="font-bold text-slate-900">{patient.patientId}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Residence:</span>
                <span className="font-semibold text-slate-800">{patient.place || 'N/A'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Evaluation Date:</span>
                <span className="font-semibold text-slate-800">{assessment.assessmentDate}</span>
              </div>
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Therapist:</span>
                <span className="font-semibold text-slate-800">{assessment.therapistName || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Parent Phone:</span>
                <span className="font-semibold text-slate-800">{patient.phone || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg transition disabled:opacity-50 text-base"
          >
            <FileDown className="h-5 w-5" />
            <span>{downloading ? 'Compiling PDF Report...' : 'Download Clinical PDF Report'}</span>
          </button>
          
          <Link
            href="/"
            className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-base"
          >
            <span>Return to Dashboard</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Off-screen A4 container for PDF rendering (hidden from UI, laid out by browser for html2canvas) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '210mm' }}>
        
        {/* Page 1: Demographics Cover Page */}
        <div 
          id="report-page-1" 
          className="bg-white text-black p-16 font-sans"
          style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
        >
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

        {/* Page 2: Question Report Section */}
        <div 
          id="report-page-2" 
          className="bg-white text-black p-16 font-sans"
          style={{ width: '210mm', boxSizing: 'border-box' }}
        >
          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-3">
            Question Response Breakdowns
          </h3>
          
          <table className="w-full text-left border-collapse text-xs border border-slate-200">
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
                  <tr key={q.questionId} className="border-b border-slate-200">
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
