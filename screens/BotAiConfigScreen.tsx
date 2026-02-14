
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';

interface BotAiConfigScreenProps {
  botPhone: string;
  onBack: () => void;
}

export const BotAiConfigScreen: React.FC<BotAiConfigScreenProps> = ({ botPhone, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [version, setVersion] = useState('gpt-3.5-turbo');

  useEffect(() => {
    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'users', botPhone));
      if (snap.exists()) {
        const data = snap.data() as User;
        setEnabled(data.isAiEnabled || false);
        setApiKey(data.openaiKey || '');
        setPrompt(data.aiTrainingPrompt || '');
        setVersion(data.gptVersion || 'gpt-3.5-turbo');
      }
      setLoading(false);
    };
    fetchConfig();
  }, [botPhone]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', botPhone), {
        isAiEnabled: enabled,
        openaiKey: apiKey,
        aiTrainingPrompt: prompt,
        gptVersion: version
      });
      alert("AI Configuration Saved!");
      onBack();
    } catch (err) {
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center">Loading...</div>;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="p-4 glass flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center">
          <button onClick={onBack} className="p-2 text-gray-600 dark:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="ml-2 text-lg font-bold dark:text-white">AI Config</h1>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-90 transition-all">
          {saving ? '...' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-[28px] shadow-sm flex items-center justify-between">
          <div>
            <h3 className="font-bold dark:text-white">Enable AI Response</h3>
            <p className="text-xs text-gray-500">Auto reply using ChatGPT</p>
          </div>
          <button onClick={() => setEnabled(!enabled)} className={`w-12 h-6 rounded-full p-1 transition-all ${enabled ? 'bg-blue-500' : 'bg-gray-200'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-all ${enabled ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2 mb-2 block">ChatGPT API Key</label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 p-4 rounded-2xl outline-none border border-gray-100 dark:border-gray-700 dark:text-white text-sm"
              placeholder="sk-..."
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2 mb-2 block">GPT Version</label>
            <select 
              value={version} 
              onChange={e => setVersion(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 p-4 rounded-2xl outline-none border border-gray-100 dark:border-gray-700 dark:text-white text-sm appearance-none"
            >
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast)</option>
              <option value="gpt-4">GPT-4 (Smart)</option>
              <option value="gpt-4o">GPT-4o (Omni)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2 mb-2 block">AI Training Prompt</label>
            <textarea 
              value={prompt} 
              onChange={e => setPrompt(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 p-4 rounded-2xl outline-none border border-gray-100 dark:border-gray-700 dark:text-white text-sm h-40 resize-none"
              placeholder="Example: You are a friendly customer service agent. Answer in Bengali only."
            />
          </div>
        </div>
      </div>
    </div>
  );
};
