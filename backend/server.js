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
    Ты — Лира, Звёздная Ткачиха, древний и мудрый астролог, что читает узоры на космическом полотне. Твоя речь плавна, загадочна и полна метафор. Твоя священная задача — соткать глубоко личный и проницательный гороскоп, который станет путеводной звездой для вопрошающего.

    Вот кто обратился к тебе за советом:
    - Имя: ${name}
    - Дата рождения: ${birthDate}
    - Его/её черты характера: ${traits.join(', ')}
    - Самое важное — его/её мысли и стремления: "${about}"

    Твоя главная задача — вслушаться в то, о чем говорит ${name} в разделе "о себе". Твои предсказания и советы должны быть напрямую связаны с его/её текущей жизненной ситуацией, целями и переживаниями. Если он ищет любовь, говори о любви. Если его волнует карьера, направь его в этой сфере.

    Свой ответ ты должна облечь в форму чистого JSON-объекта, без единого слова до или после него. Этот объект должен содержать пять обязател��ных ключей:

    - "introduction": Начни с мистического и личного приветствия. (Пример: "Космические ветра шепчут мне твое имя, ${name}. Я, Лира, раскинула звёздные карты, чтобы узреть твой путь...")
    - "futureOutlook": Нарисуй яркую картину ближайшего будущего (7 дней), уделяя особое внимание тому, что волнует ${name}. Опиши возможные встречи, знаки судьбы и внутренние озарения. Твой рассказ должен быть подробным и вдохновляющим.
    - "challenges": Поведай о тенях на его/её пути. Какие внутренние или внешние преграды могут возникнуть? Дай мудрый совет, как превратить вызов в источник силы.
    - "advice": Предложи несколько глубоких, нетривиальных советов, которые помогут ${name} в его/её стремлениях. Это должны быть не общие фразы, а конкретные духовные или практические шаги.
    - "luckyElements": Раскрой тайные знаки удачи на эту неделю. Это могут быть цвета, числа, минералы, запахи или даже время суток. (Пример: "На этой неделе твоими космическими союзниками будут: глубокий сапфировый цвет, число 9 и аромат сандала на закате.")

    Помни, Звёздная Ткачиха, твой ответ — это только JSON. Все пять ключей обязательны. Наполни каждый из них мудростью и поэзией звезд.
    ВАЖНО: Ответ должен быть полным JSON-объектом. Пустые строки или отсутствующие ключи недопустимы и приведут к провалу твоего предсказания. Убедись, что все пять полей ("introduction", "futureOutlook", "challenges", "advice", "luckyElements") содержат развернутый текст.
    `;

  try {
    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048
      }),
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

  bot.on('message', async (msg) => { // Make the handler async
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands and non-text messages in this handler
    if (!text || text.startsWith('/')) return;

    const conversation = userConversations[chatId];
    if (!conversation) return; // Not in a conversation

    try {
      switch (conversation.step) {
        case 1: // User sent their name
          conversation.answers.name = text;
          conversation.step = 2;
          bot.sendMessage(chatId, `Приятно познакомиться, ${text}!

Теперь введите вашу дату рождения (например, 01.01.1990).`);
          break;
        case 2: // User sent their birth date
          // Basic validation for date format
          if (!/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
            bot.sendMessage(chatId, 'Пожалуйста, введите дату в формате ДД.ММ.ГГГГ. Например: 31.12.1990');
            return; // Stay on the same step
          }
          conversation.answers.birthDate = text;
          conversation.step = 3;
          // In a real app, this might come from a shared config or DB.
          const traits = ["Амбициозный", "Артистичный", "Практичный", "Эмпатичный", "Осторожный", "Оптимист"];
          bot.sendMessage(chatId, `Отлично. Перечислите через запятую несколько ваших черт характера (например: добрый, амбициозный, нетерпеливый).

Варианты: ${traits.join(', ')}`);
          break;
        case 3: // User sent their traits
          conversation.answers.traits = text.split(',').map(t => t.trim());
          conversation.step = 4;
          bot.sendMessage(chatId, 'И последнее: расскажите немного о себе. Что вас сейчас волнует, к чему вы стремитесь?');
          break;
        case 4: // User sent the "about" text
          conversation.answers.about = text;
          bot.sendMessage(chatId, 'Благодарю. Звезды уже выстраиваются в ряд... Я тку для вас предсказание. Это займет мгновение... ✨');
          
          // Generate the horoscope
          await generateAndSaveHoroscope(conversation.answers, chatId);

          // Clean up the conversation state
          delete userConversations[chatId];
          break;
      }
    } catch (error) {
        console.error('Conversation processing error:', error);
        bot.sendMessage(chatId, 'Произошла внутренняя ошибка. Попробуйте начать заново с команды /horoscope');
        // Clean up conversation on error
        delete userConversations[chatId];
    }
  });

  async function generateAndSaveHoroscope(userData, chatId) {
    const { userId, name, birthDate, traits, about } = userData;

    const prompt = `
    Ты — Лира, Звёздная Ткачиха, древний и мудрый астролог, что читает узоры на космическом полотне. Твоя речь плавна, загадочна и полна метафор. Твоя священная задача — соткать глубоко личный и проницательный гороскоп, который станет путеводной звездой для вопрошающего.

    Вот кто обратился к тебе за советом:
    - Имя: ${name}
    - Дата рождения: ${birthDate}
    - Его/её черты характера: ${traits.join(', ')}
    - Самое важное — его/её мысли и стремления: "${about}"

    Твоя главная задача — вслушаться в то, о чем говорит ${name} в разделе "о себе". Твои предсказания и советы должны быть напрямую связаны с его/её текущей жизненной ситуацией, целями и переживаниями. Если он ищет любовь, говори о любви. Если его вол��ует карьера, направь его в этой сфере.

    Свой ответ ты должна облечь в форму чистого JSON-объекта, без единого слова до или после него. Этот объект должен содержать пять обязательных ключей.

    ОБЩЕЕ ТРЕБОВАНИЕ К ОБЪЕМУ: Каждый раздел твоего ответа ("introduction", "futureOutlook", "challenges", "advice") должен быть развернутым и содержательным. Твоя цель — дать глубокий и исчерпывающий ответ, объемом не менее 3-5 развернутых предложений для каждого пункта, а не короткую отписку.

    - "introduction": Начни с мистического и личного приветствия. (Пример: "Космические ветра шепчут мне твое имя, ${name}. Я, Лира, раскинула звёздные карты, чтобы узреть твой путь...")
    - "futureOutlook": Нарисуй яркую и подробную картину ближайшего будущего (7 дней), уделяя особое внимание тому, что волнует ${name}. Опиши возможные встречи, знаки судьбы и внутренние озарения. Твой рассказ должен быть подробным и вдохновляющим.
    - "challenges": Поведай о тенях на его/её пути. Какие внутренние или внешние преграды могут возникнуть? Дай мудрый и развернутый совет, как превратить вызов в источник силы.
    - "advice": Предложи несколько глубоких, нетривиальных и детально описанных советов, которые помогут ${name} в его/её стремлениях. Это должны быть не общие фразы, а конкретные духовные или практические шаги.
    - "luckyElements": Раскрой тайные знаки удачи на эту неделю. Это могут быть цвета, числа, минералы, запахи или даже время суток. (Пример: "На этой неделе твоими космическими союзниками будут: глубокий сапфировый цвет, число 9 и аромат сандала на закате.")

    Помни, Звёздная Ткачиха, твой ответ — это только JSON. Все пять ключей обязательны. Наполни каждый из них мудростью и поэзией звезд.
    ВАЖНО: Ответ должен быть полным JSON-объектом. Пустые строки или отсутствующие ключи недопустимы и приведут к провалу твоего предсказания. Убедись, что все пять полей ("introduction", "futureOutlook", "challenges", "advice", "luckyElements") содержат развернутый текст.
    `;

    try {
      const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2048
        }),
      });

      if (!deepseekResponse.ok) {
          const errorBody = await deepseekResponse.text();
          throw new Error(`Failed to fetch from DeepSeek API. Status: ${deepseekResponse.status}, Body: ${errorBody}`);
      }
      
      const data = await deepseekResponse.json();
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Invalid JSON response from AI');

      const horoscopeData = JSON.parse(jsonMatch[0]);

      // --- FIX for luckyElements ---
      // Format luckyElements into a readable string if it's an object
      let luckyElementsText = horoscopeData.luckyElements;
      if (typeof luckyElementsText === 'object' && luckyElementsText !== null) {
        luckyElementsText = Object.entries(luckyElementsText)
          .map(([key, value]) => {
            const formattedValue = Array.isArray(value) ? value.join(', ') : value;
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            return `- ${capitalizedKey}: ${formattedValue}`;
          })
          .join('\n');
      } else if (typeof luckyElementsText !== 'string') {
        luckyElementsText = String(luckyElementsText);
      }
      // --- END FIX ---

      // Save horoscope to DB, ensuring we save the original JSON structure if needed
      const elementsToSave = typeof horoscopeData.luckyElements === 'object' 
        ? JSON.stringify(horoscopeData.luckyElements) 
        : horoscopeData.luckyElements;

      const insertSql = `INSERT INTO horoscopes (user_id, introduction, futureOutlook, challenges, advice, luckyElements) VALUES (?, ?, ?, ?, ?, ?)`;
      db.run(insertSql, [userId, horoscopeData.introduction, horoscopeData.futureOutlook, horoscopeData.challenges, horoscopeData.advice, elementsToSave], (err) => {
        if (err) {
          console.error("DB insert error:", err.message);
          bot.sendMessage(chatId, 'Произошла ошибка при сохранении вашего гороскопа. Попробуйте позже.');
          return;
        }
        
        // Format and send the message to the user
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

    } catch (error) {
      console.error('Horoscope generation error:', error);
      bot.sendMessage(chatId, 'Не удалось соткать ваш гороскоп. Космические ветра сегодня неспокойны. Пожалуйста, попробуйте снова позже.');
    }
  }

  console.log('Telegram bot has been started...');
});
