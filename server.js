const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

let activeLeads = [];

/**
 * ADD LEAD
 * Called when opportunity is created in LEADS stage
 */
app.post('/new-lead', (req, res) => {
  const { contact_id, name, phone } = req.body;

  // Prevent duplicates
  const exists = activeLeads.find(l => l.contact_id === contact_id);
  if (!exists) {
    activeLeads.push({
      contact_id,
      name,
      phone,
      created_at: Date.now()
    });
  }

  res.sendStatus(200);
});

/**
 * REMOVE LEAD
 * Called when moved to FIRST CALL stage
 */
app.post('/remove-lead', (req, res) => {
  const { contact_id } = req.body;

  activeLeads = activeLeads.filter(
    lead => lead.contact_id !== contact_id
  );

  res.sendStatus(200);
});

/**
 * GET ACTIVE LEADS (for dashboard)
 */
app.get('/leads', (req, res) => {
  res.json(activeLeads);
});

/**
 * Serve Dashboard Frontend
 */
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
