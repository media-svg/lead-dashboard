const express = require("express");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATA_FILE = "./leads.json";

const BUSINESS_START = 8;   // 8 AM Pacific
const BUSINESS_END = 17;    // 5 PM Pacific

// ---------------- LOAD / SAVE ----------------

function loadLeads() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));

    return {
      active: data.active || [],
      completed: data.completed || []
    };

  } catch {
    return { active: [], completed: [] };
  }
}

function saveLeads(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---------------- PACIFIC TIME HELPERS ----------------

function toPacific(date) {
  return new Date(
    new Date(date).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles"
    })
  );
}

function getPacificMidnight() {
  const now = new Date();
  const pacificNow = toPacific(now);
  pacificNow.setHours(0, 0, 0, 0);
  return pacificNow.getTime();
}

// ---------------- BUSINESS MINUTES ----------------

function calculateBusinessMinutes(start, end) {
  let totalMinutes = 0;

  let current = new Date(start);
  const endDate = new Date(end);

  while (current < endDate) {

    const pacific = toPacific(current);
    const hour = pacific.getHours();

    if (hour >= BUSINESS_START && hour < BUSINESS_END) {
      totalMinutes++;
    }

    current.setMinutes(current.getMinutes() + 1);
  }

  return totalMinutes;
}

// ---------------- NEW LEAD ----------------

app.post("/new-lead", (req, res) => {
  const data = loadLeads();

  const newLead = {
    contact_id: req.body.contact_id,
    name: req.body.name,
    phone: req.body.phone,
    source: req.body.source || "Unknown Source",
    created_at: Date.now()
  };

  data.active.push(newLead);
  saveLeads(data);

  console.log("New lead:", newLead.name);

  res.json({ success: true });
});

// ---------------- REMOVE LEAD ----------------

app.post("/remove-lead", (req, res) => {
  const data = loadLeads();

  const lead = data.active.find(
    l => l.contact_id === req.body.contact_id
  );

  if (lead) {
    lead.completed_at = Date.now();
    data.completed.push(lead);
  }

  data.active = data.active.filter(
    l => l.contact_id !== req.body.contact_id
  );

  saveLeads(data);

  res.json({ success: true });
});

// ---------------- DASHBOARD DATA ----------------

app.get("/dashboard-data", (req, res) => {
  const data = loadLeads();

  const todayStart = getPacificMidnight();

  // TOTAL LEADS TODAY
  const totalLeadsToday =
    data.active.filter(l => l.created_at >= todayStart).length +
    data.completed.filter(l => l.created_at >= todayStart).length;

  // COMPLETED TODAY (based on completion time)
  const todayCompleted = data.completed.filter(
    l => l.completed_at && l.completed_at >= todayStart
  );

  let avgResponse = 0;

  if (todayCompleted.length > 0) {
    const totalMinutes = todayCompleted.reduce((sum, l) => {
      return sum + calculateBusinessMinutes(
        l.created_at,
        l.completed_at
      );
    }, 0);

    avgResponse = Math.round(totalMinutes / todayCompleted.length);
  }

  res.json({
    active: data.active,
    avgResponse,
    totalLeadsToday
  });
});

// ---------------- DEBUG ROUTE ----------------

app.get("/leads.json", (req, res) => {
  res.json(loadLeads());
});

// ---------------- STATIC FRONTEND ----------------

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
