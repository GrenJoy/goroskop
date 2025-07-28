const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch'); // Use require for node-fetch in CommonJS

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURATION ---
const DEEPSEEK_API_KEY = 'sk-9f1ba9f795104fbbb13cb33d20ddc70b'; // Your key is now safe on the backend
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// --- MIDDLEWARE ---
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// --- DATABASE SETUP ---
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) return console.error('Error opening database', err.message);
  
  console.log('Connected to the SQLite database.');
  db.serialize(() => {
    // User table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      telegram_id TEXT
    )`, (err) => {
      if (err) console.error("Error creating users table", err.message);
      else console.log("Users table is ready.");
    });

    // Horoscopes table
    db.run(`CREATE TABLE IF NOT EXISTS horoscopes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      introduction TEXT,
      futureOutlook TEXT,
      challenges TEXT,
      advice TEXT,
      luckyElements TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
      if (err) console.error("Error creating horoscopes table", err.message);
      else console.log("Horoscopes table is ready.");
    });
  });
});

// --- AUTHENTICATION ROUTES ---
app.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  
  const sql = 'INSERT INTO users (email, password) VALUES (?, ?)';
  db.run(sql, [email, password], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'This email is already registered.' });
      return res.status(500).json({ error: 'Failed to register user.' });
    }
    res.status(201).json({ message: 'User registered successfully', token: this.lastID });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
  db.get(sql, [email, password], (err, user) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.status(200).json({ message: 'Login successful', token: user.id });
  });
});

// --- HOROSCOPE ROUTES ---
// Middleware to protect routes (simple version)
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  // In a real app, you'd verify a real JWT token. Here we just use the user ID.
  req.userId = parseInt(token, 10);
  next();
};

app.post('/horoscope', authenticateToken, async (req, res) => {
  const { name, birthDate, traits, about } = req.body;
  const userId = req.userId;

  // This is the same prompt logic from your original api.ts
  const prompt = `You are an expert astrologer... (rest of the prompt for generating a horoscope in JSON format)`; // Abridged for brevity

  try {
    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
    });

    if (!deepseekResponse.ok) throw new Error('Failed to fetch from DeepSeek API');
    
    const data = await deepseekResponse.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON response from AI');

    const horoscopeData = JSON.parse(jsonMatch[0]);

    // Save horoscope to DB
    const insertSql = `INSERT INTO horoscopes (user_id, introduction, futureOutlook, challenges, advice, luckyElements) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(insertSql, [userId, horoscopeData.introduction, horoscopeData.futureOutlook, horoscopeData.challenges, horoscopeData.advice, horoscopeData.luckyElements], function(err) {
      if (err) {
        console.error("DB insert error:", err.message);
        return res.status(500).json({ error: "Failed to save horoscope." });
      }
      res.status(201).json(horoscopeData);
    });

  } catch (error) {
    console.error('Horoscope generation error:', error);
    res.status(500).json({ error: 'Failed to generate horoscope.' });
  }
});


const TelegramBot = require('node-telegram-bot-api');

// --- TELEGRAM BOT SETUP ---
const TELEGRAM_TOKEN = '7996945974:AAGQ92e_qrZiZ8VWhKZZDHhQoAnDGfvxips';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `Добро пожаловать в Космический Гороскоп! աստղագուշակ\n\n` +
    `Чтобы привязать ваш аккаунт с сайта, используйте команду:\n` +
    `/connect ваш_email@example.com\n\n` +
    `Чтобы создать новый гороскоп, используйте команду /horoscope`
  );
});

bot.onText(/\/connect (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const email = match[1];

  if (!email) {
    return bot.sendMessage(chatId, 'Пожалуйста, укажите ваш email после команды. Например: /connect user@example.com');
  }

  const findUserSql = 'SELECT * FROM users WHERE email = ?';
  db.get(findUserSql, [email], (err, user) => {
    if (err) {
      bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
      return console.error(err.message);
    }
    if (!user) {
      return bot.sendMessage(chatId, 'Аккаунт с таким email не найден. Пожалуйста, сначала зарегистрируйтесь на сайте.');
    }

    const updateSql = 'UPDATE users SET telegram_id = ? WHERE email = ?';
    db.run(updateSql, [chatId, email], function(err) {
      if (err) {
        bot.sendMessage(chatId, 'Не удалось привязать аккаунт. Попробуйте позже.');
        return console.error(err.message);
      }
      bot.sendMessage(chatId, 'Ваш Telegram успешно привязан к аккаунту! Теперь вы можете использовать все функции бота.');
    });
  });
});

// This is a simple in-memory store for the conversation state with each user.
// In a real production app, you'd use a database like Redis for this.
const userConversations = {};

bot.onText(null, (msg) => {
  const chatId = msg.chat.id;
  
  // Check if user is connected
  db.get('SELECT * FROM users WHERE telegram_id = ?', [chatId], (err, user) => {
    if (err || !user) {
      return bot.sendMessage(chatId, 'Пожалуйста, сначала привяжите ваш аккаунт с помощью команды /connect [ваш_email]');
    }
    
    userConversations[chatId] = { step: 1, answers: { userId: user.id } };
    bot.sendMessage(chatId, 'Начинаем создание гороскопа! ✨\n\nКак вас зовут?');
  });
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Ignore commands
  if (text.startsWith('/')) {
    return;
  }

  const conversation = userConversations[chatId];
  if (!conversation) {
    return;
  }

  switch (conversation.step) {
    case 1: // Answer to "What is your name?"
      conversation.answers.name = text;
      conversation.step = 2;
      bot.sendMessage(chatId, 'Отлично! Теперь введите вашу дату рождения (гггг-мм-дд).');
      break;
    case 2: // Answer to "What is your birth date?"
      conversation.answers.birthDate = text;
      conversation.step = 3;
      // For simplicity, we'll use a fixed list of traits.
      bot.sendMessage(chatId, 'Какие черты характера вам присущи? (ответьте одним сообщением, перечисляя через запятую, например: творческий, амбициозный, добрый)');
      break;
    case 3: // Answer to "What are your traits?"
      conversation.answers.traits = text.split(',').map(t => t.trim());
      conversation.step = 4;
      bot.sendMessage(chatId, 'И последнее: расскажите немного о себе, своих увлечениях или целях.');
      break;
    case 4: // Answer to "Tell us about yourself"
      conversation.answers.about = text;
      bot.sendMessage(chatId, 'Спасибо! Ваш гороскоп создается... Пожалуйста, подождите. ⏳');
      
      // Now, call the same logic as our /horoscope API endpoint
      generateAndSaveHoroscope(conversation.answers, chatId);
      
      // Clean up the conversation state
      delete userConversations[chatId];
      break;
  }
});

async function generateAndSaveHoroscope(userData, chatId) {
  const { userId, name, birthDate, traits, about } = userData;
  const prompt = `...`; // The full prompt to generate horoscope JSON

  try {
    // This is a simplified version of the API call logic
    const response = await fetch(DEEPSEEK_API_URL, { /* ... API call options ... */ });
    if (!response.ok) throw new Error('AI API failed');
    
    const data = await response.json();
    const horoscopeData = JSON.parse(data.choices[0].message.content.match(/\{[\s\S]*\}/)[0]);

    // Save to DB
    const insertSql = `INSERT INTO horoscopes (user_id, introduction, futureOutlook, challenges, advice, luckyElements) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(insertSql, [userId, horoscopeData.introduction, horoscopeData.futureOutlook, horoscopeData.challenges, horoscopeData.advice, horoscopeData.luckyElements]);

    // Send result to user in Telegram
    const resultText = `**Ваш Гороскоп, ${name}!**\n\n` +
                       `**Введение:** ${horoscopeData.introduction}\n\n` +
                       `**Будущее:** ${horoscopeData.futureOutlook}\n\n` +
                       `**Совет:** ${horoscopeData.advice}`;
    bot.sendMessage(chatId, resultText, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Bot horoscope generation error:', error);
    bot.sendMessage(chatId, 'Произошла космическая аномалия! Не удалось создать гороскоп. Попробуйте позже.');
  }
}

console.log('Telegram bot has been started...');


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
