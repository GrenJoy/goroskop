const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURATION ---
const DEEPSEEK_API_KEY = 'sk-9f1ba9f795104fbbb13cb33d20ddc70b';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MAX_RETRIES = 2; // Number of retries for the API call

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

// --- AUTHENTICATION & HOROSCOPE ROUTES (UNCHANGED) ---
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

  bot.on('polling_error', (error) => {
    console.error(`Telegram Polling Error: ${error.code} - ${error.message}`);
  });

  // --- BOT COMMANDS ---
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
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
      if (err || !user) {
        return bot.sendMessage(chatId, 'Аккаунт с таким email не найден. Пожалуйста, сначала зарегистрируйтесь на сайте.');
      }

      const updateSql = 'UPDATE users SET telegram_id = ? WHERE email = ?';
      db.run(updateSql, [chatId, email], (err) => {
        if (err) {
          return bot.sendMessage(chatId, 'Не удалось привязать аккаунт. Попробуйте позже.');
        }
        bot.sendMessage(chatId, 'Ваш Telegram успешно привязан к аккаунту! Теперь вы можете использовать все функции бота.');
      });
    });
  });

  const userConversations = {};

  bot.onText(/\/horoscope/, (msg) => {
    const chatId = msg.chat.id;
    db.get('SELECT * FROM users WHERE telegram_id = ?', [chatId], (err, user) => {
      if (err || !user) {
        return bot.sendMessage(chatId, 'Пожалуйста, сначала привяжите ваш аккаунт с помощью команды /connect [ваш_email]');
      }
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
          if (!/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
            return bot.sendMessage(chatId, 'Пожалуйста, введите дату в формате ДД.ММ.ГГГГ.');
          }
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

  // --- HOROSCOPE GENERATION WITH VALIDATION ---
  async function generateAndSaveHoroscope(userData, chatId) {
    const { userId, name, birthDate, traits, about } = userData;

    const prompt = `
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

        if (!deepseekResponse.ok) {
          const errorBody = await deepseekResponse.text();
          throw new Error(`API request failed with status ${deepseekResponse.status}: ${errorBody}`);
        }
        
        const data = await deepseekResponse.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON object found in response');

        const parsedJson = JSON.parse(jsonMatch[0]);

        // --- VALIDATION LOGIC ---
        const requiredKeys = ["introduction", "futureOutlook", "challenges", "advice", "luckyElements"];
        const missingKeys = requiredKeys.filter(key => !parsedJson[key] || (typeof parsedJson[key] === 'string' && parsedJson[key].trim() === ''));
        
        if (missingKeys.length > 0) {
          throw new Error(`Validation failed. Missing or empty keys: ${missingKeys.join(', ')}`);
        }

        horoscopeData = parsedJson; // Validation successful
        console.log(`Successfully generated horoscope for ${name} on attempt ${i + 1}.`);
        break; // Exit loop on success

      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error.message);
        if (i === MAX_RETRIES) {
          bot.sendMessage(chatId, 'Не удалось создать гороскоп. Звезды сегодня не в настроении. Пожалуйста, попробуйте позже.');
          return;
        }
      }
    }

    if (!horoscopeData) return; // Should not happen if the loop logic is correct

    // --- Format and Save ---
    let luckyElementsText = horoscopeData.luckyElements;
    if (typeof luckyElementsText === 'object' && luckyElementsText !== null) {
      luckyElementsText = Object.entries(luckyElementsText)
        .map(([key, value]) => `- ${key.charAt(0).toUpperCase() + key.slice(1)}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('\n');
    } else {
      luckyElementsText = String(luckyElementsText);
    }

    const elementsToSave = typeof horoscopeData.luckyElements === 'object' 
      ? JSON.stringify(horoscopeData.luckyElements) 
      : horoscopeData.luckyElements;

    const insertSql = `INSERT INTO horoscopes (user_id, introduction, futureOutlook, challenges, advice, luckyElements) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(insertSql, [userId, horoscopeData.introduction, horoscopeData.futureOutlook, horoscopeData.challenges, horoscopeData.advice, elementsToSave], (err) => {
      if (err) {
        console.error("DB insert error:", err.message);
        return bot.sendMessage(chatId, 'Произошла ошибка при сохранении вашего гороскопа.');
      }
      
      const horoscopeMessage = `
*${horoscopeData.introduction}*

🔮 *Прогноз на будущее:*
${horoscopeData.futureOutlook}

⚔️ *Испытания и возможности:*
${horoscopeData.challenges}

💡 *Советы звезд:*
${horoscopeData.advice}

🍀 *Счастливые элементы:*
${luckyElementsText}
      `;
      bot.sendMessage(chatId, horoscopeMessage, { parse_mode: 'Markdown' });
    });
  }

  console.log('Telegram bot has been started...');
});