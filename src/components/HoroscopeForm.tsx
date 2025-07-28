import React, { useState } from 'react';
import { User, Calendar, Heart, FileText, Sparkles, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { UserData } from '../types';
import { personalityTraits } from '../data/traits';
import { calculateZodiacSign } from '../utils/zodiac';

interface HoroscopeFormProps {
  onSubmit: (data: UserData) => void;
  isLoading: boolean;
}

const HoroscopeForm: React.FC<HoroscopeFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState<UserData>({
    name: '',
    birthDate: '',
    traits: [],
    about: ''
  });

  const [errors, setErrors] = useState<Partial<UserData>>({});
  const zodiacSign = calculateZodiacSign(formData.birthDate);

  const validateForm = (): boolean => {
    const newErrors: Partial<UserData> = {};
    
    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Имя обязательно для заполнения';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Имя должно содержать хотя бы 2 буквы';
    }

    // Birth Date validation
    if (!formData.birthDate) {
      newErrors.birthDate = 'Укажите корректную дату рождения' as any;
    } else {
      const birthYear = new Date(formData.birthDate).getFullYear();
      if (birthYear < 1920) {
        newErrors.birthDate = 'Пожалуйста, укажите год не ранее 1920' as any;
      }
      if (birthYear > new Date().getFullYear()) {
        newErrors.birthDate = 'Дата рождения не может быть в будущем' as any;
      }
    }
    
    // Traits validation
    if (formData.traits.length === 0) {
      newErrors.traits = 'Выберите хотя бы одну черту характера' as any;
    }
    
    // About validation
    if (!formData.about.trim()) {
      newErrors.about = 'Пожалуйста, расскажите немного о себе';
    } else if (formData.about.trim().length < 20) {
      newErrors.about = 'Расскажите о себе подробнее (минимум 20 символов)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const toggleTrait = (traitId: string) => {
    setFormData(prev => ({
      ...prev,
      traits: prev.traits.includes(traitId)
        ? prev.traits.filter(id => id !== traitId)
        : [...prev.traits, traitId]
    }));
  };

  return (
    <motion.div 
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <motion.div 
        className="text-center mb-8"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <motion.div 
          className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4"
          whileHover={{ scale: 1.1, rotate: 360 }}
          transition={{ duration: 0.6 }}
        >
          <Sparkles className="w-10 h-10 text-white" />
        </motion.div>
        <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Космический Гороскоп
        </h1>
        <p className="text-purple-200 text-lg">
          Позвольте звездам раскрыть тайны вашего будущего
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <motion.div 
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-purple-500/20"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {/* Name Field */}
          <div className="mb-6">
            <label className="flex items-center text-white text-sm font-medium mb-2">
              <User className="w-4 h-4 mr-2" />
              Ваше имя
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              placeholder="Введите ваше имя"
            />
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Birth Date Field */}
          <div className="mb-6">
            <label className="flex items-center text-white text-sm font-medium mb-2">
              <Calendar className="w-4 h-4 mr-2" />
              Дата рождения
            </label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            />
            {zodiacSign && (
              <motion.div 
                className="mt-2 flex items-center text-purple-200 text-sm"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Star className="w-4 h-4 mr-2 text-yellow-400" />
                Знак зодиака: <span className="font-semibold ml-1">{zodiacSign.nameRu} {zodiacSign.symbol}</span>
              </motion.div>
            )}
            {errors.birthDate && <p className="text-red-400 text-sm mt-1">{errors.birthDate as string}</p>}
          </div>

          {/* Personality Traits */}
          <div className="mb-6">
            <label className="flex items-center text-white text-sm font-medium mb-3">
              <Heart className="w-4 h-4 mr-2" />
              Особенности характера
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {personalityTraits.map((trait) => (
                <motion.button
                  key={trait.id}
                  type="button"
                  onClick={() => toggleTrait(trait.id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-3 rounded-xl border transition-all duration-200 text-sm font-medium ${
                    formData.traits.includes(trait.id)
                      ? 'bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-white/5 border-purple-500/30 text-purple-200 hover:bg-white/10 hover:border-purple-400'
                  }`}
                >
                  <span className="mr-2">{trait.emoji}</span>
                  {trait.label}
                </motion.button>
              ))}
            </div>
            {errors.traits && <p className="text-red-400 text-sm mt-1">{errors.traits as string}</p>}
          </div>

          {/* About Field */}
          <div className="mb-6">
            <label className="flex items-center text-white text-sm font-medium mb-2">
              <FileText className="w-4 h-4 mr-2" />
              О себе
            </label>
            <textarea
              value={formData.about}
              onChange={(e) => setFormData(prev => ({ ...prev, about: e.target.value }))}
              rows={4}
              className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
              placeholder="Расскажите о своих интересах, мечтах, целях..."
            />
            {errors.about && <p className="text-red-400 text-sm mt-1">{errors.about}</p>}
          </div>
        </motion.div>

        <motion.button
          type="submit"
          disabled={isLoading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-2xl hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-4 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
              Звезды создают ваш гороскоп...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <Sparkles className="w-5 h-5 mr-2" />
              Узнать свое будущее
            </div>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
};

export default HoroscopeForm;