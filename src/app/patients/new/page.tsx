'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dbClient } from '@/lib/db-client';
import { Assessment } from '@/lib/db-server';
import { User, Phone, MapPin, AlertCircle } from 'lucide-react';

export default function NewPatient() {
  const router = useRouter();
  
  // Form state
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState(''); // Raw input
  const [age, setAge] = useState('');
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [place, setPlace] = useState('');
  const [therapistName, setTherapistName] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [nextId, setNextId] = useState('Loading...');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load next patient ID & current datetime
  useEffect(() => {
    async function initForm() {
      try {
        const patients = await dbClient.getPatients();
        let nextNum = 100;
        if (patients.length > 0) {
          const ids = patients.map(p => {
            const match = p.patientId.match(/^C(\d+)$/);
            return match ? parseInt(match[1], 10) : 99;
          });
          const maxId = Math.max(...ids, 99);
          nextNum = maxId + 1;
        }
        setNextId(`C${nextNum}`);

        // Prefill values are set dynamically on submit
      } catch (e) {
        console.error('Error preloading patient ID', e);
        setNextId('C100');
      }
    }
    initForm();
  }, []);

  // Calculate age when dob changes (DOB must be in DD/MM/YYYY format)
  useEffect(() => {
    if (!dob) {
      setAge('');
      return;
    }

    // Basic format validation: DD/MM/YYYY
    const match = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
      setAge('Enter DOB in DD/MM/YYYY');
      return;
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);

    const birthDate = new Date(year, month, day);
    const today = new Date();

    if (isNaN(birthDate.getTime()) || birthDate > today) {
      setAge('Invalid Date of Birth');
      return;
    }

    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
      years--;
      months += 12;
    }
    if (today.getDate() < birthDate.getDate()) {
      months--;
    }
    if (months < 0) {
      months += 12;
    }

    if (years === 0) {
      setAge(`${months} month${months !== 1.0 ? 's' : ''}`);
    } else {
      setAge(`${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`);
    }
  }, [dob]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Field validation
    if (!name.trim()) return setErrorMsg('Patient Name is required.');
    if (!gender) return setErrorMsg('Gender is required.');
    if (!dob.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return setErrorMsg('Date of Birth must be in DD/MM/YYYY format.');
    }
    if (age.includes('Invalid') || age.includes('Enter')) {
      return setErrorMsg('Please enter a valid Date of Birth.');
    }
    if (!therapistName.trim()) return setErrorMsg('Therapist Name is required.');

    setSubmitting(true);

    try {
      // 1. Save Patient
      const savedPatient = await dbClient.savePatient({
        name: name.trim(),
        gender,
        dob,
        age,
        parentName: parentName.trim(),
        phone: phone.trim(),
        place: place.trim()
      });

      // 2. Generate Assessment details
      const assessmentId = Math.random().toString(36).substring(2, 9) + '-' + Date.now();
      const startTime = new Date().toTimeString().split(' ')[0]; // HH:MM:SS (24-hour format)
      
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const autoAssessmentDate = `${dd}/${mm}/${yyyy}`;

      const newAssessment: Assessment = {
        id: assessmentId,
        assessmentId,
        patientId: savedPatient.patientId,
        therapistName: therapistName.trim(),
        assessmentDate: autoAssessmentDate,
        startTime,
        endTime: '',
        duration: '',
        notes: notes.trim(),
        createdAt: new Date().toISOString()
      };

      // 3. Save Assessment
      await dbClient.saveAssessment(newAssessment);

      // 4. Redirect to testing screen
      router.push(`/assessment/${assessmentId}`);
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to register patient or start session. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg border border-border shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-2">
          New Patient Registry
        </h1>
        <p className="text-sm text-slate-500 font-medium border-b border-border pb-4 mb-6">
          Register demographic data and configure assessment start parameters.
        </p>

        {errorMsg && (
          <div className="mb-6 bg-red-50 border border-red-200 text-danger p-4 rounded text-sm font-semibold flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Demographic Card Group */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
              1. Patient Demographics
            </h2>
            
            {/* Auto Generated ID */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Patient ID (Auto Generated)
              </label>
              <input
                type="text"
                value={nextId}
                disabled
                className="w-full p-2.5 rounded border border-slate-200 bg-slate-100 font-bold text-slate-700 cursor-not-allowed"
              />
            </div>

            {/* Patient Name */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Patient Name <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Full name of child"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded border border-border bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Gender <span className="text-danger">*</span>
              </label>
              <div className="flex space-x-4">
                {['Male', 'Female', 'Other'].map(g => (
                  <label key={g} className="flex items-center space-x-2 font-semibold text-slate-700 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={gender === g}
                      onChange={(e) => setGender(e.target.value)}
                      className="h-4 w-4 text-primary focus:ring-primary border-slate-300"
                    />
                    <span>{g}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* DOB & Age */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Date of Birth <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full p-2.5 rounded border border-border bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                />
                <span className="text-[10px] text-slate-400 font-semibold block mt-1">E.g., 13/06/2022</span>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Calculated Age
                </label>
                <input
                  type="text"
                  value={age}
                  disabled
                  placeholder="Computed age from DOB"
                  className="w-full p-2.5 rounded border border-slate-200 bg-slate-100 font-bold text-slate-700 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Place */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Place / Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <MapPin className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Place of residence"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded border border-border bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                />
              </div>
            </div>
          </div>

          {/* Parent Info Card Group */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
              2. Parent / Guardian Details
            </h2>

            {/* Parent Name */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Parent / Guardian Name
              </label>
              <input
                type="text"
                placeholder="Parent or guardian full name"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="w-full p-2.5 rounded border border-border bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Contact Phone Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Phone className="h-4 w-4" />
                </span>
                <input
                  type="tel"
                  placeholder="Phone number for sync & reports"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded border border-border bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                />
              </div>
            </div>
          </div>

          {/* Therapist/Session Config Group */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
              3. Clinical Session Setup
            </h2>

            {/* Therapist Name */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Therapist Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter your clinical name"
                value={therapistName}
                onChange={(e) => setTherapistName(e.target.value)}
                className="w-full p-2.5 rounded border border-border bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
              />
            </div>

            {/* Assessment Date is automatically generated as today's date */}

            {/* Clinical Notes */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Clinical Session Notes / Observations
              </label>
              <textarea
                placeholder="Initial comments, referral source, reasons for assessment..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 rounded border border-border bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-blue-600 transition disabled:opacity-50 text-base"
          >
            {submitting ? 'Registering & Initializing...' : 'Register Patient & Begin Evaluation'}
          </button>
        </form>
      </div>
    </div>
  );
}
