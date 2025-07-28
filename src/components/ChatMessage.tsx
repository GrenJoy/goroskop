import React from 'react';
import { motion } from 'framer-motion';
import { MessageSender } from '../types';
import { User, Sparkles } from 'lucide-react';

interface ChatMessageProps {
  text: string;
  sender: MessageSender;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ text, sender }) => {
  const isUser = sender === 'user';

  return (
    <motion.div
      className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
      )}
      <div
        className={`max-w-md rounded-2xl px-4 py-3 text-white ${
          isUser
            ? 'bg-purple-600 rounded-br-none'
            : 'bg-white/10 border border-purple-500/20 rounded-bl-none'
        }`}
      >
        <p className="text-base">{text}</p>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
      )}
    </motion.div>
  );
};

export default ChatMessage;
