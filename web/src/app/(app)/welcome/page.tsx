'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { apiFetch } from '../../../lib/api';

type PatientMember = {
  _id: string;
};

type CreatePatientPayload = {
  fullName: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  relationship?: string;
  phone?: string;
  notes?: string;
};

export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePatientPayload>({
    fullName: '',
    dob: '',
    gender: 'male',
    relationship: 'self',
    phone: '',
    notes: '',
  });

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      if (user.role !== 'patient') {
        router.replace('/dashboard');
        return;
      }
      try {
        const members = await apiFetch<PatientMember[]>('/patients/my');
        if ((members || []).length > 0) {
          router.replace('/home');
          return;
        }
      } finally {
        setChecking(false);
      }
    };
    run();
  }, [router, user]);

  if (checking) {
    return null;
  }

  const canSubmit = form.fullName.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: CreatePatientPayload = {
        fullName: form.fullName.trim(),
        dob: form.dob?.trim() ? form.dob.trim() : undefined,
        gender: form.gender,
        relationship: form.relationship?.trim() ? form.relationship.trim() : undefined,
        phone: form.phone?.trim() ? form.phone.trim() : undefined,
        notes: form.notes?.trim() ? form.notes.trim() : undefined,
      };
      await apiFetch('/patients', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      router.replace('/home');
    } catch (e: any) {
      setError(e?.message || 'Failed to create profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen relative overflow-x-hidden bg-gradient-to-b from-[#0254b7] via-[#0157D8] to-[#013A9C] text-white">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

      <div className="min-h-screen px-6 py-10 flex flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/15 ring-1 ring-white/25 grid place-items-center backdrop-blur">
              <span className="text-sm font-semibold tracking-tight">Dr</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">DrApp</div>
              <div className="text-[11px] text-white/70">Getting started</div>
            </div>
          </div>

          <button
            className="text-[11px] font-semibold text-white/80 hover:text-white transition-colors"
            onClick={() => router.push('/home')}
          >
            Skip
          </button>
        </header>

        <div className="flex-1 flex flex-col justify-center">
          <div className="mx-auto w-full max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/20 px-3 py-1 text-[11px] text-white/85 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              One-time setup
            </div>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight leading-[1.15]">
              Welcome{user?.name ? `, ${user.name}` : ''}.
              <br />
              Let’s complete your profile.
            </h1>

            <p className="mt-3 text-[13px] leading-6 text-white/75">
              Add your details (or a family member) so you can manage appointments, documents, and medical records.
            </p>

            <div className="mt-8 rounded-3xl bg-white/10 ring-1 ring-white/20 backdrop-blur p-6 shadow-2xl shadow-black/20">
              {!showForm ? (
                <>
                  <div className="text-xs font-semibold text-white/90">Next step</div>
                  <div className="mt-2 text-base font-semibold tracking-tight">Create your first member profile</div>
                  <p className="mt-2 text-[13px] leading-6 text-white/75">You can edit these details anytime later.</p>

                  <button
                    className="mt-5 w-full bg-white text-[#0254b7] rounded-xl py-2.5 text-xs font-semibold shadow-lg shadow-black/20 active:scale-[0.99] transition-transform"
                    onClick={() => {
                      setShowForm(true);
                      setForm((prev) => ({ ...prev, phone: user?.mobile || prev.phone }));
                    }}
                  >
                    Complete Profile
                  </button>

                  <button
                    className="mt-3 w-full rounded-xl py-2.5 text-xs font-semibold text-white/85 ring-1 ring-white/25 hover:bg-white/10 transition-colors"
                    onClick={() => router.push('/home')}
                  >
                    Not now
                  </button>
                </>
              ) : (
                <>
                  <div className="text-xs font-semibold text-white/90">Complete profile</div>
                  <div className="mt-2 text-base font-semibold tracking-tight">Member details</div>

                  {error ? (
                    <div className="mt-3 rounded-xl bg-red-500/15 ring-1 ring-red-200/30 px-3 py-2 text-[12px] text-red-50">
                      {error}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3">
                    <input
                      className="w-full rounded-xl bg-white/10 ring-1 ring-white/20 px-3 py-2.5 text-[13px] text-white placeholder:text-white/45 outline-none focus:ring-white/35"
                      placeholder="Full name"
                      value={form.fullName}
                      onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className="w-full rounded-xl bg-white/10 ring-1 ring-white/20 px-3 py-2.5 text-[13px] text-white placeholder:text-white/45 outline-none focus:ring-white/35"
                        type="date"
                        value={form.dob || ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, dob: e.target.value }))}
                      />
                      <select
                        className="w-full rounded-xl bg-white/10 ring-1 ring-white/20 px-3 py-2.5 text-[13px] text-white outline-none focus:ring-white/35"
                        value={form.gender || 'male'}
                        onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value as any }))}
                      >
                        <option value="male" className="text-gray-900">
                          Male
                        </option>
                        <option value="female" className="text-gray-900">
                          Female
                        </option>
                        <option value="other" className="text-gray-900">
                          Other
                        </option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className="w-full rounded-xl bg-white/10 ring-1 ring-white/20 px-3 py-2.5 text-[13px] text-white placeholder:text-white/45 outline-none focus:ring-white/35"
                        placeholder="Relationship (self)"
                        value={form.relationship || ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, relationship: e.target.value }))}
                      />
                      <input
                        className="w-full rounded-xl bg-white/10 ring-1 ring-white/20 px-3 py-2.5 text-[13px] text-white placeholder:text-white/45 outline-none focus:ring-white/35"
                        placeholder="Phone (optional)"
                        value={form.phone || ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <textarea
                      className="w-full min-h-[90px] rounded-xl bg-white/10 ring-1 ring-white/20 px-3 py-2.5 text-[13px] text-white placeholder:text-white/45 outline-none focus:ring-white/35"
                      placeholder="Notes (optional)"
                      value={form.notes || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>

                  <button
                    className={`mt-5 w-full rounded-xl py-2.5 text-xs font-semibold shadow-lg shadow-black/20 active:scale-[0.99] transition-transform ${
                      canSubmit && !submitting
                        ? 'bg-white text-[#0254b7]'
                        : 'bg-white/50 text-[#0254b7] cursor-not-allowed'
                    }`}
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                  >
                    {submitting ? 'Saving...' : 'Save & Continue'}
                  </button>

                  <button
                    className="mt-3 w-full rounded-xl py-2.5 text-xs font-semibold text-white/85 ring-1 ring-white/25 hover:bg-white/10 transition-colors"
                    onClick={() => setShowForm(false)}
                    disabled={submitting}
                  >
                    Back
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <footer className="mt-6 text-center text-[11px] text-white/65">
          By continuing, you agree to our Terms & Privacy Policy.
        </footer>
      </div>
    </main>
  );
}
