
import React, { useState, useEffect, useRef } from 'react';
import { User, Message, AutoReply, View } from '../types';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';

interface ChatScreenProps {
  chatId: string;
  currentUser: User;
  onBack: () => void;
  onStartCall?: (bot: User, callType: 'audio' | 'video') => void;
  onNavigateToView?: (view: View) => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ chatId, currentUser, onBack, onStartCall, onNavigateToView }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [callCount, setCallCount] = useState(0);
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false);
  const [showBotProfile, setShowBotProfile] = useState(false);
  const [pendingCallType, setPendingCallType] = useState<'audio' | 'video'>('video');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOtherUserAndStats = async () => {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const data = chatSnap.data();
        setCallCount(data.callCount || 0);
        const otherPhone = data.participants.find((p: string) => p !== currentUser.phone);
        if (otherPhone) {
          const userSnap = await getDoc(doc(db, 'users', otherPhone));
          if (userSnap.exists()) setOtherUser(userSnap.data() as User);
        }
      }
    };
    fetchOtherUserAndStats();

    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Message));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [chatId, currentUser.phone]);

  const initiateCall = (type: 'audio' | 'video') => {
    if (!otherUser) return;
    setPendingCallType(type);
    setShowCallConfirm(true);
  };

  const handleStartCall = async () => {
    if (!otherUser) return;
    
    const pricePerMin = pendingCallType === 'video' 
      ? (otherUser.botVideoCallPrice ?? otherUser.botCallPrice ?? 0)
      : (otherUser.botAudioCallPrice ?? 0);

    if ((currentUser.balance || 0) < pricePerMin) {
      setShowCallConfirm(false);
      setShowLowBalanceModal(true);
      return;
    }

    const maxCalls = otherUser.botMaxCallsPerUser || 3;
    if (callCount >= maxCalls) {
      alert("Call limit exceeded for this user.");
      return;
    }

    const newCount = callCount + 1;
    setCallCount(newCount);
    await updateDoc(doc(db, 'chats', chatId), {
      callCount: newCount
    });

    setShowCallConfirm(false);
    if (onStartCall) onStartCall(otherUser, pendingCallType);
  };

  const handleChatGPTResponse = async (userText: string) => {
    if (!otherUser?.isAiEnabled || !otherUser?.openaiKey) return;
    
    setIsBotTyping(true);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${otherUser.openaiKey}`
        },
        body: JSON.stringify({
          model: otherUser.gptVersion || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: otherUser.aiTrainingPrompt || 'You are a helpful assistant.' },
            { role: 'user', content: userText }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();
      const aiReply = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderPhone: otherUser.phone,
        text: aiReply,
        type: 'text',
        timestamp: serverTimestamp(),
        seen: false
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: aiReply,
        lastMessageTime: serverTimestamp()
      });
    } catch (err) {
      console.error("GPT Error:", err);
    } finally {
      setIsBotTyping(false);
    }
  };

  const checkAutoReply = async (userText: string) => {
    if (!otherUser?.isBot) return;

    const repliesSnap = await getDocs(collection(db, 'auto_replies'));
    const replies = repliesSnap.docs.map(doc => doc.data() as AutoReply);
    const matchedReply = replies.find(r => userText.toLowerCase().includes(r.keyword.toLowerCase()));

    if (matchedReply) {
      setIsBotTyping(true);
      setTimeout(async () => {
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          chatId,
          senderPhone: otherUser.phone,
          text: matchedReply.response,
          type: 'text',
          timestamp: serverTimestamp(),
          seen: false
        });
        await updateDoc(doc(db, 'chats', chatId), { lastMessage: matchedReply.response, lastMessageTime: serverTimestamp() });
        setIsBotTyping(false);
      }, 1000);
    } else {
      handleChatGPTResponse(userText);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      chatId,
      senderPhone: currentUser.phone,
      text,
      type: 'text',
      timestamp: serverTimestamp(),
      seen: false
    });
    await updateDoc(doc(db, 'chats', chatId), { lastMessage: text, lastMessageTime: serverTimestamp() });
    checkAutoReply(text);
  };

  const currentRate = pendingCallType === 'video' 
    ? (otherUser?.botVideoCallPrice ?? otherUser?.botCallPrice ?? 0)
    : (otherUser?.botAudioCallPrice ?? 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-blue-50/30 dark:bg-gray-950">
      {/* Header */}
      <div className="p-4 glass flex items-center shadow-sm sticky top-0 z-[60] justify-between">
        <div className="flex items-center flex-1 min-w-0">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-600 dark:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div 
            onClick={() => setShowBotProfile(true)}
            className="flex items-center ml-2 min-w-0 cursor-pointer active:opacity-70 transition-opacity"
          >
            <img src={otherUser?.profileImage} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" alt="" />
            <div className="ml-3 truncate">
              <h3 className="font-bold text-gray-800 dark:text-white leading-tight flex items-center truncate">
                {otherUser?.name}
              </h3>
              <p className="text-[10px] text-gray-500">{isBotTyping ? 'typing...' : 'Online'}</p>
            </div>
          </div>
        </div>

        <div className="hidden xs:flex items-center bg-white dark:bg-gray-800 rounded-full px-3 py-1 border border-gray-100 dark:border-gray-700 mr-2">
           <span className="text-[11px] font-black text-blue-600">৳{(currentUser.balance || 0).toFixed(2)}</span>
        </div>

        <div className="flex items-center space-x-1">
          <button onClick={() => initiateCall('audio')} className="p-2.5 text-blue-500 dark:text-blue-400 active:scale-90 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button onClick={() => initiateCall('video')} className="p-2.5 text-blue-500 dark:text-blue-400 active:scale-90 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`flex ${msg.senderPhone === currentUser.phone ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-3 shadow-sm rounded-2xl ${msg.senderPhone === currentUser.phone ? 'blue-gradient text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 dark:text-white rounded-tl-none border border-gray-100 dark:border-gray-700'}`}>
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Low Balance Modal */}
      {showLowBalanceModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowLowBalanceModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 w-full max-w-sm rounded-[40px] p-8 shadow-2xl text-center border border-white/20">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
               <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
            </div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Insufficient Balance</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 px-2">
              আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই। কল করার জন্য দয়াকরে রিচার্জ করুন।
            </p>
            
            <div className="space-y-3">
              <button 
                onClick={() => onNavigateToView && onNavigateToView('wallet-deposit')}
                className="w-full blue-gradient text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
              >
                Deposit Now
              </button>
              <button 
                onClick={() => setShowLowBalanceModal(false)}
                className="w-full py-4 text-sm font-bold text-gray-400 uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bot Profile Overlay */}
      {showBotProfile && otherUser && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-gray-50 dark:bg-gray-950 animate-in slide-in-from-bottom duration-300">
          <div className="p-4 glass flex items-center border-b border-gray-100 dark:border-gray-800">
            <button onClick={() => setShowBotProfile(false)} className="p-2 text-gray-600 dark:text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="ml-2 text-xl font-bold dark:text-white">User Info</h1>
          </div>

          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center no-scrollbar">
            <div className="relative mb-8">
              <img
                src={otherUser.profileImage || `https://picsum.photos/seed/${otherUser.phone}/200`}
                alt={otherUser.name}
                className="w-40 h-40 rounded-[48px] shadow-2xl border-4 border-white dark:border-gray-800 object-cover"
              />
              <div className="absolute -bottom-2 right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-white dark:border-gray-950"></div>
            </div>

            <h2 className="text-3xl font-black text-gray-900 dark:text-white text-center">{otherUser.name}</h2>
            <p className="text-gray-500 font-medium mt-1">Verified Account • {otherUser.phone}</p>

            <div className="w-full max-w-sm mt-12 space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-2 mb-4">Call Rates</h3>
              
              <div className="bg-white dark:bg-gray-800 p-5 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl mr-4 text-blue-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-white">Video Call</h4>
                    <p className="text-[10px] text-gray-500 uppercase font-black">Per Minute</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-blue-600">৳{(otherUser.botVideoCallPrice ?? otherUser.botCallPrice ?? 0).toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-5 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl mr-4 text-green-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-white">Audio Call</h4>
                    <p className="text-[10px] text-gray-500 uppercase font-black">Per Minute</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-green-600">৳{(otherUser.botAudioCallPrice ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="mt-12 w-full max-w-sm">
               <button 
                onClick={() => setShowBotProfile(false)}
                className="w-full blue-gradient text-white py-4 rounded-[20px] font-bold shadow-xl active:scale-95 transition-all"
               >
                 Close
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Confirmation Dialog */}
      {showCallConfirm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCallConfirm(false)} />
          <div className="relative bg-white dark:bg-gray-900 w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 ${pendingCallType === 'video' ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-green-50 dark:bg-green-900/30'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                 {pendingCallType === 'video' ? (
                   <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" /></svg>
                 ) : (
                   <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                 )}
              </div>
              <h3 className="text-lg font-black dark:text-white">{pendingCallType === 'video' ? 'Video' : 'Audio'} Call</h3>
              <p className="text-sm text-gray-500 mt-2">This call costs <span className={`${pendingCallType === 'video' ? 'text-blue-600' : 'text-green-600'} font-bold`}>৳{currentRate.toFixed(2)}</span> per minute from your balance.</p>
            </div>
            <div className="space-y-3">
              <button onClick={handleStartCall} className={`w-full ${pendingCallType === 'video' ? 'blue-gradient' : 'bg-green-500'} text-white py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all`}>
                Call Now
              </button>
              <button onClick={() => setShowCallConfirm(false)} className="w-full py-3 text-sm font-bold text-gray-400">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 glass border-t border-gray-200 dark:border-gray-800">
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl py-3 px-4 outline-none dark:text-white text-sm"
          />
          <button type="submit" className="p-3 blue-gradient text-white rounded-xl shadow-lg active:scale-90 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};
