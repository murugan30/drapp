'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../lib/auth';
import { cachedFetch } from '../../../lib/offline';
import { apiFetch } from '../../../lib/api';
import TopHeader from '../../../components/TopHeader';
import BottomDrawer from '../../../components/BottomDrawer';
import styles from './patients.module.css';

type Patient = {
  _id: string;
  fullName: string;
  relationship?: string;
  phone?: string;
};

type CreateMemberPayload = {
  fullName: string;
  relationship?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  phone?: string;
  notes?: string;
};

type CreateStaffPatientPayload = CreateMemberPayload & {
  mobile: string;
  password?: string;
  confirmPassword?: string;
};

type MobileCheckState = 'idle' | 'checking' | 'existing' | 'new';

export default function PatientsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [offline, setOffline] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateMemberPayload>({
    fullName: '',
    relationship: 'self',
    dob: '',
    gender: 'male',
    phone: '',
    notes: '',
  });

  const [staffShowAdd, setStaffShowAdd] = useState(false);
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffMobile, setStaffMobile] = useState('');
  const [staffPatients, setStaffPatients] = useState<Patient[]>([]);
  const [staffListLoading, setStaffListLoading] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffTotal, setStaffTotal] = useState(0);
  const [staffPage, setStaffPage] = useState(1);
  const staffLimit = 20;
  const [mobileCheckState, setMobileCheckState] = useState<MobileCheckState>('idle');
  const [staffForm, setStaffForm] = useState<CreateStaffPatientPayload>({
    mobile: '',
    fullName: '',
    relationship: '',
    dob: '',
    gender: 'male',
    phone: '',
    notes: '',
    password: '',
    confirmPassword: '',
  });

  const loadMine = async () => {
    const res = await cachedFetch<Patient[]>('patients-my', '/patients/my');
    setPatients(res.data || []);
    setOffline(res.offline);
  };

  const loadStaffPatients = async (search: string, page: number) => {
    setStaffListLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(staffLimit));
      if (search.trim()) qs.set('q', search.trim());
      const res = await apiFetch<{ items: Patient[]; total: number; page: number }>(`/patients?${qs.toString()}`);
      setStaffPatients(res?.items || []);
      setStaffTotal(Number(res?.total || 0));
      setStaffPage(Number(res?.page || page));
    } catch {
      setStaffPatients([]);
    } finally {
      setStaffListLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'patient') return;
    if (patients.length === 0) return;
    const storageKey = `activeMemberId:${user.id}`;
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
    const exists = stored && patients.some((p) => p._id === stored);
    const nextId = exists ? stored : patients[0]!._id;
    setActiveMemberId(nextId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, nextId);
    }
  }, [patients, user]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      if (user.role === 'patient') {
        await loadMine();
      } else {
        await loadStaffPatients('', 1);
      }
    };
    load();
  }, [user]);

  const canSave = form.fullName.trim().length > 0;

  const handleCreateMember = async () => {
    if (!user || user.role !== 'patient') return;
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload: CreateMemberPayload = {
        fullName: form.fullName.trim(),
        relationship: form.relationship?.trim() ? form.relationship.trim() : undefined,
        dob: form.dob?.trim() ? form.dob.trim() : undefined,
        gender: form.gender,
        phone: form.phone?.trim() ? form.phone.trim() : undefined,
        notes: form.notes?.trim() ? form.notes.trim() : undefined,
      };
      await apiFetch('/patients', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setShowAdd(false);
      setForm({ fullName: '', relationship: 'self', dob: '', gender: 'male', phone: '', notes: '' });
      await loadMine();
    } catch (e: any) {
      setError(e?.message || 'Failed to create member');
    } finally {
      setSaving(false);
    }
  };

  const handleStaffFind = async () => {
    if (!user || user.role === 'patient') return;
    const mobile = staffMobile.trim();
    if (!mobile) return;
    setStaffBusy(true);
    setStaffError(null);
    try {
      const res = await apiFetch<Patient[]>(`/patients/by-mobile?mobile=${encodeURIComponent(mobile)}`);
      setStaffPatients(res || []);
    } catch (e: any) {
      setStaffError(e?.message || 'Failed to find patients');
    } finally {
      setStaffBusy(false);
    }
  };

  const handleMobileCheck = async () => {
    if (!user || user.role === 'patient') return;
    const mobile = staffForm.mobile.trim();
    if (!mobile) return;
    setMobileCheckState('checking');
    setStaffError(null);
    try {
      const res = await apiFetch<Patient[]>(`/patients/by-mobile?mobile=${encodeURIComponent(mobile)}`);
      if (res && res.length > 0) {
        setMobileCheckState('existing');
      } else {
        setMobileCheckState('new');
      }
    } catch {
      setMobileCheckState('new');
    }
  };

  const handleStaffCreate = async () => {
    if (!user || user.role === 'patient') return;
    if (staffBusy) return;
    const mobile = staffForm.mobile.trim();
    const fullName = staffForm.fullName.trim();
    if (!mobile || !fullName) return;
    setStaffBusy(true);
    setStaffError(null);
    try {
      let id: string | undefined;

      if (mobileCheckState === 'new') {
        const password = staffForm.password?.trim() || '';
        if (password.length < 6) {
          setStaffError('Password must be at least 6 characters');
          setStaffBusy(false);
          return;
        }
        if (password !== (staffForm.confirmPassword?.trim() || '')) {
          setStaffError('Passwords do not match');
          setStaffBusy(false);
          return;
        }
        const res = await apiFetch<any>('/auth/patient/register', {
          method: 'POST',
          body: JSON.stringify({
            mobile,
            password,
            fullName,
            relationship: staffForm.relationship?.trim() ? staffForm.relationship.trim() : undefined,
            dob: staffForm.dob?.trim() ? staffForm.dob.trim() : undefined,
            gender: staffForm.gender,
            phone: staffForm.phone?.trim() ? staffForm.phone.trim() : undefined,
            notes: staffForm.notes?.trim() ? staffForm.notes.trim() : undefined,
          }),
        });
        id = res?.user?._id as string | undefined;
      } else {
        const created = await apiFetch<any>('/patients/by-mobile', {
          method: 'POST',
          body: JSON.stringify({
            mobile,
            fullName,
            relationship: staffForm.relationship?.trim() ? staffForm.relationship.trim() : undefined,
            dob: staffForm.dob?.trim() ? staffForm.dob.trim() : undefined,
            gender: staffForm.gender,
            phone: staffForm.phone?.trim() ? staffForm.phone.trim() : undefined,
            notes: staffForm.notes?.trim() ? staffForm.notes.trim() : undefined,
          }),
        });
        id = created?._id as string | undefined;
      }

      if (id) {
        router.push(`/patients/${id}`);
      } else {
        setStaffError('Patient saved but ID missing');
      }
    } catch (e: any) {
      setStaffError(e?.message || 'Failed to save patient');
    } finally {
      setStaffBusy(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <TopHeader
        title={user?.role === 'patient' ? t('members') : t('patients')}
        subtitle={offline ? <span className={styles.textMuted}>{t('offline')}</span> : undefined}
        backHref="/home"
        className="-mx-6 bg-white/90 backdrop-blur-xl"
        rightElement={
          user?.role !== 'patient' ? (
            <button
              className={styles.button}
              style={{ padding: '6px 12px', fontSize: '0.875rem' }}
              onClick={() => {
                setStaffShowAdd((v) => !v);
                setStaffError(null);
                setStaffMobile('');
                setMobileCheckState('idle');
                setStaffForm({
                  mobile: '',
                  fullName: '',
                  relationship: '',
                  dob: '',
                  gender: 'male',
                  phone: '',
                  notes: '',
                  password: '',
                  confirmPassword: '',
                });
              }}
            >
              {t('addPatient')}
            </button>
          ) : undefined
        }
      />



      {user?.role !== 'patient' ? (
        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            placeholder="Search by name or phone…"
            value={staffSearch}
            onChange={(e) => setStaffSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void loadStaffPatients(staffSearch, 1);
            }}
          />
          <button
            className={styles.buttonGhost}
            onClick={() => void loadStaffPatients(staffSearch, 1)}
            disabled={staffListLoading}
            type="button"
          >
            {staffListLoading ? '…' : 'Search'}
          </button>
        </div>
      ) : null}

      <div className={styles.gridTwo}>
        {user?.role !== 'patient' ? (
          staffListLoading ? (
            <div className={styles.card}><p>Loading patients…</p></div>
          ) : staffPatients.length === 0 ? (
            <div className={styles.card}><p>No patients found.</p></div>
          ) : (
            staffPatients.map((patient) => (
              <Link key={patient._id} href={`/patients/${patient._id}`} className={styles.card}>
                <h3>{patient.fullName}</h3>
                <p className={styles.textMuted}>{patient.phone || '—'}</p>
              </Link>
            ))
          )
        ) : patients.length === 0 ? (
          <div className={styles.card}>
            <p>No members yet. Add a family member to get started.</p>
          </div>
        ) : (
          patients.map((patient) => {
            const isActiveMember = user?.role === 'patient' && activeMemberId === patient._id;
            if (user?.role !== 'patient') {
              return (
                <Link key={patient._id} href={`/patients/${patient._id}`} className={styles.card}>
                  <h3>{patient.fullName}</h3>
                  <p>{patient.relationship || 'Member'}</p>
                  <p className={styles.textMuted}>{patient.phone}</p>
                </Link>
              );
            }

            return (
              <div
                key={patient._id}
                className={`${styles.memberCard} ${isActiveMember ? styles.memberCardActive : ''}`}
              >
                <div className={styles.memberTopRow}>
                  <div>
                    <div className={styles.memberNameRow}>
                      <h3 className={styles.memberName}>{patient.fullName}</h3>
                      {isActiveMember ? <span className={styles.activePill}>Active</span> : null}
                    </div>
                    <p className={styles.memberMeta}>{patient.relationship || 'Member'}</p>
                    {patient.phone ? <p className={styles.textMuted}>{patient.phone}</p> : null}
                  </div>

                  <div className={styles.memberActions}>
                    <button
                      type="button"
                      className={styles.buttonGhost}
                      onClick={() => {
                        const storageKey = `activeMemberId:${user.id}`;
                        setActiveMemberId(patient._id);
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem(storageKey, patient._id);
                        }
                      }}
                      disabled={isActiveMember}
                    >
                      {isActiveMember ? 'Selected' : 'Set active'}
                    </button>
                    <Link className={styles.viewLink} href={`/patients/${patient._id}`}>
                      View
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {user?.role === 'patient' && (
          <div className={styles.addCard}>
            <button
              type="button"
              className="w-full h-full min-h-[120px] flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-[#0254b7] hover:bg-blue-50/50 transition-colors rounded-2xl border-2 border-dashed border-gray-200"
              onClick={() => {
                setShowAdd(true);
                setError(null);
                setForm((prev) => ({ ...prev, phone: user.mobile || prev.phone }));
              }}
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#0254b7]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <span className="font-semibold">{t('addMember') || 'Add Family Member'}</span>
            </button>
          </div>
        )}
      </div>

      <BottomDrawer
        isOpen={showAdd && user?.role === 'patient'}
        onClose={() => setShowAdd(false)}
        title={t('addMember')}
      >
        <div className="pt-2">
          {error ? <div className={styles.error + ' mb-4'}>{error}</div> : null}
          <div className={styles.formGrid}>
            <div className="flex flex-col gap-1.5 w-full md:col-span-2">
              <label className="text-xs font-semibold text-gray-700 ml-1">Full Name *</label>
              <input
                className={styles.input}
                placeholder="e.g. Jane Doe"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-gray-700 ml-1">Relationship</label>
              <select
                className={styles.input}
                value={form.relationship || 'self'}
                onChange={(e) => setForm((prev) => ({ ...prev, relationship: e.target.value }))}
              >
                <option value="self">Self</option>
                <option value="spouse">Spouse</option>
                <option value="child">Child</option>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="sibling">Sibling</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-gray-700 ml-1">Gender</label>
              <select
                className={styles.input}
                value={form.gender || 'male'}
                onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value as any }))}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-gray-700 ml-1">Date of Birth</label>
              <input
                className={styles.input}
                type="date"
                value={form.dob || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, dob: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-gray-700 ml-1">Phone Number</label>
              <input
                className={styles.input}
                placeholder="e.g. +1 234 567 890"
                value={form.phone || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5 w-full md:col-span-2">
              <label className="text-xs font-semibold text-gray-700 ml-1">Medical Notes</label>
              <textarea
                className={styles.textarea}
                placeholder="Any known allergies or chronic conditions..."
                value={form.notes || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className={styles.actionRow + ' mt-8 mb-4'}>
            <button className={styles.buttonGhost + ' flex-1'} onClick={() => setShowAdd(false)} disabled={saving}>
              Cancel
            </button>
            <button className={styles.button + ' flex-1 py-3'} onClick={handleCreateMember} disabled={!canSave || saving}>
              {saving ? 'Saving...' : 'Add Member'}
            </button>
          </div>
        </div>
      </BottomDrawer>

      <BottomDrawer
        isOpen={staffShowAdd && user?.role !== 'patient'}
        onClose={() => {
          setStaffShowAdd(false);
          setMobileCheckState('idle');
        }}
        title={t('addPatient')}
      >
        <div className="pt-2">
          {staffError ? <div className={styles.error + ' mb-4'}>{staffError}</div> : null}

          {/* Step 1: Enter mobile and check */}
          <div className={styles.formGrid}>
            <div className="flex flex-col gap-1.5 w-full md:col-span-2">
              <label className="text-xs font-semibold text-gray-700 ml-1">Mobile Number *</label>
              <div className="flex items-center gap-2">
                <input
                  className={styles.input + ' flex-1'}
                  placeholder="e.g. 9876543210"
                  value={staffForm.mobile}
                  onChange={(e) => {
                    setStaffForm((prev) => ({ ...prev, mobile: e.target.value }));
                    setMobileCheckState('idle');
                    setStaffError(null);
                  }}
                  inputMode="numeric"
                  disabled={mobileCheckState !== 'idle'}
                />
                {mobileCheckState === 'idle' ? (
                  <button
                    className={styles.button + ' h-[42px] px-4 whitespace-nowrap'}
                    onClick={handleMobileCheck}
                    disabled={staffForm.mobile.trim().length === 0}
                    type="button"
                  >
                    Check
                  </button>
                ) : (
                  <button
                    className={styles.buttonGhost + ' h-[42px] px-4 whitespace-nowrap'}
                    onClick={() => {
                      setMobileCheckState('idle');
                      setStaffError(null);
                    }}
                    type="button"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>
          </div>

          {mobileCheckState === 'checking' ? (
            <p className="text-sm text-gray-500 mt-4">Checking mobile number…</p>
          ) : null}

          {mobileCheckState === 'existing' ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
              <svg className="h-4 w-4 text-green-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <p className="text-sm font-semibold text-green-700">Mobile already registered. This patient will be added as a member.</p>
            </div>
          ) : null}

          {mobileCheckState === 'new' ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
              <svg className="h-4 w-4 text-[#0254b7] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              <p className="text-sm font-semibold text-[#0254b7]">New mobile. A new patient account will be created. Please set a password.</p>
            </div>
          ) : null}

          {/* Step 2: Show form fields after mobile check */}
          {(mobileCheckState === 'existing' || mobileCheckState === 'new') ? (
            <div className={styles.formGrid + ' mt-4'}>
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-gray-700 ml-1">Full Name *</label>
                <input
                  className={styles.input}
                  placeholder="Full name"
                  value={staffForm.fullName}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-gray-700 ml-1">Gender</label>
                <select
                  className={styles.input}
                  value={staffForm.gender || 'male'}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, gender: e.target.value as any }))}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-gray-700 ml-1">Date of Birth</label>
                <input
                  className={styles.input}
                  type="date"
                  value={staffForm.dob || ''}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, dob: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-xs font-semibold text-gray-700 ml-1">Phone</label>
                <input
                  className={styles.input}
                  placeholder="Phone (optional)"
                  value={staffForm.phone || ''}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, phone: e.target.value }))}
                  inputMode="tel"
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full md:col-span-2">
                <label className="text-xs font-semibold text-gray-700 ml-1">Medical Notes</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Notes (optional)"
                  value={staffForm.notes || ''}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              {mobileCheckState === 'new' ? (
                <>
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-xs font-semibold text-gray-700 ml-1">Password *</label>
                    <input
                      className={styles.input}
                      type="password"
                      placeholder="Min 6 characters"
                      value={staffForm.password || ''}
                      onChange={(e) => setStaffForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-xs font-semibold text-gray-700 ml-1">Confirm Password *</label>
                    <input
                      className={styles.input}
                      type="password"
                      placeholder="Repeat password"
                      value={staffForm.confirmPassword || ''}
                      onChange={(e) => setStaffForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {(mobileCheckState === 'existing' || mobileCheckState === 'new') ? (
            <div className={styles.actionRow + ' mt-8 mb-4'}>
              <button
                className={styles.buttonGhost + ' flex-1'}
                onClick={() => {
                  setStaffShowAdd(false);
                  setMobileCheckState('idle');
                }}
                disabled={staffBusy}
              >
                Cancel
              </button>
              <button
                className={styles.button + ' flex-1 py-3'}
                onClick={handleStaffCreate}
                disabled={
                  staffBusy ||
                  staffForm.fullName.trim().length === 0 ||
                  (mobileCheckState === 'new' && (staffForm.password || '').trim().length < 6)
                }
              >
                {staffBusy ? 'Saving...' : mobileCheckState === 'new' ? 'Register Patient' : 'Add Patient'}
              </button>
            </div>
          ) : null}
        </div>
      </BottomDrawer>
    </div>
  );
}
