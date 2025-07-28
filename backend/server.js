const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURATION ---
const DEEPSEEK_API_KEY = 'sk-9f1ba9f795104fbbb13cb33d20ddc70b';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MAX_RETRIES = 2;

// --- MIDDLEWARE ---
app.use(cors()); 
app.use(express.json());

app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.path}`);
  next();
});

// --- DATABASE SETUP ---
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) return console.error('Error opening database', err.message);
  
  console.log('Connected to the SQLite database.');
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      telegram_id TEXT
    )`);
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
    )`);
  });
});

// --- AUTH & WEB ROUTES (UNCHANGED) ---
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

// --- TELEGRAM BOT ---
const TelegramBot = require('node-telegram-bot-api');

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  
  const TELEGRAM_TOKEN = '7996945974:AAGQ92e_qrZiZ8VWhKZZDHhQoAnDGfvxips';
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

  bot.on('polling_error', (error) => console.error(`Telegram Polling Error: ${error.code} - ${error.message}`));

  // --- BOT COMMANDS ---
  bot.onText(/.start/, (msg) => {
    bot.sendMessage(msg.chat.id, `Добро пожаловать в Космический Гороскоп! աստղագուշակ\n\nЧтобы привязать ваш аккаунт с сайта, используйте команду:\n/connect ваш_email@example.com\n\nЧтобы создать новый гороскоп, используйте команду /horoscope`);
  });

  bot.onText(/.connect (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const email = match[1];
    if (!email) return bot.sendMessage(chatId, 'Пожалуйста, укажите ваш email после команды. Например: /connect user@example.com');
    
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
      if (err || !user) return bot.sendMessage(chatId, 'Аккаунт с таким email не найден. Пожалуйста, сначала зарегистрируйтесь на сайте.');
      
      db.run('UPDATE users SET telegram_id = ? WHERE email = ?', [chatId, email], (err) => {
        if (err) return bot.sendMessage(chatId, 'Не удалось привязать аккаунт. Попробуйте позже.');
        bot.sendMessage(chatId, 'Ваш Telegram успешно привязан к аккаунту! Теперь вы можете использовать все функции бота.');
      });
    });
  });

  const userConversations = {};

  bot.onText(/.horoscope/, (msg) => {
    const chatId = msg.chat.id;
    db.get('SELECT * FROM users WHERE telegram_id = ?', [chatId], (err, user) => {
      if (err || !user) return bot.sendMessage(chatId, 'Пожалуйста, сначала привяжите ваш аккаунт с помощью команды /connect [ваш_email]');
      userConversations[chatId] = { step: 1, answers: { userId: user.id } };
      bot.sendMessage(chatId, 'Начинаем создание гороскопа! ✨\n\nКак вас зовут?');
    });
  });

  // --- CONVERSATION HANDLER ---
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text.startsWith('/')) return;
    const conversation = userConversations[chatId];
    if (!conversation) return;

    try {
      switch (conversation.step) {
        case 1:
          conversation.answers.name = text;
          conversation.step = 2;
          bot.sendMessage(chatId, `Приятно познакомиться, ${text}!\n\nТеперь введите вашу дату рождения (например, 01.01.1990).`);
          break;
        case 2:
          if (!/^\d{2}\.\d{2}\.\d{4}$/.test(text)) return bot.sendMessage(chatId, 'Пожалуйста, введите дату в формате ДД.ММ.ГГГГ.');
          conversation.answers.birthDate = text;
          conversation.step = 3;
          bot.sendMessage(chatId, `Отлично. Перечислите через запятую несколько ваших черт характера (например: добрый, амбициозный).`);
          break;
        case 3:
          conversation.answers.traits = text.split(',').map(t => t.trim());
          conversation.step = 4;
          bot.sendMessage(chatId, 'И последнее: расскажите немного о себе. Что вас сейчас волнует, к чему вы стремитесь?');
          break;
        case 4:
          conversation.answers.about = text;
          bot.sendMessage(chatId, 'Благодарю. Звезды уже выстраиваются в ряд... Я тку для вас предсказание. Это может занять до минуты... ✨');
          await generateAndSaveHoroscope(conversation.answers, chatId);
          delete userConversations[chatId];
          break;
      }
    } catch (error) {
        console.error('Conversation processing error:', error);
        bot.sendMessage(chatId, 'Произошла внутренняя ошибка. Попробуйте начать заново с команды /horoscope');
        delete userConversations[chatId];
    }
  });

  // --- HOROSCOPE GENERATION WITH ROBUST ERROR HANDLING ---
  async function generateAndSaveHoroscope(userData, chatId) {
    const { userId, name, birthDate, traits, about } = userData;
    const prompt = `
    Ты — Лира, Звёздная Ткачиха... [PROMPT CONTENT IS THE SAME AS BEFORE, OMITTED FOR BREVITY]
    КРИТИЧЕСКИ ВАЖНО: Твой ответ должен быть исключительно и только полным JSON-объектом...
    `;

    let horoscopeData;
    for (let i = 0; i <= MAX_RETRIES; i++) {
      try {
        console.log(`Attempt ${i + 1} to generate horoscope for ${name}...`);
        const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.75,
            max_tokens: 4096
          }),
        });

        const responseText = await deepseekResponse.text();

        if (!deepseekResponse.ok) {
          throw new Error(`API request failed with status ${deepseekResponse.status}: ${responseText}`);
        }

        if (!responseText.trim().startsWith('{')) {
          throw new Error(`API returned non-JSON response (likely an HTML error page or invalid key message). Response: ${responseText}`);
        }

        const data = JSON.parse(responseText);
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('API response is missing expected content structure.');

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON object found in AI-generated content');

        const parsedJson = JSON.parse(jsonMatch[0]);
        const requiredKeys = ["introduction", "futureOutlook", "challenges", "advice", "luckyElements"];
        const missingKeys = requiredKeys.filter(key => !parsedJson[key] || String(parsedJson[key]).trim() === '');
        
        if (missingKeys.length > 0) {
          throw new Error(`Validation failed. Missing or empty keys: ${missingKeys.join(', ')}`);
        }

        horoscopeData = parsedJson;
        console.log(`Successfully generated horoscope for ${name} on attempt ${i + 1}.`);
        break;

      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error.message);
        if (i === MAX_RETRIES) {
          bot.sendMessage(chatId, 'Не удалось создать гороскоп. Звезды сегодня не в настроении. Пожалуйста, попробуйте позже.');
          return;
        }
      }
    }

    if (!horoscopeData) return;

    // --- Format and Save ---
    let luckyElementsText = horoscopeData.luckyElements;
    if (typeof luckyElementsText === 'object' && luckyElementsText !== null) {
      luckyElementsText = Object.entries(luckyElementsText)
        .map(([key, value]) => `- ${key.charAt(0).toUpperCase() + key.slice(1)}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('\n');
    } else {
      luckyElementsText = String(luckyElementsText);
    }

    const elementsToSave = typeof horoscopeData.luckyElements === 'object' ? JSON.stringify(horoscopeData.luckyElements) : horoscopeData.luckyElements;

    const insertSql = `INSERT INTO horoscopes (user_id, introduction, futureOutlook, challenges, advice, luckyElements) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(insertSql, [userId, horoscopeData.introduction, horoscopeData.futureOutlook, horoscopeData.challenges, horoscopeData.advice, elementsToSave], (err) => {
      if (err) {
        console.error("DB insert error:", err.message);
        return bot.sendMessage(chatId, 'Произошла ошибка при сохранении вашего гороскопа.');
      }
      
      const horoscopeMessage = `\n*${horoscopeData.introduction}*\n\n🔮 *Прогноз на будущее:*\n${horoscopeData.futureOutlook}\n\n⚔️ *Испытания и возможности:*\n${horoscopeData.challenges}\n\n💡 *Советы звезд:*\n${horoscopeData.advice}\n\n🍀 *Счастливые элементы:*\n${luckyElementsText}\n      `;
      bot.sendMessage(chatId, horoscopeMessage, { parse_mode: 'Markdown' });
    });
  }

  console.log('Telegram bot has been started...');
});
