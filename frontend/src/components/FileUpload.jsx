import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';

export default function FileUpload({ onUploadComplete, isProcessing }) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Please upload an Excel file (.xlsx)');
      return;
    }
    setFileName(file.name);
    onUploadComplete(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`card border-dashed border-2 rounded-lg px-8 py-8 text-center transition-all cursor-pointer focus-ring ${
        dragOver
          ? 'border-accent bg-accent-dim'
          : 'border-edge hover:border-accent/40 hover:bg-elevated/50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); }}}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {isProcessing ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
          <p className="text-[14px] font-medium text-hi">Processing {fileName}</p>
          <p className="text-[12px] text-lo">Aligning girth welds and matching anomalies across runs...</p>
        </div>
      ) : fileName ? (
        <div className="flex flex-col items-center gap-3">
          <FileSpreadsheet className="w-10 h-10 text-ok" />
          <p className="text-[14px] font-medium text-hi">{fileName}</p>
          <p className="text-[12px] text-lo">Drop another file or click to replace</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Upload className="w-10 h-10 text-lo" />
          <p className="text-[14px] font-medium text-hi">Upload Pipeline_Data.xlsx</p>
          <p className="text-[12px] text-lo">Drop file here or click to browse</p>
        </div>
      )}
    </div>
  );
}
