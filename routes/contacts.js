const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');

// POST /api/contacts - Submit a new contact message
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message, phone } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !subject || !message) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Create new contact
    const newContact = new Contact({
      firstName,
      lastName,
      email,
      subject,
      message,
      phone: phone || ''
    });

    const savedContact = await newContact.save();
    res.status(201).json({ 
      message: 'Contact message submitted successfully',
      contact: savedContact 
    });
  } catch (error) {
    console.error('Error submitting contact message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/contacts - Get all contact messages (for admin dashboard)
router.get('/', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({ contacts });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
