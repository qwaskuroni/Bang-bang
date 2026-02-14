
import React, { useState, useEffect } from 'react';
import { User, WalletSettings } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, onSnapshot, runTransaction, addDoc, collection, serverTimestamp } from 'firebase/firestore';

interface ProfileScreenProps {
  user: User;
  onLogout: () => void;
  onBack: () => void;
  onOpenAdmin: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  showAdminButton?: boolean;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ 
  user, 
  onLogout, 
  onBack, 
  onOpenAdmin, 
  darkMode, 
  toggleDarkMode,
  showAdminButton = false 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user.name);
  const [updating, setUpdating] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [walletSettings, setWalletSettings] = useState<WalletSettings | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'wallet'), d => {
      if (d.exists()) setWalletSettings(d.data() as WalletSettings);
    });
    return () => unsub();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const hasClaimedToday = user.lastClaimDate === todayStr;

  const handleUpdateName = async () => {
    if (!newName.trim() || newName === user.name) {
      setIsEditing(false);
      return;
    }
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.phone), {
        name: newName
      });
      setIsEditing(false);
    } catch (err) {
      alert("Failed to update name");
    } finally {
      setUpdating(false);
    }
  };

  const claimDailyReward = async () => {
    if (hasClaimedToday || !walletSettings?.dailyReward || claiming) return;

    setClaiming(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.phone);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw "User not found";
        
        const userData = userSnap.data() as User;
        if (userData.lastClaimDate === todayStr) throw "Already claimed today";

        const reward = walletSettings.dailyReward || 0;
        const currentBalance = userData.balance || 0;

        transaction.update(userRef, { 
          balance: currentBalance + reward,
          lastClaimDate: todayStr
        });

        // Add to transaction history
        const transRef = collection(db, 'transactions');
        await addDoc(transRef, {
            userId: user.phone,
            userName: user.name,
            type: 'mission',
            gateway: 'system',
            amount: reward,
            status: 'approved',
            timestamp: serverTimestamp()
        });
      });
      alert(`Success! You earned ৳${walletSettings.dailyReward} as a daily reward.`);
    } catch (err: any) {
      alert(err.toString());
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-y-auto pb-10 no-scrollbar">
      <div className="p-4 flex items-center glass sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 dark:text-gray-300">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="ml-2 text-xl font-bold dark:text-white">Profile & Settings</h1>
      </div>

      <div className="p-8 text-center bg-white dark:bg-gray-800/50 mb-6 shadow-sm">
        <div className="relative inline-block group">
          <img
            src={user.profileImage || `https://picsum.photos/seed/${user.phone}/200`}
            alt={user.name}
            className="w-32 h-32 rounded-[48px] shadow-2xl border-4 border-white dark:border-gray-800 object-cover mx-auto transform transition-transform group-hover:scale-105"
          />
          <button className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-2xl shadow-lg border-2 border-white dark:border-gray-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        
        <div className="mt-6">
          {isEditing ? (
            <div className="flex flex-col items-center space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-gray-100 dark:bg-gray-700 border-none rounded-2xl px-4 py-2 text-center text-xl font-bold dark:text-white outline-none ring-2 ring-blue-500"
                autoFocus
                onBlur={handleUpdateName}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
              />
              <p className="text-xs text-blue-500 font-medium">Press Enter to save</p>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{user.name}</h2>
              <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-blue-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}
          <p className="text-gray-500 font-medium mt-1">+{user.phone}</p>
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* Daily Mission Card */}
        <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-3">Today's Mission</h3>
            <div className="bg-white dark:bg-gray-800 rounded-[32px] p-6 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-3">
                    <div className="w-10 h-10 bg-yellow-50 dark:bg-yellow-900/20 rounded-full flex items-center justify-center text-yellow-500">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 14.95a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM16.243 17.243a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zM9 9a3 3 0 000 6h2a3 3 0 100-6H9z" /></svg>
                    </div>
                </div>
                <div className="pr-12">
                    <h4 className="font-black text-lg dark:text-white">Daily Login Bonus</h4>
                    <p className="text-xs text-gray-500 mt-1">লগইন করুন এবং প্রতিদিনের রিওয়ার্ড সংগ্রহ করুন!</p>
                </div>
                <div className="mt-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Reward Amount</p>
                        <p className="text-2xl font-black text-blue-600 mt-1">৳{(walletSettings?.dailyReward || 0).toFixed(2)}</p>
                    </div>
                    <button 
                        disabled={hasClaimedToday || claiming}
                        onClick={claimDailyReward}
                        className={`px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                            hasClaimedToday 
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed' 
                            : 'blue-gradient text-white shadow-lg shadow-blue-500/30 active:scale-95'
                        }`}
                    >
                        {claiming ? 'Processing...' : hasClaimedToday ? 'Claimed' : 'Claim Now'}
                    </button>
                </div>
            </div>
        </div>

        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">General Settings</h3>
        
        <div onClick={toggleDarkMode} className="w-full flex items-center justify-between p-5 bg-white dark:bg-gray-800 rounded-[24px] shadow-sm cursor-pointer active:scale-[0.98] transition-all">
          <div className="flex items-center text-gray-700 dark:text-gray-200">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl mr-4">
              <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {darkMode ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                )}
              </svg>
            </div>
            <span className="font-bold">Dark Appearance</span>
          </div>
          <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${darkMode ? 'bg-blue-500' : 'bg-gray-200'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center p-5 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-[24px] shadow-sm active:scale-[0.98] transition-all mt-6"
        >
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl mr-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <span className="font-bold">Sign Out</span>
        </button>
      </div>
    </div>
  );
};
