import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Sparkles, RefreshCw, Star, Moon, Sun, Heart, MessageSquare } from 'lucide-react';
import { Horoscope } from '../types';

interface HoroscopeCardProps {
  horoscope: Horoscope;
  userName: string;
  onNewReading: () => void;
  onStartChat: () => void; // New prop to start the chat
}

const HoroscopeCard: React.FC<HoroscopeCardProps> = ({ horoscope, userName, onNewReading, onStartChat }) => {
  const sections = [
    {
      title: 'Космическое приветствие',
      content: horoscope.introduction,
      icon: <Star className="w-5 h-5" />,
      gradient: 'from-purple-500 to-blue-500'
    },
    {
      title: 'Взгляд в будущее',
      content: horoscope.futureOutlook,
      icon: <Sun className="w-5 h-5" />,
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Потенциальные вызовы',
      content: horoscope.challenges,
      icon: <Moon className="w-5 h-5" />,
      gradient: 'from-orange-500 to-red-500'
    },
    {
      title: 'Космические советы',
      content: horoscope.advice,
      icon: <Heart className="w-5 h-5" />,
      gradient: 'from-pink-500 to-purple-500'
    },
    {
      title: 'Счастливые элементы',
      content: horoscope.luckyElements,
      icon: <Sparkles className="w-5 h-5" />,
      gradient: 'from-yellow-500 to-orange-500'
    }
  ];

  return (
    <motion.div 
      className="w-full max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* Header */}
      <motion.div 
        className="text-center mb-8"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <motion.div 
          className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4"
          whileHover={{ scale: 1.1, rotate: 360 }}
          transition={{ duration: 0.6 }}
        >
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </motion.div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Гороскоп для {userName}
        </h1>
        <p className="text-purple-200 text-lg">
          Персональные предсказания от звезд
        </p>
      </motion.div>

      {/* Horoscope Sections */}
      <div className="grid gap-6 mb-8">
        {sections.map((section, index) => (
          <motion.div
            key={section.title}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-purple-500/20 hover:bg-white/15 transition-all duration-300"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.1 + 0.4 }}
            whileHover={{ scale: 1.02, y: -5 }}
          >
            <div className="flex items-center mb-4">
              <motion.div 
                className={`w-10 h-10 bg-gradient-to-r ${section.gradient} rounded-full flex items-center justify-center mr-3`}
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
              >
                {section.icon}
              </motion.div>
              <h2 className="text-xl font-bold text-white">{section.title}</h2>
            </div>
            <div className="text-purple-100 leading-relaxed text-lg prose prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="text-purple-200">{children}</em>,
                  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 ml-4">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 ml-4">{children}</ol>,
                }}
              >
                {section.content}
              </ReactMarkdown>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Action Buttons */}
      <motion.div 
        className="text-center flex flex-col sm:flex-row items-center justify-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <motion.button
          onClick={onNewReading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-2xl hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-4 focus:ring-purple-500/50 transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          Новое предсказание
        </motion.button>
        <motion.button
          onClick={onStartChat}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="inline-flex items-center px-8 py-4 bg-white/10 border border-purple-400 text-white font-semibold rounded-2xl hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-purple-500/50 transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
          <MessageSquare className="w-5 h-5 mr-2" />
          Продолжить общение
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default HoroscopeCard;