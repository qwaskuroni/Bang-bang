
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';

interface BotWelcomeConfigScreenProps {
  botPhone: string;
  onBack: () => void;
}

export const BotWelcomeConfigScreen: React.FC<BotWelcomeConfigScreenProps> = ({ botPhone, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'users', botPhone));
      if (snap.exists()) {
        const data = snap.data() as User;
        setWelcomeMsg(data.welcomeMessage || '');
      }
      setLoading(false);
    };
    fetchConfig();
  }, [botPhone]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', botPhone), {
        welcomeMessage: welcomeMsg.trim()
      });
      alert("Welcome Message Saved!");
      onBack();
    } catch (err) {
      alert("Save failed");
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
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="p-4 glass flex items-center justify-between border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
        <div className="flex items-center">
          <button onClick={onBack} className="p-2 text-gray-600 dark:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="ml-2 text-lg font-bold dark:text-white">Welcome Message</h1>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-90 transition-all shadow-lg shadow-pink-500/20">
          {saving ? '...' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-10">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
           <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Greeting Message</label>
              <textarea 
                value={welcomeMsg} 
                onChange={e => setWelcomeMsg(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-pink-500/20 dark:text-white text-sm h-48 resize-none shadow-inner"
                placeholder="Example: Hello! Welcome to my chat. How can I help you today?"
              />
           </div>
           
           <div className="p-4 bg-pink-50 dark:bg-pink-900/10 rounded-2xl border border-pink-100 dark:border-pink-800/30">
              <div className="flex items-start">
                 <svg className="w-5 h-5 text-pink-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 <div>
                    <h4 className="font-bold text-pink-900 dark:text-pink-300 text-xs">এটা কিভাবে কাজ করে?</h4>
                    <p className="text-[10px] text-pink-700 dark:text-pink-400 mt-1 leading-relaxed">
                       ইউজার যখন বটকে প্রথম কোনো মেসেজ দিবে, বট সাথে সাথে এই ওয়েলকাম মেসেজটি দিয়ে তাকে অভিবাদন জানাবে। এটি প্রতিটি বটের জন্য আলাদা আলাদা ভাবে সেট করা যায়।
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
