
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
  isAiEnabled?: boolean;
  openaiKey?: string;
  aiTrainingPrompt?: string;
  gptVersion?: string;
  botVideoUrl?: string;
  botCallDuration?: number;
  botMaxCallsPerUser?: number;
  botCallPrice?: number; // Legacy, keep for backward compatibility
  botVideoCallPrice?: number; // New: Price per minute for video calls
  botAudioCallPrice?: number; // New: Price per minute for audio calls
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  type: 'deposit' | 'withdraw';
  gateway: 'bkash' | 'nagad' | 'rocket';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  transactionId?: string; // For deposit
  targetNumber?: string; // For withdraw
  timestamp: Timestamp;
}

export interface WalletSettings {
  bkashNumber: string;
  nagadNumber: string;
  rocketNumber: string;
  minDeposit: number;
  minWithdraw: number;
}

export interface Message {
  id?: string;
  chatId: string;
  senderPhone: string;
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

export type View = 'chats' | 'calls' | 'contacts' | 'profile' | 'admin' | 'bot-settings' | 'bot-ai-config' | 'bot-video-config' | 'bot-call-rate-config' | 'active-call' | 'wallet-deposit' | 'wallet-withdraw' | 'wallet-history';
