'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { Logo } from '../../components/Logo';

type RegisterForm = {
  mobile: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  relationship?: string;
  phone?: string;
  notes?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const { registerPatient } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<RegisterForm>({
    mobile: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    dob: '',
    gender: 'male',
    relationship: 'self',
    phone: '',
    notes: '',
  });

  const canSubmit =
    form.mobile.trim().length === 10 &&
    form.password.length >= 6 &&
    form.password === form.confirmPassword &&
    form.fullName.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await registerPatient({
        mobile: form.mobile.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        dob: form.dob?.trim() ? form.dob.trim() : undefined,
        gender: form.gender,
        relationship: form.relationship?.trim() ? form.relationship.trim() : undefined,
        phone: form.phone?.trim() ? form.phone.trim() : undefined,
        notes: form.notes?.trim() ? form.notes.trim() : undefined,
      });
      router.replace('/home');
    } catch (e: any) {
      setError(e?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafafa] flex flex-col text-zinc-900 px-6 font-sans">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full pt-10 pb-8">
        <div className="flex flex-col items-center mb-10 text-center">
          <Logo size={160} className="mb-5" />
        </div>

        {error ? (
          <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-gray-700 ml-1">Phone Number</label>
            <div className="flex items-center w-full bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#0254b7] focus-within:ring-1 focus-within:ring-[#0254b7]/30 transition-all shadow-sm">
              <div className="pl-4 pr-3 py-4 text-[15px] text-gray-500 font-medium select-none bg-gray-50/50 border-r border-gray-100">
                +91
              </div>
              <input
                className="w-full bg-transparent px-4 py-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400"
                placeholder="Enter your phone number"
                type="tel"
                inputMode="tel"
                value={form.mobile}
                onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-gray-700 ml-1">Password</label>
            <input
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#0254b7] focus:ring-1 focus:ring-[#0254b7]/30 transition-all shadow-sm"
              type="password"
              placeholder="****************"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-gray-700 ml-1">Confirm Password</label>
            <input
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#0254b7] focus:ring-1 focus:ring-[#0254b7]/30 transition-all shadow-sm"
              type="password"
              placeholder="****************"
              value={form.confirmPassword}
              onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            />
          </div>

          <div className="mt-1 text-[13px] text-gray-500">
            Member details (self)
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-gray-700 ml-1">Full Name</label>
            <input
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#0254b7] focus:ring-1 focus:ring-[#0254b7]/30 transition-all shadow-sm"
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-gray-700 ml-1">DOB</label>
              <input
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-4 text-[15px] text-gray-900 outline-none focus:border-[#0254b7] focus:ring-1 focus:ring-[#0254b7]/30 transition-all shadow-sm"
                type="date"
                value={form.dob || ''}
                onChange={(e) => setForm((p) => ({ ...p, dob: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-gray-700 ml-1">Gender</label>
              <select
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-4 text-[15px] text-gray-900 outline-none focus:border-[#0254b7] focus:ring-1 focus:ring-[#0254b7]/30 transition-all shadow-sm"
                value={form.gender || 'male'}
                onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value as any }))}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-gray-700 ml-1">Relationship</label>
              <input
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#0254b7] focus:ring-1 focus:ring-[#0254b7]/30 transition-all shadow-sm"
                placeholder="self"
                value={form.relationship || ''}
                onChange={(e) => setForm((p) => ({ ...p, relationship: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-gray-700 ml-1">Member Phone</label>
              <input
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#0254b7] focus:ring-1 focus:ring-[#0254b7]/30 transition-all shadow-sm"
                placeholder="optional"
                value={form.phone || ''}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-gray-700 ml-1">Notes</label>
            <textarea
              className="w-full min-h-[90px] bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#0254b7] focus:ring-1 focus:ring-[#0254b7]/30 transition-all shadow-sm"
              placeholder="optional"
              value={form.notes || ''}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <button
            type="button"
            disabled={!canSubmit || submitting}
            className={`w-full rounded-full py-4 text-[17px] font-semibold mt-2 transition-all ${
              !canSubmit || submitting
                ? 'bg-blue-300 text-white/90 cursor-not-allowed shadow-none'
                : 'bg-[#0254b7] text-white shadow-lg shadow-blue-500/25 active:scale-[0.98]'
            }`}
            onClick={handleSubmit}
          >
            Register
          </button>

          <div className="mt-2 text-center text-[14px] text-gray-600">
            <button
              type="button"
              className="text-[#0254b7] font-semibold hover:underline underline-offset-2"
              onClick={() => router.push('/login')}
            >
              Already have an account? Sign In
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
