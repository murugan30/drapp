export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

const imageExtToMime: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

export function inferMimeType(fileName: string, mimeType?: string) {
  const mt = (mimeType || '').trim().toLowerCase();
  if (mt && mt !== 'application/octet-stream') return mt;

  const name = (fileName || '').toLowerCase();
  const idx = name.lastIndexOf('.');
  const ext = idx >= 0 ? name.slice(idx + 1) : '';

  if (ext === 'pdf') return 'application/pdf';
  if (ext in imageExtToMime) return imageExtToMime[ext] as string;
  return mt || 'application/octet-stream';
}

export function getFileKind(fileName: string, mimeType?: string) {
  const mt = inferMimeType(fileName, mimeType);
  if (mt === 'application/pdf') return 'pdf' as const;
  if (mt.startsWith('image/')) return 'image' as const;
  return 'unknown' as const;
}

export function validateUploadFile(file: File) {
  const mimeType = inferMimeType(file.name, file.type);
  const kind = getFileKind(file.name, mimeType);

  if (kind === 'unknown') {
    return {
      ok: false as const,
      mimeType,
      error: 'Only images and PDF files are allowed.',
    };
  }

  const maxBytes = kind === 'pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    const maxMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
    return {
      ok: false as const,
      mimeType,
      error: `File too large. Max ${maxMb}MB for ${kind.toUpperCase()}.`,
    };
  }

  return { ok: true as const, mimeType };
}
