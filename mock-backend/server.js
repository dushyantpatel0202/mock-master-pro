require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors()); // Allows your frontend at port 5500 to talk to this server
app.use(express.json());

// 1. MongoDB Connection
// Replace 'mockmaster' with your preferred database name
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mockmaster';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ Connection error:', err));

// 2. Question Schema & Model
// Based on your questions.json structure
const questionSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    subject: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correct: { type: Number, required: true }
});

const Question = mongoose.model('Question', questionSchema);

// 3. API Routes

// GET: Fetch all questions for the test
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await Question.find().sort({ id: 1 });
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

// POST: Seed endpoint to render your JSON into MongoDB
app.post('/api/seed', async (req, res) => {
    try {
        const data = require('./questions.json'); // Place your file in the backend folder
        await Question.deleteMany({}); // Optional: Clears collection before re-seeding
        await Question.insertMany(data);
        res.status(201).json({ message: `${data.length} questions rendered successfully!` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
// 1. Define the Result Schema
const resultSchema = new mongoose.Schema({
    score: Number,
    correct: Number,
    wrong: Number,
    totalQuestions: Number,
    percentage: String,
    timeTaken: String,
    date: { type: Date, default: Date.now }
});

const Result = mongoose.model('Result', resultSchema);

// 2. Create the POST Route to save results
app.post('/api/results', async (req, res) => {
    try {
        const newResult = new Result(req.body);
        await newResult.save();
        res.status(201).json({ message: 'Score saved to MongoDB!' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save result' });
    }
});