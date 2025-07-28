const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURATION ---
const DEEPSEEK_API_KEY = 'sk-a3699ffb8a5146778610815d7ca8537f';
const TELEGRAM_TOKEN = '7996945974:AAGQ92e_qrZiZ8VWhKZZDHhQoAnDGfvxips';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MAX_RETRIES = 1; // Reduced retries for faster failure detection

// --- MIDDLEWARE ---
app.use(cors()); 
app.use(express.json());
app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.path}`);
  next();
});

// --- DATABASE SETUP ---
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('FATAL: Error opening database', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, telegram_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS horoscopes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, introduction TEXT, futureOutlook TEXT, challenges TEXT, advice TEXT, luckyElements TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users (id))`);
  });
});

// --- SIMPLIFIED & ROBUST HOROSCOPE GENERATION ---
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
          temperature: 0.7,
          max_tokens: 2048 // Safe token limit
        }),
      });

      const responseText = await response.text();
      if (!response.ok) throw new Error(`API request failed with status ${response.status}: ${responseText}`);
      if (!responseText.trim().startsWith('{')) throw new Error(`API returned non-JSON response. Body: ${responseText}`);

      const data = JSON.parse(responseText);
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('API response is missing expected content structure.');
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found in AI-generated content');
      
      const parsedJson = JSON.parse(jsonMatch[0]);
      const requiredKeys = ["introduction", "futureOutlook", "challenges", "advice", "luckyElements"];
      const missingKeys = requiredKeys.filter(key => !parsedJson[key] || String(parsedJson[key]).trim() === '');

      if (missingKeys.length > 0) throw new Error(`Validation failed. Missing or empty keys: ${missingKeys.join(', ')}`);
      
      console.log(`Successfully generated horoscope on attempt ${i + 1}.`);
      return parsedJson;

    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      if (i === MAX_RETRIES) throw new Error('Failed to generate horoscope after multiple retries.');
    }
  }
}

// --- NEW, SIMPLIFIED PROMPT TEMPLATE ---

function getHoroscopePrompt(name, birthDate, traits, about) {
  return `
Ты — мистический и мудрый астролог. Твоя задача — создать персонализированный гороскоп для пользователя на основе следующих данных:
- Имя: ${name}
- Дата рождения: ${birthDate}
- Черты характера: ${traits.join(', ')}
- О пользователе: "${about}"

Твой ответ ДОЛЖЕН быть строго в формате JSON-объекта и ничего более. Не добавляй никакого текста до или после JSON. JSON-объект должен содержать следующие ключи с непустыми строками:
- "introduction": Тёплое, мистическое приветствие для ${name}. Пример: "Звёзды приветствуют тебя, ${name}! Космос раскрывает свои тайны..."
- "futureOutlook": Подробный прогноз на ближайшие 7 дней, связанный с тем, что волнует пользователя (из поля "about"). Минимум 50 слов.
- "challenges": Потенциальные препятствия и советы, как их преодолеть. Минимум 50 слов.
- "advice": 2-3 конкретных, действенных совета для личностного роста и достижения целей. Минимум 50 слов.
- "luckyElements": Список из минимум 3 счастливых элементов (например, цвет, число, минерал). Форматируй как строку, например: "Цвет: индиго, Число: 7, Минерал: аметист".

Тон должен быть ободряющим, таинственным и глубоким. Убедись, что все ключи присутствуют, их значения — непустые строки, и ответ — это только JSON-объект.
Пример ответа:
{
  "introduction": "Звёзды приветствуют тебя, ${name}! Космос раскрывает свои тайны...",
  "futureOutlook": "На этой неделе тебя ждут новые возможности в карьере. Твоя энергия привлечет внимание коллег, но будь внимателен к мелочам.",
  "challenges": "Возможны небольшие конфликты в личной жизни. Сохраняй спокойствие и используй открытый диалог для решения проблем.",
  "advice": "Сосредоточься на своих целях, занимайся медитацией и планируй свои действия заранее.",
  "luckyElements": "Цвет: синий, Число: 12, Минерал: лазурит"
}
`;
}

// --- AUTH & WEB ROUTES ---
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  req.userId = parseInt(token, 10);
  next();
};

app.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, password], function(err) {
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
  db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.status(200).json({ message: 'Login successful', token: user.id });
  });
});

app.post('/horoscope', authenticateToken, async (req, res) => {
  const { name, birthDate, traits, about } = req.body;
  const prompt = getHoroscopePrompt(name, birthDate, traits, about);

  try {
    const horoscopeData = await getHoroscopeFromAPI(prompt);
    
    let luckyElementsText = horoscopeData.luckyElements;
    if (typeof luckyElementsText === 'object' && luckyElementsText !== null) {
      luckyElementsText = Object.entries(luckyElementsText)
        .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('\n');
    }

    const responseData = { ...horoscopeData, luckyElements: luckyElementsText };
    const elementsToSave = typeof horoscopeData.luckyElements === 'object' ? JSON.stringify(horoscopeData.luckyElements) : horoscopeData.luckyElements;
    
    db.run(`INSERT INTO horoscopes (user_id, introduction, futureOutlook, challenges, advice, luckyElements) VALUES (?, ?, ?, ?, ?, ?)`, [req.userId, horoscopeData.introduction, horoscopeData.futureOutlook, horoscopeData.challenges, horoscopeData.advice, elementsToSave], function(err) {
      if (err) {
        console.error("DB insert error:", err.message);
        return res.status(500).json({ error: "Failed to save horoscope." });
      }
      res.status(201).json(responseData);
    });
  } catch (error) {
    console.error('Horoscope generation process failed for web:', error.message);
    res.status(500).json({ error: 'Failed to generate horoscope.' });
  }
});

// --- TELEGRAM BOT ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  
  try {
    console.log('Initializing Telegram Bot...');
    const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
    console.log('Telegram Bot initialized successfully.');

    bot.on('polling_error', (error) => console.error(`Telegram Polling Error: ${error.code} - ${error.message}`));

    const userConversations = {};

    bot.onText(/\/start|\/connect|\/horoscope/, (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (text.startsWith('/connect')) {
            const email = text.split(' ')[1];
            if (!email) return bot.sendMessage(chatId, 'Пожалуйста, укажите ваш email. /connect user@example.com');
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
                if (err || !user) return bot.sendMessage(chatId, 'Аккаунт с таким email не найден.');
                db.run('UPDATE users SET telegram_id = ? WHERE email = ?', [chatId, email], (err) => {
                    if (err) return bot.sendMessage(chatId, 'Не удалось привязать аккаунт.');
                    bot.sendMessage(chatId, 'Ваш Telegram успешно привязан!');
                });
            });
        } else if (text.startsWith('/horoscope')) {
            db.get('SELECT * FROM users WHERE telegram_id = ?', [chatId], (err, user) => {
                if (err || !user) return bot.sendMessage(chatId, 'Пожалуйста, сначала привяжите ваш аккаунт. /connect [ваш_email]');
                userConversations[chatId] = { step: 1, answers: { userId: user.id } };
                bot.sendMessage(chatId, 'Начинаем создание гороскопа! ✨\n\nКак вас зовут?');
            });
        } else { // /start
            bot.sendMessage(chatId, `Добро пожаловать в Космический Гороскоп!\n\n/connect [ваш_email] - привязать аккаунт.\n/horoscope - создать новый г��роскоп.`);
        }
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

    console.log('Telegram bot event listeners are set up.');

  } catch (error) {
    console.error('CRITICAL: Failed to initialize Telegram Bot. Please check your TELEGRAM_TOKEN and network connection.');
    console.error('Detailed Error:', error.message);
    process.exit(1);
  }
});