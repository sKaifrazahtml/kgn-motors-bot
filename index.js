const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

// -------------------------------------------------------------
// 1. ENVIRONMENT VARIABLES & AI INITIALIZATION
// -------------------------------------------------------------
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Gemini AI Client Setup
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// -------------------------------------------------------------
// 2. HELPER FUNCTIONS
// -------------------------------------------------------------

// Helper 1: Send Standard WhatsApp Text Message
async function sendTextMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
  } catch (err) {
    console.error('Error sending text message:', err.response?.data || err.message);
  }
}

// Helper 2: Send Interactive Main Menu Buttons
async function sendMainMenu(to) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: "Welcome to *K.G.N. MOTORS & PARTS*! 🛠️\n\nAapki kya madad kar sakte hain? Niche diye gaye options me se choose karein:"
          },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'btn_parts', title: '🔩 Parts Inquiry' } },
              { type: 'reply', reply: { id: 'btn_booking', title: '🛠️ Book Service' } },
              { type: 'reply', reply: { id: 'btn_ai_help', title: '🤖 Ask AI Mechanic' } }
            ]
          }
        }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
  } catch (err) {
    console.error('Error sending Interactive Buttons:', err.response?.data || err.message);
  }
}

// Helper 3: Gemini AI Response Generator
async function getGeminiResponse(userPrompt) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are an expert automotive mechanic assistant for K.G.N. MOTORS & PARTS. Answer the customer's vehicle problem briefly and accurately in simple Hindi/Hinglish: ${userPrompt}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error("Gemini AI Error:", err);
    return "Maaf kijiye, abhi AI assistant response nahi de pa raha hai. Kripya thodi der baad prayas karein.";
  }
}

// -------------------------------------------------------------
// 3. WEBHOOK ROUTES
// -------------------------------------------------------------

// Meta Webhook Verification Endpoint (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Incoming WhatsApp Event Handler Endpoint (POST)
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object) {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const msgType = message.type;

      console.log(`💬 Message received from ${from} [Type: ${msgType}]`);

      // 1. Handle Button Clicks
      if (msgType === 'interactive') {
        const buttonId = message.interactive.button_reply.id;

        if (buttonId === 'btn_parts') {
          await sendTextMessage(from, "🔩 **Spare Parts Query:**\nAapko kis gadi ka part chahiye? (e.g., *Bolero BS6 Injector*, *Jeeto Clutch Plate*)");
        } else if (buttonId === 'btn_booking') {
          await sendTextMessage(from, "🛠️ **Service Booking:**\nApni vehicle ka number aur issue type batayein:\nExample: *MP09AB1234 - Oil Change & General Service*");
        } else if (buttonId === 'btn_ai_help') {
          await sendTextMessage(from, "🤖 **AI Mechanic Helpline Active!**\nApni gadi ki dikkat batayein (e.g., *Bolero starting problem with black smoke*):");
        }
      } 
      // 2. Handle Photo/Image Uploads
      else if (msgType === 'image') {
        await sendTextMessage(from, "📷 Part ki photo mil gayi hai! Humare mechanic ise review karke aapko jald update denge.");
      } 
      // 3. Handle Normal Text Messages
      else if (msgType === 'text') {
        const text = message.text.body.trim();

        if (['hi', 'hello', 'menu', 'start', 'help'].includes(text.toLowerCase())) {
          await sendMainMenu(from);
        } else {
          const aiReply = await getGeminiResponse(text);
          await sendTextMessage(from, `🤖 *AI Suggestion:*\n${aiReply}`);
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// -------------------------------------------------------------
// 4. SERVER LISTEN
// -------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});