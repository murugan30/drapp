'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../lib/auth';
import { apiFetch, API_BASE } from '../../../lib/api';
import styles from './documents.module.css';
import { validateUploadFile } from '../../../lib/docUpload';

export default function DocumentsPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [patientId, setPatientId] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isPatient = user?.role === 'patient';

  const effectivePatientId = useMemo(() => {
    if (!user) return '';
    if (isPatient) {
      const storageKey = `activeMemberId:${user.id}`;
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
      return stored || '';
    }
    return patientId.trim();
  }, [isPatient, patientId, user]);

  const refresh = async (targetPatientId: string) => {
    if (!targetPatientId) {
      setDocuments([]);
      return;
    }
    const d = await apiFetch<any[]>(`/documents/by-patient?patientId=${targetPatientId}`);
    setDocuments(d || []);
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      if (!effectivePatientId) {
        setDocuments([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await refresh(effectivePatientId);
      } catch (e: any) {
        setError(e?.message || 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [effectivePatientId, user]);

  const handlePickFile = () => {
    setError(null);
    setSuccess(null);
    fileRef.current?.click();
  };

  const handleUpload = async (file: File) => {
    if (!effectivePatientId) return;
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
          patientId: effectivePatientId,
          fileName: file.name,
          mimeType: validation.mimeType,
          size: file.size,
        }),
      });
      const uploadUrl: string | undefined = res?.uploadUrl;
      if (!uploadUrl) throw new Error('Upload URL not received');

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
      await refresh(effectivePatientId);
      setSuccess('Document uploaded.');
    } catch (e: any) {
      setError(e?.message || 'Failed to upload document');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDownload = async (documentId: string) => {
    try {
      setError(null);
      const res = await apiFetch<any>(`/documents/download?documentId=${documentId}`);
      const url: string | undefined = res?.downloadUrl;
      if (!url) throw new Error('Download URL not available');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.message || 'Failed to download');
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerActionsRow}>
        {!isPatient ? (
          <input
            className={styles.input}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Patient ID"
            inputMode="text"
          />
        ) : (
          <span />
        )}
        <div className={styles.headerActionsRight}>
          <button className={styles.button} onClick={handlePickFile} disabled={busy || !effectivePatientId}>
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
      </div>

      {error ? <div className={styles.bannerError}>{error}</div> : null}
      {success ? <div className={styles.bannerSuccess}>{success}</div> : null}

      <div className={styles.card}>
        {loading ? (
          <p>Loading…</p>
        ) : !effectivePatientId ? (
          <p>{isPatient ? 'Select an active member in Members first.' : 'Enter a patient ID to view documents.'}</p>
        ) : documents.length === 0 ? (
          <p>No documents uploaded yet.</p>
        ) : (
          <div className={styles.docList}>
            {documents.map((doc: any) => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
