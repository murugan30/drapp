'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../lib/auth';
import { apiFetch, API_BASE } from '../../../../../lib/api';
import styles from './consultation.module.css';

export default function ConsultationPage() {
  const router = useRouter();
  const params = useParams();
  const appointmentId = params?.id as string;
  const { user } = useAuth();

  const [appointment, setAppointment] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [prescriptionTitle, setPrescriptionTitle] = useState('Prescription');
  const [prescriptionDetails, setPrescriptionDetails] = useState('');

  const canAccess = user?.role === 'doctor' || user?.role === 'admin';

  const statusLabel = useMemo(() => {
    const raw = (appointment?.status || 'scheduled').toLowerCase();
    if (raw === 'scheduled') return { label: 'Scheduled', cls: styles.pill };
    if (raw === 'completed') return { label: 'Completed', cls: styles.pillSuccess };
    if (raw === 'cancelled') return { label: 'Cancelled', cls: styles.pillDanger };
    return { label: raw.charAt(0).toUpperCase() + raw.slice(1), cls: styles.pill };
  }, [appointment?.status]);

  const refresh = async (patientId: string) => {
    const [r, d] = await Promise.all([
      apiFetch<any[]>(`/medical-records/by-patient?patientId=${patientId}`),
      apiFetch<any[]>(`/documents/by-patient?patientId=${patientId}`),
    ]);
    setRecords(r || []);
    setDocuments(d || []);
  };

  useEffect(() => {
    const load = async () => {
      if (!appointmentId) return;
      if (!canAccess) return;
      setLoading(true);
      setError(null);
      try {
        const a = await apiFetch<any>(`/appointments/${appointmentId}`);
        setAppointment(a);
        const p = await apiFetch<any>(`/patients/${a.patientId}`);
        setPatient(p);
        await refresh(a.patientId);
      } catch (e: any) {
        setError(e?.message || 'Failed to load consultation');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [appointmentId, canAccess]);

  const handleMarkCompleted = async () => {
    if (!appointmentId) return;
    try {
      setError(null);
      setSuccess(null);
      setActionBusy(true);
      const updated = await apiFetch<any>(`/appointments/${appointmentId}/complete`, { method: 'PATCH' });
      setAppointment(updated);
      setSuccess('Consultation marked as completed.');
    } catch (e: any) {
      setError(e?.message || 'Failed to mark completed');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddPrescription = async () => {
    if (!patient?._id) return;
    if (!prescriptionTitle.trim()) return;
    try {
      setError(null);
      setSuccess(null);
      setActionBusy(true);
      await apiFetch('/medical-records', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patient._id,
          summary: prescriptionTitle.trim(),
          details: prescriptionDetails?.trim() ? prescriptionDetails.trim() : undefined,
        }),
      });
      await refresh(patient._id);
      setPrescriptionDetails('');
      setSuccess('Prescription saved.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save prescription');
    } finally {
      setActionBusy(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!patient?._id) return;
    try {
      setError(null);
      setSuccess(null);
      setActionBusy(true);
      const res = await apiFetch<any>('/documents/upload', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patient._id,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
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
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
        ...(isApiUpload ? { credentials: 'include' as const } : {}),
      });
      if (!putRes.ok) {
        throw new Error('File upload failed');
      }
      await refresh(patient._id);
      setSuccess('Document uploaded.');
    } catch (e: any) {
      setError(e?.message || 'Failed to upload document');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDownload = async (documentId: string) => {
    try {
      setError(null);
      const res = await apiFetch<any>(`/documents/download?documentId=${documentId}`);
      const url: string | undefined = res?.downloadUrl;
      if (!url) {
        throw new Error('Download URL not available');
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.message || 'Failed to download document');
    }
  };

  if (!canAccess) {
    return (
      <div className={styles.wrapper}>
        <header className={styles.headerBar}>
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
          <span />
          <span />
        </header>
        <div className={styles.card}>Only doctors/admins can access this page.</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.headerBar}>
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

        <div style={{ textAlign: 'center' }}>
          <div className={styles.title}>Consultation</div>
          <div className={styles.subTitle}>{patient?.fullName || 'Patient'}</div>
        </div>

        <span className={statusLabel.cls}>{statusLabel.label}</span>
      </header>

      {error ? <div className={styles.bannerError}>{error}</div> : null}
      {success ? <div className={styles.bannerSuccess}>{success}</div> : null}

      <div className={styles.card}>
        <div className={styles.title}>Appointment</div>
        <div className={styles.subTitle}>
          {loading ? 'Loading...' : appointment?.scheduledAt ? new Date(appointment.scheduledAt).toLocaleString() : '—'}
        </div>

        <div className={styles.actionsRow}>
          <button type="button" className={styles.primaryBtn} onClick={handleMarkCompleted} disabled={actionBusy || appointment?.status === 'completed'}>
            {appointment?.status === 'completed' ? 'Completed' : actionBusy ? 'Saving...' : 'Mark as completed'}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              if (patient?._id) router.push(`/patients/${patient._id}`);
            }}
            disabled={!patient?._id}
          >
            Open chat
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.title}>Add prescription</div>
        <div style={{ marginTop: 12 }}>
          <label className={styles.label}>Title</label>
          <input className={styles.input} value={prescriptionTitle} onChange={(e) => setPrescriptionTitle(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label className={styles.label}>Details</label>
          <textarea className={styles.textarea} value={prescriptionDetails} onChange={(e) => setPrescriptionDetails(e.target.value)} />
        </div>
        <div className={styles.actionsRow}>
          <button type="button" className={styles.primaryBtn} onClick={handleAddPrescription} disabled={actionBusy || !patient?._id}>
            {actionBusy ? 'Saving...' : 'Save prescription'}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.title}>Documents</div>
        <div className={styles.subTitle}>Upload reports, prescriptions, lab results</div>

        <div className={styles.actionsRow}>
          <label className={styles.secondaryBtn} style={{ cursor: actionBusy ? 'not-allowed' : 'pointer' }}>
            Upload
            <input
              type="file"
              style={{ display: 'none' }}
              disabled={actionBusy || !patient?._id}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>

        <div className={styles.docList}>
          {documents.length === 0 ? (
            <div className={styles.subTitle}>No documents uploaded.</div>
          ) : (
            documents.map((doc: any) => (
              <div key={doc._id} className={styles.docCard}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{doc.fileName}</div>
                  <div className={styles.docMeta}>
                    {doc.mimeType} · {Math.round((doc.size || 0) / 1024)} KB
                  </div>
                </div>
                <button type="button" className={styles.linkBtn} onClick={() => void handleDownload(doc._id)}>
                  Download
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.title}>Previous records</div>
        <div className={styles.docList}>
          {records.length === 0 ? (
            <div className={styles.subTitle}>No records yet.</div>
          ) : (
            records.map((r: any) => (
              <div key={r._id} className={styles.docCard}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{r.summary}</div>
                  <div className={styles.docMeta}>{r.details || '—'}</div>
                  <div className={styles.docMeta}>{new Date(r.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
