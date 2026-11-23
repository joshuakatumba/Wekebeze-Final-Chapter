import React, { useEffect, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { PageHead, FileUploadBox, EmptyState, PageSkeleton } from "../components/ui";

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(ENDPOINTS.files);
      setFiles(Array.isArray(res) ? res : res.results || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.upload(ENDPOINTS.files, fd);
      toast("File uploaded");
      load();
    } catch (err) {
      toast(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    await api.delete(ENDPOINTS.file(id));
    setFiles((prev) => prev.filter((f) => f.id !== id));
    toast("File deleted");
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHead title="Files" />
      <FileUploadBox onFile={handleUpload} busy={uploading} label="Upload document or media" />
      {files.length === 0 ? (
        <EmptyState title="No files uploaded yet" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr><th>Name</th><th>Size</th><th /></tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td><a href={f.file} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{f.original_name}</a></td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{Math.max(1, Math.round((f.size_bytes || 0) / 1024))} KB</td>
                  <td style={{ textAlign: "right" }}>
                    <button onClick={() => handleDelete(f.id)} style={{ background: "none", border: "none", color: "var(--color-alarm-red)", cursor: "pointer" }}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

