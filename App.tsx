
import React, { useState, useEffect } from 'react';
import { SplashScreen } from './screens/SplashScreen';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ChatScreen } from './screens/ChatScreen';
import { GroupChatScreen } from './screens/GroupChatScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AdminDashboard } from './screens/AdminDashboard';
import { BotSettingsScreen } from './screens/BotSettingsScreen';
import { BotAiConfigScreen } from './screens/BotAiConfigScreen';
import { BotVideoConfigScreen } from './screens/BotVideoConfigScreen';
import { BotCallRateConfigScreen } from './screens/BotCallRateConfigScreen';
import { CallScreen } from './screens/CallScreen';
import { User, View } from './types';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const MASTER_ADMIN_PHONE = "01700000000"; 

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<View>('chats');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeBotPhone, setActiveBotPhone] = useState<string | null>(null);
  const [callData, setCallData] = useState<{ bot: User; chatId: string; callType: 'audio' | 'video' } | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isAdminRoute, setIsAdminRoute] = useState(window.location.hash === '#admin');

  useEffect(() => {
    const handleHashChange = () => {
      const isA = window.location.hash === '#admin';
      setIsAdminRoute(isA);
      if (isA) setActiveView('admin');
    };
    window.addEventListener('hashchange', handleHashChange);
    
    const savedUserStr = localStorage.getItem('imo_user');
    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr) as User;
        setCurrentUser(savedUser);
      } catch (e) {
        localStorage.removeItem('imo_user');
      }
    }
    setTimeout(() => setLoading(false), 1200);
    
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!currentUser?.phone) return;

    const unsub = onSnapshot(doc(db, 'users', currentUser.phone), (docSnap) => {
      if (docSnap.exists()) {
        const freshData = docSnap.data() as User;
        if (JSON.stringify(freshData) !== JSON.stringify(currentUser)) {
          setCurrentUser(freshData);
          localStorage.setItem('imo_user', JSON.stringify(freshData));
        }
      }
    });

    return () => unsub();
  }, [currentUser?.phone]);

  if (loading) return <SplashScreen />;
  if (!currentUser) return <LoginScreen onLogin={(user) => {
    setCurrentUser(user);
    localStorage.setItem('imo_user', JSON.stringify(user));
  }} />;

  if (activeView === 'active-call' && callData) {
    return (
      <CallScreen 
        bot={callData.bot} 
        chatId={callData.chatId} 
        currentUser={currentUser}
        callType={callData.callType}
        onEnd={() => {
          setActiveView('chats');
          setCallData(null);
        }} 
      />
    );
  }

  if (isAdminRoute && currentUser.phone === MASTER_ADMIN_PHONE) {
    if (activeView === 'bot-settings' && activeBotPhone) {
      return (
        <BotSettingsScreen 
          botPhone={activeBotPhone}
          onBack={() => setActiveView('admin')}
          onOpenAiConfig={() => setActiveView('bot-ai-config')}
          onOpenVideoConfig={() => setActiveView('bot-video-config')}
          onOpenCallRateConfig={() => setActiveView('bot-call-rate-config')}
        />
      );
    }
    if (activeView === 'bot-ai-config' && activeBotPhone) {
      return (
        <BotAiConfigScreen 
          botPhone={activeBotPhone}
          onBack={() => setActiveView('bot-settings')}
        />
      );
    }
    if (activeView === 'bot-video-config' && activeBotPhone) {
      return (
        <BotVideoConfigScreen 
          botPhone={activeBotPhone}
          onBack={() => setActiveView('bot-settings')}
        />
      );
    }
    if (activeView === 'bot-call-rate-config' && activeBotPhone) {
      return (
        <BotCallRateConfigScreen 
          botPhone={activeBotPhone}
          onBack={() => setActiveView('bot-settings')}
        />
      );
    }
    return <AdminDashboard 
      onBack={() => { window.location.hash = ''; setActiveView('chats'); }} 
      onOpenBotSettings={(phone) => {
        setActiveBotPhone(phone);
        setActiveView('bot-settings');
      }}
    />;
  }

  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden ${darkMode ? 'dark' : ''} bg-gray-50 dark:bg-gray-950`}>
      {activeChatId ? (
        <ChatScreen 
          chatId={activeChatId} 
          currentUser={currentUser} 
          onBack={() => setActiveChatId(null)} 
          onStartCall={(bot, callType) => {
            setCallData({ bot, chatId: activeChatId, callType });
            setActiveView('active-call');
          }}
          onNavigateToView={(view) => {
            setActiveChatId(null);
            setActiveView(view);
          }}
        />
      ) : activeGroupId ? (
        <GroupChatScreen
          groupId={activeGroupId}
          currentUser={currentUser}
          onBack={() => setActiveGroupId(null)}
        />
      ) : activeView === 'profile' ? (
        <ProfileScreen 
          user={currentUser} 
          onLogout={() => {
            localStorage.removeItem('imo_user');
            setCurrentUser(null);
          }} 
          onBack={() => setActiveView('chats')}
          onOpenAdmin={() => {}} 
          darkMode={darkMode}
          toggleDarkMode={() => setDarkMode(!darkMode)}
        />
      ) : (
        <HomeScreen 
          currentUser={currentUser} 
          activeView={activeView} 
          setActiveView={setActiveView} 
          onSelectChat={setActiveChatId} 
          onSelectGroup={setActiveGroupId}
        />
      )}
    </div>
  );
};

export default App;
