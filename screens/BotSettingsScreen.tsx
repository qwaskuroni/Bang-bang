
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

interface BotSettingsScreenProps {
  botPhone: string;
  onBack: () => void;
  onOpenAiConfig: () => void;
  onOpenVideoConfig: () => void;
  onOpenCallRateConfig: () => void;
}

export const BotSettingsScreen: React.FC<BotSettingsScreenProps> = ({ botPhone, onBack, onOpenAiConfig, onOpenVideoConfig, onOpenCallRateConfig }) => {
  const [bot, setBot] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchBot = async () => {
      const docSnap = await getDoc(doc(db, 'users', botPhone));
      if (docSnap.exists()) {
        const data = docSnap.data() as User;
        setBot(data);
        setEditName(data.name || '');
        setEditImage(data.profileImage || '');
      }
      setLoading(false);
    };
    fetchBot();
  }, [botPhone]);

  const handleSaveProfile = async () => {
    if (!editName.trim()) return alert("Name is required");
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', botPhone), {
        name: editName,
        profileImage: editImage
      });
      alert("Bot Profile Updated!");
      // Update local state to show change
      if (bot) setBot({ ...bot, name: editName, profileImage: editImage });
    } catch (err) {
      alert("Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 overflow-y-auto no-scrollbar">
      <div className="p-4 glass flex items-center border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
        <button onClick={onBack} className="p-2 text-gray-600 dark:text-gray-300">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="ml-2 text-xl font-bold dark:text-white">Bot Management</h1>
      </div>

      <div className="p-6 flex flex-col items-center">
        <div className="relative mb-6">
           <img src={editImage || bot?.profileImage} className="w-24 h-24 rounded-[32px] shadow-xl object-cover bg-white" alt="" />
           <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1.5 rounded-xl border-2 border-white dark:border-gray-950 shadow-lg">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
           </div>
        </div>
        
        <div className="w-full max-w-sm space-y-4 mb-8">
           <div className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Bot Public Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl outline-none dark:text-white font-bold text-sm border-2 border-transparent focus:border-blue-500/20 transition-all"
                  placeholder="Bot Name"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Profile Image URL</label>
                <input 
                  type="text" 
                  value={editImage}
                  onChange={e => setEditImage(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl outline-none dark:text-white font-bold text-[11px] border-2 border-transparent focus:border-blue-500/20 transition-all"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full py-3 bg-gray-100 dark:bg-gray-700 dark:text-white text-gray-700 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                {saving ? 'Saving...' : 'Update Identity'}
              </button>
           </div>
        </div>
      </div>

      <div className="px-6 space-y-4 pb-10">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Configuration Modules</h3>
        
        <button 
          onClick={onOpenAiConfig}
          className="w-full flex items-center justify-between p-5 bg-white dark:bg-gray-800 rounded-[28px] shadow-sm active:scale-[0.98] transition-all border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center text-gray-700 dark:text-gray-200">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl mr-4">
              <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="font-black text-sm block">AI Auto Reply GPT</span>
              <p className="text-[10px] text-gray-400 font-medium">Configure LLM intelligence</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        <button 
          onClick={onOpenVideoConfig}
          className="w-full flex items-center justify-between p-5 bg-white dark:bg-gray-800 rounded-[28px] shadow-sm active:scale-[0.98] transition-all border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center text-gray-700 dark:text-gray-200">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl mr-4">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <span className="font-black text-sm block">Video Content Settings</span>
              <p className="text-[10px] text-gray-400 font-medium">Embed YouTube or MP4 feeds</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        <button 
          onClick={onOpenCallRateConfig}
          className="w-full flex items-center justify-between p-5 bg-white dark:bg-gray-800 rounded-[28px] shadow-sm active:scale-[0.98] transition-all border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center text-gray-700 dark:text-gray-200">
            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-2xl mr-4">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <span className="font-black text-sm block">Monetization Setup</span>
              <p className="text-[10px] text-gray-400 font-medium">Set Taka per minute rates</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
};
