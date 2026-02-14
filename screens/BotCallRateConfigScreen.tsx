
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';

interface BotCallRateConfigScreenProps {
  botPhone: string;
  onBack: () => void;
}

export const BotCallRateConfigScreen: React.FC<BotCallRateConfigScreenProps> = ({ botPhone, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [videoPrice, setVideoPrice] = useState(0);
  const [audioPrice, setAudioPrice] = useState(0);

  useEffect(() => {
    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'users', botPhone));
      if (snap.exists()) {
        const data = snap.data() as User;
        setVideoPrice(data.botVideoCallPrice ?? data.botCallPrice ?? 0);
        setAudioPrice(data.botAudioCallPrice ?? 0);
      }
      setLoading(false);
    };
    fetchConfig();
  }, [botPhone]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', botPhone), {
        botVideoCallPrice: Number(videoPrice),
        botAudioCallPrice: Number(audioPrice),
        // Sync legacy field with video price for safety
        botCallPrice: Number(videoPrice)
      });
      alert("Call Rates Updated Successfully!");
      onBack();
    } catch (err) {
      alert("Update failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center">Loading...</div>;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="p-4 glass flex items-center justify-between border-b dark:border-gray-800">
        <div className="flex items-center">
          <button onClick={onBack} className="p-2 text-gray-600 dark:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="ml-2 text-lg font-bold dark:text-white">Call Rate Setup</h1>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
          {saving ? '...' : 'Update'}
        </button>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 space-y-8">
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                 <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" /></svg>
              </div>
              <div>
                <h3 className="text-base font-black dark:text-white">Video Call Rate</h3>
                <p className="text-[10px] text-gray-500">Charge per minute for video calls</p>
              </div>
            </div>
            <div className="relative">
              <input 
                type="number" 
                value={videoPrice} 
                onChange={e => setVideoPrice(Number(e.target.value))} 
                className="w-full bg-gray-50 dark:bg-gray-900 p-5 rounded-2xl outline-none font-black text-2xl dark:text-white border-2 border-transparent focus:border-blue-500/30 text-center transition-all" 
                placeholder="0.00" 
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳/min</div>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-700" />

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-xl">
                 <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              </div>
              <div>
                <h3 className="text-base font-black dark:text-white">Audio Call Rate</h3>
                <p className="text-[10px] text-gray-500">Charge per minute for audio calls</p>
              </div>
            </div>
            <div className="relative">
              <input 
                type="number" 
                value={audioPrice} 
                onChange={e => setAudioPrice(Number(e.target.value))} 
                className="w-full bg-gray-50 dark:bg-gray-900 p-5 rounded-2xl outline-none font-black text-2xl dark:text-white border-2 border-transparent focus:border-green-500/30 text-center transition-all" 
                placeholder="0.00" 
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳/min</div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
              Users will be notified of these specific rates before they start a call. The balance will be deducted at the start of each minute based on the call type.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
