const express = require("express");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATA_FILE = "./leads.json";

// Load leads from file
function loadLeads() {
  try {
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// Save leads to file
function saveLeads(leads) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2));
}

// GET all leads
app.get("/leads", (req, res) => {
  const leads = loadLeads();
  res.json(leads);
});

// NEW LEAD
app.post("/new-lead", (req, res) => {
  const leads = loadLeads();

  const newLead = {
    contact_id: req.body.contact_id,
    name: req.body.name,
    phone: req.body.phone,
    source: req.body.source || "Unknown Source",
    created_at: Date.now()
  };

  leads.push(newLead);
  saveLeads(leads);

  res.status(200).json({ success: true });
});

// REMOVE LEAD
app.post("/remove-lead", (req, res) => {
  let leads = loadLeads();

  leads = leads.filter(
    lead => lead.contact_id !== req.body.contact_id
  );

  saveLeads(leads);

  res.status(200).json({ success: true });
});

// Serve frontend
app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
