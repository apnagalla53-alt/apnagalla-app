import React, { useRef, useState, useEffect } from 'react';
import api from '../api';
import { Camera, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { ui, useUiLanguage } from '../../i18n';

interface AttachmentPickerProps {
  label?: string;
  imageLabel?: string;
  disabled?: boolean;
  // If the entity already exists and has an attachment
  existingAttachmentUrl?: string;
  // Called when user selects or clears a local file
  onFileSelect?: (file: File | null) => void;
  // If we are uploading immediately (for already existing entities)
  uploadImmediately?: {
    entityType: string;
    entityId: string;
    category: string;
  };
  onUploadSuccess?: (attachment: { id: string; url: string }) => void;
  onRemove?: () => void;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  label = 'Photo Attachment',
  imageLabel = 'receipt',
  disabled = false,
  existingAttachmentUrl,
  onFileSelect,
  uploadImmediately,
  onUploadSuccess,
  onRemove
}) => {
  useUiLanguage();
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [serverPreview, setServerPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false; let objectUrl: string | undefined;
    setServerPreview(null);
    if (existingAttachmentUrl) {
      const path = existingAttachmentUrl.replace(/^\/api\/v1/, '');
      if (!/^\/attachments\/[a-f0-9-]+\/content$/i.test(path)) { setError('Invalid attachment link'); return; }
      api.get(path, { responseType: 'blob' }).then(response => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data); setServerPreview(objectUrl);
      }).catch(() => { if (!cancelled) setError('Photo could not be loaded'); });
    }
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [existingAttachmentUrl]);

  useEffect(() => {
    if (localFile) {
      const url = URL.createObjectURL(localFile);
      setLocalPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setLocalPreview(null);
      return undefined;
    }
  }, [localFile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0) {
      setError(ui('Choose a JPG, PNG or WebP photo.'));
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum size is 5MB.');
      e.target.value = '';
      return;
    }

    setError(null);
    setLocalFile(file);
    if (onFileSelect) onFileSelect(file);

    if (uploadImmediately) {
      await performUpload(file);
    }
  };

  const performUpload = async (file: File) => {
    if (!uploadImmediately) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', uploadImmediately.entityType);
    formData.append('entityId', uploadImmediately.entityId);
    formData.append('category', uploadImmediately.category);

    setUploading(true);
    try {
      const response = await api.post('/attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (onUploadSuccess) onUploadSuccess(response.data);
      setLocalFile(null); // Clear local since it's now on server
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (localFile) {
      setLocalFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (onFileSelect) onFileSelect(null);
      return;
    }
    if (existingAttachmentUrl && onRemove) {
      try {
        await onRemove();
      } catch (err) {
        setError('Failed to remove photo');
      }
    }
  };

  const displayUrl = localPreview || serverPreview;

  return (
    <div className="r-attachment-picker border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-3">
      <div className="r-attachment-heading flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">{ui(label)}</h3>
        {uploading && <span className="text-xs text-blue-600 animate-pulse flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin"/> Uploading...</span>}
      </div>
      <p className="r-caption">Optional · JPG, PNG or WebP · Up to 5 MB</p>

      {error && (
        <div role="alert" className="r-attachment-error p-2 bg-red-50 text-red-600 text-xs rounded border border-red-200">
          {error}
        </div>
      )}

      {displayUrl ? (
        <div className="r-attachment-preview relative group rounded overflow-hidden border border-gray-200 bg-gray-50 flex justify-center">
          <img 
            src={displayUrl} 
            alt={ui(label)}
            className="max-h-48 object-contain"
          />
          <div className="r-attachment-actions absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-gray-800 rounded shadow text-sm font-medium hover:bg-gray-100"
            >
              {ui('Replace')}
            </button>
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={handleRemove}
              data-tone="danger"
              className="px-3 py-1.5 bg-red-600 text-white rounded shadow text-sm font-medium hover:bg-red-700"
            >
              {ui('Remove')}
            </button>
          </div>
        </div>
      ) : (
        <div className="r-attachment-actions flex gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 py-3 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-600 transition-colors"
            disabled={disabled || uploading}
          >
            <Camera className="w-6 h-6" />
            <span className="text-sm font-medium">{ui('Camera')}</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-3 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-600 transition-colors"
            disabled={disabled || uploading}
          >
            <ImageIcon className="w-6 h-6" />
            <span className="text-sm font-medium">{ui('Gallery')}</span>
          </button>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        hidden
        disabled={disabled || uploading}
        aria-label={'Choose ' + imageLabel + ' image from gallery'}
        onChange={handleFileChange}
        className="hidden"
        accept="image/jpeg, image/png, image/webp"
      />
      <input
        type="file"
        ref={cameraInputRef}
        hidden
        disabled={disabled || uploading}
        aria-label={'Take ' + imageLabel + ' photo'}
        onChange={handleFileChange}
        className="hidden"
        accept="image/jpeg, image/png, image/webp"
        capture="environment"
      />
    </div>
  );
};
