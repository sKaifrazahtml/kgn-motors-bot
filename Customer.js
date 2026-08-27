const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true }, // Format: 919876543210 (without + sign)
  name: { type: String, required: true },
  vehicleNo: { type: String, required: true },
  lastServiceKm: { type: Number, required: true },
  lastServiceDate: { type: String, required: true },
  nextServiceDueKm: { type: Number, required: true }
});

module.exports = mongoose.model('Customer', customerSchema);