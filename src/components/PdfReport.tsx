'use client';

import { useState } from 'react';
import { Question } from '@/lib/questions-seed';
import { Patient, Assessment, Response } from '@/lib/db-server';
import { FileDown, ClipboardCheck, ArrowRight, User, Calendar, MapPin, Phone } from 'lucide-react';
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
      const { jsPDF } = await import('jspdf');

      // Initialize A4 PDF (210mm x 297mm)
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // --- PAGE 1: COVER PAGE ---
      // Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text('CAROLINA DEVELOPMENTAL ASSESSMENT SYSTEM (CDAS)', 15, 22);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-505
      doc.text('Clinical Assessment Report', 15, 27);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('Clinical Document\nConfidential', 195, 23, { align: 'right' });

      // Thick horizontal line
      doc.setDrawColor(30, 41, 59); // slate-800
      doc.setLineWidth(0.6);
      doc.line(15, 32, 195, 32);

      // Info Columns Layout
      // Column 1: Patient Info (x: 15 to 100)
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 138); // blue-900 / primary
      doc.text('PATIENT INFORMATION', 15, 43);

      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.3);
      doc.line(15, 45, 100, 45);

      const patientFields = [
        { label: 'Name:', value: patient.name, bold: true },
        { label: 'Patient ID:', value: patient.patientId, bold: true },
        { label: 'Gender:', value: patient.gender },
        { label: 'DOB:', value: patient.dob },
        { label: 'Age:', value: patient.age },
        { label: 'Residence:', value: patient.place || 'N/A' }
      ];

      let patientY = 51;
      patientFields.forEach(f => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139);
        doc.text(f.label, 15, patientY);

        doc.setFont('Helvetica', f.bold ? 'bold' : 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(f.value, 42, patientY);
        patientY += 6.5;
      });

      // Column 2: Assessment Details (x: 110 to 195)
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 138);
      doc.text('ASSESSMENT DETAILS', 110, 43);

      doc.line(110, 45, 195, 45);

      const assessmentFields = [
        { label: 'Therapist:', value: assessment.therapistName || 'N/A', bold: true },
        { label: 'Date:', value: assessment.assessmentDate },
        { label: 'Parent Name:', value: patient.parentName || 'N/A' },
        { label: 'Parent Phone:', value: patient.phone || 'N/A' }
      ];

      let assessmentY = 51;
      assessmentFields.forEach(f => {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139);
        doc.text(f.label, 110, assessmentY);

        doc.setFont('Helvetica', f.bold ? 'bold' : 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(f.value, 142, assessmentY);
        assessmentY += 6.5;
      });

      // Score Summary Section
      const summaryY = Math.max(patientY, assessmentY) + 5;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 138);
      doc.text('EVALUATION SCORE SUMMARY', 15, summaryY);
      doc.line(15, summaryY + 2, 195, summaryY + 2);

      // Score cards background
      const cardWidth = 42;
      const cardHeight = 16;
      const cardY = summaryY + 5;
      const cardData = [
        { title: 'TOTAL ITEMS', value: totalQuestions, bgColor: [241, 245, 249], textCol: [30, 41, 59] }, // slate-100
        { title: 'YES (PASSED)', value: yesCount, bgColor: [240, 253, 250], textCol: [22, 163, 74] },   // emerald-50/600
        { title: 'NO (FAILED)', value: noCount, bgColor: [254, 242, 242], textCol: [220, 38, 38] },    // red-50/600
        { title: 'NOT TESTED', value: notTestedCount, bgColor: [248, 250, 252], textCol: [100, 116, 139] } // slate-50/500
      ];

      cardData.forEach((c, idx) => {
        const cardX = 15 + idx * (cardWidth + 4);
        
        // Draw background card
        doc.setFillColor(c.bgColor[0], c.bgColor[1], c.bgColor[2]);
        doc.rect(cardX, cardY, cardWidth, cardHeight, 'F');
        
        // Card Border
        doc.setDrawColor(226, 232, 240);
        doc.rect(cardX, cardY, cardWidth, cardHeight, 'S');

        // Draw Card Title
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(c.title, cardX + cardWidth / 2, cardY + 5, { align: 'center' });

        // Draw Card Value
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(c.textCol[0], c.textCol[1], c.textCol[2]);
        doc.text(String(c.value), cardX + cardWidth / 2, cardY + 12, { align: 'center' });
      });

      // Therapist Notes Section
      const notesY = cardY + cardHeight + 10;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 138);
      doc.text('THERAPIST NOTES & CLINICAL OBSERVATIONS', 15, notesY);
      doc.line(15, notesY + 2, 195, notesY + 2);

      const notesText = assessment.notes || 'No notes or specific clinical observations recorded for this assessment session.';
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);

      // Split text to fit page width (180mm minus padding = 172mm)
      const splitNotes = doc.splitTextToSize(notesText, 172);
      const notesBoxHeight = splitNotes.length * 5.2 + 8;

      // Draw background box for notes
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(15, notesY + 5, 180, notesBoxHeight, 'F');
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(15, notesY + 5, 180, notesBoxHeight, 'S');

      // Draw Notes text lines
      let noteLineY = notesY + 11;
      doc.setFont('Helvetica', assessment.notes ? 'normal' : 'italic');
      splitNotes.forEach((line: string) => {
        doc.text(line, 19, noteLineY);
        noteLineY += 5.2;
      });

      // --- PAGE 2: QUESTION BREAKDOWNS ---
      doc.addPage();

      const drawTableHeader = (y: number) => {
        doc.setFillColor(30, 58, 138); // primary theme blue
        doc.rect(15, y, 180, 8, 'F');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);

        doc.text('ID', 17, y + 5.5);
        doc.text('Domain', 29, y + 5.5);
        doc.text('Age Level', 72.5, y + 5.5, { align: 'center' });
        doc.text('Curriculum Sequence Text', 82, y + 5.5);
        doc.text('Response', 185, y + 5.5, { align: 'center' });
      };

      let currentY = 20;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 138);
      doc.text('QUESTION RESPONSE BREAKDOWNS', 15, currentY);
      currentY += 4;
      
      drawTableHeader(currentY);
      currentY += 8;

      questions.forEach((q, idx) => {
        const ans = responseMap.get(q.questionId) || 'NOT_TESTED';
        const splitQuestion = doc.splitTextToSize(q.question, 91);
        const splitDomain = doc.splitTextToSize(q.domain, 34);
        const textLines = Math.max(splitQuestion.length, splitDomain.length);
        const rowHeight = textLines * 4.5 + 4; // 4.5mm per line plus padding

        if (currentY + rowHeight > 280) {
          doc.addPage();
          currentY = 20;
          drawTableHeader(currentY);
          currentY += 8;
        }

        // Row background
        const isEven = idx % 2 === 0;
        doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255); // alternating background colors
        doc.rect(15, currentY, 180, rowHeight, 'F');

        // Draw Cells Content
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59); // slate-800
        doc.text(q.questionId, 17, currentY + 4.5);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105); // slate-600
        let domainLineY = currentY + 4.5;
        splitDomain.forEach((line: string) => {
          doc.text(line, 29, domainLineY);
          domainLineY += 4.5;
        });

        doc.text(`${q.ageLevel} yrs`, 72.5, currentY + 4.5, { align: 'center' });

        doc.setTextColor(15, 23, 42); // slate-900
        let questionLineY = currentY + 4.5;
        splitQuestion.forEach((line: string) => {
          doc.text(line, 82, questionLineY);
          questionLineY += 4.5;
        });

        // Response styling (color coded)
        doc.setFont('Helvetica', 'bold');
        if (ans === 'YES') {
          doc.setTextColor(22, 163, 74); // green-600 (PASSED)
        } else if (ans === 'NO') {
          doc.setTextColor(220, 38, 38); // red-600 (FAILED)
        } else {
          doc.setTextColor(100, 116, 139); // slate-500 (NOT TESTED)
        }
        doc.text(ans, 185, currentY + 4.5, { align: 'center' });

        // Cell border line (subtle)
        doc.setDrawColor(241, 245, 249); // slate-100
        doc.setLineWidth(0.1);
        doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

        currentY += rowHeight;
      });

      // --- POST-PROCESSING: PAGE NUMBERS & HEADERS ---
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // slate-400
        
        doc.text('Carolina Developmental Assessment System (CDAS)', 15, 287);
        doc.text(`Page ${i} of ${totalPages}`, 195, 287, { align: 'right' });
        
        if (i >= 2) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(`Patient: ${patient.name} (${patient.patientId})`, 15, 12);
          doc.text(`Assessment Date: ${assessment.assessmentDate}`, 195, 12, { align: 'right' });
          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.2);
          doc.line(15, 14, 195, 14);
        }
      }

      // Save PDF
      doc.save(`CDAS_Assessment_Report_${patient.patientId}.pdf`);
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
    </div>
  );
}
