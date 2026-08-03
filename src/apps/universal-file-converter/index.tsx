import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import {
convertImageFile,
createTextFileBlob,
createPdfFromText,
convertJsonToCsv,
ImageFormat,
TextFormat,
ConvertedFileResult,
} from './utils/converter';
export function UniversalFileConverterPage() {
const [activeTab, setActiveTab] = useState<'image' | 'text' | 'json'>('image');
// Image State
const [imageFile, setImageFile] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string | null>(null);
const [targetImageFormat, setTargetImageFormat] = useState<ImageFormat>('image/jpeg');
const [imageQuality, setImageQuality] = useState<number>(0.9);
const [convertedImage, setConvertedImage] = useState<ConvertedFileResult | null>(null);
const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
// Text State
const [textContent, setTextContent] = useState<string>('');
const [docTitle, setDocTitle] = useState<string>('My_Document');
const [targetTextFormat, setTargetTextFormat] = useState<TextFormat>('pdf');
const [generatedTextFile, setGeneratedTextFile] = useState<ConvertedFileResult | null>(null);
// JSON to CSV State
const [jsonInput, setJsonInput] = useState<string>(
'[\n  { "id": 1, "name": "Aarav", "role": "Developer" },\n  { "id": 2, "name": "Priya", "role": "Designer" }\n]'
);
const [csvOutput, setCsvOutput] = useState<ConvertedFileResult | null>(null);
const [jsonError, setJsonError] = useState<string | null>(null);
const fileInputRef = useRef<HTMLInputElement>(null);
// Drag & Drop
const [isDragging, setIsDragging] = useState<boolean>(false);
const handleImageSelect = (file: File) => {
if (!file.type.startsWith('image/')) {
alert('Please upload an image file');
return;
}
setImageFile(file);
setConvertedImage(null);
const reader = new FileReader();
reader.onload = (e) => setImagePreview(e.target?.result as string);
reader.readAsDataURL(file);
};
const handleDrop = (e: DragEvent<HTMLDivElement>) => {
e.preventDefault();
setIsDragging(false);
if (e.dataTransfer.files && e.dataTransfer.files[0]) {
handleImageSelect(e.dataTransfer.files[0]);
}
};
const handleProcessImage = async () => {
if (!imageFile) return;
setIsProcessingImage(true);
try {
const result = await convertImageFile(imageFile, targetImageFormat, imageQuality);
setConvertedImage(result);
} catch (err) {
alert(`Error converting image: ${(err as Error).message}`);
} finally {
setIsProcessingImage(false);
}
};
const handleGenerateTextFile = () => {
if (!textContent.trim()) {
alert('Please enter text content before converting');
return;
}
if (targetTextFormat === 'pdf') {
const result = createPdfFromText(textContent, docTitle);
setGeneratedTextFile(result);
} else {
const result = createTextFileBlob(textContent, docTitle, targetTextFormat);
setGeneratedTextFile(result);
}
};
const handleConvertJsonToCsv = () => {
setJsonError(null);
try {
const csvText = convertJsonToCsv(jsonInput);
const result = createTextFileBlob(csvText, 'data_export', 'csv');
setCsvOutput(result);
} catch (err) {
setJsonError((err as Error).message);
}
};
const formatBytes = (bytes: number) => {
if (bytes === 0) return '0 Bytes';
const k = 1024;
const sizes = ['Bytes', 'KB', 'MB'];
const i = Math.floor(Math.log(bytes) / Math.log(k));
return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
return (
<div className="max-w-5xl mx-auto p-6 bg-slate-50 min-h-screen text-slate-800">
<header className="mb-8 text-center">
<h1 className="text-3xl font-bold text-slate-900 mb-2">Universal File Converter</h1>
<p className="text-slate-600">
Fast, secure, and local browser-based file conversion. No files leave your device.
</p>
</header>
{/* Navigation Tabs */}
<div className="flex justify-center border-b border-slate-200 mb-8">
<button
onClick={() => setActiveTab('image')}
className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${ activeTab === 'image' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800' }`}
>
Image Converter
</button>
<button
onClick={() => setActiveTab('text')}
className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${ activeTab === 'text' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800' }`}
>
Text & PDF Generator
</button>
<button
onClick={() => setActiveTab('json')}
className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${ activeTab === 'json' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800' }`}
>
JSON to CSV
</button>
</div>
{/* TAB 1: IMAGE CONVERTER */}
{activeTab === 'image' && (
<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
<div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
<h2 className="text-lg font-semibold text-slate-900 mb-4">1. Select Image</h2>
<div
onDragOver={(e) => {
e.preventDefault();
setIsDragging(true);
}}
onDragLeave={() => setIsDragging(false)}
onDrop={handleDrop}
onClick={() => fileInputRef.current?.click()}
className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${ isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50' }`}
>
<input
type="file"
ref={fileInputRef}
className="hidden"
accept="image/*"
onChange={(e: ChangeEvent<HTMLInputElement>) => {
if (e.target.files && e.target.files[0]) {
handleImageSelect(e.target.files[0]);
}
}}
/>
<p className="text-sm text-slate-600 font-medium">
Click or drag & drop image here
</p>
<p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP, GIF supported</p>
</div>
{imagePreview && (
<div className="mt-6">
<p className="text-xs font-semibold text-slate-500 uppercase mb-2">Original Preview</p>
<div className="relative bg-slate-100 rounded-lg overflow-hidden max-h-48 flex items-center justify-center p-2">
<img
src={imagePreview}
alt="Preview"
className="max-h-40 object-contain rounded"
/>
</div>
{imageFile && (
<div className="mt-2 text-xs text-slate-500 flex justify-between">
<span>{imageFile.name}</span>
<span>{formatBytes(imageFile.size)}</span>
</div>
)}
</div>
)}
</div>
<div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
<div>
<h2 className="text-lg font-semibold text-slate-900 mb-4">2. Conversion Settings</h2>
<div className="mb-4">
<label className="block text-sm font-medium text-slate-700 mb-2">Target Format</label>
<div className="grid grid-cols-3 gap-2">
{[
{ label: 'JPG', value: 'image/jpeg' },
{ label: 'PNG', value: 'image/png' },
{ label: 'WEBP', value: 'image/webp' },
].map((fmt) => (
<button
key={fmt.value}
onClick={() => setTargetImageFormat(fmt.value as ImageFormat)}
className={`py-2 text-sm rounded-md font-medium border transition-colors ${ targetImageFormat === fmt.value ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50' }`}
>
{fmt.label}
</button>
))}
</div>
</div>
{targetImageFormat !== 'image/png' && (
<div className="mb-6">
<div className="flex justify-between items-center mb-1">
<label className="text-sm font-medium text-slate-700">Quality</label>
<span className="text-xs font-semibold text-slate-500">
{Math.round(imageQuality * 100)}%
</span>
</div>
<input
type="range"
min="0.1"
max="1.0"
step="0.05"
value={imageQuality}
onChange={(e) => setImageQuality(parseFloat(e.target.value))}
className="w-full accent-indigo-600"
/>
</div>
)}
<button
onClick={handleProcessImage}
disabled={!imageFile || isProcessingImage}
className={`w-full py-3 rounded-lg font-semibold text-white shadow transition-colors ${ !imageFile || isProcessingImage ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700' }`}
>
{isProcessingImage ? 'Converting...' : 'Convert Image'}
</button>
</div>
{convertedImage && (
<div className="mt-6 pt-6 border-t border-slate-100">
<div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
<div className="flex justify-between items-center mb-2">
<span className="text-sm font-medium text-emerald-900">
Conversion Complete
</span>
<span className="text-xs text-emerald-700 font-semibold">
{formatBytes(convertedImage.size)}
</span>
</div>
<a
href={convertedImage.url}
download={convertedImage.filename}
className="block w-full text-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold transition-colors"
>
Download {convertedImage.filename}
</a>
</div>
</div>
)}
</div>
</div>
)}
{/* TAB 2: TEXT & PDF GENERATOR */}
{activeTab === 'text' && (
<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
<div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
<div className="mb-4">
<label className="block text-sm font-medium text-slate-700 mb-1">Document Title</label>
<input
type="text"
value={docTitle}
onChange={(e) => setDocTitle(e.target.value)}
className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
placeholder="Enter file title..."
/>
</div>
<div>
<label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
<textarea
value={textContent}
onChange={(e) => setTextContent(e.target.value)}
rows={12}
className="w-full border border-slate-300 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
placeholder="Type or paste your content here..."
/>
</div>
</div>
<div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
<div>
<h2 className="text-lg font-semibold text-slate-900 mb-4">Export Options</h2>
<div className="space-y-2 mb-6">
{[
{ id: 'pdf', label: 'PDF Document (.pdf)' },
{ id: 'txt', label: 'Plain Text (.txt)' },
{ id: 'md', label: 'Markdown (.md)' },
{ id: 'html', label: 'HTML Webpage (.html)' },
{ id: 'json', label: 'JSON Text (.json)' },
].map((fmt) => (
<label
key={fmt.id}
className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${ targetTextFormat === fmt.id ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50' }`}
>
<input
type="radio"
name="textFormat"
checked={targetTextFormat === fmt.id}
onChange={() => setTargetTextFormat(fmt.id as TextFormat)}
className="accent-indigo-600 mr-3"
/>
<span className="text-sm font-medium">{fmt.label}</span>
</label>
))}
</div>
<button
onClick={handleGenerateTextFile}
className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow transition-colors"
>
Generate File
</button>
</div>
{generatedTextFile && (
<div className="mt-6 pt-6 border-t border-slate-100">
<div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
<p className="text-xs font-semibold text-emerald-800 mb-1">File Generated!</p>
<p className="text-xs text-emerald-600 mb-3 truncate">{generatedTextFile.filename}</p>
<a
href={generatedTextFile.url}
download={generatedTextFile.filename}
className="block w-full text-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold transition-colors"
>
Download File
</a>
</div>
</div>
)}
</div>
</div>
)}
{/* TAB 3: JSON TO CSV */}
{activeTab === 'json' && (
<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
<div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
<h2 className="text-lg font-semibold text-slate-900 mb-2">JSON Input</h2>
<p className="text-xs text-slate-500 mb-4">Paste an array of objects to convert into structured CSV data.</p>
<textarea
value={jsonInput}
onChange={(e) => setJsonInput(e.target.value)}
rows={12}
className="w-full border border-slate-300 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
/>
{jsonError && (
<p className="mt-2 text-xs font-medium text-rose-600">{jsonError}</p>
)}
<button
onClick={handleConvertJsonToCsv}
className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow transition-colors"
>
Convert to CSV
</button>
</div>
<div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
<div>
<h2 className="text-lg font-semibold text-slate-900 mb-2">CSV Output</h2>
<p className="text-xs text-slate-500 mb-4">Preview or download the generated comma-separated values.</p>
{csvOutput ? (
<div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-xs overflow-x-auto max-h-64 whitespace-pre">
Preview Ready
</div>
) : (
<div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-400 text-sm">
Click Convert to process JSON
</div>
)}
</div>
{csvOutput && (
<div className="mt-6 pt-6 border-t border-slate-100">
<a
href={csvOutput.url}
download={csvOutput.filename}
className="block w-full text-center py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors shadow"
>
Download {csvOutput.filename}
</a>
</div>
)}
</div>
</div>
)}
</div>
);
}

export default UniversalFileConverterPage;
