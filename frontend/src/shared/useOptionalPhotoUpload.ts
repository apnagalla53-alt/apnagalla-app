import { useState } from 'react';
import api from './api';
import { useAuthStore } from './store/authStore';
const photos=new Map<string,{file:File;expires:number}>();
useAuthStore.subscribe((state,previous)=>{if(state.authEpoch!==previous.authEpoch||state.tenantContext?.company_id!==previous.tenantContext?.company_id)photos.clear();});

export type PhotoUploadState = 'NOT_SELECTED' | 'SELECTED' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

export function useOptionalPhotoUpload(draftKey?:string) {
  const auth=useAuthStore.getState(),key=draftKey?[auth.user?.id,auth.tenantContext?.company_id,auth.tenantContext?.branch_id,draftKey].join(':'):'';
  const [file, setFile] = useState<File | null>(()=>{const cached=photos.get(key);return cached&&cached.expires>Date.now()?cached.file:null;});
  const [state, setState] = useState<PhotoUploadState>(file?'SELECTED':'NOT_SELECTED');
  function select(next: File | null) {
    if(key&&next){if(photos.size>=10&&!photos.has(key))photos.delete(photos.keys().next().value!);photos.set(key,{file:next,expires:Date.now()+8*3600000});}else if(key)photos.delete(key);
    setFile(next); setState(next ? 'SELECTED' : 'NOT_SELECTED');
  }
  async function upload(entityType: string, entityId: string, category: string) {
    if (!file) return;
    const body = new FormData();
    body.append('file', file); body.append('entityType', entityType);
    body.append('entityId', entityId); body.append('category', category);
    setState('UPLOADING');
    try { await api.post('/attachments', body); photos.delete(key); setState('UPLOADED'); }
    catch (error) { setState('FAILED'); throw error; }
  }
  return { file, state, failed: state === 'FAILED', select, upload };
}
