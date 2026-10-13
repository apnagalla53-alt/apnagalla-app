import { useState } from 'react';
import api from './api';

export type PhotoUploadState = 'NOT_SELECTED' | 'SELECTED' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

export function useOptionalPhotoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<PhotoUploadState>('NOT_SELECTED');
  function select(next: File | null) {
    setFile(next); setState(next ? 'SELECTED' : 'NOT_SELECTED');
  }
  async function upload(entityType: string, entityId: string, category: string) {
    if (!file) return;
    const body = new FormData();
    body.append('file', file); body.append('entityType', entityType);
    body.append('entityId', entityId); body.append('category', category);
    setState('UPLOADING');
    try { await api.post('/attachments', body); setState('UPLOADED'); }
    catch (error) { setState('FAILED'); throw error; }
  }
  return { file, state, failed: state === 'FAILED', select, upload };
}
