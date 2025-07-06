require('dotenv').config(); // ✅ Load environment variables first

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const personaRouter = require('./routes/persona');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(morgan('dev'));

app.use('/persona', personaRouter);
app.use('/auth', authRouter);
app.use('/users', usersRouter);

app.get('/', (req, res) => {
  res.send('Onda backend is running 🎶');
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
