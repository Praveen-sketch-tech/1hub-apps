import React, { useState, useEffect, useRef } from 'react';
import { PreviewMode, LayoutMode, Theme, ValidationIssue, DOMStats, RecentFile } from './types';
import { defaultHtml } from './lib/sampleData';

const MainPage: React.FC = () => {
  const [code, setCode] = useState<string>(defaultHtml);
  const [renderedCode, setRenderedCode] = useState<string>(defaultHtml);
  const [fileName, setFileName] = useState<string>('untitled.html');
  
  // Settings
  const [theme, setTheme] = useState<Theme>('dark');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split-h');
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [wordWrap, setWordWrap] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(14);
  const [splitRatio, setSplitRatio] = useState<number>(50); // percentage
  
  // Inspector Data
  const [stats, setStats] = useState<DOMStats>({ lines: 0, chars: 0, words: 0, tags: 0, images: 0, links: 0, scripts: 0, styles: 0 });
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'validation'>('stats');
  
  // Modals
  const [showRecent, setShowRecent] = useState<boolean>(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDragging = useRef<boolean>(false);

  // Initialize
  useEffect(() => {
    const savedTheme = localStorage.getItem('htmlEditor_theme') as Theme;
    if (savedTheme) setTheme(savedTheme);
    
    const savedRecent = JSON.parse(localStorage.getItem('htmlEditor_recent') || '[]');
    setRecentFiles(savedRecent);
  }, []);

  // Sync rendered code if auto-refresh is on
  useEffect(() => {
    if (isAutoRefresh) {
      const timer = setTimeout(() => {
        setRenderedCode(code);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [code, isAutoRefresh]);

  // Inspector calculations
  useEffect(() => {
    const timer = setTimeout(() => {
      const lines = code.split('\n').length;
      const chars = code.length;
      const words = code.trim().split(/\s+/).filter(w => w.length > 0).length;

      const parser = new DOMParser();
      const doc = parser.parseFromString(code, 'text/html');

      setStats({
        lines,
        chars,
        words,
        tags: doc.querySelectorAll('*').length,
        images: doc.querySelectorAll('img').length,
        links: doc.querySelectorAll('a').length,
        scripts: doc.querySelectorAll('script').length,
        styles: doc.querySelectorAll('style, link[rel="stylesheet"]').length
      });

      const errors: ValidationIssue[] = [];
      const idSet = new Set();
      doc.querySelectorAll('[id]').forEach(el => {
        if (el.id) {
          if (idSet.has(el.id)) errors.push({ type: 'error', message: `Duplicate ID found: "${el.id}"` });
          idSet.add(el.id);
        }
      });
      
      doc.querySelectorAll('*').forEach(el => {
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          if (['class', 'id', 'href', 'src'].includes(attr.name) && attr.value.trim() === '') {
            errors.push({ type: 'warning', message: `Empty attribute '${attr.name}' on <${el.tagName.toLowerCase()}>` });
          }
        }
      });

      if (errors.length === 0) {
        errors.push({ type: 'success', message: 'No HTML issues detected. Clean markup.' });
      }
      setValidationIssues(errors);
    }, 800);
    return () => clearTimeout(timer);
  }, [code]);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab Support
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);
      
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
    // Shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleFileOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      alert('File is too large! Maximum allowed size is 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setCode(ev.target.result as string);
        setFileName(file.name);
        addToRecent(file.name, ev.target.result as string);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = () => {
    addToRecent(fileName, code);
    alert('File saved to local storage/recent files.');
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addToRecent = (name: string, content: string) => {
    const newRecent = [{ name, content, date: new Date().toLocaleString() }, ...recentFiles.filter(f => f.name !== name)].slice(0, 5);
    setRecentFiles(newRecent);
    localStorage.setItem('htmlEditor_recent', JSON.stringify(newRecent));
  };

  const formatCode = () => {
    let formatted = '';
    let indent = 0;
    const lines = code.replace(/>\s+</g, '><').split(/(?=<)|(?<=>)/);
    
    lines.forEach(line => {
      if (line.match(/^<\/\w/)) indent = Math.max(0, indent - 1);
      formatted += '    '.repeat(indent) + line + '\n';
      if (line.match(/^<\w[^>]*[^\/]>$/) && !line.startsWith('<input') && !line.startsWith('<img') && !line.startsWith('<br') && !line.startsWith('<hr') && !line.startsWith('<meta') && !line.startsWith('<link')) {
        indent += 1;
      }
    });
    setCode(formatted.trim());
  };

  const minifyCode = () => {
    let minified = code.replace(/<!--[\s\S]*?-->/g, ''); 
    minified = minified.replace(/>\s+</g, '><'); 
    minified = minified.replace(/\s{2,}/g, ' '); 
    setCode(minified.trim());
  };

  const handleReplace = () => {
    const find = prompt('Find text:');
    if (!find) return;
    const replace = prompt(`Replace "${find}" with:`);
    if (replace === null) return;
    setCode(code.split(find).join(replace));
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('htmlEditor_theme', newTheme);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    if (layoutMode === 'split-h') {
      const newRatio = (e.clientX / window.innerWidth) * 100;
      setSplitRatio(Math.min(Math.max(newRatio, 10), 90));
    } else if (layoutMode === 'split-v') {
      const newRatio = ((e.clientY - 50) / (window.innerHeight - 50 - 150)) * 100; 
      setSplitRatio(Math.min(Math.max(newRatio, 10), 90));
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'default';
  };

  const handleMouseDown = () => {
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = layoutMode === 'split-h' ? 'col-resize' : 'row-resize';
  };

  const previewStyle = () => {
    if (previewMode === 'tablet') return { width: '768px', height: '1024px', maxHeight: '100%' };
    if (previewMode === 'mobile') return { width: '375px', height: '812px', maxHeight: '100%' };
    return { width: '100%', height: '100%' };
  };

  const isDark = theme === 'dark';
  const hoverBtnClass = isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-gray-200';
  const activeBtnClass = isDark ? 'bg-[#094771] text-white' : 'bg-blue-200 text-blue-900';

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans transition-colors duration-200 ${isDark ? "bg-[#1e1e1e] text-[#d4d4d4]" : "bg-white text-gray-800"}`}>
      <input type="file" ref={fileInputRef} className="hidden" accept=".html,.htm,.txt" onChange={handleFileOpen} />

      <div className={`flex flex-wrap items-center gap-2 px-3 py-2 border-b ${isDark ? "bg-[#252526] border-[#333]" : "bg-gray-100 border-gray-300"}`}>
        <div className={`flex items-center gap-1 pr-2 border-r ${isDark ? "border-[#444]" : "border-gray-300"}`}>
          <button onClick={() => fileInputRef.current?.click()} className={`p-1.5 rounded ${hoverBtnClass}`} title="Open File">📂</button>
          <button onClick={() => setShowRecent(true)} className={`p-1.5 rounded ${hoverBtnClass}`} title="Recent Files">🕒</button>
          <button onClick={handleSave} className={`p-1.5 rounded ${hoverBtnClass}`} title="Save (Ctrl+S)">💾</button>
          <button onClick={handleDownload} className={`p-1.5 rounded ${hoverBtnClass}`} title="Download HTML">⬇️</button>
        </div>

        <div className={`flex items-center gap-1 pr-2 border-r ${isDark ? "border-[#444]" : "border-gray-300"}`}>
          <button onClick={handleReplace} className={`px-2 py-1.5 text-xs font-medium rounded ${hoverBtnClass}`} title="Find & Replace">🔍 Replace</button>
          <button onClick={formatCode} className={`px-2 py-1.5 text-xs font-medium rounded ${hoverBtnClass}`} title="Beautify Code">✨ Format</button>
          <button onClick={minifyCode} className={`px-2 py-1.5 text-xs font-medium rounded ${hoverBtnClass}`} title="Minify Code">🗜️ Minify</button>
          <button onClick={() => setWordWrap(!wordWrap)} className={`px-2 py-1.5 text-xs font-medium rounded ${wordWrap ? activeBtnClass : hoverBtnClass}`}>📄 Wrap</button>
          <button onClick={() => setFontSize(f => Math.min(f + 2, 24))} className={`p-1.5 rounded ${hoverBtnClass}`} title="Zoom In">A+</button>
          <button onClick={() => setFontSize(f => Math.max(f - 2, 8))} className={`p-1.5 rounded ${hoverBtnClass}`} title="Zoom Out">A-</button>
        </div>

        <div className={`flex items-center gap-1 pr-2 border-r ${isDark ? "border-[#444]" : "border-gray-300"}`}>
          <button onClick={() => setPreviewMode('desktop')} className={`p-1.5 rounded ${previewMode === 'desktop' ? activeBtnClass : hoverBtnClass}`} title="Desktop">💻</button>
          <button onClick={() => setPreviewMode('tablet')} className={`p-1.5 rounded ${previewMode === 'tablet' ? activeBtnClass : hoverBtnClass}`} title="Tablet">📱</button>
          <button onClick={() => setPreviewMode('mobile')} className={`p-1.5 rounded ${previewMode === 'mobile' ? activeBtnClass : hoverBtnClass}`} title="Mobile">📱</button>
          
          <div className="flex items-center gap-1 ml-2">
            <input type="checkbox" id="auto-refresh" checked={isAutoRefresh} onChange={(e) => setIsAutoRefresh(e.target.checked)} className="cursor-pointer" />
            <label htmlFor="auto-refresh" className="text-xs cursor-pointer select-none">Auto-run</label>
          </div>
          <button onClick={() => setRenderedCode(code)} disabled={isAutoRefresh} className={`ml-1 px-2 py-1 text-xs rounded font-medium ${!isAutoRefresh ? "bg-blue-600 hover:bg-blue-700 text-white" : "opacity-50 cursor-not-allowed"}`}>▶ Run</button>
        </div>

        <div className={`flex items-center gap-1 pr-2 border-r ${isDark ? "border-[#444]" : "border-gray-300"}`}>
          <button onClick={() => setLayoutMode('split-h')} className={`p-1.5 rounded ${layoutMode === 'split-h' ? activeBtnClass : hoverBtnClass}`} title="Split Horizontal">↔️</button>
          <button onClick={() => setLayoutMode('split-v')} className={`p-1.5 rounded ${layoutMode === 'split-v' ? activeBtnClass : hoverBtnClass}`} title="Split Vertical">↕️</button>
          <button onClick={() => setLayoutMode('editor-only')} className={`p-1.5 rounded ${layoutMode === 'editor-only' ? activeBtnClass : hoverBtnClass}`} title="Editor Only">📝</button>
          <button onClick={() => setLayoutMode('preview-only')} className={`p-1.5 rounded ${layoutMode === 'preview-only' ? activeBtnClass : hoverBtnClass}`} title="Preview Only">👁️</button>
        </div>

        <div className="ml-auto">
          <button onClick={toggleTheme} className={`p-1.5 rounded ${hoverBtnClass}`}>
            {isDark ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      <div className={`flex flex-1 overflow-hidden ${layoutMode === 'split-v' ? "flex-col" : "flex-row"}`}>
        
        {(layoutMode === 'split-h' || layoutMode === 'split-v' || layoutMode === 'editor-only') && (
          <div className="flex flex-col relative" style={{ flexBasis: layoutMode === 'editor-only' ? '100%' : `${splitRatio}%`, flexGrow: 0, flexShrink: 0 }}>
            <div className="flex flex-1 overflow-hidden">
              <div ref={lineNumbersRef} className={`py-4 pr-3 pl-2 text-right select-none overflow-hidden font-mono text-sm ${isDark ? "bg-[#1e1e1e] text-[#858585]" : "bg-gray-100 text-gray-500"}`} style={{ fontSize: `${fontSize}px`, minWidth: '40px' }}>
                {code.split('\n').map((_, i) => (
                  <div key={i} className="leading-relaxed">{i + 1}</div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                spellCheck="false"
                className={`flex-1 p-4 m-0 border-none outline-none resize-none font-mono leading-relaxed ${isDark ? "bg-[#1e1e1e] text-[#d4d4d4]" : "bg-white text-gray-900"}`}
                style={{ fontSize: `${fontSize}px`, whiteSpace: wordWrap ? 'pre-wrap' : 'pre' }}
              />
            </div>
            <div className={`flex justify-between items-center px-3 py-1 text-xs border-t ${isDark ? "bg-[#007acc] text-white border-transparent" : "bg-blue-600 text-white border-blue-700"}`}>
              <span>{fileName}</span>
              <span>{code.length} chars</span>
            </div>
          </div>
        )}

        {(layoutMode === 'split-h' || layoutMode === 'split-v') && (
          <div onMouseDown={handleMouseDown} className={`${layoutMode === 'split-h' ? "w-1.5 cursor-col-resize hover:w-2" : "h-1.5 cursor-row-resize hover:h-2"} bg-blue-500/20 hover:bg-blue-500/50 transition-all z-10`} />
        )}

        {(layoutMode === 'split-h' || layoutMode === 'split-v' || layoutMode === 'preview-only') && (
          <div className="flex-1 flex items-center justify-center bg-gray-200 dark:bg-black/80 relative overflow-hidden p-4">
            <div className="bg-white rounded shadow-2xl transition-all duration-300 ease-in-out overflow-hidden relative" style={previewStyle()}>
              <iframe title="preview" srcDoc={renderedCode} sandbox="allow-scripts allow-modals allow-same-origin allow-forms" className="w-full h-full border-none bg-white" />
            </div>
          </div>
        )}
      </div>

      <div className={`h-[150px] shrink-0 border-t flex flex-col ${isDark ? "bg-[#252526] border-[#333]" : "bg-gray-100 border-gray-300"}`}>
        <div className={`flex border-b text-sm font-medium ${isDark ? "border-[#333]" : "border-gray-300"}`}>
          <button onClick={() => setActiveTab('stats')} className={`px-4 py-2 border-b-2 transition-colors ${activeTab === 'stats' ? "border-blue-500 text-blue-500" : "border-transparent text-gray-500 hover:text-gray-400"}`}>
            📊 DOM Stats
          </button>
          <button onClick={() => setActiveTab('validation')} className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-1 ${activeTab === 'validation' ? "border-blue-500 text-blue-500" : "border-transparent text-gray-500 hover:text-gray-400"}`}>
            🚨 Validation
            {validationIssues.some(i => i.type === 'error') && <span className="flex h-2 w-2 rounded-full bg-red-500 ml-1"></span>}
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 text-sm">
          {activeTab === 'stats' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-2 rounded ${isDark ? "bg-[#1e1e1e]" : "bg-white shadow-sm"}`}><strong>Lines:</strong> {stats.lines}</div>
              <div className={`p-2 rounded ${isDark ? "bg-[#1e1e1e]" : "bg-white shadow-sm"}`}><strong>Characters:</strong> {stats.chars}</div>
              <div className={`p-2 rounded ${isDark ? "bg-[#1e1e1e]" : "bg-white shadow-sm"}`}><strong>Words:</strong> {stats.words}</div>
              <div className={`p-2 rounded ${isDark ? "bg-[#1e1e1e]" : "bg-white shadow-sm"}`}><strong>HTML Tags:</strong> {stats.tags}</div>
              <div className={`p-2 rounded ${isDark ? "bg-[#1e1e1e]" : "bg-white shadow-sm"}`}><strong>Images:</strong> {stats.images}</div>
              <div className={`p-2 rounded ${isDark ? "bg-[#1e1e1e]" : "bg-white shadow-sm"}`}><strong>Links:</strong> {stats.links}</div>
              <div className={`p-2 rounded ${isDark ? "bg-[#1e1e1e]" : "bg-white shadow-sm"}`}><strong>Scripts:</strong> {stats.scripts}</div>
              <div className={`p-2 rounded ${isDark ? "bg-[#1e1e1e]" : "bg-white shadow-sm"}`}><strong>Styles:</strong> {stats.styles}</div>
            </div>
          )}

          {activeTab === 'validation' && (
            <div className="space-y-2">
              {validationIssues.map((issue, idx) => (
                <div key={idx} className={`p-2 rounded border ${
                  issue.type === 'error' ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400" :
                  issue.type === 'warning' ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400" :
                  "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                }`}>
                  {issue.type === 'error' && '❌ '}
                  {issue.type === 'warning' && '⚠️ '}
                  {issue.type === 'success' && '✅ '}
                  {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showRecent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-lg shadow-xl overflow-hidden ${isDark ? "bg-[#252526]" : "bg-white"}`}>
            <div className={`flex justify-between items-center p-4 border-b ${isDark ? "border-[#333]" : "border-gray-200"}`}>
              <h2 className="text-lg font-semibold">Recent Files</h2>
              <button onClick={() => setShowRecent(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-300">✕</button>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto">
              {recentFiles.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No recent files found.</div>
              ) : (
                recentFiles.map((file, idx) => (
                  <div key={idx} className={`flex justify-between items-center p-3 rounded mb-1 cursor-pointer transition-colors ${isDark ? "hover:bg-[#333]" : "hover:bg-gray-100"}`} onClick={() => { setCode(file.content); setFileName(file.name); setShowRecent(false); }}>
                    <div>
                      <div className="font-medium">{file.name}</div>
                      <div className="text-xs text-gray-500">{file.date}</div>
                    </div>
                    <button className="text-blue-500 text-sm font-medium px-3 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20">Load</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainPage;
