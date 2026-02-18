const express = require("express");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATA_FILE = "./leads.json";

const BUSINESS_START = 8;   // 8 AM Pacific
const BUSINESS_END = 17;    // 5 PM Pacific (17 = 5PM)

// ---------------- LOAD / SAVE ----------------

function loadLeads() {
  try {
    const raw = fs.readFileSync(DATA_FILE);
    const data = JSON.parse(raw);

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
  const pacificNow = toPacific(new Date());
  pacificNow.setHours(0, 0, 0, 0);
  return pacificNow.getTime();
}

// ---------------- BUSINESS MINUTES ENGINE ----------------

function calculateBusinessMinutes(start, end) {
  let totalMinutes = 0;

  let current = new Date(start);
  const endDate = new Date(end);

  while (current < endDate) {

    const pacific = toPacific(current);
    const hour = pacific.getHours();
    const day = pacific.getDay(); // 0 = Sunday, 6 = Saturday

    const isWeekend = (day === 0 || day === 6);
    const isBusinessHour = hour >= BUSINESS_START && hour < BUSINESS_END;

    if (!isWeekend && isBusinessHour) {
      totalMinutes++;
    }

    current.setMinutes(current.getMinutes() + 1);
  }

  return totalMinutes;
}

// ---------------- FORMAT BUSINESS DURATION ----------------

function formatBusinessDuration(totalMinutes) {

  const BUSINESS_MINUTES_PER_DAY = (BUSINESS_END - BUSINESS_START) * 60;

  const days = Math.floor(totalMinutes / BUSINESS_MINUTES_PER_DAY);
  const remainingAfterDays = totalMinutes % BUSINESS_MINUTES_PER_DAY;

  const hours = Math.floor(remainingAfterDays / 60);
  const minutes = remainingAfterDays % 60;

  let parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(" ");
}

function getBusinessMinutesUntilNow(start) {
  return calculateBusinessMinutes(start, Date.now());
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

  const leadIndex = data.active.findIndex(
    l => l.contact_id === req.body.contact_id
  );

  if (leadIndex !== -1) {
    const lead = data.active[leadIndex];

    lead.completed_at = Date.now();

    data.completed.push(lead);
    data.active.splice(leadIndex, 1);

    saveLeads(data);
  }

  res.json({ success: true });
});

// ---------------- DASHBOARD DATA ----------------

app.get("/dashboard-data", (req, res) => {

  const data = loadLeads();
  const todayStart = getPacificMidnight();

  // ---------- TOTAL LEADS TODAY ----------
  const totalLeadsToday =
    data.active.filter(l => l.created_at >= todayStart).length +
    data.completed.filter(l => l.completed_at >= todayStart).length;

  // ---------- COMPLETED TODAY ----------
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

  // ---------- ACTIVE LEADS WITH BUSINESS WAITING ----------
  const activeWithWaiting = data.active.map(lead => {

    const minutes = getBusinessMinutesUntilNow(lead.created_at);

    return {
      ...lead,
      waitingMinutes: minutes,
      waitingLabel: formatBusinessDuration(minutes)
    };
  });

  res.json({
    active: activeWithWaiting,
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
