'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, API_BASE } from '../../../../../lib/api';
import styles from './patient-documents.module.css';
import { validateUploadFile } from '../../../../../lib/docUpload';

export default function PatientDocumentsPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params?.id as string;

  const fileRef = useRef<HTMLInputElement | null>(null);

  const [patient, setPatient] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const d = await apiFetch<any[]>(`/documents/by-patient?patientId=${patientId}`);
    setDocuments(d || []);
  };

  useEffect(() => {
    const load = async () => {
      if (!patientId) return;
      setError(null);
      try {
        const p = await apiFetch<any>(`/patients/${patientId}`);
        setPatient(p);
        await refresh();
      } catch (e: any) {
        setError(e?.message || 'Failed to load documents');
      }
    };
    void load();
  }, [patientId]);

  const handleDownload = async (documentId: string) => {
    try {
      setError(null);
      setSuccess(null);
      const res = await apiFetch<any>(`/documents/download?documentId=${documentId}`);
      const url: string | undefined = res?.downloadUrl;
      if (!url) throw new Error('Download URL not available');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.message || 'Failed to download');
    }
  };

  const handlePickFile = () => {
    setError(null);
    setSuccess(null);
    fileRef.current?.click();
  };

  const handleUpload = async (file: File) => {
    if (!patientId) return;
    try {
      setError(null);
      setSuccess(null);

      const validation = validateUploadFile(file);
      if (!validation.ok) {
        throw new Error(validation.error);
      }

      setBusy(true);
      const res = await apiFetch<any>('/documents/upload', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          fileName: file.name,
          mimeType: validation.mimeType,
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
        headers: { 'Content-Type': validation.mimeType },
        body: file,
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

      await refresh();
      setSuccess('Document uploaded.');
    } catch (e: any) {
      setError(e?.message || 'Failed to upload document');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.headerBar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => {
            router.push(`/patients/${patientId}`);
          }}
          aria-label="Back"
        >
          <span className={styles.backIcon} aria-hidden="true" />
          Back
        </button>
        <div style={{ textAlign: 'center' }}>
          <div className={styles.title}>Documents</div>
          <div className={styles.subTitle}>{patient?.fullName || 'Patient'}</div>
        </div>
        <span />
      </header>

      {error ? <div className={styles.bannerError}>{error}</div> : null}
      {success ? <div className={styles.bannerSuccess}>{success}</div> : null}

      <div className={styles.card}>
        <div className={styles.actionsRow}>
          <button type="button" className={styles.secondaryBtn} onClick={handlePickFile} disabled={busy}>
            {busy ? 'Uploading…' : 'Upload report'}
          </button>
          <input
            ref={fileRef}
            type="file"
            style={{ display: 'none' }}
            accept="image/*,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />
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
    </div>
  );
}
