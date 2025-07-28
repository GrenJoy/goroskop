import React from 'react';
import { motion } from 'framer-motion';

const StarField: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Large animated stars */}
      <motion.div 
        className="absolute top-20 left-20 w-2 h-2 bg-yellow-200 rounded-full opacity-80"
        animate={{ 
          scale: [1, 1.5, 1], 
          opacity: [0.8, 1, 0.8],
          rotate: [0, 180, 360]
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.div 
        className="absolute top-40 right-32 w-1 h-1 bg-blue-200 rounded-full opacity-60"
        animate={{ 
          scale: [1, 2, 1], 
          opacity: [0.6, 1, 0.6] 
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div 
        className="absolute top-60 left-1/3 w-1.5 h-1.5 bg-purple-200 rounded-full opacity-70"
        animate={{ 
          scale: [1, 1.3, 1], 
          opacity: [0.7, 1, 0.7],
          y: [0, -10, 0]
        }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div 
        className="absolute bottom-40 right-20 w-2 h-2 bg-pink-200 rounded-full opacity-50"
        animate={{ 
          scale: [1, 1.8, 1], 
          opacity: [0.5, 1, 0.5],
          x: [0, 10, 0]
        }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />
      <motion.div 
        className="absolute bottom-60 left-16 w-1 h-1 bg-indigo-200 rounded-full opacity-80"
        animate={{ 
          scale: [1, 1.4, 1], 
          opacity: [0.8, 1, 0.8] 
        }}
        transition={{ duration: 1.8, repeat: Infinity }}
      />
      <motion.div 
        className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-yellow-300 rounded-full opacity-60"
        animate={{ 
          scale: [1, 2.2, 1], 
          opacity: [0.6, 1, 0.6],
          rotate: [0, -180, -360]
        }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />
      
      {/* Small twinkling stars */}
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-px h-px bg-white rounded-full opacity-30"
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [1, 1.5, 1]
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 3
          }}
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`
          }}
        />
      ))}
    </div>
  );
};

export default StarField;