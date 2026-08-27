const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Google DNS Fix

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// User session memory (temporary state tracking)
const userState = {};

// MongoDB Schema for Booking
const bookingSchema = new mongoose.Schema({
  phone: String,
  customerName: String,
  vehicleNumber: String,
  serviceType: String,
  status: { type: String, default: 'Received' },
  createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model('Booking', bookingSchema);

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Webhook Verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Incoming Messages Handler
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messageData = changes?.value?.messages?.[0];

    if (messageData) {
      const from = messageData.from;
      let text = '';

      if (messageData.type === 'text') {
        text = messageData.text.body.trim();
      } else if (messageData.type === 'interactive') {
        text = messageData.interactive.button_reply.id;
      }

      console.log(`💬 Message from ${from}: ${text}`);

      await handleUserLogic(from, text);
    }

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Business Logic Router
async function handleUserLogic(from, text) {
  const state = userState[from] || { step: 'IDLE' };
  const lowerText = text.toLowerCase();

  // 1. Initial Greeting / Menu (Updated Garage Name)
  if (lowerText === 'hi' || lowerText === 'hello' || lowerText === 'menu' || text === 'MAIN_MENU') {
    userState[from] = { step: 'IDLE' };
    await sendInteractiveButtons(from, 'Welcome to K.G.N. MOTORS & PARTS! 🚗🔧\nKripya niche diye gaye options me se chunein:');
    return;
  }

  // 2. Button Handlers
  if (text === 'BTN_BOOK') {
    userState[from] = { step: 'AWAITING_NAME' };
    await sendTextMessage(from, '📝 Service Booking:\nKripya apna **Naam** likhkar bhejein:');
    return;
  }

  if (text === 'BTN_STATUS') {
    userState[from] = { step: 'AWAITING_VEHICLE_NO' };
    await sendTextMessage(from, '🔍 Vehicle Status Check:\nApna **Vehicle Number** likhkar bhejein (e.g., MP09AB1234):');
    return;
  }

  // 3. Sequential Form Handling
  if (state.step === 'AWAITING_NAME') {
    userState[from] = { step: 'AWAITING_VEHICLE', name: text };
    await sendTextMessage(from, `Dhanyawad ${text}! Ab apna **Vehicle Number** (e.g. MP09AB1234) bhejein:`);
    return;
  }

  if (state.step === 'AWAITING_VEHICLE') {
    const customerName = state.name;
    const vehicleNo = text.toUpperCase();

    // Save to Database
    const newBooking = new Booking({
      phone: from,
      customerName: customerName,
      vehicleNumber: vehicleNo,
      serviceType: 'General Service'
    });

    await newBooking.save();
    userState[from] = { step: 'IDLE' };

    // Customer ko Confirmation Reply
    await sendTextMessage(from, `✅ **Booking Confirmed!**\n\nGarage: K.G.N. MOTORS & PARTS 🛠️\nName: ${customerName}\nVehicle: ${vehicleNo}\nStatus: Received\n\nHum jald hi aapki gadi inspect karenge!`);

    // 🔔 Aapke Personal WhatsApp Number (918223829866) par Alert Message:
    const ownerNumber = process.env.OWNER_PHONE_NUMBER || '918223829866';
    const ownerAlert = `🚨 **NEW BOOKING ALERT!** 🚗\n\n🏪 **Garage:** K.G.N. MOTORS & PARTS\n👤 **Customer:** ${customerName}\n📞 **Phone:** ${from}\n🚘 **Vehicle:** ${vehicleNo}\n📅 **Time:** ${new Date().toLocaleString()}`;
    
    await sendTextMessage(ownerNumber, ownerAlert);

    return;
  }

  if (state.step === 'AWAITING_VEHICLE_NO') {
    const vehicleNo = text.toUpperCase();
    const booking = await Booking.findOne({ vehicleNumber: vehicleNo }).sort({ createdAt: -1 });

    userState[from] = { step: 'IDLE' };

    if (booking) {
      await sendTextMessage(from, `🚗 **Vehicle Status (K.G.N. MOTORS):**\n\nOwner: ${booking.customerName}\nVehicle: ${booking.vehicleNumber}\nCurrent Status: *${booking.status}*\nDate: ${new Date(booking.createdAt).toLocaleDateString()}`);
    } else {
      await sendTextMessage(from, `❌ Vehicle number **${vehicleNo}** ka koi record nahi mila. Kripya number check karke dubara try karein.`);
    }
    return;
  }

  // Fallback Message
  await sendInteractiveButtons(from, 'Welcome to K.G.N. MOTORS & PARTS! 🚗🔧\nAapki baat samajh nahi aayi. Kripya niche diye option chunnein:');
}

// Helper: Send Text Message
async function sendTextMessage(to, text) {
  try {
    await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v18.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      }
    });
  } catch (error) {
    console.error('❌ Error sending message:', error.response?.data || error.message);
  }
}

// Helper: Send Interactive Reply Buttons
async function sendInteractiveButtons(to, headerText) {
  try {
    await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v18.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: headerText },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'BTN_BOOK', title: '🛠️ Book Service' } },
              { type: 'reply', reply: { id: 'BTN_STATUS', title: '📋 Check Status' } }
            ]
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ Error sending buttons:', error.response?.data || error.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));