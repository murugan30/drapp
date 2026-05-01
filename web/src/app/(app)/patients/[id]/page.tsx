'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../lib/auth';
import { API_BASE, apiFetch } from '../../../../lib/api';
import styles from './patient.module.css';

export default function PatientProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const patientId = params?.id as string;
  const appointmentId = searchParams?.get('appointmentId') || '';
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);

  const isStaff = useMemo(() => user?.role === 'doctor' || user?.role === 'admin', [user?.role]);
  const isPatientUser = useMemo(() => user?.role === 'patient', [user?.role]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [modalKind, setModalKind] = useState<'staff' | 'patient'>('patient');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordTitle, setRecordTitle] = useState('Prescription');
  const [recordDetails, setRecordDetails] = useState('');
  const [recordFile, setRecordFile] = useState<File | null>(null);

  const groupedRecords = useMemo(() => {
    const items = [...(records || [])].sort((a, b) => {
      const at = new Date(a?.createdAt || 0).getTime();
      const bt = new Date(b?.createdAt || 0).getTime();
      return at - bt;
    });
    const groups: Array<{ dateLabel: string; items: any[] }> = [];
    let currentKey = '';
    for (const r of items) {
      const d = new Date(r?.createdAt || Date.now());
      const key = d.toDateString();
      if (key !== currentKey) {
        currentKey = key;
        groups.push({ dateLabel: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), items: [] });
      }
      groups[groups.length - 1].items.push(r);
    }
    return groups;
  }, [records]);

  useEffect(() => {
    const load = async () => {
      const [p, r] = await Promise.all([
        apiFetch<any>(`/patients/${patientId}`),
        apiFetch<any[]>(`/medical-records/by-patient?patientId=${patientId}`),
      ]);
      setPatient(p);
      setRecords(r || []);
    };
    if (patientId) load();
  }, [patientId]);

  const refreshRecords = async () => {
    if (!patientId) return;
    const r = await apiFetch<any[]>(`/medical-records/by-patient?patientId=${patientId}`);
    setRecords(r || []);
  };

  const handleCompleteConsultation = async () => {
    if (!appointmentId) return;
    try {
      setError(null);
      setBusy(true);
      await apiFetch(`/appointments/${appointmentId}/complete`, { method: 'PATCH' });
      setMenuOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to complete consultation');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRecord = async () => {
    if (!recordTitle.trim()) return;
    try {
      setError(null);
      setBusy(true);
      await apiFetch('/medical-records', {
        method: 'POST',
        body: JSON.stringify({ patientId, summary: recordTitle.trim(), details: recordDetails?.trim() ? recordDetails.trim() : undefined }),
      });

      if (recordFile) {
        const res = await apiFetch<any>('/documents/upload', {
          method: 'POST',
          body: JSON.stringify({
            patientId,
            fileName: recordFile.name,
            mimeType: recordFile.type || 'application/octet-stream',
            size: recordFile.size,
          }),
        });
        const uploadUrl: string | undefined = res?.uploadUrl;
        if (!uploadUrl) {
          throw new Error('Upload URL not received');
        }
        const apiOrigin = new URL(API_BASE, window.location.origin).origin;
        const uploadOrigin = new URL(uploadUrl, window.location.origin).origin;
        const isApiUpload = apiOrigin === uploadOrigin;
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': recordFile.type || 'application/octet-stream' },
          body: recordFile,
          ...(isApiUpload ? { credentials: 'include' as const } : {}),
        });
        if (!putRes.ok) {
          let bodyText = '';
          try {
            bodyText = await putRes.text();
          } catch {
            bodyText = '';
          }
          throw new Error(`File upload failed (${putRes.status}). ${bodyText || ''}`.trim());
        }
      }

      await refreshRecords();
      setRecordDetails('');
      setRecordFile(null);
      setShowAddRecord(false);
      setMenuOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to save record');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.headerBar}>
        {user?.role === 'patient' ? (
          <button
            type="button"
            className={styles.backButton}
            onClick={() => {
              router.push('/patients');
            }}
            aria-label="Back"
          >
            <span className={styles.backIcon} aria-hidden="true" />
            Back
          </button>
        ) : (
          <button
            type="button"
            className={styles.backButton}
            onClick={() => {
              router.push('/appointments');
            }}
            aria-label="Back"
          >
            <span className={styles.backIcon} aria-hidden="true" />
            Back
          </button>
        )}

        <div className={styles.headerTitleBlock}>
          <div className={styles.headerTitle}>{patient?.fullName || 'Patient'}</div>
        </div>

        <div style={{ position: 'relative' }}>
          {isStaff || isPatientUser ? (
            <>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu"
                disabled={busy}
              >
                ⋯
              </button>
              {menuOpen ? (
                <div className={styles.dropdown}>
                  {isStaff ? (
                    <button
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        setModalKind('staff');
                        setRecordTitle('Prescription');
                        setRecordDetails('');
                        setRecordFile(null);
                        setShowAddRecord(true);
                        setMenuOpen(false);
                      }}
                    >
                      Add prescription / record
                    </button>
                  ) : null}

                  {isPatientUser ? (
                    <button
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        setModalKind('patient');
                        setRecordTitle('Medical details');
                        setRecordDetails('');
                        setRecordFile(null);
                        setShowAddRecord(true);
                        setMenuOpen(false);
                      }}
                    >
                      Add medical details
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className={styles.dropdownItem}
                    onClick={() => {
                      router.push(`/patients/${patientId}/documents`);
                      setMenuOpen(false);
                    }}
                  >
                    Documents
                  </button>
                  {isStaff ? (
                    <button
                      type="button"
                      className={styles.dropdownItemDanger}
                      onClick={handleCompleteConsultation}
                      disabled={!appointmentId || busy}
                    >
                      Complete consultation
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <span />
          )}
        </div>
      </header>

      {error ? <div className={styles.banner}>{error}</div> : null}

      <div className={styles.chatShell}>
        <div className={styles.chatMessages}>
          <div className={`${styles.bubble} ${styles.bubbleLeft}`}>
            <div className={styles.bubbleTitle}>{patient?.fullName || 'Member'}</div>
            <div className={styles.bubbleBody}>DOB: {patient?.dob || '—'}

Phone: {patient?.phone || '—'}</div>
            <div className={styles.bubbleMeta}>
              <span className={styles.bubbleTimeMuted}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          {groupedRecords.map((g) => (
            <div key={g.dateLabel}>
              <div className={styles.dateDivider}>
                <span className={styles.dateDividerPill}>{g.dateLabel}</span>
              </div>
              {g.items.map((record) => {
                const d = new Date(record.createdAt);
                const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={record._id} className={`${styles.bubble} ${styles.bubbleRight}`}>
                    <div className={styles.bubbleTitle}>{record.summary}</div>
                    <div className={styles.bubbleBody}>{record.details || ''}</div>
                    <div className={styles.bubbleMeta}>
                      <span className={styles.bubbleTime}>{timeLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {showAddRecord ? (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setShowAddRecord(false);
            setMenuOpen(false);
          }}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className={styles.modalTitle}>{modalKind === 'staff' ? 'Add prescription / record' : 'Add medical details'}</div>
            <div className={styles.modalSub}>This will appear in the patient timeline.</div>

            <div className={styles.modalBody}>
              <div>
                <label className={styles.label}>Title</label>
                <input className={styles.input} value={recordTitle} onChange={(e) => setRecordTitle(e.target.value)} />
              </div>

              <div>
                <label className={styles.label}>Details</label>
                <textarea className={styles.textarea} value={recordDetails} onChange={(e) => setRecordDetails(e.target.value)} />
              </div>

              <div className={styles.fileRow}>
                <label className={styles.label}>Upload document (optional)</label>
                <div className={styles.fileRowInner}>
                  <label className={styles.secondaryBtn} style={{ cursor: busy ? 'not-allowed' : 'pointer' }}>
                    {recordFile ? 'Change file' : 'Choose file'}
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      accept="image/*,application/pdf"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setRecordFile(f);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {recordFile ? <div className={styles.fileName}>Selected: {recordFile.name}</div> : null}
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setShowAddRecord(false);
                  setRecordFile(null);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="button" className={styles.primaryBtn} onClick={handleSaveRecord} disabled={busy}>
                {busy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
