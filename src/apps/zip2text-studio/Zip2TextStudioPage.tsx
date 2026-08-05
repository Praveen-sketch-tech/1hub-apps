import React, { useState, useCallback, useRef } from 'react';
import { FileArchive, UploadCloud, Settings, Download, Copy, Search, Code, CheckCircle, Trash2, FileText, Layers } from 'lucide-react';
import { ExtractedFile, ExtractionStats, AppConfig } from './types';
import { DEFAULT_CONFIG, formatBytes } from './lib/constants';
import { processZipFile } from './lib/zipProcessor';
import { generateExportText, generateSplitExportChunks, wrapFileBlock } from './lib/exportFormatter';

const Zip2TextStudioPage: React.FC = () => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [projectName, setProjectName] = useState<string>('project');
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [stats, setStats] = useState<ExtractionStats | null>(null);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      await processFile(file);
    } else {
      alert('Please upload a valid .zip file');
    }
  }, [config]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    try {
      setProjectName(file.name.replace('.zip', ''));
      const result = await processZipFile(file, config);
      setFiles(result.files);
      setStats(result.stats);
    } catch (error) {
      console.error('Error processing zip:', error);
      alert("Failed to process ZIP file. Make sure it's valid.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredFiles = files.filter(f =>
    f.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyAll = async () => {
    const text = generateExportText(files, config, projectName);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(-1);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleDownloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    if (config.splitContext) {
      const chunks = generateSplitExportChunks(files, config, projectName);
      chunks.forEach((chunk, i) => {
        setTimeout(() => {
          handleDownloadFile(chunk.content, chunk.filename);
        }, i * 300);
      });
    } else {
      const text = generateExportText(files, config, projectName);
      handleDownloadFile(text, `${projectName}-code-export.txt`);
    }
  };

  const resetState = () => {
    setFiles([]);
    setStats(null);
    setSearchTerm('');
    setProjectName('project');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
              <FileArchive className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold dark:text-white">Zip2Text Studio</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Extract repository text for AI context & audits</p>
            </div>
          </div>
          {files.length > 0 && (
            <button
              onClick={resetState}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Clear Session
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Config */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-4 dark:text-white uppercase tracking-wider text-slate-500">
                <Settings className="w-4 h-4" /> Configuration
              </h2>
              <div className="space-y-5">
                {/* AI Mode Toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium dark:text-slate-200 block">AI Ready Mode</span>
                    <span className="text-xs text-slate-500 block">Adds AI prompt headers</span>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only"
                      checked={config.aiReadyMode}
                      onChange={(e) => setConfig({ ...config, aiReadyMode: e.target.checked })}
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${config.aiReadyMode ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${config.aiReadyMode ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                </label>

                {/* AI Splitter Toggle */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <label className="flex items-center justify-between cursor-pointer mb-2">
                    <div>
                      <span className="text-sm font-medium dark:text-slate-200 block">Context Splitter</span>
                      <span className="text-xs text-slate-500 block">Split large codebases</span>
                    </div>
                    <div className="relative">
                      <input type="checkbox" className="sr-only"
                        checked={config.splitContext}
                        onChange={(e) => setConfig({ ...config, splitContext: e.target.checked })}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${config.splitContext ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${config.splitContext ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                  {config.splitContext && (
                    <div className="mt-2">
                      <label className="text-xs text-slate-500 mb-1 block">Max Characters per Chunk</label>
                      <input
                        type="number"
                        value={config.chunkSizeLimit}
                        onChange={(e) => setConfig({ ...config, chunkSizeLimit: Number(e.target.value) })}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Extensions */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <label className="text-sm font-medium dark:text-slate-200 block mb-2">Target Extensions</label>
                  <textarea
                    value={config.includeExtensions.join(', ')}
                    onChange={(e) => setConfig({ ...config, includeExtensions: e.target.value.split(',').map(s => s.trim()) })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20"
                  />
                  <p className="text-xs text-slate-500 mt-1">Comma separated</p>
                </div>

                {/* Excludes */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <label className="text-sm font-medium dark:text-slate-200 block mb-2">Exclude Patterns</label>
                  <textarea
                    value={config.excludePatterns.join('\n')}
                    onChange={(e) => setConfig({ ...config, excludePatterns: e.target.value.split('\n').map(s => s.trim()) })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none h-28"
                  />
                  <p className="text-xs text-slate-500 mt-1">One per line (dirs or file names)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Area */}
          <div className="lg:col-span-3 flex flex-col space-y-6">
            {!files.length ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl transition-all ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500'}`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInput}
                  accept=".zip"
                  className="hidden"
                />
                {isLoading ? (
                  <div className="flex flex-col items-center animate-pulse">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Extracting repository...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6">
                      <UploadCloud className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 dark:text-white text-center">Upload Repository ZIP</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-center max-w-sm mb-8">
                      Drag & drop your source code ZIP file here, or click to browse. We'll automatically filter and format the code.
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                    >
                      Browse Files
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Stats Panel */}
                {stats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                      <div className="p-3 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Files Found</p>
                        <p className="text-lg font-bold dark:text-white">{stats.totalFiles}</p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                      <div className="p-3 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                        <Code className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Code Files</p>
                        <p className="text-lg font-bold dark:text-white">{stats.codeFiles}</p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                      <div className="p-3 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Total Lines</p>
                        <p className="text-lg font-bold dark:text-white">{stats.totalLines.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                      <div className="p-3 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg">
                        <FileArchive className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Payload Size</p>
                        <p className="text-lg font-bold dark:text-white">{formatBytes(stats.totalSize)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Toolbar & Search */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-center">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search path or filename..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                      onClick={handleCopyAll}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors"
                    >
                      {copiedIndex === -1 ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copiedIndex === -1 ? 'Copied All' : 'Copy All Text'}
                    </button>
                    <button
                      onClick={handleDownloadAll}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm shadow-blue-500/20"
                    >
                      <Download className="w-4 h-4" />
                      {config.splitContext ? 'Download Chunks' : 'Download TXT'}
                    </button>
                  </div>
                </div>

                {/* File List */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex-1 max-h-[600px] flex flex-col shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      Extracted Files ({filteredFiles.length})
                    </span>
                  </div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-2">
                    {filteredFiles.map((file, idx) => (
                      <div key={file.id} className="group flex flex-col p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                            <div className="truncate">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate" title={file.path}>
                                {file.path}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                  {formatBytes(file.size)}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {file.lines} lines
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(wrapFileBlock(file.path, file.content).trim());
                              setCopiedIndex(idx);
                              setTimeout(() => setCopiedIndex(null), 2000);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="Copy single file context"
                          >
                            {copiedIndex === idx ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredFiles.length === 0 && (
                      <div className="p-8 text-center text-slate-500">
                        No files match your search criteria or target extensions.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Zip2TextStudioPage;