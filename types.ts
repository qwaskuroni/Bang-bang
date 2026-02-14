
import { Timestamp } from 'firebase/firestore';

export interface User {
  phone: string;
  name: string;
  profileImage?: string;
  status?: string;
  online: boolean;
  lastSeen: Timestamp;
  createdAt: Timestamp;
  balance?: number;
  role?: 'admin' | 'user';
  isBot?: boolean;
  isBlocked?: boolean;
  isAiEnabled?: boolean;
  openaiKey?: string;
  aiTrainingPrompt?: string;
  gptVersion?: string;
  botVideoUrl?: string;
  botCallDuration?: number;
  botMaxCallsPerUser?: number;
  botCallPrice?: number;
  botVideoCallPrice?: number;
  botAudioCallPrice?: number;
  lastClaimDate?: string;
  welcomeMessage?: string; // Added welcome message for bots
}

export interface Group {
  id: string;
  name: string;
  logo: string;
  type: 'public' | 'private';
  createdBy: string;
  admins: string[];
  members: string[];
  lastMessage: string;
  lastMessageTime: Timestamp;
  createdAt: Timestamp;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  type: 'deposit' | 'withdraw' | 'mission';
  gateway: 'bkash' | 'nagad' | 'rocket' | 'system';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  transactionId?: string;
  targetNumber?: string;
  timestamp: Timestamp;
}

export interface WalletSettings {
  bkashNumber: string;
  nagadNumber: string;
  rocketNumber: string;
  minDeposit: number;
  minWithdraw: number;
  dailyReward?: number;
  groupsEnabled?: boolean;
}

export interface Message {
  id?: string;
  chatId: string;
  senderPhone: string;
  senderName?: string;
  senderImage?: string;
  text: string;
  type: 'text' | 'image' | 'voice';
  timestamp: Timestamp;
  seen: boolean;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: Timestamp;
  unreadCount?: number;
  otherUser?: User;
  callCount?: number;
}

export interface AutoReply {
  id: string;
  keyword: string;
  response: string;
}

export type View = 'chats' | 'calls' | 'contacts' | 'groups' | 'create-group' | 'profile' | 'admin' | 'bot-settings' | 'bot-ai-config' | 'bot-video-config' | 'bot-call-rate-config' | 'bot-welcome-config' | 'bot-auto-reply-config' | 'active-call' | 'wallet-deposit' | 'wallet-withdraw' | 'wallet-history' | 'group-chat' | 'group-profile';
