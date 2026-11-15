import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from './firebase';

const MAX_CREDENTIAL_BYTES = 5 * 1024 * 1024; // 5 MB limit matching storage.rules

export async function compressImageToDataUrl(
  file: File,
  maxDimension = 420,
  maxChars = 70000
): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  let width = img.width;
  let height = img.height;
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to process image in this browser.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.8, 0.65, 0.5, 0.35]) {
    const out = canvas.toDataURL('image/jpeg', quality);
    if (out.length <= maxChars) return out;
  }

  // Final smaller resize fallback if image is ultra-detailed
  canvas.width = Math.max(1, Math.round(canvas.width * 0.7));
  canvas.height = Math.max(1, Math.round(canvas.height * 0.7));
  const ctx2 = canvas.getContext('2d');
  if (!ctx2) throw new Error('Unable to resize image.');
  ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
  const fallbackOut = canvas.toDataURL('image/jpeg', 0.45);
  if (fallbackOut.length > maxChars) {
    throw new Error('Image is still too large after compression. Please pick a smaller image.');
  }
  return fallbackOut;
}

export function validateCredentialFile(file: File): { fileName: string; mimeType: string; fileSize: number } {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isImage && !isPdf) {
    throw new Error('Unsupported format. Please select a JPG, PNG, WebP image or a PDF document.');
  }
  if (file.size > MAX_CREDENTIAL_BYTES) {
    throw new Error('File exceeds the 5 MB size limit. Please upload a smaller image or PDF.');
  }
  const cleanName = (file.name || 'document').replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 140);
  return {
    fileName: cleanName || 'document',
    mimeType: isPdf ? 'application/pdf' : file.type || 'image/jpeg',
    fileSize: file.size,
  };
}

export function uploadTechnicianCredentialToStorage(
  userId: string,
  docType: 'Certificate' | 'License' | 'Degree',
  file: File,
  onProgress?: (percent: number) => void
): Promise<{
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}> {
  const validated = validateCredentialFile(file);
  const uniqueName = `${Date.now()}_${validated.fileName}`.slice(0, 175);
  const storagePath = `technician-credentials/${userId}/${uniqueName}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: validated.mimeType,
      customMetadata: {
        ownerId: userId,
        docType,
      },
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (error) => {
        reject(new Error(error.message || 'Firebase Storage upload failed.'));
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          resolve({
            storagePath,
            downloadUrl,
            fileName: validated.fileName,
            mimeType: validated.mimeType,
            fileSize: validated.fileSize,
          });
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to retrieve Storage download URL.'));
        }
      }
    );
  });
}

export async function deleteTechnicianCredentialFromStorage(storagePath?: string): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (err) {
    // Ignore already-deleted objects when cleaning up Firestore linkage
    const code = (err as { code?: string })?.code;
    if (code !== 'storage/object-not-found') {
      throw err;
    }
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read selected file.'));
    };
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Invalid image file.'));
    img.src = src;
  });
}
