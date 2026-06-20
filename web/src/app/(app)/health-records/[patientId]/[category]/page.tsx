'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../lib/auth';
import { apiFetch, API_BASE } from '../../../../../lib/api';
import TopHeader from '../../../../../components/TopHeader';
import { validateUploadFile } from '../../../../../lib/docUpload';

type PatientDoc = {
  _id: string;
  fileName: string;
  mimeType: string;
  size: number;
  category?: string;
  createdAt?: string;
};

type CategoryKey = 'prescriptions' | 'lab' | 'imaging' | 'uploads' | 'other';

type ViewResponse = {
  viewUrl?: string;
  document?: PatientDoc;
};

type DownloadResponse = {
  downloadUrl?: string;
  document?: PatientDoc;
};

type TimeFilterKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'last180' | 'last365' | 'all';

function getDocCategory(doc: PatientDoc): CategoryKey {
  const name = (doc.fileName || '').toLowerCase();
  const mime = (doc.mimeType || '').toLowerCase();

  if (doc.category === 'uploads') return 'uploads';
  if (doc.category === 'lab') return 'lab';

  if (name.includes('prescription') || name.includes('rx') || name.includes('presc')) return 'prescriptions';
  if (name.includes('lab') || name.includes('report') || name.includes('test')) return 'lab';
  if (
    mime.startsWith('image/') ||
    name.includes('xray') ||
    name.includes('x-ray') ||
    name.includes('scan') ||
    name.includes('mri') ||
    name.includes('ct') ||
    name.includes('ultrasound')
  ) {
    return 'imaging';
  }
  return 'other';
}

 function isPdfDoc(doc: PatientDoc) {
   const mime = (doc.mimeType || '').toLowerCase();
   return mime.includes('pdf') || (doc.fileName || '').toLowerCase().endsWith('.pdf');
 }

 function isImageDoc(doc: PatientDoc) {
   const mime = (doc.mimeType || '').toLowerCase();
   return mime.startsWith('image/');
 }

function titleForCategory(cat: string) {
  if (cat === 'prescriptions') return 'Prescriptions';
  if (cat === 'lab') return 'Lab';
  if (cat === 'imaging') return 'Imaging';
  if (cat === 'uploads') return 'My Uploads';
  if (cat === 'all') return 'All Records';
  return 'Other';
}

function formatBytes(bytes: number) {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function HealthRecordCategoryListPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();

  const patientId = params?.patientId as string;
  const category = (params?.category as string) || 'other';

  const [patient, setPatient] = useState<any>(null);
  const [allDocs, setAllDocs] = useState<PatientDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [docQuery, setDocQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pdf' | 'image' | 'other'>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilterKey>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'size_desc'>('newest');

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PatientDoc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const canView = user?.role === 'patient' || user?.role === 'doctor' || user?.role === 'admin' || user?.role === 'assistant' || user?.role === 'lab';

  useEffect(() => {
    const load = async () => {
      if (!patientId || !canView) return;
      setLoading(true);
      setError(null);
      try {
        const [p, d] = await Promise.all([
          apiFetch<any>(`/patients/${patientId}`),
          apiFetch<PatientDoc[]>(`/documents/by-patient?patientId=${patientId}`),
        ]);
        setPatient(p);
        setAllDocs(d || []);
      } catch (e: any) {
        setPatient(null);
        setAllDocs([]);
        setError(e?.message || 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [canView, category, patientId]);

  useEffect(() => {
    setDocQuery('');
    setTypeFilter('all');
    setTimeFilter('all');
    setSortBy('newest');
    setPreviewOpen(false);
    setPreviewDoc(null);
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewLoading(false);
    setPreviewError(null);
  }, [category, patientId]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleOpenInNewTab = async (documentId: string) => {
    setError(null);
    setBusyId(documentId);
    try {
      const res = await apiFetch<ViewResponse>(`/documents/view?documentId=${documentId}`);
      const url = res?.viewUrl;
      if (!url) throw new Error('View URL not available');

      if (url.includes('/api/documents/local-')) {
        const fileRes = await fetch(`${API_BASE}/documents/local-view?documentId=${documentId}`, { credentials: 'include' });
        if (!fileRes.ok) throw new Error('Failed to fetch file content');
        const blob = await fileRes.blob();
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to open document');
    } finally {
      setBusyId(null);
    }
  };

  const handlePreview = async (doc: PatientDoc) => {
    setPreviewError(null);
    setBusyId(doc._id);
    setPreviewLoading(true);
    setPreviewDoc(doc);
    setPreviewOpen(true);

    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });

    try {
      const res = await apiFetch<ViewResponse>(`/documents/view?documentId=${doc._id}`);
      const url = res?.viewUrl;
      if (!url) throw new Error('View URL not available');

      if (url.includes('/api/documents/local-')) {
        const fileRes = await fetch(`${API_BASE}/documents/local-view?documentId=${doc._id}`, { credentials: 'include' });
        if (!fileRes.ok) throw new Error('Failed to fetch file content');
        const blob = await fileRes.blob();
        const objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } else {
        setPreviewUrl(url);
      }
    } catch (e: any) {
      setPreviewError(e?.message || 'Failed to open document');
    } finally {
      setPreviewLoading(false);
      setBusyId(null);
    }
  };

  const handleDownload = async (documentId: string) => {
    setError(null);
    setBusyId(documentId);
    try {
      const res = await apiFetch<DownloadResponse>(`/documents/download?documentId=${documentId}`);
      const url = res?.downloadUrl;
      if (!url) throw new Error('Download URL not available');

      if (url.includes('/api/documents/local-')) {
        const fileRes = await fetch(`${API_BASE}/documents/local-download?documentId=${documentId}`, { credentials: 'include' });
        if (!fileRes.ok) throw new Error('Failed to fetch file content');
        const blob = await fileRes.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = res.document?.fileName || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Delay revoke just in case
        setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to download');
    } finally {
      setBusyId(null);
    }
  };

  const headerTitle = useMemo(() => titleForCategory(category), [category]);

  const categoryCounts = useMemo(() => {
    const c: Record<CategoryKey, number> = { prescriptions: 0, lab: 0, imaging: 0, uploads: 0, other: 0 };
    for (const d of allDocs) {
      c[getDocCategory(d)] += 1;
    }
    return c;
  }, [allDocs]);

  const categoryKeys = useMemo(() => {
    return [
      { key: 'all', label: 'All', count: allDocs.length },
      { key: 'prescriptions', label: 'Prescriptions', count: categoryCounts.prescriptions },
      { key: 'lab', label: 'Lab', count: categoryCounts.lab },
      { key: 'imaging', label: 'Imaging', count: categoryCounts.imaging },
      { key: 'uploads', label: 'Uploads', count: categoryCounts.uploads },
      { key: 'other', label: 'Other', count: categoryCounts.other },
    ] as const;
  }, [allDocs.length, categoryCounts.imaging, categoryCounts.lab, categoryCounts.other, categoryCounts.prescriptions, categoryCounts.uploads]);

  const timeFilterOptions = useMemo(() => {
    return [
      { key: 'today' as const, label: 'Today' },
      { key: 'yesterday' as const, label: 'Yesterday' },
      { key: 'last7' as const, label: 'Last 7 days' },
      { key: 'last30' as const, label: 'Last month' },
      { key: 'last180' as const, label: 'Last 6 months' },
      { key: 'last365' as const, label: 'Last 1 year' },
      { key: 'all' as const, label: 'All' },
    ];
  }, []);

  const docTimeRange = useMemo(() => {
    if (timeFilter === 'all') return null;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (timeFilter === 'today') {
      return { from: startOfToday.getTime(), to: now.getTime() };
    }

    if (timeFilter === 'yesterday') {
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      return { from: startOfYesterday.getTime(), to: startOfToday.getTime() };
    }

    const days =
      timeFilter === 'last7'
        ? 7
        : timeFilter === 'last30'
          ? 30
          : timeFilter === 'last180'
            ? 180
            : 365;

    const from = new Date(startOfToday);
    from.setDate(from.getDate() - (days - 1));
    return { from: from.getTime(), to: now.getTime() };
  }, [timeFilter]);

  const visibleDocs = useMemo(() => {
    const base = category === 'all'
      ? allDocs
      : allDocs.filter((x) => getDocCategory(x) === (category as CategoryKey));

    const timeFiltered = docTimeRange
      ? base.filter((d) => {
        const t = d.createdAt ? new Date(d.createdAt).getTime() : NaN;
        if (!Number.isFinite(t)) return false;
        return t >= docTimeRange.from && t < docTimeRange.to;
      })
      : base;

    const q = docQuery.trim().toLowerCase();
    let out = q
      ? timeFiltered.filter((d) => (d.fileName || '').toLowerCase().includes(q))
      : timeFiltered.slice();

    if (typeFilter === 'pdf') out = out.filter((d) => isPdfDoc(d));
    if (typeFilter === 'image') out = out.filter((d) => isImageDoc(d));
    if (typeFilter === 'other') out = out.filter((d) => !isPdfDoc(d) && !isImageDoc(d));

    out.sort((a, b) => {
      if (sortBy === 'name_asc') {
        const an = (a.fileName || '').toLowerCase();
        const bn = (b.fileName || '').toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        return 0;
      }
      if (sortBy === 'size_desc') {
        return Number(b.size || 0) - Number(a.size || 0);
      }

      const at = new Date(a.createdAt || 0).getTime();
      const bt = new Date(b.createdAt || 0).getTime();
      if (sortBy === 'oldest') return at - bt;
      return bt - at;
    });

    return out;
  }, [allDocs, category, docQuery, docTimeRange, sortBy, typeFilter]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    e.target.value = '';

    const validation = validateUploadFile(file);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      // 1. Get presigned url
      const res = await apiFetch<any>('/documents/upload', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patientId,
          fileName: file.name,
          mimeType: validation.mimeType,
          size: file.size,
          category: user?.role === 'lab' ? 'lab' : 'uploads',
        }),
      });

      const uploadUrl = res?.uploadUrl;
      const document = res?.document;

      if (!uploadUrl || !document) {
        throw new Error('Failed to get upload capabilities.');
      }

      // 2. Upload to S3/Local
      const isLocal = uploadUrl.includes('/api/documents/local');
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': validation.mimeType },
        body: file,
        ...(isLocal ? { credentials: 'include' } : {}),
      });

      if (!putRes.ok) {
        const txt = await putRes.text().catch(() => '');
        throw new Error(`Failed to upload: ${putRes.status} ${txt}`);
      }

      // 3. Refresh the doc list so the user sees it immediately
      const refreshReq = await apiFetch<PatientDoc[]>(`/documents/by-patient?patientId=${patientId}`);
      setAllDocs(refreshReq || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  if (!canView) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f8faff] text-gray-900 pb-10 absolute inset-0 z-50">
      <TopHeader
        title={headerTitle}
        backHref="/health-records"
        rightElement={
          ((user?.role === 'patient' && (category === 'uploads' || category === 'all')) ||
            (user?.role === 'lab' && (category === 'lab' || category === 'all'))) ? (
            <label className="relative cursor-pointer text-sm font-bold text-[#0254b7] hover:text-blue-700 active:scale-95 transition-all flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full">
              {uploading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  <span>Upload</span>
                </>
              )}
              <input
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
                accept="image/*,application/pdf"
              />
            </label>
          ) : undefined
        }
      />

      <div className="flex flex-col px-6 pt-6 pb-2 gap-6 flex-1">
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">
            {headerTitle}
          </h2>
          <p className="mt-1 text-sm font-medium text-gray-500">
            {patient?.fullName}
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-sm font-semibold text-red-700 backdrop-blur-sm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <div className="flex overflow-x-auto gap-2 pb-1 -mx-6 px-6 hide-scrollbar [&::-webkit-scrollbar]:hidden">
            {categoryKeys.map((c) => {
              const active = String(c.key) === String(category);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    router.push(`/health-records/${patientId}/${c.key}`);
                  }}
                  className={`flex-shrink-0 inline-flex items-center gap-2 px-4 h-9 rounded-full text-xs font-bold transition-all ${active
                    ? 'bg-[#0254b7] text-white shadow-md shadow-blue-500/20'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-200'
                    }`}
                >
                  <span>{c.label}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-gray-50 text-gray-500'}`}>{c.count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex overflow-x-auto gap-2 pb-1 -mx-6 px-6 hide-scrollbar [&::-webkit-scrollbar]:hidden">
            {timeFilterOptions.map((opt) => {
              const active = opt.key === timeFilter;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTimeFilter(opt.key)}
                  className={`flex-shrink-0 inline-flex items-center px-4 h-9 rounded-full text-xs font-bold transition-all ${active
                    ? 'bg-[#0254b7] text-white shadow-md shadow-blue-500/20'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-200'
                    }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <input
                  className="w-full bg-white border border-gray-100 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0254b7]/20 focus:border-[#0254b7] shadow-sm transition-all"
                  value={docQuery}
                  onChange={(e) => setDocQuery(e.target.value)}
                  placeholder="Search files"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="shrink-0 bg-white border border-gray-200 rounded-2xl px-3 py-3 text-xs font-bold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0254b7]/20 focus:border-[#0254b7]"
                aria-label="Sort documents"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name_asc">Name</option>
                <option value="size_desc">Size</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${typeFilter === 'all'
                    ? 'bg-[#0254b7] text-white border-[#0254b7]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-200'
                    }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('pdf')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${typeFilter === 'pdf'
                    ? 'bg-[#0254b7] text-white border-[#0254b7]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-200'
                    }`}
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('image')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${typeFilter === 'image'
                    ? 'bg-[#0254b7] text-white border-[#0254b7]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-200'
                    }`}
                >
                  Images
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('other')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${typeFilter === 'other'
                    ? 'bg-[#0254b7] text-white border-[#0254b7]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-200'
                    }`}
                >
                  Other
                </button>
              </div>

              <div className="text-xs font-semibold text-gray-600">{loading ? 'Loading…' : `${visibleDocs.length} items`}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-3">
            {visibleDocs.length === 0 && !loading ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-6">
                <div className="text-sm font-semibold text-gray-900">No files</div>
                <div className="mt-1 text-xs font-semibold text-gray-600">Try changing your search or filters.</div>
              </div>
            ) : null}

            {visibleDocs.map((doc) => {
              const busy = busyId === doc._id;
              const isImage = isImageDoc(doc);
              const isPdf = isPdfDoc(doc);
              const createdDate = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date';
              const createdTime = doc.createdAt ? new Date(doc.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';

              return (
                <div key={doc._id} className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4 flex flex-col gap-4 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                      {isPdf ? (
                        <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8z" /><path d="M14 2v6h6" /><path d="M10 11v6" /><path d="M10 14h3" /></svg>
                      ) : isImage ? (
                        <svg className="w-5 h-5 text-[#0254b7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8z" /><path d="M14 2v6h6" /></svg>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }} className="flex-1">
                      <div className="text-sm font-bold text-gray-900 truncate tracking-tight">{doc.fileName}</div>
                      <div className="mt-1 text-xs font-medium text-gray-500 truncate">
                        {createdDate} {createdTime && `at ${createdTime}`}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
                        Added by {user?.role === 'patient' ? 'Doctor' : 'Staff'} · {formatBytes(doc.size)}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gray-50 -mx-4" />

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDownload(doc._id)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100 transition-colors disabled:opacity-60 text-center"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handlePreview(doc)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#f0f5ff] text-[#0254b7] hover:bg-blue-100 transition-colors disabled:opacity-60 text-center"
                    >
                      {busy ? 'Opening...' : 'View'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

     {previewOpen ? (
       <div
         className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
         onClick={() => {
           setPreviewOpen(false);
         }}
       >
         <div
           className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden"
           onClick={(e) => e.stopPropagation()}
         >
           <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
             <div style={{ minWidth: 0 }}>
               <div className="text-sm font-bold text-gray-900 truncate">{previewDoc?.fileName || 'Document'}</div>
               <div className="text-xs font-medium text-gray-500">Preview</div>
             </div>
             <button
               type="button"
               className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 text-gray-600 font-bold active:scale-95 transition-transform"
               onClick={() => setPreviewOpen(false)}
               aria-label="Close preview"
             >
               ✕
             </button>
           </div>

           <div className="px-5 py-4">
             {previewError ? (
               <div className="rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-sm font-semibold text-red-700">{previewError}</div>
             ) : null}

             {previewLoading ? (
               <div className="h-[55vh] rounded-2xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                 <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                 </svg>
               </div>
             ) : previewDoc && previewUrl && isImageDoc(previewDoc) ? (
               <div className="h-[55vh] rounded-2xl border border-gray-100 bg-white overflow-hidden flex items-center justify-center">
                 <img src={previewUrl} alt={previewDoc.fileName} className="max-h-full max-w-full object-contain" />
               </div>
             ) : previewDoc && previewUrl && isPdfDoc(previewDoc) ? (
               <div className="h-[55vh] rounded-2xl border border-gray-100 bg-white overflow-hidden">
                 <iframe title={previewDoc.fileName} src={previewUrl} className="w-full h-full" />
               </div>
             ) : previewDoc ? (
               <div className="h-[55vh] rounded-2xl border border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 text-center px-6">
                 <div className="text-sm font-bold text-gray-900">Preview not available</div>
                 <div className="text-xs font-medium text-gray-500">This file type can be downloaded or opened in a new tab.</div>
               </div>
             ) : null}

             <div className="mt-4 flex gap-3">
               <button
                 type="button"
                 className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-50 text-gray-700 border border-gray-100 hover:bg-gray-100 transition-colors active:scale-95"
                 onClick={() => {
                   if (previewDoc) void handleDownload(previewDoc._id);
                 }}
                 disabled={!previewDoc}
               >
                 Download
               </button>
               <button
                 type="button"
                 className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#f0f5ff] text-[#0254b7] hover:bg-blue-100 transition-colors active:scale-95"
                 onClick={() => {
                   if (previewDoc) void handleOpenInNewTab(previewDoc._id);
                 }}
                 disabled={!previewDoc}
               >
                 Open in tab
               </button>
             </div>
           </div>
         </div>
       </div>
     ) : null}
    </div>
  );
}
