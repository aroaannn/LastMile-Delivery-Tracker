require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const zoneRoutes = require('./routes/zone.routes');
const rateCardRoutes = require('./routes/rateCard.routes');
const orderRoutes = require('./routes/order.routes');
const agentRoutes = require('./routes/agent.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.use(cors({
  origin: 'http://localhost:5173', // Replace with your exact frontend URL
  credentials: true 
}));

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api', zoneRoutes);
app.use('/api', rateCardRoutes);
app.use('/api', orderRoutes);
app.use('/api', agentRoutes);
app.use('/api', adminRoutes);

// Central error handler - catches anything thrown/rejected in routes that
// wasn't already handled with its own try/catch.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Last-Mile Delivery Tracker API listening on port ${PORT}`);
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
module.exports = app;