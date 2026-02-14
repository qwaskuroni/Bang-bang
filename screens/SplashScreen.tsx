
import React from 'react';

export const SplashScreen: React.FC = () => {
  return (
    <div className="h-screen w-full blue-gradient flex flex-items-center justify-center">
      <div className="text-center animate-pulse">
        <div className="w-24 h-24 bg-white rounded-[24px] shadow-2xl flex items-center justify-center mx-auto mb-6 transform rotate-12">
          <svg className="w-14 h-14 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h1 className="text-white text-3xl font-bold tracking-tight">ImoFlow</h1>
        <p className="text-blue-100 mt-2 text-sm">Instant. Real-time. Secure.</p>
      </div>
    </div>
  );
};
