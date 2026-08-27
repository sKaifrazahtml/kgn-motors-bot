const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Google DNS force karne ke liye

require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('./Customer');

// Connection logic start...
mongoose.connect(process.env.MONGO_URI)
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connecting to MongoDB...');
    
    // Purana test data delete karke naya add karein
    await Customer.deleteMany({});

    await Customer.create({
      phone: '918223829866', // 👈 Yahan apna personal WhatsApp number daalein (With 91)
      name: 'Kaif',
      vehicleNo: 'MP09AB1234',
      lastServiceKm: 45000,
      lastServiceDate: '2026-08-10',
      nextServiceDueKm: 50000
    });

    console.log('✅ Test Customer Successfully Added!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });