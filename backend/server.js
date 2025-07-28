const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURATION ---
const DEEPSEEK_API_KEY = 'sk-a3699ffb8a5146778610815d7ca8537f'; // NEW KEY
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
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, telegram_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS horoscopes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, introduction TEXT, futureOutlook TEXT, challenges TEXT, advice TEXT, luckyElements TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users (id))`);
  });
});

// --- SHARED HOROSCOPE GENERATION LOGIC ---
async function getHoroscopeFromAPI(prompt) {
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      console.log(`Attempt ${i + 1} to call DeepSeek API...`);
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.75,
          max_tokens: 4096
        }),
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${responseText}`);
      }
      if (!responseText.trim().startsWith('{')) {
        throw new Error(`API returned non-JSON response. Body: ${responseText}`);
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
      
      console.log(`Successfully generated horoscope on attempt ${i + 1}.`);
      return parsedJson; // Success

    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      if (i === MAX_RETRIES) {
        throw new Error('Failed to generate horoscope after multiple retries.'); // Final failure
      }
    }
  }
}

// --- PROMPT TEMPLATE ---
function getHoroscopePrompt(name, birthDate, traits, about) {
  return `
  Ты — Лира, Звёздная Ткачиха, древний и мудрый астролог. Твоя задача — соткать глубоко личный и проницательный гороскоп. Твоя речь плавна, загадочна и полна метафор.

  Вот данные для гороскопа:
  - Имя: ${name}
  - Дата рождения: ${birthDate}
  - Черты характера: ${traits.join(', ')}
  - Мысли и стремления: "${about}"

  Твои предсказания и советы должны быть напрямую связаны с мыслями и стремлениями человека.

  КРИТИЧЕСКИ ВАЖНО: Твой ответ должен быть исключительно и только полным JSON-объектом. Всегда, без исключений, заполняй ВСЕ ПЯТЬ ключей: "introduction", "futureOutlook", "challenges", "advice", и "luckyElements". Если ты оставишь хотя бы один ключ пустым, предсказание провалится.

  - "introduction": Напиши мистическое и личное приветствие для ${name}. Объем: 3-4 предложения.
  - "futureOutlook": Нарисуй яркую и подробную картину ближайшего будущего (7 дней), основываясь на стремлениях ${name}. Объем: 4-6 предложений.
  - "challenges": Опиши возможные внутренние или внешние преграды. Дай мудрый совет, как их преодолеть. Объем: 3-5 предложений.
  - "advice": ОБЯЗАТЕЛЬНО К ЗАПОЛНЕНИЮ. Предложи 2-3 глубоких, нетривиальных и детально описанных совета, напрямую связанных с тем, что волнует ${name}. Этот раздел не может быть пустым. Объем: 4-6 предложений.
  - "luckyElements": ОБЯЗАТЕЛЬНО К ЗАПОЛНЕНИЮ. Раскрой тайные знаки удачи на неделю. Укажи как минимум 3-4 разных элемента (например: цвет, число, день недели, минерал, аромат). Этот раздел не может быть пустым.

  Перед тем как дать ответ, мысленно перепроверь: все ли пять ключей заполнены содержательным текстом? Пустых полей быть не должно.
  `;
}

// --- AUTH ROUTES ---
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

// --- WEB HOROSCOPE ROUTE ---
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  req.userId = parseInt(token, 10);
  next();
};

app.post('/horoscope', authenticateToken, async (req, res) => {
  const { name, birthDate, traits, about } = req.body;
  const userId = req.userId;
  const prompt = getHoroscopePrompt(name, birthDate, traits, about);

  try {
    const horoscopeData = await getHoroscopeFromAPI(prompt);
    const elementsToSave = typeof horoscopeData.luckyElements === 'object' ? JSON.stringify(horoscopeData.luckyElements) : horoscopeData.luckyElements;
    const insertSql = `INSERT INTO horoscopes (user_id, introduction, futureOutlook, challenges, advice, luckyElements) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(insertSql, [userId, horoscopeData.introduction, horoscopeData.futureOutlook, horoscopeData.challenges, horoscopeData.advice, elementsToSave], function(err) {
      if (err) {
        console.error("DB insert error:", err.message);
        return res.status(500).json({ error: "Failed to save horoscope." });
      }
      res.status(201).json(horoscopeData);
    });
  } catch (error) {
    console.error('Horoscope generation process failed for web:', error.message);
    res.status(500).json({ error: 'Failed to generate horoscope.' });
  }
});

// --- TELEGRAM BOT ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  const TELEGRAM_TOKEN = '7996945974:AAGQ92e_qrZiZ8VWhKZZDHhQoAnDGfvxips';
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

  bot.on('polling_error', (error) => console.error(`Telegram Polling Error: ${error.code} - ${error.message}`));

  const userConversations = {};

  bot.onText(/\/start|\/connect|\/horoscope/, (msg) => {
    db.get('SELECT * FROM users WHERE telegram_id = ?', [msg.chat.id], (err, user) => {
      if (msg.text.startsWith('/connect')) {
        const email = msg.text.split(' ')[1];
        if (!email) return bot.sendMessage(msg.chat.id, 'Пожалуйста, укажите ваш email после команды. Например: /connect user@example.com');
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
          if (err || !user) return bot.sendMessage(msg.chat.id, 'Аккаунт с таким email не найден.');
          db.run('UPDATE users SET telegram_id = ? WHERE email = ?', [msg.chat.id, email], (err) => {
            if (err) return bot.sendMessage(msg.chat.id, 'Не удалось привязать аккаунт.');
            bot.sendMessage(msg.chat.id, 'Ваш Telegram успешно привязан к аккаунту!');
          });
        });
      } else if (msg.text.startsWith('/horoscope')) {
        if (err || !user) return bot.sendMessage(msg.chat.id, 'Пожалуйста, сначала привяжите ваш аккаунт с помощью команды /connect [ваш_email]');
        userConversations[msg.chat.id] = { step: 1, answers: { userId: user.id } };
        bot.sendMessage(msg.chat.id, 'Начинаем создание гороскопа! ✨\n\nКак вас зовут?');
      } else { // /start
        bot.sendMessage(msg.chat.id, `Добро пожаловать в Космический Гороскоп! \u0430\u0441\u0442\u0440\u0430\u0433\u0443\u0448\u0430\u043a\n\nЧтобы привязать ваш аккаунт с сайта, используйте команду:\n/connect \u0432\u0430\u0448_email@example.com\n\nЧтобы создать новый гороскоп, используйте команду /horoscope`);
      }
    });
  });

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
          bot.sendMessage(chatId, `Отлично. Перечислите через запятую несколько ваших черт характера.`);
          break;
        case 3:
          conversation.answers.traits = text.split(',').map(t => t.trim());
          conversation.step = 4;
          bot.sendMessage(chatId, 'И последнее: расскажите немного о себе. Что вас сейчас волнует, к чему вы стремитесь?');
          break;
        case 4:
          conversation.answers.about = text;
          bot.sendMessage(chatId, 'Благодарю. Звезды уже выстраиваются в ряд... Это может занять до минуты... ✨');
          const prompt = getHoroscopePrompt(conversation.answers.name, conversation.answers.birthDate, conversation.answers.traits, conversation.answers.about);
          const horoscopeData = await getHoroscopeFromAPI(prompt);
          
          let luckyElementsText = horoscopeData.luckyElements;
          if (typeof luckyElementsText === 'object' && luckyElementsText !== null) {
            luckyElementsText = Object.entries(luckyElementsText).map(([k, v]) => `- ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`).join('\n');
          }
          
          const horoscopeMessage = `*${horoscopeData.introduction}*\n\n🔮 *Прогноз на будущее:*\n${horoscopeData.futureOutlook}\n\n⚔️ *Испытания и возможности:*\n${horoscopeData.challenges}\n\n💡 *Советы звезд:*\n${horoscopeData.advice}\n\n🍀 *Счастливые элементы:*\n${luckyElementsText}`;
          bot.sendMessage(chatId, horoscopeMessage, { parse_mode: 'Markdown' });

          const elementsToSave = typeof horoscopeData.luckyElements === 'object' ? JSON.stringify(horoscopeData.luckyElements) : horoscopeData.luckyElements;
          db.run(`INSERT INTO horoscopes (user_id, introduction, futureOutlook, challenges, advice, luckyElements) VALUES (?, ?, ?, ?, ?, ?)`, [conversation.answers.userId, horoscopeData.introduction, horoscopeData.futureOutlook, horoscopeData.challenges, horoscopeData.advice, elementsToSave]);
          
          delete userConversations[chatId];
          break;
      }
    } catch (error) {
        console.error('Conversation processing error:', error.message);
        bot.sendMessage(chatId, 'Произошла внутренняя ошибка. Попробуйте начать заново с команды /horoscope');
        delete userConversations[chatId];
    }
  });

  console.log('Telegram bot has been started...');
});
