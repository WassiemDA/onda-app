const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
require('dotenv').config();

const authRouter = require('./routes/auth');
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

// Middleware
app.use(cors()); // Enable CORS
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// app.use(express.static(path.join(__dirname, 'public'))); // Optional static folder

// Routes
app.use('/', authRouter);
app.use('/', indexRouter);
app.use('/users', usersRouter);

module.exports = app;
