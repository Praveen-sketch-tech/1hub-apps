import React, { useState } from 'react';
import { PartyProfile } from '../types/deed';

interface PartyBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: PartyProfile[];
  onAddProfile: (profile: PartyProfile) => void;
  onSelectProfile: (profile: PartyProfile, role: 'A' | 'B') => void;
  activeRole: 'A' | 'B';
}

export const PartyBookModal: React.FC<PartyBookModalProps> = ({
  isOpen,
  onClose,
  profiles,
  onAddProfile,
  onSelectProfile,
  activeRole
}) => {
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<'Person' | 'Company' | 'Witness'>('Person');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;
    const newP: PartyProfile = {
      id: Date.now().toString(),
      name,
      fatherName,
      phone,
      address,
      type
    };
    onAddProfile(newP);
    setName('');
    setFatherName('');
    setPhone('');
    setAddress('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 text-xs">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Party / Profile Book (Select for Party {activeRole})
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 font-bold">✕</button>
        </div>

        {/* Existing Profiles List */}
        <div className="mb-6 max-h-48 overflow-y-auto space-y-2">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Saved Parties:</h3>
          {profiles.map((p) => (
            <div key={p.id} className="p-3 border rounded-lg dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100">{p.name} ({p.type})</p>
                {p.fatherName && <p className="text-gray-500 dark:text-gray-400">S/o {p.fatherName}</p>}
                <p className="text-gray-500 dark:text-gray-400">{p.phone} • {p.address}</p>
              </div>
              <button
                onClick={() => {
                  onSelectProfile(p, activeRole);
                  onClose();
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
              >
                Select as Party {activeRole}
              </button>
            </div>
          ))}
        </div>

        {/* Add New Profile Form */}
        <form onSubmit={handleCreate} className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Save New Party Profile:</h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Full Name / Company Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              required
            />
            <input
              placeholder="Father's / Owner's Name"
              value={fatherName}
              onChange={(e) => setFatherName(e.target.value)}
              className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
            <input
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="Person">Individual Person</option>
              <option value="Company">Business / Company</option>
              <option value="Witness">Witness</option>
            </select>
          </div>
          <input
            placeholder="Full Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
          />
          <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 transition">
            Save Profile to Book
          </button>
        </form>
      </div>
    </div>
  );
};