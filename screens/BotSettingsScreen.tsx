
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

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

  useEffect(() => {
    const fetchBot = async () => {
      const docSnap = await getDoc(doc(db, 'users', botPhone));
      if (docSnap.exists()) setBot(docSnap.data() as User);
      setLoading(false);
    };
    fetchBot();
  }, [botPhone]);

  if (loading) return <div className="h-full flex items-center justify-center">Loading...</div>;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="p-4 glass flex items-center border-b border-gray-100 dark:border-gray-800">
        <button onClick={onBack} className="p-2 text-gray-600 dark:text-gray-300">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="ml-2 text-xl font-bold dark:text-white">Bot Settings</h1>
      </div>

      <div className="p-6 flex flex-col items-center">
        <img src={bot?.profileImage} className="w-24 h-24 rounded-[32px] shadow-xl mb-4" alt="" />
        <h2 className="text-xl font-bold dark:text-white">{bot?.name}</h2>
        <p className="text-sm text-gray-500">{botPhone}</p>
      </div>

      <div className="px-6 space-y-4">
        <button 
          onClick={onOpenAiConfig}
          className="w-full flex items-center justify-between p-5 bg-white dark:bg-gray-800 rounded-[24px] shadow-sm active:scale-95 transition-all"
        >
          <div className="flex items-center text-gray-700 dark:text-gray-200">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl mr-4">
              <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold">AI Auto Reply GPT</span>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        <button 
          onClick={onOpenVideoConfig}
          className="w-full flex items-center justify-between p-5 bg-white dark:bg-gray-800 rounded-[24px] shadow-sm active:scale-95 transition-all"
        >
          <div className="flex items-center text-gray-700 dark:text-gray-200">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl mr-4">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span className="font-bold">Video Call Settings</span>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        <button 
          onClick={onOpenCallRateConfig}
          className="w-full flex items-center justify-between p-5 bg-white dark:bg-gray-800 rounded-[24px] shadow-sm active:scale-95 transition-all"
        >
          <div className="flex items-center text-gray-700 dark:text-gray-200">
            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-xl mr-4">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold">Call Rate Setup</span>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
};
