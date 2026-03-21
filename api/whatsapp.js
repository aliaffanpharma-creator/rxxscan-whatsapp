const fetch = require('node-fetch');
const FormData = require('form-data');

const GROQ_KEY          = process.env.GROQ_KEY;
const ELEVEN_KEY        = process.env.ELEVEN_KEY;
const ULTRAMSG_TOKEN    = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

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
  english: { label: 'English', whisper: 'en', eleven: 'eng' },
  urdu:    { label: 'اردو',    whisper: 'ur', eleven: 'urd' },
  punjabi: { label: 'پنجابی', whisper: 'pa', eleven: 'pan' },
  pashto:  { label: 'پښتو',  whisper: 'ps', eleven: 'pus' },
  sindhi:  { label: 'سنڌي',  whisper: 'sd', eleven: 'snd' }
};

// ─────────────────────────────────────────────
// TEXT STRINGS
// ─────────────────────────────────────────────
const T = {
  welcome: `👋 *Welcome to RxScan!*\n\nYour 24/7 AI Pharmacist 💊\n\n🌐 Choose your language:\n\n1️⃣ English\n2️⃣ اردو Urdu\n3️⃣ پنجابی Punjabi\n4️⃣ پښتو Pashto\n5️⃣ سنڌي Sindhi\n\nReply with *1 to 5*`,
  askFormat: {
    english: `✅ English selected!\n\nHow should I reply?\n\n💬 *1 — Text*\n🎤 *2 — Voice Note*\n\nReply 1 or 2`,
    urdu:    `✅ اردو منتخب!\n\nجواب کیسے دوں؟\n\n💬 *1 — ٹیکسٹ*\n🎤 *2 — وائس نوٹ*\n\n1 یا 2 لکھیں`,
    punjabi: `✅ پنجابی چنی!\n\nکیویں جواب دیواں؟\n\n💬 *1 — ٹیکسٹ*\n🎤 *2 — وائس نوٹ*\n\n1 یا 2 لکھو`,
    pashto:  `✅ پښتو وټاکل شوه!\n\nڅنګه ځواب درکړم؟\n\n💬 *1 — متن*\n🎤 *2 — غږ*\n\n1 یا 2 ولیکئ`,
    sindhi:  `✅ سنڌي چونڊيل!\n\nڪيئن جواب ڏيان؟\n\n💬 *1 — ٽيڪسٽ*\n🎤 *2 — وائس نوٽ*\n\n1 يا 2 لکو`
  },
  confirmed: {
    english: (f) => `🎉 All set! Replying in English via ${f==='voice'?'Voice Notes 🎤':'Text 💬'}\n\nSend me:\n📷 Prescription photo\n✍️ Type prescription\n🎤 Voice note question\n\nType *change* anytime to reset`,
    urdu:    (f) => `🎉 بالکل ٹھیک! ${f==='voice'?'وائس نوٹ 🎤':'ٹیکسٹ 💬'} میں جواب دوں گا\n\nبھیجیں:\n📷 نسخے کی تصویر\n✍️ نسخہ ٹائپ کریں\n🎤 سوال وائس نوٹ میں\n\n*change* لکھیں ترجیح بدلنے کے لیے`,
    punjabi: (f) => `🎉 ਵਧੀਆ! ${f==='voice'?'وائس نوٹ 🎤':'ٹیکسٹ 💬'} نال جواب دیواں گا\n\nبھیجو:\n📷 نسخے دی فوٹو\n✍️ نسخہ ٹائپ کرو\n🎤 سوال وائس نوٹ وچ`,
    pashto:  (f) => `🎉 ښه! ${f==='voice'?'غږ 🎤':'متن 💬'} له لارې ځواب\n\nراولیږئ:\n📷 نسخې عکس\n✍️ نسخه ولیکئ\n🎤 پوښتنه`,
    sindhi:  (f) => `🎉 بلڪل! ${f==='voice'?'وائس نوٽ 🎤':'ٽيڪسٽ 💬'} ذريعي جواب\n\nموڪليو:\n📷 نسخي جي تصوير\n✍️ نسخو ٽائيپ ڪريو\n🎤 سوال`
  },
  switchToVoice: {
    english: `I noticed you sent a voice note! Switch to *Voice Notes* 🎤?\n\nReply *yes* or *no*`,
    urdu:    `وائس نوٹ بھیجا! کیا میں بھی وائس نوٹ میں جواب دوں؟\n\n*ہاں* یا *نہیں*`,
    punjabi: `وائس نوٹ بھیجیا! وائس نوٹ وچ جواب دیواں؟\n\n*ہاں* یا *نہیں*`,
    pashto:  `د غږ یادښت راولیږه! غږ کې ځواب درکړم؟\n\n*هو* یا *نه*`,
    sindhi:  `وائس نوٽ موڪليو! وائس نوٽ ۾ جواب ڏيان؟\n\n*ها* يا *نه*`
  },
  switchToText: {
    english: `I noticed you sent text! Switch to *Text* 💬?\n\nReply *yes* or *no*`,
    urdu:    `ٹیکسٹ بھیجا! ٹیکسٹ میں جواب دوں؟\n\n*ہاں* یا *نہیں*`,
    punjabi: `ٹیکسٹ بھیجیا! ٹیکسٹ وچ جواب دیواں؟\n\n*ہاں* یا *نہیں*`,
    pashto:  `متن راولیږه! متن کې ځواب درکړم؟\n\n*هو* یا *نه*`,
    sindhi:  `ٽيڪسٽ موڪليو! ٽيڪسٽ ۾ جواب ڏيان؟\n\n*ها* يا *نه*`
  },
  waiting: {
    english: '🔍 Analyzing your prescription...',
    urdu:    '🔍 نسخہ چیک ہو رہا ہے...',
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
    english: '❌ Could not hear clearly. Please try again.',
    urdu:    '❌ سمجھ نہیں آیا۔ دوبارہ بھیجیں۔',
    punjabi: '❌ سمجھ نئیں آیا۔ دوبارہ بھیجو۔',
    pashto:  '❌ نه واوریدل. بیا یې واستوئ.',
    sindhi:  '❌ سمجهه نه آئي. ٻيهر موڪليو.'
  },
  invalidChoice: {
    english: '⚠️ Please reply with a number 1 to 5',
    urdu:    '⚠️ 1 سے 5 تک نمبر لکھیں',
    punjabi: '⚠️ 1 توں 5 تک نمبر لکھو',
    pashto:  '⚠️ له 1 نه تر 5 شمیره ولیکئ',
    sindhi:  '⚠️ 1 کان 5 تائين نمبر لکو'
  },
  formatError: {
    english: '⚠️ Please reply with 1 (Text) or 2 (Voice)',
    urdu:    '⚠️ 1 (ٹیکسٹ) یا 2 (وائس) لکھیں',
    punjabi: '⚠️ 1 (ٹیکسٹ) یا 2 (وائس) لکھو',
    pashto:  '⚠️ 1 (متن) یا 2 (غږ) ولیکئ',
    sindhi:  '⚠️ 1 (ٽيڪسٽ) يا 2 (وائس) لکو'
  },
  switchedVoice: {
    english: '✅ Switched to Voice Notes 🎤',
    urdu:    '✅ وائس نوٹ پر سوئچ ہو گیا 🎤',
    punjabi: '✅ وائس نوٹ تے سوئچ ہو گیا 🎤',
    pashto:  '✅ غږ ته لیږدول شو 🎤',
    sindhi:  '✅ وائس نوٽ تي سوئچ ٿي ويو 🎤'
  },
  switchedText: {
    english: '✅ Switched to Text 💬',
    urdu:    '✅ ٹیکسٹ پر سوئچ ہو گیا 💬',
    punjabi: '✅ ٹیکسٹ تے سوئچ ہو گیا 💬',
    pashto:  '✅ متن ته لیږدول شو 💬',
    sindhi:  '✅ ٽيڪسٽ تي سوئچ ٿي ويو 💬'
  },
  keptSame: {
    english: '👍 Keeping your current setting!',
    urdu:    '👍 پہلی ترتیب برقرار ہے!',
    punjabi: '👍 پہلی ترتیب ویسی ای اے!',
    pashto:  '👍 ورته پاتې شو!',
    sindhi:  '👍 ساڳي ترتيب رهي!'
  }
};

const t = (key, lang) => T[key]?.[lang] || T[key]?.english || '';

// ─────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────
function getSystemPrompt(language, forVoice = false) {
  const format = forVoice
    ? 'Reply naturally like speaking. No bullet points, no asterisks. Flowing sentences only.'
    : 'Format for WhatsApp. Use *bold* for medicine names.';
  const base = `You are RxScan, a friendly AI pharmacist in Pakistan.
Analyze prescriptions, explain medicines, check interactions, answer health questions.
Keep replies under 200 words. Be warm and simple like a pharmacist friend.
Always suggest consulting a real doctor for serious issues.
${format}
End by asking if they have more questions.`;
  const map = {
    english: `${base}\nReply ONLY in English.`,
    urdu:    `${base}\nReply ONLY in Urdu. Simple conversational Urdu or Roman Urdu is fine.`,
    punjabi: `${base}\nReply ONLY in Punjabi.`,
    pashto:  `${base}\nReply ONLY in Pashto.`,
    sindhi:  `${base}\nReply ONLY in Sindhi.`
  };
  return map[language] || map.english;
}

// ─────────────────────────────────────────────
// SEND MESSAGE — UltraMsg
// ─────────────────────────────────────────────
async function sendText(to, body) {
  const url = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages/chat`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: ULTRAMSG_TOKEN,
      to: `${to}@c.us`,
      body
    })
  });
}

// ─────────────────────────────────────────────
// SEND VOICE NOTE — UltraMsg
// ─────────────────────────────────────────────
async function sendVoiceNote(to, audioBuffer) {
  try {
    const base64Audio = audioBuffer.toString('base64');
    const url = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages/audio`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: ULTRAMSG_TOKEN,
        to: `${to}@c.us`,
        audio: `data:audio/mpeg;base64,${base64Audio}`
      })
    });
    return res.ok;
  } catch { return false; }
}

// ─────────────────────────────────────────────
// DOWNLOAD MEDIA
// ─────────────────────────────────────────────
async function downloadMedia(url) {
  const res = await fetch(url);
  return await res.buffer();
}

// ─────────────────────────────────────────────
// TRANSCRIBE AUDIO — Groq Whisper
// ─────────────────────────────────────────────
async function transcribeAudio(buffer, langCode) {
  const form = new FormData();
  form.append('file', buffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
  form.append('model', 'whisper-large-v3');
  if (langCode) form.append('language', langCode);
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, ...form.getHeaders() },
    body: form
  });
  const data = await res.json();
  return data.text || '';
}

// ─────────────────────────────────────────────
// AI REPLY — Groq Llama 4 Scout
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
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
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
// TEXT TO SPEECH — ElevenLabs
// ─────────────────────────────────────────────
async function textToSpeech(text, language) {
  if (!ELEVEN_KEY) return null;
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB', {
      method: 'POST',
      headers: { 'xi-api-key': ELEVEN_KEY, 'Content-Type': 'application/json' },
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
// SMART DELIVER
// ─────────────────────────────────────────────
async function deliver(to, text, session) {
  if (session.replyFormat === 'voice') {
    const audio = await textToSpeech(text, session.language);
    if (audio) {
      const sent = await sendVoiceNote(to, audio);
      if (sent) return;
    }
  }
  await sendText(to, text);
}

// ─────────────────────────────────────────────
// AUTO MODE SWITCH DETECTION
// ─────────────────────────────────────────────
async function checkModeSwitch(from, incomingType, session) {
  if (session.step !== 'active') return false;
  if (!session.lastMsgType) { session.lastMsgType = incomingType; return false; }
  if (session.replyFormat === 'text' && incomingType === 'audio' && session.lastMsgType === 'audio') {
    session.step = 'awaiting_switch_confirm';
    session.pendingSwitch = 'voice';
    await sendText(from, t('switchToVoice', session.language));
    return true;
  }
  if (session.replyFormat === 'voice' && incomingType === 'text' && session.lastMsgType === 'text') {
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
  if (req.method !== 'POST') return res.status(405).end();

  // Respond to UltraMsg immediately
  res.status(200).json({ status: 'ok' });

  try {
    const data = req.body;

    // UltraMsg sends data in this format
    const from      = (data.from || '').replace('@c.us', '').replace('whatsapp:', '');
    const msgBody   = (data.body || '').trim();
    const msgType   = data.type || 'chat';

    // Ignore messages sent by the bot itself
    if (data.fromMe) return;
    if (!from) return;

    const session = getSession(from);
    const lang    = session.language || 'english';
    const text    = msgBody.toLowerCase();

    // Detect type
    let type = 'text';
    if (msgType === 'image') type = 'image';
    else if (msgType === 'audio' || msgType === 'ptt') type = 'audio';

    // Reset keywords
    const resetWords = ['reset', 'restart', 'change', 'تبدیل', 'بدلو'];
    if (session.step === 'active' && resetWords.some(w => text.includes(w))) {
      Object.assign(session, {
        step: 'new', language: null, replyFormat: null,
        lastMsgType: null, pendingSwitch: null, history: []
      });
      await sendText(from, T.welcome);
      return;
    }

    // NEW USER
    if (session.step === 'new') {
      await sendText(from, T.welcome);
      session.step = 'awaiting_language';
      return;
    }

    // AWAITING LANGUAGE
    if (session.step === 'awaiting_language') {
      const map = {
        '1': 'english', 'english': 'english',
        '2': 'urdu',    'urdu': 'urdu',       'اردو': 'urdu',
        '3': 'punjabi', 'punjabi': 'punjabi',  'پنجابی': 'punjabi',
        '4': 'pashto',  'pashto': 'pashto',   'پښتو': 'pashto',
        '5': 'sindhi',  'sindhi': 'sindhi',   'سنڌي': 'sindhi'
      };
      const chosen = map[text] || map[msgBody];
      if (!chosen) { await sendText(from, t('invalidChoice', 'english')); return; }
      session.language = chosen;
      session.step = 'awaiting_format';
      await sendText(from, t('askFormat', chosen));
      return;
    }

    // AWAITING FORMAT
    if (session.step === 'awaiting_format') {
      if (text === '1') session.replyFormat = 'text';
      else if (text === '2') session.replyFormat = 'voice';
      else { await sendText(from, t('formatError', lang)); return; }
      session.step = 'active';
      await sendText(from, T.confirmed[lang](session.replyFormat));
      return;
    }

    // AWAITING SWITCH CONFIRM
    if (session.step === 'awaiting_switch_confirm') {
      const yes = ['yes','ہاں','ها','هو','y','ok','haan','han'].some(w => text.includes(w));
      const no  = ['no','نہیں','نه','n','nope','nahi','na'].some(w => text.includes(w));
      if (yes) {
        session.replyFormat = session.pendingSwitch;
        session.step = 'active';
        session.pendingSwitch = null;
        await sendText(from, session.replyFormat === 'voice' ? t('switchedVoice', lang) : t('switchedText', lang));
      } else if (no) {
        session.step = 'active';
        session.pendingSwitch = null;
        await sendText(from, t('keptSame', lang));
      } else {
        await sendText(from, session.pendingSwitch === 'voice' ? t('switchToVoice', lang) : t('switchToText', lang));
      }
      return;
    }

    // ACTIVE
    if (session.step === 'active') {
      const switched = await checkModeSwitch(from, type, session);
      if (switched) return;
      session.lastMsgType = type;

      const sysPrompt = getSystemPrompt(lang, session.replyFormat === 'voice');

      // TEXT
      if (type === 'text') {
        const reply = await callAI(sysPrompt, msgBody, null, session.history);
        session.history.push({ role: 'user', content: msgBody });
        session.history.push({ role: 'assistant', content: reply });
        if (session.history.length > 12) session.history = session.history.slice(-12);
        await deliver(from, reply, session);
      }

      // IMAGE
      else if (type === 'image') {
        await sendText(from, t('waiting', lang));
        const mediaUrl = data.media || data.url || '';
        const buffer   = await downloadMedia(mediaUrl);
        const base64   = buffer.toString('base64');
        const reply    = await callAI(
          sysPrompt,
          'Analyze this prescription. List each medicine, what it treats, dosage, when to take it, and warnings.',
          base64,
          session.history
        );
        session.history.push({ role: 'user', content: '[prescription image]' });
        session.history.push({ role: 'assistant', content: reply });
        if (session.history.length > 12) session.history = session.history.slice(-12);
        await deliver(from, reply, session);
      }

      // AUDIO / VOICE NOTE
      else if (type === 'audio') {
        await sendText(from, t('listening', lang));
        const mediaUrl   = data.media || data.url || '';
        const buffer     = await downloadMedia(mediaUrl);
        const langCode   = LANGS[lang]?.whisper;
        const transcript = await transcribeAudio(buffer, langCode);
        if (!transcript) { await sendText(from, t('audioError', lang)); return; }
        const reply = await callAI(sysPrompt, transcript, null, session.history);
        session.history.push({ role: 'user', content: transcript });
        session.history.push({ role: 'assistant', content: reply });
        if (session.history.length > 12) session.history = session.history.slice(-12);
        await deliver(from, reply, session);
      }
    }

  } catch (err) {
    console.error('RxScan Error:', err);
  }
};
```

---

## Now Set Webhook in UltraMsg

1. Go to **UltraMsg dashboard**
2. Click **Settings** in left sidebar
3. Find **"Webhook URL"** field
4. Paste exactly:
```
https://rxxscan-whatsapp.vercel.app/api/whatsapp
