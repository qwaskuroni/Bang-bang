
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { AutoReply } from '../types';

interface BotAutoReplyConfigScreenProps {
  botPhone: string;
  onBack: () => void;
}

export const BotAutoReplyConfigScreen: React.FC<BotAutoReplyConfigScreenProps> = ({ botPhone, onBack }) => {
  const [replies, setReplies] = useState<AutoReply[]>([]);
  const [keyword, setKeyword] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users', botPhone, 'auto_replies'));
    const unsub = onSnapshot(q, (snap) => {
      setReplies(snap.docs.map(d => ({ id: d.id, ...d.data() } as AutoReply)));
      setLoading(false);
    });
    return () => unsub();
  }, [botPhone]);

  const handleAddReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !response.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'users', botPhone, 'auto_replies'), {
        keyword: keyword.trim().toLowerCase(),
        response: response.trim()
      });
      setKeyword('');
      setResponse('');
    } catch (err) {
      alert("Failed to add reply pattern");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this reply pattern?")) return;
    try {
      await deleteDoc(doc(db, 'users', botPhone, 'auto_replies', id));
    } catch (err) {
      alert("Delete failed");
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="p-4 glass flex items-center border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
        <button onClick={onBack} className="p-2 text-gray-600 dark:text-gray-300">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="ml-2 text-lg font-bold dark:text-white">Auto Reply Rules</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-10">
        {/* Add New Pattern */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
           <h2 className="text-sm font-black dark:text-white uppercase tracking-widest mb-2">New Reply Pattern</h2>
           <form onSubmit={handleAddReply} className="space-y-4">
              <div>
                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Trigger Keyword</label>
                 <input 
                   required
                   type="text" 
                   value={keyword}
                   onChange={e => setKeyword(e.target.value)}
                   className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500/20 dark:text-white text-sm"
                   placeholder="e.g. hello, support, price"
                 />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Bot Response</label>
                 <textarea 
                   required
                   value={response}
                   onChange={e => setResponse(e.target.value)}
                   className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500/20 dark:text-white text-sm h-24 resize-none"
                   placeholder="Enter the automated message..."
                 />
              </div>
              <button 
                disabled={submitting}
                type="submit" 
                className="w-full blue-gradient text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
              >
                 {submitting ? 'Saving...' : 'Add Auto Reply'}
              </button>
           </form>
        </div>

        {/* List of Patterns */}
        <div className="space-y-4">
           <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Configured Rules — {replies.length}</h2>
           {replies.length > 0 ? (
             <div className="space-y-3">
                {replies.map(reply => (
                  <div key={reply.id} className="bg-white dark:bg-gray-800 p-5 rounded-[28px] shadow-sm border border-gray-100 dark:border-gray-700 flex items-start justify-between">
                     <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center space-x-2 mb-1">
                           <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-black rounded-lg border border-blue-100 dark:border-blue-800 uppercase">IF KEYWORD</span>
                           <h4 className="font-bold text-gray-900 dark:text-white truncate">"{reply.keyword}"</h4>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">
                           <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">THEN REPLY:</span>
                           {reply.response}
                        </p>
                     </div>
                     <button onClick={() => handleDelete(reply.id)} className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all active:scale-90">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                     </button>
                  </div>
                ))}
             </div>
           ) : (
             <div className="text-center py-10 bg-gray-100/50 dark:bg-gray-800/30 rounded-[32px] border-2 border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-gray-400 text-xs font-bold">No auto-reply rules set for this bot.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
