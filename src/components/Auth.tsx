import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (token: string) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const apiRequest = async (endpoint: 'login' | 'register') => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:3001/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${endpoint}`);
      }
      if (data.token) {
        onAuthSuccess(data.token);
      } else {
        throw new Error('No token received');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="w-full max-w-md mx-auto"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-purple-500/20">
        <h1 className="text-3xl font-bold text-white text-center mb-2">Космический Вход</h1>
        <p className="text-purple-200 text-center mb-8">
          Сохраняйте свои гороскопы и чаты
        </p>
        
        <div className="space-y-6">
          <div>
            <label className="flex items-center text-white text-sm font-medium mb-2">
              <User className="w-4 h-4 mr-2" /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <label className="flex items-center text-white text-sm font-medium mb-2">
              <Lock className="w-4 h-4 mr-2" /> Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <div className="flex flex-col gap-4 pt-4">
            <motion.button
              onClick={() => apiRequest('login')}
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </motion.button>
            <motion.button
              onClick={() => apiRequest('register')}
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-white/10 border border-purple-400 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Auth;
