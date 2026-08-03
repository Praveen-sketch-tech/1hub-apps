import React from 'react';
import { StyleConfig } from '../types/resume';

interface StyleControlsProps {
  config: StyleConfig;
  onChange: (newConfig: StyleConfig) => void;
  onLoadSample: () => void;
  onReset: () => void;
  onExportJSON: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPrint: () => void;
}

export const StyleControls: React.FC<StyleControlsProps> = ({
  config,
  onChange,
  onLoadSample,
  onReset,
  onExportJSON,
  onImportJSON,
  onPrint
}) => {
  const colors = ['#2563eb', '#059669', '#7c3aed', '#dc2626', '#0f172a'];

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Layout Template</label>
          <select
            value={config.template}
            onChange={(e) => onChange({ ...config, template: e.target.value as StyleConfig['template'] })}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="modern">Modern Two-Column</option>
            <option value="classic">Classic ATS Standard</option>
            <option value="minimal">Minimalist Executive</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Font Style</label>
          <select
            value={config.fontFamily}
            onChange={(e) => onChange({ ...config, fontFamily: e.target.value as StyleConfig['fontFamily'] })}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="sans">Clean Sans-Serif</option>
            <option value="serif">Formal Serif</option>
            <option value="mono">Technical Monospace</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Accent Color</label>
          <div className="flex gap-2 items-center">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ ...config, themeColor: c })}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  config.themeColor === c ? 'border-black dark:border-white scale-110' : 'border-transparent'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onLoadSample}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
        >
          Sample Data
        </button>
        <button
          onClick={onExportJSON}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
        >
          Export JSON
        </button>
        <label className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition cursor-pointer">
          Import JSON
          <input type="file" accept=".json" onChange={onImportJSON} className="hidden" />
        </label>
        <button
          onClick={onPrint}
          className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition"
        >
          Print / Download PDF
        </button>
      </div>
    </div>
  );
};