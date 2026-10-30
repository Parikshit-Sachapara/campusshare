import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, X } from 'lucide-react';
import styles from './FileUpload.module.css';

export interface FileUploadProps {
  label?: string;
  maxSizeMb?: number;
  acceptedTypes?: string[];
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  maxSizeMb = 5,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  multiple = false,
  onFilesSelected,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const validateAndAdd = (newFiles: FileList | File[]) => {
    setErrorMsg(null);
    const valid: File[] = [];
    const maxBytes = maxSizeMb * 1024 * 1024;

    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i];
      if (acceptedTypes.length > 0 && !acceptedTypes.includes(f.type)) {
        setErrorMsg(`Invalid file type: ${f.name}. Allowed: ${acceptedTypes.join(', ')}`);
        return;
      }
      if (f.size > maxBytes) {
        setErrorMsg(`File too large: ${f.name}. Maximum allowed size is ${maxSizeMb} MB`);
        return;
      }
      valid.push(f);
    }

    const updated = multiple ? [...selectedFiles, ...valid] : valid;
    setSelectedFiles(updated);
    onFilesSelected(updated);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAdd(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
    onFilesSelected(updated);
  };

  return (
    <div className={className}>
      {label && (
        <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 'var(--text-sm)' }}>
          {label}
        </div>
      )}

      <div
        className={`${styles.dropzone} ${dragActive ? styles.dragActive : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <div className={styles.iconCircle}>
          <UploadCloud size={24} />
        </div>
        <div className={styles.promptText}>
          Click or drag files here to upload
        </div>
        <div className={styles.hintText}>
          PNG, JPG, WEBP, or PDF up to {maxSizeMb} MB
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          className={styles.fileInput}
          onChange={(e) => {
            if (e.target.files) validateAndAdd(e.target.files);
          }}
        />
      </div>

      {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

      {selectedFiles.length > 0 && (
        <div className={styles.previewContainer}>
          {selectedFiles.map((file, idx) => {
            const isImg = file.type.startsWith('image/');
            const previewUrl = isImg ? URL.createObjectURL(file) : null;

            return (
              <div key={`${file.name}-${idx}`} className={styles.fileItem}>
                <div className={styles.fileMeta}>
                  {previewUrl ? (
                    <img src={previewUrl} alt={file.name} className={styles.thumbnail} />
                  ) : (
                    <FileText size={28} color="var(--ink-soft)" />
                  )}
                  <div className={styles.fileDetails}>
                    <span className={styles.fileName}>{file.name}</span>
                    <span className={styles.fileSize}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className={styles.removeBtn}
                  aria-label="Remove uploaded file"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
