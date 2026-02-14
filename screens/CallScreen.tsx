
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from '../types';
import { db } from '../firebase';
import { doc, runTransaction } from 'firebase/firestore';

interface CallScreenProps {
  bot: User;
  chatId: string;
  onEnd: () => void;
  currentUser: User;
  callType?: 'audio' | 'video';
}

export const CallScreen: React.FC<CallScreenProps> = ({ bot, chatId, onEnd, currentUser, callType = 'video' }) => {
  // স্যাটাস সরাসরি 'connecting' থেকে শুরু হবে কারণ ইউজার নিজেই কল দিচ্ছে
  const [status, setStatus] = useState<'connecting' | 'connected'>('connecting');
  const [timer, setTimer] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const pricePerMin = useMemo(() => {
    return callType === 'video' 
      ? (bot.botVideoCallPrice ?? bot.botCallPrice ?? 0)
      : (bot.botAudioCallPrice ?? 0);
  }, [bot, callType]);

  const rawContent = (bot.botVideoUrl || '').trim();

  // YouTube ID Extraction
  const videoId = useMemo(() => {
    if (!rawContent || callType === 'audio') return null;
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = rawContent.match(regExp);
    if (match && match[7].length === 11) return match[7];
    const shortsMatch = rawContent.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
    return null;
  }, [rawContent, callType]);

  const isYouTube = !!videoId;

  const finalVideoUrl = useMemo(() => {
    if (!videoId) return "";
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&controls=0&playsinline=1&modestbranding=1&rel=0&loop=1&playlist=${videoId}&iv_load_policy=3&showinfo=0`;
  }, [videoId]);

  // ব্যালেন্স কাটার লজিক
  const deductBalance = async () => {
    const price = pricePerMin;
    if (price <= 0) return true;

    try {
      return await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', currentUser.phone);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw "User not found";
        
        const currentBalance = userSnap.data().balance || 0;
        if (currentBalance < price) return false;

        transaction.update(userRef, { balance: currentBalance - price });
        return true;
      });
    } catch (e) {
      console.error("Billing error:", e);
      return false;
    }
  };

  // কল শুরু হওয়ার অটোমেটিক লজিক
  useEffect(() => {
    const startCallSequence = async () => {
      // ৩ সেকেন্ড ওয়েটিং সিমুলেশন (Connecting...)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const success = await deductBalance();
      if (!success) {
        alert("Insufficient balance to start call.");
        onEnd();
        return;
      }

      setStatus('connected');
      
      if (callType === 'video' && localVideoRef.current) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => { if (localVideoRef.current) localVideoRef.current.srcObject = stream; })
          .catch(() => {});
      }
    };

    startCallSequence();
  }, []);

  useEffect(() => {
    if (status === 'connected') {
      const interval = setInterval(async () => {
        const nextTimer = timer + 1;
        setTimer(nextTimer);

        // প্রতি ১ মিনিটে টাকা কাটবে
        if (nextTimer > 0 && nextTimer % 60 === 0) {
          const success = await deductBalance();
          if (!success) {
            alert("Call ended due to low balance.");
            onEnd();
          }
        }

        const limit = bot.botCallDuration || 300; 
        if (nextTimer >= limit) onEnd();
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [status, timer, bot.botCallDuration, onEnd]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-between text-white overflow-hidden select-none">
      
      {/* Background - বটের ছবি ব্লার হয়ে সবসময় থাকবে */}
      <div className="absolute inset-0 z-0 bg-gray-900 overflow-hidden">
        <img 
          src={bot.profileImage} 
          className="absolute inset-0 w-full h-full object-cover opacity-40 blur-3xl scale-125 transition-opacity duration-1000" 
          alt="" 
        />
        
        {status === 'connected' && (
          <div className="absolute inset-0 z-10 animate-in fade-in duration-1000">
            {callType === 'video' ? (
              isYouTube ? (
                <div className="w-full h-full relative">
                  <div className="absolute inset-0 z-10 bg-transparent" />
                  <iframe
                    src={finalVideoUrl}
                    className="w-full h-full scale-[1.7] origin-center"
                    frameBorder="0"
                    allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
                  ></iframe>
                </div>
              ) : (
                <video 
                  ref={videoRef}
                  src={rawContent}
                  playsInline
                  loop
                  autoPlay
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-500/5 mix-blend-overlay">
                 {/* Audio call overlay */}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header Info */}
      <div className="relative z-20 w-full p-8 text-center pt-24 bg-gradient-to-b from-black/80 to-transparent">
        <div className={`transition-all duration-700 ${status === 'connected' ? 'scale-75 translate-y-[-20px]' : 'scale-100'}`}>
          <div className="relative inline-block">
            <img 
              src={bot.profileImage} 
              className="w-28 h-28 rounded-full border-4 border-white/20 shadow-2xl mx-auto object-cover" 
              alt="" 
            />
            {status === 'connecting' && (
              <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-ping opacity-50"></div>
            )}
          </div>
        </div>
        
        <h2 className="text-3xl font-bold mt-6 drop-shadow-2xl">
          {bot.name}
        </h2>
        <p className={`text-sm font-medium ${callType === 'video' ? 'text-blue-300' : 'text-green-300'} mt-2`}>
          {status === 'connecting' ? 'Calling...' : formatTime(timer)}
        </p>
      </div>

      {/* Local Preview for Video Call */}
      {callType === 'video' && (
        <div className={`absolute right-4 top-24 w-24 h-36 bg-gray-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl z-30 transition-all duration-1000 ${status === 'connected' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        </div>
      )}

      {/* Bottom Controls */}
      <div className="relative z-20 w-full p-12 flex flex-col items-center bg-gradient-to-t from-black/90 to-transparent pb-20">
        <div className="flex flex-col items-center space-y-4">
          <button 
            onClick={onEnd} 
            className="p-7 bg-red-600 rounded-full shadow-[0_0_40px_rgba(220,38,38,0.5)] active:scale-90 transition-all"
          >
            <svg className="w-8 h-8 text-white rotate-[135deg]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">End Call</span>
        </div>
      </div>
    </div>
  );
};
