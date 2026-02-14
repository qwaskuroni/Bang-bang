
import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const userRef = doc(db, 'users', phone);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        onLogin(userData);
      } else {
        const newUser: User = {
          name: `User ${phone.slice(-4)}`,
          phone: phone,
          online: true,
          balance: 0.00, // Initial balance
          lastSeen: serverTimestamp() as any,
          createdAt: serverTimestamp() as any,
          profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${phone}`,
          isBot: false
        };
        await setDoc(userRef, newUser);
        onLogin(newUser);
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed. Please check your internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col p-6 overflow-hidden">
      <div className="mt-20 text-center">
        <div className="w-24 h-24 blue-gradient rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">ImoFlow</h2>
        <p className="text-gray-500 mt-2 font-medium">Fast & Secure Messenger</p>
      </div>

      <form onSubmit={handleLogin} className="mt-12 space-y-6 flex-1 max-w-sm mx-auto w-full">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold border-r pr-3 border-gray-200">+88</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className="w-full pl-16 pr-4 py-4 rounded-3xl bg-white border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm text-lg font-semibold text-gray-800"
              placeholder="017XXXXXXXX"
              maxLength={11}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-sm font-medium text-center animate-shake">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full blue-gradient text-white py-5 rounded-[24px] font-bold text-lg shadow-xl active:scale-[0.96] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {loading ? (
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <span>Get Started</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </form>

      <div className="mt-auto text-center pb-8">
        <p className="text-xs text-gray-400 font-medium px-10">
          By continuing, you agree to our <span className="text-blue-500">Privacy Policy</span> and <span className="text-blue-500">Terms of Service</span>.
        </p>
      </div>
    </div>
  );
};
