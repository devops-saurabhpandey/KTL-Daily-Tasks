const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "ktl_daily_tasks";
const OUTLETS = ["Ramadevi","Chunniganj","Keshav Nagar","Kannauj","Shivraj pur","Bilhaur","Unnao","Fatehpur"];
let tasks;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWhatsAppNumber(value) {
  let digits = String(value || "").replace(/\\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}

async function sendRcReceivedWhatsApp(task) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_RC_TEMPLATE_NAME;
  if (!phoneNumberId || !accessToken || !templateName) {
    console.warn("RC WhatsApp notification skipped: WhatsApp Cloud API environment variables are not configured.");
    return { sent: false, reason: "not_configured" };
  }
  const to = normalizeWhatsAppNumber(task.phone);
  if (!to || to.length < 10) {
    console.warn("RC WhatsApp notification skipped: customer phone number is missing or invalid.");
    return { sent: false, reason: "invalid_phone" };
  }
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_RC_TEMPLATE_LANGUAGE || "en" },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: clean(task.customerName) || "Customer" },
            { type: "text", text: clean(task.vehicleNumber) || "your vehicle" }
          ]
        }]
      }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("WhatsApp RC notification failed:", JSON.stringify(result));
    return { sent: false, reason: "provider_error" };
  }
  console.log("RC WhatsApp notification accepted by Meta for task", String(task._id));
  return { sent: true };
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "KTL Daily Tasks", database: tasks ? "connected" : "not_configured_or_disconnected" });
});

app.get("/api/tasks", async (req, res) => {
  try {
    if (!tasks) return res.status(503).json({ error: "Database is not connected. Set MONGODB_URI in deployment environment." });
    const q = clean(req.query.q);
    const filter = q ? {
      $or: [
        { customerName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
        { phone: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
        { chassisNumber: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
        { vehicleNumber: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
      ]
    } : {};
    const rows = await tasks.find(filter).sort({ createdAt: -1 }).limit(500).toArray();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Unable to load tasks." }); }
});

app.post("/api/tasks", async (req, res) => {
  try {
    if (!tasks) return res.status(503).json({ error: "Database is not connected. Set MONGODB_URI." });
    const customerName = clean(req.body.customerName);
    const executiveName = clean(req.body.executiveName);
    const outlet = clean(req.body.outlet);
    const phone = clean(req.body.phone);
    const chassisNumber = clean(req.body.chassisNumber);
    const engineNumber = clean(req.body.engineNumber);
    const vehicleNumber = clean(req.body.vehicleNumber).toUpperCase();
    const vehicleType = clean(req.body.vehicleType) || "Private";
    if (!["Private", "Commercial"].includes(vehicleType)) return res.status(400).json({ error: "Please select Private or Commercial vehicle." });
    const exShowroomPrice = Number(req.body.exShowroomPrice ?? 0);
    if (!Number.isFinite(exShowroomPrice) || exShowroomPrice < 0) return res.status(400).json({ error: "Ex-showroom price must be a valid non-negative number." });
    const taxAmount = Number(req.body.taxAmount ?? 0);
    const penalty = Number(req.body.penalty ?? 0);
    if (!Number.isFinite(taxAmount) || taxAmount < 0 || !Number.isFinite(penalty) || penalty < 0) return res.status(400).json({ error: "Tax amount and penalty must be valid non-negative numbers." });
    const taskDateInput = clean(req.body.taskDate);
    const taskDate = taskDateInput && /^\d{4}-\d{2}-\d{2}$/.test(taskDateInput) ? new Date(taskDateInput + "T00:00:00.000Z") : new Date();
    if (!customerName) return res.status(400).json({ error: "Customer name is required." });
    if (!executiveName) return res.status(400).json({ error: "Executive name is required." });
    if (!OUTLETS.includes(outlet)) return res.status(400).json({ error: "Please select a valid outlet." });
    const now = new Date();
    const item = {
      customerName, executiveName, outlet, exShowroomPrice, taxAmount, penalty, phone, chassisNumber, engineNumber, vehicleNumber, vehicleType, taskDate,
      numberPlateStatus: req.body.numberPlateStatus === "Received" ? "Received" : "Pending",
      rcStatus: req.body.rcStatus === "Received" ? "Received" : "Pending",
      createdAt: now, updatedAt: now
    };
    const result = await tasks.insertOne(item);
    res.status(201).json({ ...item, _id: result.insertedId });
  } catch (e) { res.status(500).json({ error: "Unable to save task." }); }
});

app.patch("/api/tasks/:id", async (req, res) => {
  try {
    if (!tasks) return res.status(503).json({ error: "Database is not connected. Set MONGODB_URI." });
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid task ID." });
    const taskId = new ObjectId(req.params.id);
    const existing = await tasks.findOne({ _id: taskId });
    if (!existing) return res.status(404).json({ error: "Task not found." });
    const update = {};
    for (const key of ["customerName", "executiveName", "outlet", "phone", "chassisNumber", "engineNumber", "vehicleNumber", "vehicleType"]) {
      if (typeof req.body[key] === "string") update[key] = clean(req.body[key]);
    }
    if (typeof req.body.taskDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.taskDate)) update.taskDate = new Date(req.body.taskDate + "T00:00:00.000Z");
    if (req.body.exShowroomPrice !== undefined) { const amount = Number(req.body.exShowroomPrice); if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Ex-showroom price must be a valid non-negative number." }); update.exShowroomPrice = amount; }
    for (const key of ["taxAmount", "penalty"]) { if (req.body[key] !== undefined) { const amount = Number(req.body[key]); if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Tax amount and penalty must be valid non-negative numbers." }); update[key] = amount; } }
    for (const key of ["numberPlateStatus", "rcStatus"]) {
      if (["Received", "Pending"].includes(req.body[key])) update[key] = req.body[key];
    }
    if (update.outlet !== undefined && !OUTLETS.includes(update.outlet)) return res.status(400).json({ error: "Please select a valid outlet." });
    if (update.vehicleType !== undefined && !["Private", "Commercial"].includes(update.vehicleType)) return res.status(400).json({ error: "Please select Private or Commercial vehicle." });
    if (update.vehicleNumber) update.vehicleNumber = update.vehicleNumber.toUpperCase();
    update.updatedAt = new Date();
    await tasks.updateOne({ _id: taskId }, { $set: update });
    let whatsapp = { sent: false, reason: "not_rc_transition" };
    if (existing.rcStatus !== "Received" && update.rcStatus === "Received") {
      try {
        whatsapp = await sendRcReceivedWhatsApp({ ...existing, ...update, _id: taskId });
      } catch (err) {
        console.error("WhatsApp RC notification error:", err.message);
        whatsapp = { sent: false, reason: "send_error" };
      }
    }
    res.json({ success: true, whatsapp });
  } catch (e) { res.status(500).json({ error: "Unable to update task." }); }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

async function start() {
  if (MONGODB_URI) {
    const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    tasks = client.db(DB_NAME).collection("tasks");
    await tasks.createIndex({ createdAt: -1 });
    console.log("MongoDB connected");
  } else {
    console.warn("MONGODB_URI is not set; API will report database unavailable.");
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`KTL Daily Tasks listening on ${PORT}`));
}
start().catch(err => { console.error("Startup failed:", err.message); process.exit(1); });