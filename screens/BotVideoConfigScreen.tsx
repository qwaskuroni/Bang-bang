
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';

interface BotVideoConfigScreenProps {
  botPhone: string;
  onBack: () => void;
}

export const BotVideoConfigScreen: React.FC<BotVideoConfigScreenProps> = ({ botPhone, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [duration, setDuration] = useState(30);
  const [maxCalls, setMaxCalls] = useState(3);
  const [callPrice, setCallPrice] = useState(0);

  useEffect(() => {
    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'users', botPhone));
      if (snap.exists()) {
        const data = snap.data() as User;
        setVideoUrlInput(data.botVideoUrl || '');
        setDuration(data.botCallDuration || 30);
        setMaxCalls(data.botMaxCallsPerUser || 3);
        setCallPrice(data.botCallPrice || 0);
      }
      setLoading(false);
    };
    fetchConfig();
  }, [botPhone]);

  // Extract SRC for preview
  const previewUrl = useMemo(() => {
    const raw = videoUrlInput.trim();
    if (!raw) return '';
    if (raw.toLowerCase().includes('<iframe')) {
      const match = raw.match(/src=["']([^"']+)["']/i);
      return match ? match[1] : '';
    }
    return raw;
  }, [videoUrlInput]);

  const isYouTube = previewUrl.includes('youtube.com') || previewUrl.includes('youtu.be');

  const finalPreviewUrl = useMemo(() => {
    if (!previewUrl || !isYouTube) return previewUrl;
    let clean = previewUrl.split('?')[0];
    if (!clean.includes('/embed/')) {
       const idMatch = previewUrl.match(/(?:v=|\/embed\/|dev\.be\/)([^&?]+)/);
       if (idMatch) clean = `https://www.youtube.com/embed/${idMatch[1]}`;
    }
    return `${clean}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1`;
  }, [previewUrl, isYouTube]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', botPhone), {
        botVideoUrl: videoUrlInput,
        botCallDuration: Number(duration),
        botMaxCallsPerUser: Number(maxCalls),
        botCallPrice: Number(callPrice)
      });
      alert("Configuration Saved!");
      onBack();
    } catch (err) {
      alert("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center">Loading...</div>;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="p-4 glass flex items-center justify-between border-b dark:border-gray-800">
        <button onClick={onBack} className="p-2 dark:text-gray-300">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-lg font-bold dark:text-white">Video & Billing</h1>
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
          {saving ? '...' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-10">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm space-y-5 border border-gray-100 dark:border-gray-700">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-3 block">Video URL or Embed Code</label>
            <textarea 
              value={videoUrlInput} 
              onChange={e => setVideoUrlInput(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl outline-none dark:text-white text-sm border-2 border-transparent focus:border-blue-500 min-h-[120px] shadow-inner"
              placeholder="Paste YouTube Link or Embed Code here"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm space-y-4 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="font-bold dark:text-white text-sm">Price per Minute (৳)</span>
            <input type="number" value={callPrice} onChange={e => setCallPrice(Number(e.target.value))} className="w-20 bg-gray-100 dark:bg-gray-900 p-2 rounded-lg text-center font-bold dark:text-white outline-none" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold dark:text-white text-sm">Call Duration (sec)</span>
            <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-20 bg-gray-100 dark:bg-gray-900 p-2 rounded-lg text-center font-bold dark:text-white outline-none" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold dark:text-white text-sm">Max Calls/User</span>
            <input type="number" value={maxCalls} onChange={e => setMaxCalls(Number(e.target.value))} className="w-20 bg-gray-100 dark:bg-gray-900 p-2 rounded-lg text-center font-bold dark:text-white outline-none" />
          </div>
        </div>

        {previewUrl && (
          <div className="space-y-3">
             <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 block">Preview (Autoplay Test)</label>
             <div className="bg-black rounded-[32px] overflow-hidden aspect-[9/16] shadow-2xl border-4 border-white dark:border-gray-800 relative">
              {isYouTube ? (
                <iframe
                  key={finalPreviewUrl}
                  src={finalPreviewUrl}
                  className="w-full h-full scale-[1.05]"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                ></iframe>
              ) : (
                <video key={previewUrl} src={previewUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
