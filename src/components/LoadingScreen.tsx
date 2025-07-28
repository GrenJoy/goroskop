import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Moon, Star } from 'lucide-react';

interface LoadingScreenProps {
  userName: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ userName }) => {
  return (
    <motion.div 
      className="w-full max-w-md mx-auto text-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div className="relative">
        {/* Animated cosmic circle */}
        <motion.div className="w-32 h-32 mx-auto mb-8 relative">
          <motion.div 
            className="absolute inset-0 rounded-full border-4 border-purple-500/30"
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div 
            className="absolute inset-2 rounded-full border-4 border-pink-500/40"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="absolute inset-4 rounded-full border-4 border-blue-500/50"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          
          {/* Center icon */}
          <motion.div className="absolute inset-0 flex items-center justify-center">
            <motion.div 
              className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center"
              animate={{ rotate: [0, 180, 360] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Sparkles className="w-6 h-6 text-white" />
              </motion.div>
            </motion.div>
          </motion.div>
          
          {/* Floating icons */}
          <motion.div
            className="absolute -top-2 -right-2"
            animate={{ y: [0, -10, 0], rotate: [0, 15, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Moon className="w-6 h-6 text-yellow-300" />
          </motion.div>
          <motion.div
            className="absolute -bottom-2 -left-2"
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Star className="w-5 h-5 text-blue-300" />
          </motion.div>
          <motion.div
            className="absolute top-1/2 -left-4"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Star className="w-4 h-4 text-purple-300" />
          </motion.div>
        </motion.div>

        {/* Loading text */}
        <motion.div className="space-y-4">
          <motion.h2 
            className="text-2xl font-bold text-white"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {userName}, звезды работают для вас...
          </motion.h2>
          
          <div className="space-y-2 text-purple-200">
            <motion.p 
              className="opacity-75"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              🌟 Анализируем космические энергии
            </motion.p>
            <motion.p 
              className="opacity-75"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            >
              🔮 Читаем послания звезд
            </motion.p>
            <motion.p 
              className="opacity-75"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
            >
              ✨ Создаем ваш уникальный гороскоп
            </motion.p>
          </div>

          {/* Progress indicator */}
          <motion.div className="mt-6">
            <div className="w-full bg-purple-900/30 rounded-full h-2 overflow-hidden">
              <motion.div 
                className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LoadingScreen;