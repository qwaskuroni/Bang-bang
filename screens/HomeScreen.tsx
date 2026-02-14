
import React, { useState, useEffect } from 'react';
import { User, Chat, Group, View, WalletSettings, Transaction } from '../types';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, serverTimestamp, getDocs, limit, orderBy } from 'firebase/firestore';

interface HomeScreenProps {
  currentUser: User;
  activeView: View;
  setActiveView: (view: View) => void;
  onSelectChat: (chatId: string) => void;
  onSelectGroup: (groupId: string) => void;
}

const MASTER_ADMIN_PHONE = "01700000000"; 

export const HomeScreen: React.FC<HomeScreenProps> = ({ currentUser, activeView, setActiveView, onSelectChat, onSelectGroup }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [titleClickCount, setTitleClickCount] = useState(0);
  
  // Create Group States
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [groupType, setGroupType] = useState<'public' | 'private' | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupLogoSeed, setGroupLogoSeed] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Wallet states
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [walletSettings, setWalletSettings] = useState<WalletSettings | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Transaction Form States
  const [selectedGateway, setSelectedGateway] = useState<'bkash' | 'nagad' | 'rocket'>('bkash');
  const [amount, setAmount] = useState('');
  const [txId, setTxId] = useState('');
  const [targetNum, setTargetNum] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Sync Wallet Settings (which now includes groupsEnabled)
    const unsubSettings = onSnapshot(doc(db, 'settings', 'wallet'), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as WalletSettings;
        setWalletSettings(data);
        
        // Safety: if groups are disabled and user is currently on groups view, redirect to chats
        if (data.groupsEnabled === false && activeView === 'groups') {
          setActiveView('chats');
        }
      }
    });

    // Sync User Transactions
    const qTrans = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.phone)
    );
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      const transList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      const sorted = transList.sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });
      setTransactions(sorted.slice(0, 20));
    });

    return () => { unsubSettings(); unsubTrans(); };
  }, [currentUser.phone, activeView]);

  // Fetch Chats
  useEffect(() => {
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.phone));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatData: Chat[] = [];
      for (const d of snapshot.docs) {
        const data = d.data() as Chat;
        data.id = d.id;
        const otherPhone = data.participants.find(p => p !== currentUser.phone);
        if (otherPhone) {
          const userSnap = await getDoc(doc(db, 'users', otherPhone));
          if (userSnap.exists()) data.otherUser = userSnap.data() as User;
        }
        chatData.push(data);
      }
      setChats(chatData.sort((a, b) => (b.lastMessageTime?.toMillis() || 0) - (a.lastMessageTime?.toMillis() || 0)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser.phone]);

  // Fetch Groups
  useEffect(() => {
    if (activeView === 'groups' && walletSettings?.groupsEnabled !== false) {
      setLoadingGroups(true);
      const q = query(collection(db, 'groups'), where('members', 'array-contains', currentUser.phone));
      const unsub = onSnapshot(q, (snap) => {
        const groupData = snap.docs.map(d => {
          const data = d.data();
          return { 
            id: d.id, 
            ...data,
            admins: data.admins || [],
            members: data.members || []
          } as Group;
        });
        setGroups(groupData.sort((a, b) => (b.lastMessageTime?.toMillis() || 0) - (a.lastMessageTime?.toMillis() || 0)));
        setLoadingGroups(false);
      });
      return () => unsub();
    }
  }, [activeView, currentUser.phone, walletSettings?.groupsEnabled]);

  // Fetch Contacts (Bots)
  useEffect(() => {
    if (activeView === 'contacts') {
      setLoadingContacts(true);
      const q = query(collection(db, 'users'), where('isBot', '==', true), limit(100));
      const unsub = onSnapshot(q, (snap) => {
        const bots = snap.docs.map(d => d.data() as User).filter(u => u.phone !== currentUser.phone);
        setContacts(bots);
        setLoadingContacts(false);
      });
      return () => unsub();
    }
  }, [activeView, currentUser.phone]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !groupType) return;
    setIsCreatingGroup(true);
    try {
      const logo = `https://api.dicebear.com/7.x/identicon/svg?seed=${groupLogoSeed || groupName}`;
      await addDoc(collection(db, 'groups'), {
        name: groupName,
        logo: logo,
        type: groupType,
        createdBy: currentUser.phone,
        admins: [currentUser.phone],
        members: [currentUser.phone],
        lastMessage: 'Group created',
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      setGroupType(null);
      setGroupName('');
      setGroupLogoSeed('');
      setShowCreateOptions(false);
      setActiveView('groups');
    } catch (err) {
      alert("Error creating group");
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return alert("Enter valid amount");
    
    if (activeView === 'wallet-deposit') {
      if (!txId) return alert("Enter Transaction ID");
      if (walletSettings && amt < walletSettings.minDeposit) return alert(`Min deposit ৳${walletSettings.minDeposit}`);
    } else {
      if (!targetNum) return alert("Enter your number");
      if (amt > (currentUser.balance || 0)) return alert("Insufficient balance");
      if (walletSettings && amt < walletSettings.minWithdraw) return alert(`Min withdraw ৳${walletSettings.minWithdraw}`);
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        userId: currentUser.phone,
        userName: currentUser.name,
        type: activeView === 'wallet-deposit' ? 'deposit' : 'withdraw',
        gateway: selectedGateway,
        amount: amt,
        status: 'pending',
        transactionId: txId || null,
        targetNumber: targetNum || null,
        timestamp: serverTimestamp()
      });
      alert("Request submitted successfully!");
      setActiveView('wallet-history');
      setAmount(''); setTxId(''); setTargetNum('');
    } catch (err) {
      alert("Error submitting request");
    } finally {
      setSubmitting(false);
    }
  };

  const startOrSelectChat = async (targetUser: User) => {
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.phone));
    const snap = await getDocs(q);
    const existingChat = snap.docs.find(d => {
      const parts = d.data().participants as string[];
      return parts.includes(targetUser.phone);
    });

    if (existingChat) {
      onSelectChat(existingChat.id);
    } else {
      const newChatRef = await addDoc(collection(db, 'chats'), {
        participants: [currentUser.phone, targetUser.phone],
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      onSelectChat(newChatRef.id);
    }
  };

  const getGatewayNumber = () => {
    if (!walletSettings) return 'Loading...';
    return selectedGateway === 'bkash' ? walletSettings.bkashNumber : 
           selectedGateway === 'nagad' ? walletSettings.nagadNumber : 
           walletSettings.rocketNumber;
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleTitleClick = () => {
    if (currentUser.phone === MASTER_ADMIN_PHONE) {
      const nextCount = titleClickCount + 1;
      if (nextCount >= 5) {
        window.location.hash = '#admin';
        setTitleClickCount(0);
      } else {
        setTitleClickCount(nextCount);
      }
    }
  };

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));
  const filteredChats = chats.filter(c => c.otherUser?.name.toLowerCase().includes(search.toLowerCase()) || c.otherUser?.phone.includes(search));

  if (activeView === 'wallet-deposit' || activeView === 'wallet-withdraw') {
    return (
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 overflow-y-auto pb-10">
        <div className="p-4 glass sticky top-0 z-50 flex items-center border-b dark:border-gray-800">
          <button onClick={() => setActiveView('chats')} className="p-2 -ml-2 text-gray-600 dark:text-gray-300">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="ml-2 text-lg font-bold dark:text-white">{activeView === 'wallet-deposit' ? 'Deposit Money' : 'Withdraw Money'}</h1>
        </div>
        <div className="p-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
            <div className="flex justify-around items-center">
              <GatewayIcon active={selectedGateway === 'bkash'} onClick={() => setSelectedGateway('bkash')} name="bKash" color="bg-pink-500" />
              <GatewayIcon active={selectedGateway === 'nagad'} onClick={() => setSelectedGateway('nagad')} name="Nagad" color="bg-orange-500" />
              <GatewayIcon active={selectedGateway === 'rocket'} onClick={() => setSelectedGateway('rocket')} name="Rocket" color="bg-purple-600" />
            </div>
            {activeView === 'wallet-deposit' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 text-center animate-pulse">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Send Money to {selectedGateway}</p>
                <h3 className="text-xl font-black text-blue-700 dark:text-blue-400 mt-1">{getGatewayNumber()}</h3>
                <p className="text-[10px] text-blue-400 mt-1 font-medium">Use 'Send Money' option from your app</p>
              </div>
            )}
            <form onSubmit={handleTransaction} className="space-y-4">
              <div className="group">
                <label className="text-xs font-bold text-gray-400 ml-1 mb-1 block transition-colors group-focus-within:text-blue-500">Amount (৳)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl outline-none font-bold text-lg dark:text-white border-2 border-transparent focus:border-blue-500/30 transition-all" placeholder="0.00" />
              </div>
              {activeView === 'wallet-deposit' ? (
                <div className="group">
                  <label className="text-xs font-bold text-gray-400 ml-1 mb-1 block transition-colors group-focus-within:text-blue-500">Transaction ID</label>
                  <input type="text" value={txId} onChange={e => setTxId(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl outline-none font-bold dark:text-white border-2 border-transparent focus:border-blue-500/30 transition-all" placeholder="Example: AM67B9X" />
                </div>
              ) : (
                <div className="group">
                  <label className="text-xs font-bold text-gray-400 ml-1 mb-1 block transition-colors group-focus-within:text-blue-500">Your {selectedGateway} Number</label>
                  <input type="tel" value={targetNum} onChange={e => setTargetNum(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl outline-none font-bold dark:text-white border-2 border-transparent focus:border-blue-500/30 transition-all" placeholder="017XXXXXXXX" />
                </div>
              )}
              <button disabled={submitting} type="submit" className="w-full blue-gradient text-white py-4 rounded-2xl font-bold text-lg shadow-xl active:scale-95 transition-all mt-4">
                {submitting ? 'Processing...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 relative h-full">
      <div className="p-4 glass sticky top-0 z-[60] shadow-sm">
        <div className="flex items-center justify-between min-h-[48px]">
          {isSearchOpen ? (
            <div className="flex-1 flex items-center animate-in slide-in-from-right-4 duration-300">
              <button onClick={() => { setIsSearchOpen(false); setSearch(''); }} className="p-2 -ml-2 text-blue-600 mr-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
              <div className="flex-1 relative">
                <input autoFocus type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-2xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col animate-in fade-in duration-300" onClick={handleTitleClick}>
                <h1 className="text-2xl font-black text-blue-600 select-none tracking-tight cursor-pointer">ImoFlow</h1>
              </div>
              <div className="flex items-center space-x-1.5">
                <button onClick={() => setIsSearchOpen(true)} className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 active:scale-90 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>
                <div className="relative">
                  <div onClick={() => setShowWalletMenu(!showWalletMenu)} className="flex items-center bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-700 rounded-full pl-3 pr-1 py-1 shadow-sm active:scale-95 transition-all cursor-pointer">
                    <span className="text-sm font-bold text-gray-800 dark:text-white mr-2">৳{(currentUser.balance || 0).toFixed(2)}</span>
                    <div className="w-8 h-8 blue-gradient rounded-full flex items-center justify-center text-white shadow-md"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                  </div>
                  {showWalletMenu && (
                    <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-gray-800 rounded-[28px] shadow-2xl z-50 p-2 border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
                       <div className="grid grid-cols-2 gap-1">
                          <WalletAction onClick={() => { setActiveView('wallet-deposit'); setShowWalletMenu(false); }} label="Deposit" color="text-green-500 bg-green-50" icon={<path d="M12 4v16m8-8H4" />} />
                          <WalletAction onClick={() => { setActiveView('wallet-withdraw'); setShowWalletMenu(false); }} label="Withdraw" color="text-red-500 bg-red-50" icon={<path d="M20 12H4" />} />
                          <WalletAction onClick={() => { setActiveView('wallet-history'); setShowWalletMenu(false); }} label="History" color="text-blue-500 bg-blue-50" icon={<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />} />
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 h-full">
        {activeView === 'groups' && walletSettings?.groupsEnabled !== false ? (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-lg font-black dark:text-white">Your Groups</h2>
               <button onClick={() => setShowCreateOptions(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  Create Group
               </button>
            </div>
            {loadingGroups ? (
              <div className="flex flex-col items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div></div>
            ) : filteredGroups.length > 0 ? filteredGroups.map(group => (
              <button key={group.id} onClick={() => onSelectGroup(group.id)} className="w-full flex items-center p-4 bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 transition-all animate-in fade-in active:scale-[0.98]">
                 <img src={group.logo} className="w-12 h-12 rounded-2xl object-cover bg-gray-50 p-1" alt="" />
                 <div className="ml-4 text-left flex-1 min-w-0">
                    <h3 className="font-bold text-sm dark:text-white truncate">{group.name}</h3>
                    <p className="text-[10px] text-gray-500 font-medium truncate uppercase tracking-tighter">{group.type} Group • {group.members.length} Members</p>
                 </div>
              </button>
            )) : (
              <div className="text-center py-24 flex flex-col items-center">
                 <p className="text-gray-400 font-bold">You are not in any groups</p>
              </div>
            )}
          </div>
        ) : activeView === 'chats' ? (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div></div>
            ) : filteredChats.length > 0 ? filteredChats.map(chat => (
              <button key={chat.id} onClick={() => onSelectChat(chat.id)} className="w-full flex items-center p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border-b dark:border-gray-800 animate-in fade-in duration-300">
                <div className="relative">
                  <img src={chat.otherUser?.profileImage || `https://picsum.photos/seed/${chat.id}/200`} className="w-12 h-12 rounded-xl object-cover shadow-sm" alt="" />
                </div>
                <div className="ml-3 flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm dark:text-white truncate pr-2">{chat.otherUser?.name || 'User'}</h3>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{chat.lastMessage || 'Start a conversation'}</p>
                </div>
              </button>
            )) : (
              <div className="text-center py-24 flex flex-col items-center">
                <p className="text-gray-400 font-bold">No active chats</p>
              </div>
            )}
          </>
        ) : (
          <div className="p-2 space-y-1">
            {filteredContacts.map(contact => (
              <button key={contact.phone} onClick={() => startOrSelectChat(contact)} className="w-full flex items-center p-3 hover:bg-white dark:hover:bg-gray-800 rounded-2xl transition-all animate-in slide-in-from-bottom-2 duration-300">
                <img src={contact.profileImage} className="w-11 h-11 rounded-xl object-cover shadow-sm" alt="" />
                <div className="ml-3 flex-1 text-left min-w-0">
                  <h3 className="font-bold text-sm dark:text-white truncate">{contact.name}</h3>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 glass border-t dark:border-gray-800 flex items-center justify-around px-2 py-2 z-[100] safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <NavButton active={activeView === 'chats'} label="Chats" onClick={() => setActiveView('chats')} icon={<path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />} />
        {walletSettings?.groupsEnabled !== false && (
          <NavButton active={activeView === 'groups'} label="Groups" onClick={() => setActiveView('groups')} icon={<path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />} />
        )}
        <NavButton active={activeView === 'contacts'} label="Contacts" onClick={() => setActiveView('contacts')} icon={<path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />} />
        <NavButton active={activeView === 'profile'} label="Profile" onClick={() => setActiveView('profile')} icon={<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />} />
      </div>
    </div>
  );
};

const GatewayIcon: React.FC<{ active: boolean; onClick: () => void; name: string; color: string }> = ({ active, onClick, name, color }) => (
  <div onClick={onClick} className={`flex flex-col items-center cursor-pointer transition-all ${active ? 'scale-110' : 'opacity-40 grayscale'}`}>
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-[10px] shadow-lg ${color}`}>{name}</div>
    <span className="text-[10px] font-bold mt-1 dark:text-gray-400">{name}</span>
  </div>
);

const WalletAction: React.FC<{ label: string; icon: React.ReactNode; color: string; onClick: () => void }> = ({ label, icon, color, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center p-3 rounded-2xl active:scale-95 transition-all">
    <div className={`w-10 h-10 flex items-center justify-center rounded-xl mb-1 ${color}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>{icon}</svg></div>
    <span className="text-[9px] font-black uppercase text-gray-500 tracking-tighter">{label}</span>
  </button>
);

const NavButton: React.FC<{ active: boolean; label: string; icon: React.ReactNode; onClick: () => void }> = ({ active, label, icon, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 py-2 px-2 transition-all duration-300 relative ${active ? 'text-blue-600 scale-110' : 'text-gray-400 hover:text-gray-500'}`}>
    {active && <div className="absolute inset-0 bg-blue-50 dark:bg-blue-900/20 rounded-2xl -z-10 animate-in zoom-in duration-300 mx-2 my-1.5" />}
    <svg className={`w-6 h-6 mb-0.5 transition-all ${active ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
    <span className={`text-[10px] transition-all ${active ? 'font-black tracking-tight' : 'font-semibold'}`}>{label}</span>
  </button>
);
