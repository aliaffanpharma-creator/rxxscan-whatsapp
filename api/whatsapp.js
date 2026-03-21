// /api/whatsapp.js
const fetch    = require('node-fetch');
const FormData = require('form-data');

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN;
const WA_TOKEN     = process.env.WA_TOKEN;
const PHONE_ID     = process.env.WA_PHONE_ID;
const GROQ_KEY     = process.env.GROQ_KEY;
const ELEVEN_KEY   = process.env.ELEVEN_KEY;

// ─────────────────────────────────────────────
// SESSION STORE
// ─────────────────────────────────────────────
const sessions = {};
function getSession(from) {
  if (!sessions[from]) {
    sessions[from] = {
      step: 'new',
      language: null,
      replyFormat: null,
      lastMsgType: null,
      pendingSwitch: null,
      history: []
    };
  }
  return sessions[from];
}

// ─────────────────────────────────────────────
// LANGUAGE CONFIG
// ─────────────────────────────────────────────
const LANGS = {
  english: { label: 'English',  flag: '🇬🇧', whisper: 'en', eleven: 'eng' },
  urdu:    { label: 'اردو',     flag: '🇵🇰', whisper: 'ur', eleven: 'urd' },
  punjabi: { label: 'پنجابی',   flag: '🏔️', whisper: 'pa', eleven: 'pan' },
  pashto:  { label: 'پښتو',    flag: '🌄', whisper: 'ps', eleven: 'pus' },
  sindhi:  { label: 'سنڌي',    flag: '🌊', whisper: 'sd', eleven: 'snd' }
};

// ─────────────────────────────────────────────
// ALL TEXT STRINGS (5 languages)
// ─────────────────────────────────────────────
const T = {
  welcome: {
    english: `👋 *Welcome to RxScan!*\n\nYour 24/7 AI Pharmacist — free, private & always here.\n\n🌐 *Choose your language:*\n\n1️⃣ 🇬🇧 English\n2️⃣ 🇵🇰 اردو Urdu\n3️⃣ 🏔️ پنجابی Punjabi\n4️⃣ 🌄 پښتو Pashto\n5️⃣ 🌊 سنڌي Sindhi\n\nReply with a number *1 to 5*`,
    urdu:    `👋 *RxScan میں خوش آمدید!*\n\nآپ کا 24/7 AI فارماسسٹ۔\n\n🌐 *اپنی زبان منتخب کریں:*\n\n1️⃣ 🇬🇧 English\n2️⃣ 🇵🇰 اردو\n3️⃣ 🏔️ پنجابی\n4️⃣ 🌄 پښتو\n5️⃣ 🌊 سنڌي\n\n*1 سے 5* تک جواب دیں`,
    punjabi: `👋 *RxScan وچ جی آیاں!*\n\n🌐 *اپنی بولی چنو:*\n\n1️⃣ English\n2️⃣ اردو\n3️⃣ پنجابی\n4️⃣ پښتو\n5️⃣ سنڌي\n\n*1 توں 5* لکھو`,
    pashto:  `👋 *RxScan ته ښه راغلاست!*\n\n🌐 *خپله ژبه وټاکئ:*\n\n1️⃣ English\n2️⃣ اردو\n3️⃣ پنجابی\n4️⃣ پښتو\n5️⃣ سنڌي\n\n*1 نه 5* ولیکئ`,
    sindhi:  `👋 *RxScan ۾ ڀليڪار!*\n\n🌐 *پنهنجي ٻولي چونڊيو:*\n\n1️⃣ English\n2️⃣ اردو\n3️⃣ پنجابی\n4️⃣ پښتو\n5️⃣ سنڌي\n\n*1 کان 5* لکو`
  },
  askFormat: {
    english: `✅ *English selected!*\n\nHow should I reply to you?\n\n💬 *1 — Text messages*\n🎤 *2 — Voice notes*\n\nReply *1 or 2*`,
    urdu:    `✅ *اردو منتخب!*\n\nمیں آپ کو کیسے جواب دوں؟\n\n💬 *1 — ٹیکسٹ میسج*\n🎤 *2 — وائس نوٹ*\n\n*1 یا 2* لکھیں`,
    punjabi: `✅ *پنجابی چنی!*\n\nمیں تینوں کیویں جواب دیواں؟\n\n💬 *1 — ٹیکسٹ*\n🎤 *2 — وائس نوٹ*\n\n*1 یا 2* لکھو`,
    pashto:  `✅ *پښتو وټاکل شوه!*\n\nزه تاسو ته څنګه ځواب درکړم؟\n\n💬 *1 — متن*\n🎤 *2 — د غږ یادښت*\n\n*1 یا 2* ولیکئ`,
    sindhi:  `✅ *سنڌي چونڊيل!*\n\nمان توهان کي ڪيئن جواب ڏيان؟\n\n💬 *1 — ٽيڪسٽ*\n🎤 *2 — وائس نوٽ*\n\n*1 يا 2* لکو`
  },
  confirmed: {
    english: (fmt) => `🎉 *All set!* Replying in English via ${fmt === 'voice' ? 'Voice Notes 🎤' : 'Text 💬'}\n\nSend me:\n📷 Prescription photo\n✍️ Type your prescription\n🎤 Voice note with your question\n\n_Type *change* anytime to update preferences_`,
    urdu:    (fmt) => `🎉 *بالکل ٹھیک!* ${fmt === 'voice' ? 'وائس نوٹ 🎤' : 'ٹیکسٹ 💬'} میں اردو جواب دوں گا\n\nبھیجیں:\n📷 نسخے کی تصویر\n✍️ نسخہ ٹائپ کریں\n🎤 سوال وائس نوٹ میں\n\n_*change* لکھیں ترجیحات تبدیل کرنے کے لیے_`,
    punjabi: (fmt) => `🎉 *ਵਧੀਆ!* پنجابی وچ ${fmt === 'voice' ? 'وائس نوٹ 🎤' : 'ٹیکسٹ 💬'} نال جواب دیواں گا\n\nبھیجو:\n📷 نسخے دی فوٹو\n✍️ نسخہ ٹائپ کرو\n🎤 سوال وائس نوٹ وچ`,
    pashto:  (fmt) => `🎉 *ښه!* پښتو کې ${fmt === 'voice' ? 'د غږ یادښت 🎤' : 'متن 💬'} له لارې ځواب\n\nراولیږئ:\n📷 د نسخې عکس\n✍️ نسخه ولیکئ\n🎤 پوښتنه د غږ یادښت کې`,
    sindhi:  (fmt) => `🎉 *بلڪل!* سنڌي ۾ ${fmt === 'voice' ? 'وائس نوٽ 🎤' : 'ٽيڪسٽ 💬'} ذريعي جواب\n\nموڪليو:\n📷 نسخي جي تصوير\n✍️ نسخو ٽائيپ ڪريو\n🎤 سوال وائس نوٽ ۾`
  },
  switchDetected: {
    english: `I noticed you sent a voice note! Want me to switch to *Voice Notes* 🎤?\n\nReply *yes* to switch or *no* to keep text.`,
    urdu:    `میں نے دیکھا آپ نے وائس نوٹ بھیجا! کیا میں بھی *وائس نوٹ* 🎤 میں جواب دوں؟\n\n*ہاں* لکھیں سوئچ کے لیے، *نہیں* رکھنے کے لیے`,
    punjabi: `میں نے ویکھیا تم نے وائس نوٹ بھیجیا! کی میں وی *وائس نوٹ* 🎤 وچ جواب دیواں؟\n\n*ہاں* لکھو سوئچ کرن لئی`,
    pashto:  `ما وکتل چې تاسو د غږ یادښت راولیږه! ایا زه هم *د غږ یادښت* 🎤 کې ځواب درکړم؟\n\n*هو* ولیکئ`,
    sindhi:  `مون ڏٺو توهان وائس نوٽ موڪليو! ڇا مان وي *وائس نوٽ* 🎤 ۾ جواب ڏيان؟\n\n*ها* لکو`
  },
  switchToText: {
    english: `I noticed you sent a text! Want me to switch to *Text* 💬 instead of voice notes?\n\nReply *yes* to switch or *no* to keep voice.`,
    urdu:    `میں نے دیکھا آپ نے ٹیکسٹ بھیجا! کیا میں *ٹیکسٹ* 💬 میں جواب دوں؟\n\n*ہاں* لکھیں سوئچ کے لیے`,
    punjabi: `میں نے ویکھیا تم نے ٹیکسٹ بھیجیا! کی میں *ٹیکسٹ* 💬 وچ جواب دیواں؟\n\n*ہاں* لکھو`,
    pashto:  `ما وکتل چې تاسو متن راولیږه! ایا زه *متن* 💬 کې ځواب درکړم؟\n\n*هو* ولیکئ`,
    sindhi:  `مون ڏٺو توهان ٽيڪسٽ موڪليو! ڇا مان *ٽيڪسٽ* 💬 ۾ جواب ڏيان؟\n\n*ها* لکو`
  },
  waiting: {
    english: '🔍 Analyzing your prescription...',
    urdu:    '🔍 نسخہ چیک کیا جا رہا ہے...',
    punjabi: '🔍 نسخہ چیک ہو رہا اے...',
    pashto:  '🔍 نسخه کتل کیږي...',
    sindhi:  '🔍 نسخو چيڪ ٿي رهيو آهي...'
  },
  listening: {
    english: '🎤 Listening...',
    urdu:    '🎤 سن رہا ہوں...',
    punjabi: '🎤 سن رہا ہاں...',
    pashto:  '🎤 اوریدل کیږي...',
    sindhi:  '🎤 ٻڌي رهيو آهيان...'
  },
  audioError: {
    english: '❌ Sorry, could not hear clearly. Please try again.',
    urdu:    '❌ معذرت، سمجھ نہیں آیا۔ دوبارہ بھیجیں۔',
    punjabi: '❌ معاف کرنا، سمجھ نئیں آیا۔ دوبارہ بھیجو۔',
    pashto:  '❌ بخښنه، نه واوریدل. بیا یې واستوئ.',
    sindhi:  '❌ معاف ڪجو، سمجهه نه آئي. ٻيهر موڪليو.'
  },
  invalidChoice: {
    english: '⚠️ Please reply with a number 1 to 5',
    urdu:    '⚠️ براہ کرم 1 سے 5 تک نمبر لکھیں',
    punjabi: '⚠️ مہربانی کرکے 1 توں 5 تک نمبر لکھو',
    pashto:  '⚠️ مهرباني وکړئ له 1 نه تر 5 پورې شمیره ولیکئ',
    sindhi:  '⚠️ مهرباني ڪري 1 کان 5 تائين نمبر لکو'
  },
  formatError: {
    english: '⚠️ Please reply with 1 (Text) or 2 (Voice Note)',
    urdu:    '⚠️ 1 (ٹیکسٹ) یا 2 (وائس نوٹ) لکھیں',
    punjabi: '⚠️ 1 (ٹیکسٹ) یا 2 (وائس نوٹ) لکھو',
    pashto:  '⚠️ 1 (متن) یا 2 (د غږ یادښت) ولیکئ',
    sindhi:  '⚠️ 1 (ٽيڪسٽ) يا 2 (وائس نوٽ) لکو'
  },
  switchedVoice: {
    english: '✅ Switched to Voice Notes 🎤 — ask me anything!',
    urdu:    '✅ وائس نوٹ پر سوئچ ہو گیا 🎤',
    punjabi: '✅ وائس نوٹ تے سوئچ ہو گیا 🎤',
    pashto:  '✅ د غږ یادښت ته لیږدول شو 🎤',
    sindhi:  '✅ وائس نوٽ تي سوئچ ٿي ويو 🎤'
  },
  switchedText: {
    english: '✅ Switched to Text messages 💬 — ask me anything!',
    urdu:    '✅ ٹیکسٹ میسج پر سوئچ ہو گیا 💬',
    punjabi: '✅ ٹیکسٹ میسج تے سوئچ ہو گیا 💬',
    pashto:  '✅ متن پیغام ته لیږدول شو 💬',
    sindhi:  '✅ ٽيڪسٽ ميسيج تي سوئچ ٿي ويو 💬'
  },
  keptSame: {
    english: '👍 No change! Keeping your current setting.',
    urdu:    '👍 کوئی تبدیلی نہیں! پہلی ترتیب برقرار ہے۔',
    punjabi: '👍 کوئی تبدیلی نئیں! پہلی ترتیب ویسی ای اے۔',
    pashto:  '👍 هیڅ بدلون نه! ورته پاتې شو.',
    sindhi:  '👍 ڪو تبديلي نه! ساڳي ترتيب رهي.'
  }
};

const t = (key, lang) => T[key]?.[lang] || T[key]?.english || '';

// ─────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────
function getSystemPrompt(language, forVoice = false) {
  const voiceNote = forVoice
    ? 'This reply will be read aloud as a voice note. Write naturally like you are speaking. No bullet points, no asterisks, no lists. Use flowing sentences only.'
    : 'Format nicely for WhatsApp. Use *bold* for medicine names. Keep it clean.';

  const base = `You are RxScan, a friendly AI pharmacist in Pakistan.
You analyze prescriptions, explain medicines simply, check drug interactions, and answer health questions.
Keep replies under 200 words. Be warm, caring and simple — like a pharmacist friend.
Never give alarming advice. Always suggest consulting a real doctor for serious issues.
${voiceNote}
Always end by asking if they have more questions.`;

  const instructions = {
    english: `${base}\nReply ONLY in English.`,
    urdu:    `${base}\nReply ONLY in Urdu (اردو). Use simple everyday Urdu. Roman Urdu is also fine.`,
    punjabi: `${base}\nReply ONLY in Punjabi (پنجابی). Use natural everyday Punjabi.`,
    pashto:  `${base}\nReply ONLY in Pashto (پښتو). Use simple everyday Pashto.`,
    sindhi:  `${base}\nReply ONLY in Sindhi (سنڌي). Use simple conversational Sindhi.`
  };
  return instructions[language] || instructions.english;
}

// ─────────────────────────────────────────────
// SEND WHATSAPP TEXT
// ─────────────────────────────────────────────
async function sendText(to, text) {
  await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    })
  });
}

// ─────────────────────────────────────────────
// DOWNLOAD MEDIA FROM META
// ─────────────────────────────────────────────
async function downloadMedia(mediaId) {
  const r1 = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${WA_TOKEN}` }
  });
  const { url } = await r1.json();
  const r2 = await fetch(url, {
    headers: { 'Authorization': `Bearer ${WA_TOKEN}` }
  });
  return await r2.buffer();
}

// ─────────────────────────────────────────────
// TRANSCRIBE AUDIO — GROQ WHISPER
// ─────────────────────────────────────────────
async function transcribeAudio(buffer, langCode) {
  const form = new FormData();
  form.append('file', buffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
  form.append('model', 'whisper-large-v3');
  if (langCode) form.append('language', langCode);

  const res  = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      ...form.getHeaders()
    },
    body: form
  });
  const data = await res.json();
  return data.text || '';
}

// ─────────────────────────────────────────────
// AI REPLY — GROQ LLAMA 4 SCOUT
// ─────────────────────────────────────────────
async function callAI(systemPrompt, userMessage, imageBase64 = null, history = []) {
  const userContent = imageBase64
    ? [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        { type: 'text', text: userMessage }
      ]
    : userMessage;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),
    { role: 'user', content: userContent }
  ];

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages,
      temperature: 0.3,
      max_tokens: 512
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─────────────────────────────────────────────
// TEXT TO SPEECH — ELEVENLABS
// ─────────────────────────────────────────────
async function textToSpeech(text, language) {
  if (!ELEVEN_KEY) return null;
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        language_code: LANGS[language]?.eleven || 'eng',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });
    if (!res.ok) return null;
    return await res.buffer();
  } catch { return null; }
}

// ─────────────────────────────────────────────
// SEND VOICE NOTE
// ─────────────────────────────────────────────
async function sendVoiceNote(to, audioBuffer) {
  try {
    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'reply.mp3', contentType: 'audio/mpeg' });
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'audio/mpeg');

    const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        ...form.getHeaders()
      },
      body: form
    });
    const { id: mediaId } = await uploadRes.json();
    if (!mediaId) return false;

    await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'audio',
        audio: { id: mediaId }
      })
    });
    return true;
  } catch { return false; }
}

// ─────────────────────────────────────────────
// SMART DELIVER — text or voice with fallback
// ─────────────────────────────────────────────
async function deliver(to, text, session) {
  if (session.replyFormat === 'voice') {
    const audio = await textToSpeech(text, session.language);
    if (audio) {
      await sendVoiceNote(to, audio);
      return;
    }
    // silent fallback to text if TTS fails
  }
  await sendText(to, text);
}

// ─────────────────────────────────────────────
// AUTO MODE-SWITCH DETECTION
// ─────────────────────────────────────────────
async function checkModeSwitch(from, incomingType, session) {
  if (session.step !== 'active') return false;
  if (!session.lastMsgType) { session.lastMsgType = incomingType; return false; }

  const nowVoice = incomingType === 'audio';
  const nowText  = incomingType === 'text';

  if (session.replyFormat === 'text' && nowVoice && session.lastMsgType === 'audio') {
    session.step = 'awaiting_switch_confirm';
    session.pendingSwitch = 'voice';
    await sendText(from, t('switchDetected', session.language));
    return true;
  }

  if (session.replyFormat === 'voice' && nowText && session.lastMsgType === 'text') {
    session.step = 'awaiting_switch_confirm';
    session.pendingSwitch = 'text';
    await sendText(from, t('switchToText', session.language));
    return true;
  }

  session.lastMsgType = incomingType;
  return false;
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────
module.exports = async function handler(req, res) {

  // Webhook verification
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.status(403).send('Forbidden');
  }

  if (req.method !== 'POST') return res.status(405).end();

  // Acknowledge Meta immediately (must be under 5 seconds)
  res.status(200).send('OK');

  try {
    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;

    const from    = msg.from;
    const type    = msg.type;
    const session = getSession(from);
    const lang    = session.language || 'english';
    const body    = (msg.text?.body || '').trim().toLowerCase();

    // ── RESET KEYWORDS ──
    const resetWords = ['reset', 'restart', 'change', 'تبدیل', 'بدلو', 'بدل'];
    if (session.step === 'active' && resetWords.some(w => body.includes(w))) {
      session.step         = 'new';
      session.language     = null;
      session.replyFormat  = null;
      session.lastMsgType  = null;
      session.pendingSwitch = null;
      session.history      = [];
      await sendText(from, T.welcome.english);
      return;
    }

    // ── STEP: NEW USER ──
    if (session.step === 'new') {
      await sendText(from, T.welcome.english);
      session.step = 'awaiting_language';
      return;
    }

    // ── STEP: AWAITING LANGUAGE ──
    if (session.step === 'awaiting_language') {
      const langMap = {
        '1': 'english', 'english': 'english',
        '2': 'urdu',    'urdu': 'urdu',       'اردو': 'urdu',
        '3': 'punjabi', 'punjabi': 'punjabi',  'پنجابی': 'punjabi',
        '4': 'pashto',  'pashto': 'pashto',   'پښتو': 'pashto',
        '5': 'sindhi',  'sindhi': 'sindhi',   'سنڌي': 'sindhi'
      };
      const chosen = langMap[body];
      if (!chosen) {
        await sendText(from, t('invalidChoice', 'english'));
        return;
      }
      session.language = chosen;
      session.step     = 'awaiting_format';
      await sendText(from, t('askFormat', chosen));
      return;
    }

    // ── STEP: AWAITING FORMAT ──
    if (session.step === 'awaiting_format') {
      if (body === '1') {
        session.replyFormat = 'text';
      } else if (body === '2') {
        session.replyFormat = 'voice';
      } else {
        await sendText(from, t('formatError', lang));
        return;
      }
      session.step = 'active';
      await sendText(from, T.confirmed[lang](session.replyFormat));
      return;
    }

    // ── STEP: AWAITING SWITCH CONFIRM ──
    if (session.step === 'awaiting_switch_confirm') {
      const yesWords = ['yes', 'ہاں', 'ها', 'هو', 'ਹਾਂ', '1', 'y', 'ok', 'ٹھیک', 'haan', 'han'];
      const noWords  = ['no', 'نہیں', 'نه', 'ਨਹੀਂ', '2', 'n', 'nope', 'nahi', 'na'];
      const isYes    = yesWords.some(w => body.includes(w));
      const isNo     = noWords.some(w => body.includes(w));

      if (isYes) {
        session.replyFormat   = session.pendingSwitch;
        session.step          = 'active';
        session.pendingSwitch = null;
        const msg = session.replyFormat === 'voice'
          ? t('switchedVoice', lang)
          : t('switchedText', lang);
        await sendText(from, msg);
      } else if (isNo) {
        session.step          = 'active';
        session.pendingSwitch = null;
        await sendText(from, t('keptSame', lang));
      } else {
        // ask again
        const askAgain = session.pendingSwitch === 'voice'
          ? t('switchDetected', lang)
          : t('switchToText', lang);
        await sendText(from, askAgain);
      }
      return;
    }

    // ── STEP: ACTIVE ──
    if (session.step === 'active') {

      // Check if user is switching communication mode
      const switched = await checkModeSwitch(from, type, session);
      if (switched) return;
      session.lastMsgType = type;

      const sysPrompt = getSystemPrompt(lang, session.replyFormat === 'voice');

      // TEXT MESSAGE
      if (type === 'text') {
        const userMsg = msg.text?.body || '';
        const reply   = await callAI(sysPrompt, userMsg, null, session.history);
        session.history.push({ role: 'user', content: userMsg });
        session.history.push({ role: 'assistant', content: reply });
        if (session.history.length > 12) session.history = session.history.slice(-12);
        await deliver(from, reply, session);
      }

      // IMAGE — Prescription Photo
      else if (type === 'image') {
        await sendText(from, t('waiting', lang));
        const buffer  = await downloadMedia(msg.image?.id);
        const base64  = buffer.toString('base64');
        const prompt  = 'Analyze this prescription photo. List each medicine, what it treats, the dosage, when to take it, and any important warnings. Be clear and simple.';
        const reply   = await callAI(sysPrompt, prompt, base64, session.history);
        session.history.push({ role: 'user', content: '[prescription image sent]' });
        session.history.push({ role: 'assistant', content: reply });
        if (session.history.length > 12) session.history = session.history.slice(-12);
        await deliver(from, reply, session);
      }

      // VOICE NOTE
      else if (type === 'audio') {
        await sendText(from, t('listening', lang));
        const buffer     = await downloadMedia(msg.audio?.id);
        const langCode   = LANGS[lang]?.whisper;
        const transcript = await transcribeAudio(buffer, langCode);
        if (!transcript) {
          await sendText(from, t('audioError', lang));
          return;
        }
        const reply = await callAI(sysPrompt, transcript, null, session.history);
        session.history.push({ role: 'user', content: transcript });
        session.history.push({ role: 'assistant', content: reply });
        if (session.history.length > 12) session.history = session.history.slice(-12);
        await deliver(from, reply, session);
      }
    }

  } catch (err) {
    console.error('RxScan WhatsApp Error:', err);
  }
};