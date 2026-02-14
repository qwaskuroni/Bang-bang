
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, doc, setDoc, updateDoc, runTransaction, orderBy, addDoc, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { User, Transaction, WalletSettings, Chat, Message } from '../types';

interface AdminDashboardProps {
  onBack: () => void;
  onOpenBotSettings: (phone: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, onOpenBotSettings }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'live-chats' | 'wallet' | 'settings' | 'groups-control'>('users');
  const [userFilter, setUserFilter] = useState<'all' | 'bots'>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [walletSettings, setWalletSettings] = useState<WalletSettings>({
    bkashNumber: '', nagadNumber: '', rocketNumber: '', minDeposit: 100, minWithdraw: 500, dailyReward: 5, groupsEnabled: true
  });

  // Create Bot States
  const [showCreateBot, setShowCreateBot] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotPhone, setNewBotPhone] = useState('');
  const [newBotSeed, setNewBotSeed] = useState('');
  const [newBotImageUrl, setNewBotImageUrl] = useState('');
  const [isCreatingBot, setIsCreatingBot] = useState(false);

  // Chat Monitoring states
  const [botChats, setBotChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [monitoredMessages, setMonitoredMessages] = useState<Message[]>([]);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [monitoredBot, setMonitoredBot] = useState<User | null>(null);
  const [monitoredUser, setMonitoredUser] = useState<User | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(query(collection(db, 'users')), snap => {
      const uList = snap.docs.map(d => d.data() as User);
      setUsers(uList.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
    });

    const unsubTrans = onSnapshot(query(collection(db, 'transactions')), snap => {
      const tList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(tList.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'wallet'), d => {
        if (d.exists()) {
            setWalletSettings({
                bkashNumber: '', nagadNumber: '', rocketNumber: '', minDeposit: 100, minWithdraw: 500, dailyReward: 5, groupsEnabled: true,
                ...d.data() as WalletSettings
            });
        }
    });
    
    const unsubChats = onSnapshot(collection(db, 'chats'), (snap) => {
      const chatList: Chat[] = [];
      snap.docs.forEach(d => {
        const data = d.data() as Chat;
        data.id = d.id;
        chatList.push(data);
      });
      setBotChats(chatList);
    });

    return () => { unsubUsers(); unsubTrans(); unsubSettings(); unsubChats(); };
  }, []);

  useEffect(() => {
    if (!selectedChat) {
      setMonitoredMessages([]);
      return;
    }

    const q = query(collection(db, 'chats', selectedChat.id, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMonitoredMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    const identifyParticipants = async () => {
      const botPhone = selectedChat.participants.find(p => users.find(u => u.phone === p && u.isBot));
      const userPhone = selectedChat.participants.find(p => p !== botPhone);
      
      if (botPhone) setMonitoredBot(users.find(u => u.phone === botPhone) || null);
      if (userPhone) setMonitoredUser(users.find(u => u.phone === userPhone) || null);
    };
    identifyParticipants();

    return () => unsub();
  }, [selectedChat, users]);

  const toggleGroupVisibility = async () => {
    const newVal = !walletSettings.groupsEnabled;
    try {
      await updateDoc(doc(db, 'settings', 'wallet'), { groupsEnabled: newVal });
    } catch (err) {
      alert("Failed to update group visibility");
    }
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName || !newBotPhone) return;
    setIsCreatingBot(true);
    try {
      const userRef = doc(db, 'users', newBotPhone);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        alert("User or Bot with this phone already exists!");
        return;
      }

      const profileImage = newBotImageUrl.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${newBotSeed || newBotName}`;

      await setDoc(userRef, {
        name: newBotName,
        phone: newBotPhone,
        isBot: true,
        online: true,
        balance: 0,
        profileImage: profileImage,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        isAiEnabled: false,
        botCallDuration: 60,
        botMaxCallsPerUser: 5,
        botCallPrice: 5,
        botVideoCallPrice: 10,
        botAudioCallPrice: 5
      });

      alert("Bot Created Successfully!");
      setShowCreateBot(false);
      setNewBotName('');
      setNewBotPhone('');
      setNewBotSeed('');
      setNewBotImageUrl('');
    } catch (err) {
      alert("Error creating bot");
    } finally {
      setIsCreatingBot(false);
    }
  };

  const handleSendAsBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !monitoredBot || !adminReplyText.trim()) return;

    const text = adminReplyText;
    setAdminReplyText('');

    await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), {
      chatId: selectedChat.id,
      senderPhone: monitoredBot.phone,
      text,
      type: 'text',
      timestamp: serverTimestamp(),
      seen: false
    });

    await updateDoc(doc(db, 'chats', selectedChat.id), {
      lastMessage: text,
      lastMessageTime: serverTimestamp()
    });
  };

  const handleApprove = async (t: Transaction) => {
    if (t.status !== 'pending') return;
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', t.userId);
        const transRef = doc(db, 'transactions', t.id);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw "User document does not exist!";
        const userData = userSnap.data() as User;
        const currentBalance = Number(userData.balance || 0);
        const transAmount = Number(t.amount);
        let newBalance = currentBalance;
        if (t.type === 'deposit') newBalance = currentBalance + transAmount;
        else if (t.type === 'withdraw') {
          if (currentBalance < transAmount) throw "User has insufficient balance.";
          newBalance = currentBalance - transAmount;
        }
        transaction.update(userRef, { balance: newBalance });
        transaction.update(transRef, { status: 'approved' });
      });
      alert(`Success! Approved ৳${t.amount} for ${t.userName}`);
    } catch (e: any) {
      alert("Error: " + e.toString());
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Reject this request?")) return;
    await updateDoc(doc(db, 'transactions', id), { status: 'rejected' });
  };

  const toggleBlockUser = async (user: User) => {
    const newStatus = !user.isBlocked;
    const confirmMsg = newStatus 
      ? `Are you sure you want to block ${user.name}? They will no longer be able to send messages.` 
      : `Unblock ${user.name}?`;
    
    if (window.confirm(confirmMsg)) {
      await updateDoc(doc(db, 'users', user.phone), { isBlocked: newStatus });
      alert(newStatus ? "User Blocked" : "User Unblocked");
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (window.confirm(`PERMANENTLY DELETE user ${user.name} (${user.phone})? This cannot be undone.`)) {
      await deleteDoc(doc(db, 'users', user.phone));
      alert("User Deleted Permanently");
    }
  };

  const saveSettings = async () => {
    await setDoc(doc(db, 'settings', 'wallet'), walletSettings);
    alert("Settings saved!");
  };

  const stats = {
    totalUsers: users.length,
    totalBots: users.filter(u => u.isBot).length,
    pendingTrans: transactions.filter(t => t.status === 'pending').length,
    totalBalance: users.reduce((acc, curr) => acc + (curr.balance || 0), 0)
  };

  const NavItem: React.FC<{ id: typeof activeTab; label: string; icon: React.ReactNode }> = ({ id, label, icon }) => (
    <button 
      onClick={() => { setActiveTab(id); setIsSidebarOpen(false); setSelectedChat(null); }}
      className={`w-full flex items-center space-x-3 px-4 py-4 rounded-2xl transition-all ${activeTab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
    >
      <div className={`${activeTab === id ? 'text-white' : 'text-gray-400'}`}>{icon}</div>
      <span className="font-bold text-sm">{label}</span>
    </button>
  );

  const filteredUsers = userFilter === 'all' ? users : users.filter(u => u.isBot);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 w-72 glass border-r dark:border-gray-800 z-[110] transform transition-transform duration-300 lg:relative lg:transform-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-10">
            <div className="w-10 h-10 blue-gradient rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            </div>
            <div>
              <h2 className="font-black text-xl text-gray-900 dark:text-white leading-none">Console</h2>
              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Admin Panel</p>
            </div>
          </div>

          <div className="space-y-2">
            <NavItem id="users" label="Users & Bots" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
            <NavItem id="groups-control" label="Groups Settings" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
            <NavItem id="live-chats" label="Monitor Chats" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>} />
            <NavItem id="wallet" label="Transactions" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>} />
            <NavItem id="settings" label="System Settings" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>} />
          </div>

          <div className="absolute bottom-8 left-6 right-6">
            <button onClick={onBack} className="w-full flex items-center justify-center space-x-2 p-4 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-2xl font-bold text-sm active:scale-95 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              <span>Exit Console</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="p-4 glass border-b dark:border-gray-800 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-500 lg:hidden">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
            </button>
            <h2 className="ml-2 font-black text-lg dark:text-white capitalize">
              {activeTab === 'groups-control' ? 'Group Feature Control' : `${activeTab} Management`}
            </h2>
          </div>
          {activeTab === 'users' && (
            <button 
              onClick={() => setShowCreateBot(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-500/30 flex items-center active:scale-95 transition-all"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Add New Bot
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 no-scrollbar relative h-full">
          {activeTab === 'groups-control' && (
            <div className="max-w-2xl mx-auto space-y-6">
               <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                     <div>
                        <h3 className="text-xl font-black dark:text-white">Global Group Visibility</h3>
                        <p className="text-sm text-gray-500 mt-1">এই অপশনটি অন থাকলে ইউজাররা গ্রুপ ফিচার দেখতে পাবে। অফ করলে গ্রুপ মেনু হাইড হয়ে যাবে।</p>
                     </div>
                     <button 
                        onClick={toggleGroupVisibility}
                        className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${walletSettings.groupsEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                     >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${walletSettings.groupsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                     </button>
                  </div>
                  
                  <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800">
                     <div className="flex items-start">
                        <svg className="w-6 h-6 text-blue-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div>
                           <h4 className="font-bold text-blue-900 dark:text-blue-200">কিভাবে কাজ করে?</h4>
                           <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
                              অফ করলে ইউজারদের অ্যাপের নিচের মেনুবার থেকে 'Groups' আইকনটি চলে যাবে। কিন্তু আগে থেকে তৈরি করা গ্রুপগুলো ডাটাবেসে সুরক্ষিত থাকবে। আপনি চাইলে যেকোনো সময় আবার অন করতে পারেন।
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'users' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <StatCard 
                  label="Active Users" 
                  value={stats.totalUsers} 
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-6 h-6">
                      <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  } 
                  color="text-blue-600 bg-blue-50 dark:bg-blue-900/20" 
                />
                <StatCard 
                  label="Total Bot Accounts" 
                  value={stats.totalBots} 
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-6 h-6">
                      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  } 
                  color="text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" 
                />
                <StatCard 
                  label="Pending Requests" 
                  value={stats.pendingTrans} 
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-6 h-6">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  } 
                  color="text-amber-600 bg-amber-50 dark:bg-amber-900/20" 
                />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold dark:text-white">User Directory</h3>
                    <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
                      <button onClick={() => setUserFilter('all')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${userFilter === 'all' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400'}`}>All Users</button>
                      <button onClick={() => setUserFilter('bots')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${userFilter === 'bots' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400'}`}>Bots Only</button>
                    </div>
                  </div>
                </div>
                <div className="divide-y dark:divide-gray-700">
                  {filteredUsers.map(u => (
                    <div key={u.phone} className="p-4 sm:p-6 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <div className="flex items-center min-w-0">
                        <img src={u.profileImage} className="w-12 h-12 rounded-2xl object-cover shadow-sm" alt="" />
                        <div className="ml-4 min-w-0">
                          <p className={`font-black text-sm truncate ${u.isBlocked ? 'text-red-500 line-through' : 'dark:text-white'}`}>{u.name}</p>
                          <p className="text-[10px] text-gray-500 font-medium">{u.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {u.isBot ? (
                          <button onClick={() => onOpenBotSettings(u.phone)} className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
                        ) : (
                          <div className="flex space-x-1">
                             <button onClick={() => toggleBlockUser(u)} className="p-2.5 bg-red-50 text-red-500 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" /></svg></button>
                             <button onClick={() => handleDeleteUser(u)} className="p-2.5 bg-red-50 text-red-600 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'live-chats' && (
            <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              {!selectedChat ? (
                <div className="flex-1 overflow-y-auto divide-y dark:divide-gray-700">
                  {botChats.map(chat => (
                    <button key={chat.id} onClick={() => setSelectedChat(chat)} className="w-full p-6 flex items-center hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all text-left">
                       <div className="flex-1">
                          <h4 className="font-bold text-sm dark:text-white">Chat ID: {chat.id}</h4>
                          <p className="text-xs text-gray-500 mt-1">{chat.lastMessage}</p>
                       </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col h-full">
                   <div className="p-4 border-b dark:border-gray-700 flex items-center">
                      <button onClick={() => setSelectedChat(null)} className="p-2 text-gray-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                      <h3 className="ml-2 font-bold dark:text-white">Monitoring Chat</h3>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {monitoredMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.senderPhone === monitoredBot?.phone ? 'justify-end' : 'justify-start'}`}>
                           <div className={`p-3 rounded-2xl text-sm ${msg.senderPhone === monitoredBot?.phone ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 dark:text-white'}`}>
                              {msg.text}
                           </div>
                        </div>
                      ))}
                      <div ref={scrollRef} />
                   </div>
                   <form onSubmit={handleSendAsBot} className="p-4 border-t dark:border-gray-700 flex space-x-2">
                      <input value={adminReplyText} onChange={e => setAdminReplyText(e.target.value)} type="text" className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-xl px-4 py-2 outline-none dark:text-white" placeholder="Reply as bot..." />
                      <button type="submit" className="p-2 bg-blue-600 text-white rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
                   </form>
                </div>
              )}
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="space-y-4">
              {transactions.map(t => (
                <div key={t.id} className="bg-white dark:bg-gray-800 p-6 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                  <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl font-black text-[9px] uppercase tracking-widest ${t.type === 'deposit' ? 'bg-green-500 text-white' : t.type === 'withdraw' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>{t.type}</div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                    <div>
                      <h4 className="font-black text-lg dark:text-white leading-tight">{t.userName}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-1">{t.userId} • {t.gateway.toUpperCase()} Gateway</p>
                    </div>
                    <div className="mt-4 sm:mt-0 text-left sm:text-right">
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-none mb-1">Requested Amount</p>
                       <p className="text-2xl font-black dark:text-white">৳{t.amount.toLocaleString()}</p>
                    </div>
                  </div>
                  {t.status === 'pending' ? (
                    <div className="flex space-x-3">
                      <button onClick={() => handleApprove(t)} className="flex-1 bg-green-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Approve</button>
                      <button onClick={() => handleReject(t.id)} className="flex-1 bg-red-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Reject</button>
                    </div>
                  ) : (
                    <div className={`text-center p-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] ${t.status === 'approved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{t.status}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] shadow-sm border border-gray-100 dark:border-gray-700 space-y-8">
              <div>
                <h3 className="text-lg font-black dark:text-white mb-2">Wallet & Mission Configuration</h3>
                <p className="text-xs text-gray-500">Manage payment gateways and daily rewards</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GatewayInput label="bKash Number" value={walletSettings.bkashNumber} color="border-pink-500/20 focus:border-pink-500" onChange={v => setWalletSettings({...walletSettings, bkashNumber: v})} />
                <GatewayInput label="Nagad Number" value={walletSettings.nagadNumber} color="border-orange-500/20 focus:border-orange-500" onChange={v => setWalletSettings({...walletSettings, nagadNumber: v})} />
                <GatewayInput label="Rocket Number" value={walletSettings.rocketNumber} color="border-purple-500/20 focus:border-purple-500" onChange={v => setWalletSettings({...walletSettings, rocketNumber: v})} />
              </div>
              <button onClick={saveSettings} className="w-full blue-gradient text-white py-5 rounded-[24px] font-black text-sm uppercase tracking-widest shadow-2xl active:scale-[0.98] transition-all">Save System Configuration</button>
            </div>
          )}
        </main>
      </div>

      {/* Create Bot Modal */}
      {showCreateBot && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateBot(false)} />
           <div className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-white/20">
              <div className="text-center mb-8">
                 <h2 className="text-2xl font-black dark:text-white">Create New Bot</h2>
                 <p className="text-sm text-gray-500 mt-2">নতুন বট ইউজার তৈরি করুন।</p>
              </div>

              <form onSubmit={handleCreateBot} className="space-y-6">
                 <div className="flex flex-col items-center mb-4">
                    <img 
                      src={newBotImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${newBotSeed || newBotName || 'default'}`} 
                      className="w-20 h-20 rounded-[28px] bg-gray-100 p-2 shadow-inner mb-4 object-cover" 
                      alt="" 
                    />
                    <div className="flex flex-col space-y-2 w-full">
                       <input 
                        type="text" 
                        placeholder="Image URL (Direct link)" 
                        value={newBotImageUrl}
                        onChange={e => setNewBotImageUrl(e.target.value)}
                        className="bg-gray-50 dark:bg-gray-800 text-[10px] p-3 rounded-xl outline-none dark:text-white w-full border border-gray-100 dark:border-gray-700"
                      />
                      {!newBotImageUrl && (
                        <input 
                          type="text" 
                          placeholder="Or DiceBear Seed" 
                          value={newBotSeed}
                          onChange={e => setNewBotSeed(e.target.value)}
                          className="bg-gray-50 dark:bg-gray-800 text-[10px] p-2 rounded-xl outline-none dark:text-white w-full text-center"
                        />
                      )}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div>
                       <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Bot Name</label>
                       <input 
                         required
                         type="text" 
                         value={newBotName}
                         onChange={e => setNewBotName(e.target.value)}
                         className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500/30 dark:text-white font-bold" 
                         placeholder="Enter Bot Name" 
                       />
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Phone Number (ID)</label>
                       <input 
                         required
                         type="tel" 
                         maxLength={11}
                         value={newBotPhone}
                         onChange={e => setNewBotPhone(e.target.value.replace(/\D/g, ''))}
                         className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500/30 dark:text-white font-bold" 
                         placeholder="017XXXXXXXX" 
                       />
                    </div>
                 </div>

                 <div className="pt-4 space-y-3">
                    <button 
                      disabled={isCreatingBot}
                      type="submit" 
                      className="w-full blue-gradient text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                    >
                       {isCreatingBot ? 'Creating...' : 'Create Bot Account'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowCreateBot(false)}
                      className="w-full text-xs font-bold text-gray-400 py-2"
                    >
                      Cancel
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-50 dark:border-gray-700 flex items-center">
    <div className={`p-4 rounded-2xl mr-4 ${color}`}>{icon}</div>
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-xl font-black dark:text-white leading-none">{value}</p>
    </div>
  </div>
);

const GatewayInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; color: string }> = ({ label, value, onChange, type = "text", color }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className={`w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl outline-none text-sm dark:text-white border-2 transition-all ${color}`} />
  </div>
);
