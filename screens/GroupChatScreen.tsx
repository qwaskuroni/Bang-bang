
import React, { useState, useEffect, useRef } from 'react';
import { User, Message, Group } from '../types';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { GroupProfileScreen } from './GroupProfileScreen';

interface GroupChatScreenProps {
  groupId: string;
  currentUser: User;
  onBack: () => void;
}

export const GroupChatScreen: React.FC<GroupChatScreenProps> = ({ groupId, currentUser, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [group, setGroup] = useState<Group | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubGroup = onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (snap.exists()) setGroup({ id: snap.id, ...snap.data() } as Group);
    });

    const q = query(collection(db, 'groups', groupId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubMsgs = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Message));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => { unsubGroup(); unsubMsgs(); };
  }, [groupId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.isBlocked || !inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await addDoc(collection(db, 'groups', groupId, 'messages'), {
      chatId: groupId,
      senderPhone: currentUser.phone,
      senderName: currentUser.name,
      senderImage: currentUser.profileImage,
      text,
      type: 'text',
      timestamp: serverTimestamp(),
      seen: false
    });
    await updateDoc(doc(db, 'groups', groupId), {
      lastMessage: `${currentUser.name}: ${text}`,
      lastMessageTime: serverTimestamp()
    });
  };

  if (showProfile && group) {
    return (
      <GroupProfileScreen 
        group={group} 
        currentUser={currentUser} 
        onBack={() => setShowProfile(false)} 
        onCloseChat={onBack}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-blue-50/20 dark:bg-gray-950">
      {/* Header */}
      <div className="p-4 glass flex items-center shadow-sm sticky top-0 z-[60] justify-between">
        <div className="flex items-center min-w-0 flex-1">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-600 dark:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div onClick={() => setShowProfile(true)} className="flex items-center ml-2 min-w-0 cursor-pointer active:opacity-70 transition-all">
            <img src={group?.logo} className="w-10 h-10 rounded-xl object-cover shadow-sm bg-white p-0.5" alt="" />
            <div className="ml-3 truncate">
              <h3 className="font-bold text-gray-800 dark:text-white leading-tight truncate">{group?.name}</h3>
              <p className="text-[10px] text-gray-500">{group?.members.length} members online</p>
            </div>
          </div>
        </div>
        <button onClick={() => setShowProfile(true)} className="p-2 text-blue-500">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`flex ${msg.senderPhone === currentUser.phone ? 'justify-end' : 'justify-start'}`}>
            {msg.senderPhone !== currentUser.phone && (
              <img src={msg.senderImage} className="w-8 h-8 rounded-lg mr-2 self-end shadow-sm" alt="" />
            )}
            <div className="max-w-[75%] flex flex-col">
              {msg.senderPhone !== currentUser.phone && (
                <span className="text-[10px] font-black text-gray-400 ml-1 mb-1 uppercase tracking-tighter">{msg.senderName}</span>
              )}
              <div className={`p-3 shadow-sm rounded-2xl ${
                msg.senderPhone === currentUser.phone 
                ? 'blue-gradient text-white rounded-tr-none' 
                : 'bg-white dark:bg-gray-800 dark:text-white rounded-tl-none border border-gray-100 dark:border-gray-700'
              }`}>
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-3 glass border-t border-gray-200 dark:border-gray-800">
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message members..."
            className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl py-3 px-4 outline-none text-sm dark:text-white"
          />
          <button type="submit" className="p-3 blue-gradient text-white rounded-xl shadow-lg active:scale-90 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};
