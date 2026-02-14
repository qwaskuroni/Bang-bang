
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, doc, setDoc, updateDoc, runTransaction, getDoc, orderBy, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { User, Transaction, WalletSettings, Chat, Message } from '../types';

interface AdminDashboardProps {
  onBack: () => void;
  onOpenBotSettings: (phone: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, onOpenBotSettings }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'live-chats' | 'wallet' | 'settings'>('users');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [walletSettings, setWalletSettings] = useState<WalletSettings>({
    bkashNumber: '', nagadNumber: '', rocketNumber: '', minDeposit: 100, minWithdraw: 500
  });

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

    const unsubSettings = onSnapshot(doc(db, 'settings', 'wallet'), d => d.exists() && setWalletSettings(d.data() as WalletSettings));
    
    // Fetch chats involving bots for monitoring
    const unsubChats = onSnapshot(collection(db, 'chats'), async (snap) => {
      const chatList: Chat[] = [];
      for (const d of snap.docs) {
        const data = d.data() as Chat;
        data.id = d.id;
        chatList.push(data);
      }
      // We'll filter later to show only chats with at least one bot
      setBotChats(chatList);
    });

    return () => { unsubUsers(); unsubTrans(); unsubSettings(); unsubChats(); };
  }, []);

  // Sync messages when a chat is selected for monitoring
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

    // Determine who is the bot and who is the user
    const identifyParticipants = async () => {
      const botPhone = selectedChat.participants.find(p => users.find(u => u.phone === p && u.isBot));
      const userPhone = selectedChat.participants.find(p => p !== botPhone);
      
      if (botPhone) setMonitoredBot(users.find(u => u.phone === botPhone) || null);
      if (userPhone) setMonitoredUser(users.find(u => u.phone === userPhone) || null);
    };
    identifyParticipants();

    return () => unsub();
  }, [selectedChat, users]);

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

  const saveSettings = async () => {
    await setDoc(doc(db, 'settings', 'wallet'), walletSettings);
    alert("Settings saved!");
  };

  const stats = {
    totalUsers: users.length,
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

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
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
            <NavItem id="live-chats" label="Monitor Chats" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>} />
            <NavItem id="wallet" label="Transactions" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>} />
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="p-4 glass border-b dark:border-gray-800 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-500 lg:hidden">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
            </button>
            <h2 className="ml-2 font-black text-lg dark:text-white capitalize">
              {activeTab === 'live-chats' && selectedChat ? 'Monitoring Chat' : `${activeTab} Management`}
            </h2>
          </div>
          <div className="flex items-center space-x-3">
             <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-none">Total System Cash</span>
                <span className="text-sm font-black text-blue-600">৳{stats.totalBalance.toLocaleString()}</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 no-scrollbar relative h-full">
          {activeTab === 'users' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <StatCard label="Active Users" value={stats.totalUsers} icon={<path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />} color="text-blue-600 bg-blue-50 dark:bg-blue-900/20" />
                <StatCard label="Pending Requests" value={stats.pendingTrans} icon={<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />} color="text-amber-600 bg-amber-50 dark:bg-amber-900/20" />
                <StatCard label="User Holdings" value={`৳${stats.totalBalance.toLocaleString()}`} icon={<path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />} color="text-green-600 bg-green-50 dark:bg-green-900/20" />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                  <h3 className="font-bold dark:text-white">User Directory</h3>
                  <span className="text-xs text-gray-400 font-medium">Newest First</span>
                </div>
                <div className="divide-y dark:divide-gray-700">
                  {users.map(u => (
                    <div key={u.phone} className="p-4 sm:p-6 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <div className="flex items-center min-w-0">
                        <div className="relative">
                          <img src={u.profileImage} className="w-12 h-12 rounded-2xl object-cover shadow-sm" alt="" />
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${u.online ? 'bg-green-500' : 'bg-gray-300'}`} />
                        </div>
                        <div className="ml-4 min-w-0">
                          <div className="flex items-center">
                            <p className="font-black text-sm dark:text-white truncate">{u.name}</p>
                            {u.isBot && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-[8px] font-black rounded-lg uppercase tracking-wider">Bot</span>}
                          </div>
                          <p className="text-[10px] text-gray-500 font-medium">{u.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter leading-none mb-1">Current Balance</p>
                          <p className="font-black text-blue-600">৳{(u.balance || 0).toFixed(2)}</p>
                        </div>
                        {u.isBot && (
                          <button onClick={() => onOpenBotSettings(u.phone)} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-2xl text-gray-400 hover:text-blue-500 transition-colors active:scale-90">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </button>
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
                <div className="flex-1 overflow-y-auto">
                  <div className="p-6 border-b dark:border-gray-700">
                    <h3 className="font-bold dark:text-white">User-Bot Conversations</h3>
                    <p className="text-xs text-gray-500 mt-1">Select a chat to monitor messages and reply as the bot.</p>
                  </div>
                  <div className="divide-y dark:divide-gray-700">
                    {botChats.filter(chat => {
                      // Only show chats that involve at least one bot
                      return chat.participants.some(p => users.find(u => u.phone === p && u.isBot));
                    }).map(chat => {
                      const botPhone = chat.participants.find(p => users.find(u => u.phone === p && u.isBot));
                      const userPhone = chat.participants.find(p => p !== botPhone);
                      const bot = users.find(u => u.phone === botPhone);
                      const user = users.find(u => u.phone === userPhone);

                      return (
                        <button key={chat.id} onClick={() => setSelectedChat(chat)} className="w-full p-6 flex items-center hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all text-left">
                          <div className="flex -space-x-3 mr-4">
                            <img src={user?.profileImage} className="w-10 h-10 rounded-xl border-2 border-white dark:border-gray-800 shadow-sm object-cover" alt="" />
                            <img src={bot?.profileImage} className="w-10 h-10 rounded-xl border-2 border-white dark:border-gray-800 shadow-sm object-cover" alt="" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm dark:text-white truncate">
                              {user?.name} ↔ {bot?.name}
                            </h4>
                            <p className="text-xs text-gray-500 truncate mt-1">{chat.lastMessage || 'No messages yet'}</p>
                          </div>
                          <div className="text-right ml-4">
                             <p className="text-[10px] text-gray-400">{chat.lastMessageTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                             <div className="mt-1 px-2 py-0.5 bg-blue-50 text-blue-500 text-[8px] font-black rounded uppercase">Monitor</div>
                          </div>
                        </button>
                      );
                    })}
                    {botChats.length === 0 && (
                      <div className="p-10 text-center text-gray-400">No active bot conversations found.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full relative">
                  {/* Chat Header */}
                  <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/20">
                    <div className="flex items-center">
                      <button onClick={() => setSelectedChat(null)} className="p-2 -ml-2 text-gray-500 hover:text-blue-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <div className="ml-2 flex items-center">
                        <img src={monitoredUser?.profileImage} className="w-8 h-8 rounded-lg object-cover mr-2" alt="" />
                        <div>
                          <p className="text-xs font-black dark:text-white leading-none">{monitoredUser?.name}</p>
                          <p className="text-[9px] text-gray-400">{monitoredUser?.phone}</p>
                        </div>
                        <div className="mx-3 text-gray-300">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </div>
                        <img src={monitoredBot?.profileImage} className="w-8 h-8 rounded-lg object-cover mr-2 border-2 border-blue-100" alt="" />
                        <div>
                          <p className="text-xs font-black dark:text-white leading-none text-blue-600">{monitoredBot?.name}</p>
                          <p className="text-[9px] text-gray-400">Verified Bot</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message List */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-blue-50/10 dark:bg-gray-950/20">
                    {monitoredMessages.map((msg, i) => (
                      <div key={msg.id || i} className={`flex flex-col ${msg.senderPhone === monitoredBot?.phone ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center mb-1 space-x-2">
                           {msg.senderPhone !== monitoredBot?.phone && <span className="text-[9px] font-bold text-gray-400 uppercase">{monitoredUser?.name}</span>}
                           {msg.senderPhone === monitoredBot?.phone && <span className="text-[9px] font-bold text-blue-500 uppercase">Replied as Bot</span>}
                        </div>
                        <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm text-sm ${
                          msg.senderPhone === monitoredBot?.phone 
                            ? 'blue-gradient text-white rounded-tr-none' 
                            : 'bg-white dark:bg-gray-700 dark:text-white rounded-tl-none border border-gray-100 dark:border-gray-600'
                        }`}>
                          {msg.text}
                        </div>
                        <span className="text-[8px] text-gray-400 mt-1">{msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                    <div ref={scrollRef} />
                  </div>

                  {/* Admin Reply Tool */}
                  <div className="p-4 border-t dark:border-gray-700 glass">
                    <form onSubmit={handleSendAsBot} className="flex space-x-2">
                      <input 
                        type="text" 
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                        placeholder={`Reply to ${monitoredUser?.name} as ${monitoredBot?.name}...`}
                        className="flex-1 bg-gray-100 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm outline-none dark:text-white focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button type="submit" className="p-4 blue-gradient text-white rounded-2xl shadow-xl active:scale-95 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                    </form>
                    <p className="text-[10px] text-center text-gray-400 mt-3 font-medium uppercase tracking-widest">You are manually overriding the bot responses</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="space-y-4">
              {transactions.map(t => (
                <div key={t.id} className="bg-white dark:bg-gray-800 p-6 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                  <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl font-black text-[9px] uppercase tracking-widest ${t.type === 'deposit' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>{t.type}</div>
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
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-700 mb-6 space-y-2">
                    {t.transactionId && <p className="text-xs font-medium text-gray-500">Transaction ID: <span className="text-blue-600 font-black">{t.transactionId}</span></p>}
                    {t.targetNumber && <p className="text-xs font-medium text-gray-500">Target Number: <span className="text-blue-600 font-black">{t.targetNumber}</span></p>}
                    <p className="text-xs font-medium text-gray-500">Time: <span className="dark:text-gray-300">{t.timestamp?.toDate().toLocaleString()}</span></p>
                  </div>
                  {t.status === 'pending' ? (
                    <div className="flex space-x-3">
                      <button onClick={() => handleApprove(t)} className="flex-1 bg-green-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-green-500/20 active:scale-95 transition-all">Approve</button>
                      <button onClick={() => handleReject(t.id)} className="flex-1 bg-red-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all">Reject</button>
                    </div>
                  ) : (
                    <div className={`text-center p-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] ${t.status === 'approved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{t.status}</div>
                  )}
                </div>
              ))}
              {transactions.length === 0 && <div className="text-center py-24 text-gray-400 flex flex-col items-center"><svg className="w-16 h-16 mb-4 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p className="font-bold">No recent requests</p></div>}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] shadow-sm border border-gray-100 dark:border-gray-700 space-y-8">
              <div>
                <h3 className="text-lg font-black dark:text-white mb-2">Wallet Integration</h3>
                <p className="text-xs text-gray-500">Set up numbers for bKash, Nagad and Rocket gateways</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GatewayInput label="bKash Number" value={walletSettings.bkashNumber} color="border-pink-500/20 focus:border-pink-500" onChange={v => setWalletSettings({...walletSettings, bkashNumber: v})} />
                <GatewayInput label="Nagad Number" value={walletSettings.nagadNumber} color="border-orange-500/20 focus:border-orange-500" onChange={v => setWalletSettings({...walletSettings, nagadNumber: v})} />
                <GatewayInput label="Rocket Number" value={walletSettings.rocketNumber} color="border-purple-500/20 focus:border-purple-500" onChange={v => setWalletSettings({...walletSettings, rocketNumber: v})} />
              </div>
              <div className="h-px bg-gray-100 dark:bg-gray-700" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GatewayInput label="Min Deposit (৳)" value={walletSettings.minDeposit.toString()} color="border-blue-500/20 focus:border-blue-500" onChange={v => setWalletSettings({...walletSettings, minDeposit: Number(v)})} type="number" />
                <GatewayInput label="Min Withdraw (৳)" value={walletSettings.minWithdraw.toString()} color="border-blue-500/20 focus:border-blue-500" onChange={v => setWalletSettings({...walletSettings, minWithdraw: Number(v)})} type="number" />
              </div>
              <button onClick={saveSettings} className="w-full blue-gradient text-white py-5 rounded-[24px] font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-500/20 active:scale-[0.98] transition-all">Save System Configuration</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-50 dark:border-gray-700 flex items-center">
    <div className={`p-4 rounded-2xl mr-4 ${color}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>{icon}</svg></div>
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-xl font-black dark:text-white leading-none">{value}</p>
    </div>
  </div>
);

const GatewayInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; color: string }> = ({ label, value, onChange, type = "text", color }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
    <input 
      type={type} 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className={`w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl outline-none text-sm dark:text-white border-2 transition-all ${color}`} 
    />
  </div>
);
