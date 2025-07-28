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
// Temporarily allow all origins for debugging CORS issues.
// WARNING: This is insecure for production.
app.use(cors()); 
app.use(express.json());

// Simple request logger middleware
app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.path}`);
  next();
});

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
  const prompt = `
    Ты — мистический и мудрый астролог. Твоя задача — создать персонализированный гороскоп на основе данных пользователя.
    Имя пользователя: ${name}.
    Дата рождения: ${birthDate}.
    Черты характера, которые пользователь выбрал: ${traits.join(', ')}.
    Вот что пользователь рассказал о себе: "${about}".

    Основываясь на этой информации, предоставь подробный и проницательный гороскоп. Твой ответ должен быть ОБЯЗАТЕЛЬНО в формате JSON-объекта со следующими ключами:
    - "introduction": Тёплое, космическое приветствие для ${name}. (Пример: "Звёзды приветствуют тебя, ${name}! Космос приоткрывает свои тайны...")
    - "futureOutlook": Подробные предсказания на ближайшее будущее (следующие 7 дней). Расскажи о возможных событиях в карьере, личной жизни и саморазвитии. (Минимум 50 слов)
    - "challenges": Потенциальные вызовы, с которыми пользователь может столкнуться, и развернутые советы, как их преодолеть. (Минимум 50 слов)
    - "advice": Конкретные, действенные и подробные советы для личностного роста и гармонии. (Минимум 50 слов)
    - "luckyElements": Опиши счастливые числа, цвета, камни или даже дни недели для пользователя на этот период. (Пример: "Твои счастливые числа на этой неделе - 7 и 13. Цвет удачи - индиго.")

    Твой тон должен быть ободряющим, таинственным и глубоким. Ответ ДОЛЖЕН быть строго в формате JSON и ничего более. Не добавляй никаких пояснений до или после JSON.
    `;

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

// --- SERVER LISTENING ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  
  // --- TELEGRAM BOT INITIALIZATION ---
  // We start the bot ONLY after the web server is successfully running.
  const TELEGRAM_TOKEN = '7996945974:AAGQ92e_qrZiZ8VWhKZZDHhQoAnDGfvxips';
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

  bot.on('polling_error', (error) => {
    console.error(`Telegram Polling Error: ${error.code} - ${error.message}`);
  });

  bot.onText(/.start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      `Добро пожаловать в Космический Гороскоп! աստղագուշակ\n\n` +
      `Чтобы привязать ваш аккаунт с сайта, используйте команду:\n` +
      `/connect ваш_email@example.com\n\n` +
      `Чтобы создать новый гороскоп, используйте команду /horoscope`
    );
  });

  bot.onText(/.connect (.+)/, (msg, match) => {
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

  const userConversations = {};

  bot.onText(/.horoscope/, (msg) => {
    const chatId = msg.chat.id;
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

    if (!text || text.startsWith('/')) return;

    const conversation = userConversations[chatId];
    if (!conversation) return;

    // ... (rest of the conversation logic)
  });

  async function generateAndSaveHoroscope(userData, chatId) {
    // ... (rest of the generation logic)
  }

  console.log('Telegram bot has been started...');
});
