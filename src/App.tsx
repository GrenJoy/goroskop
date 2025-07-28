import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HoroscopeForm from './components/HoroscopeForm';
import LoadingScreen from './components/LoadingScreen';
import HoroscopeCard from './components/HoroscopeCard';
import StarField from './components/StarField';
import ChatWindow from './components/ChatWindow';
import Auth from './components/Auth';
import { UserData, Horoscope, ChatMessage } from './types';

type AppState = 'form' | 'loading' | 'result';

function App() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [state, setState] = useState<AppState>('form');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [currentHoroscope, setCurrentHoroscope] = useState<Horoscope | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const handleAuthSuccess = (token: string) => {
    setAuthToken(token);
    // In a real app, you might save the token to localStorage to persist login
  };

  const handleFormSubmit = async (data: UserData) => {
    if (!authToken) return;

    setUserData(data);
    setIsLoading(true);
    setState('loading');
    try {
      const response = await fetch('http://localhost:3001/horoscope', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate horoscope');
      }

      const generatedHoroscope = await response.json();
      setCurrentHoroscope(generatedHoroscope);
      setState('result');
    } catch (error: any) {
      console.error('Error generating horoscope:', error);
      alert(error.message);
      setState('form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewReading = () => {
    setState('form');
    setCurrentHoroscope(null);
    setUserData(null);
  };

  const renderContent = () => {
    if (!authToken) {
      return (
        <motion.div key="auth" className="w-full">
          <Auth onAuthSuccess={handleAuthSuccess} />
        </motion.div>
      );
    }

    switch (state) {
      case 'form':
        return (
          <motion.div key="form" className="w-full">
            <HoroscopeForm onSubmit={handleFormSubmit} isLoading={isLoading} />
          </motion.div>
        );
      case 'loading':
        return userData && (
          <motion.div key="loading">
            <LoadingScreen userName={userData.name} />
          </motion.div>
        );
      case 'result':
        return currentHoroscope && userData && (
          <motion.div key="result" className="w-full">
            <HoroscopeCard
              horoscope={currentHoroscope}
              userName={userData.name}
              onNewReading={handleNewReading}
              onStartChat={() => alert('Chat will be connected to the backend next!')}
            />
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden"
    >
      <StarField />
      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </div>
      {/* History and Chat components would be rendered here, connected to the backend */}
    </motion.div>
  );
}

export default App;