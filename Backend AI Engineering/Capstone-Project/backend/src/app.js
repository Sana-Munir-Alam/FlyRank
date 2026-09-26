const express = require('express');
const session = require('express-session');
const env = require('./config/env');
const connectPgSimple = require('connect-pg-simple');
const helmet = require('helmet');

const pool = require('./config/database');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

const PgSession = connectPgSimple(session);

app.use(helmet());
app.use(express.json({ limit: '100kb' }));

app.use(
  session({
    store: new PgSession({
        pool,
        tableName: 'sessions',
    }),
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  })
);

app.use(routes);

app.use(errorHandler);

module.exports = app;