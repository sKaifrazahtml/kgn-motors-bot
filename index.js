const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// 1. ENVIRONMENT VARIABLES
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const OWNER_PHONE_NUMBER = process.env.OWNER_PHONE_NUMBER; // Aapka personal number

// User state tracker (temporary memory)
const userStates = {};

// 2. HELPER FUNCTIONS

// Standard WhatsApp Text Message
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

// Interactive List Menu (Naya Simplified Menu)
async function sendMainMenu(to) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: 'K.G.N. MOTORS & PARTS' },
          body: { text: 'Namaste! K.G.N. Motors me aapka swagat hai. Kripya niche diye gaye options me se chunein:' },
          footer: { text: 'Select an option below' },
          action: {
            button: 'Menu Options 🛠️',
            sections: [
              {
                title: 'Main Services',
                rows: [
                  { id: 'book_service', title: '📅 Book Service', description: 'Gadi ki service ya repair slot book karein' },
                  { id: 'choose_work', title: '🔧 Kaun Sa Kaam Karwana Hai', description: 'Gadi ke kaam ki detail chunein ya batayein' },
                  { id: 'service_reminder', title: '⏰ Service Reminder', description: 'Agli service ka reminder set karein' }
                ]
              }
            ]
          }
        }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
  } catch (err) {
    console.error('Error sending Interactive List Menu:', err.response?.data || err.message);
  }
}

// 3. WEBHOOK VERIFICATION
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 4. WEBHOOK MESSAGE HANDLER
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message) {
      const from = message.from; // Customer ka number
      const state = userStates[from] || 'IDLE';

      // Interactive List Menu Selection Handle Karein
      if (message.type === 'interactive') {
        const selectedId = message.interactive?.list_reply?.id;

        if (selectedId === 'book_service') {
          userStates[from] = 'WAITING_FOR_BOOKING_DETAILS';
          await sendTextMessage(from, "📅 *Service Booking:*\n\nKripya apni Gadi ka Number aur Date batayein.\n*Example:* MP17AB1234 - 15 Sept 10 AM");
        } else if (selectedId === 'choose_work') {
          userStates[from] = 'WAITING_FOR_WORK_DETAILS';
          await sendTextMessage(from, "🔧 *Kaun Sa Kaam Karwana Hai:*\n\nKripya gadi me jo kaam karwana hai wo likh kar bhejein.\n*Example:* Oil change, Brakes check, Engine tuning, etc.");
        } else if (selectedId === 'service_reminder') {
          userStates[from] = 'WAITING_FOR_REMINDER_DETAILS';
          await sendTextMessage(from, "⏰ *Service Reminder Setup:*\n\nApni gadi ka number aur aakhri service ki date batayein taaki hum aapko agle service ka reminder bhej sakein.\n*Example:* MP17AB1234 - Last serviced 1 Month ago");
        }
      } 
      // Text Messages Handle Karein
      else if (message.type === 'text') {
        const userText = message.text.body.trim();

        if (state === 'WAITING_FOR_BOOKING_DETAILS') {
          await sendTextMessage(from, "✅ Dhanyawad! Aapki service booking request mil gayi hai. Hum jald hi confirm karenge.");
          
          // Personal WhatsApp Par Detail Bhejna
          if (OWNER_PHONE_NUMBER) {
            const alertMsg = `🔔 *NEW SERVICE BOOKING REQUEST*\n\n📱 *Customer Number:* +${from}\n📋 *Details:* ${userText}`;
            await sendTextMessage(OWNER_PHONE_NUMBER, alertMsg);
          }
          userStates[from] = 'IDLE';

        } else if (state === 'WAITING_FOR_WORK_DETAILS') {
          await sendTextMessage(from, "👍 Aapke bataye gaye kaam ko note kar liya gaya hai. Garage team aapse sampark karegi.");

          // Personal WhatsApp Par Detail Bhejna
          if (OWNER_PHONE_NUMBER) {
            const alertMsg = `🔔 *NEW WORK REQUIREMENT*\n\n📱 *Customer Number:* +${from}\n🔧 *Kaam ki Detail:* ${userText}`;
            await sendTextMessage(OWNER_PHONE_NUMBER, alertMsg);
          }
          userStates[from] = 'IDLE';

        } else if (state === 'WAITING_FOR_REMINDER_DETAILS') {
          await sendTextMessage(from, "⏰ Dhanyawad! Service reminder set kar diya gaya hai.");

          // Personal WhatsApp Par Detail Bhejna
          if (OWNER_PHONE_NUMBER) {
            const alertMsg = `🔔 *NEW SERVICE REMINDER SET*\n\n📱 *Customer Number:* +${from}\n🚘 *Vehicle Info:* ${userText}`;
            await sendTextMessage(OWNER_PHONE_NUMBER, alertMsg);
          }
          userStates[from] = 'IDLE';

        } else {
          // Default Menu Bhejna
          await sendMainMenu(from);
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});