const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch');
const TelegramBot = require('node-telegram-bot-api'); // MOVED TO TOP

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURATION ---
const DEEPSEEK_API_KEY = 'sk-a3699ffb8a5146778610815d7ca8537f';
const TELEGRAM_TOKEN = '7996945974:AAGQ92e_qrZiZ8VWhKZZDHhQoAnDGfvxips';
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

// --- SHARED, ROBUST HOROSCOPE GENERATION LOGIC ---
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

// --- PROMPT TEMPLATE ---
function getHoroscopePrompt(name, birthDate, traits, about) {
  return `
  Ты — Лира, Звёздная Ткачиха, древний и мудрый астролог... [PROMPT OMITTED FOR BREVITY, IT IS UNCHANGED]
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
  const prompt = getHoroscopePrompt(name, birthDate, traits, about);

  try {
    const horoscopeData = await getHoroscopeFromAPI(prompt);
    
    let luckyElementsText = horoscopeData.luckyElements;
    if (typeof luckyElementsText === 'object' && luckyElementsText !== null) {
      luckyElementsText = Object.entries(luckyElementsText)
        .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('\n');
    }

    const responseData = {
        ...horoscopeData,
        luckyElements: luckyElementsText
    };

    const elementsToSave = typeof horoscopeData.luckyElements === 'object' ? JSON.stringify(horoscopeData.luckyElements) : horoscopeData.luckyElements;
    const insertSql = `INSERT INTO horoscopes (user_id, introduction, futureOutlook, challenges, advice, luckyElements) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(insertSql, [req.userId, horoscopeData.introduction, horoscopeData.futureOutlook, horoscopeData.challenges, horoscopeData.advice, elementsToSave], function(err) {
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
        // ... [UNCHANGED BOT LOGIC] ...
    });

    bot.on('message', async (msg) => {
        // ... [UNCHANGED BOT LOGIC] ...
    });

    console.log('Telegram bot event listeners are set up.');

  } catch (error) {
    console.error('CRITICAL: Failed to initialize Telegram Bot. Please check your TELEGRAM_TOKEN and network connection.');
    console.error('Detailed Error:', error.message);
    process.exit(1);
  }
});