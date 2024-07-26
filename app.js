require("dotenv").config(); // Load environment variables from .env file
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");


const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.EMAIL_PASSWORD,
  }
});

app.use(cors());
app.use(bodyParser.json());

const threadTimeouts = {};

app.get("/", async (req, res) => {
  res.send('working...');
});

app.get("/start", async (req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    setThreadTimeout(thread.id);
    res.json({ thread_id: thread.id });
  } catch (error) {
    console.error("Error creating thread:", error);
    res.status(500).json({ error: "Failed to create thread" });
  }
});

app.post("/chat", async (req, res) => {
  const assistantId = process.env.ASSISTANT_ID;
  console.log('threadTimeouts: ', threadTimeouts);
  const { thread_id: threadId, message } = req.body;

  if (!threadId) {
    return res.status(400).json({ error: "Missing thread_id" });
  }

  try {
    console.log(`Received message: ${message} for thread ID: ${threadId}`);
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: assistantId,
    });
    const messages = await openai.beta.threads.messages.list(run.thread_id);
    const response = messages.data[0].content[0].text.value;

    resetThreadTimeout(threadId);

    console.log('Assistant response: ', response);
    res.json({ response });
  } catch (error) {
    console.error("Error handling chat:", error);
    res.status(500).json({ error: "Failed to process chat" });
  }
});

function setThreadTimeout(threadId) {
  threadTimeouts[threadId] = setTimeout(async () => {
    const messages = await openai.beta.threads.messages.list(threadId);
    await sendEmail(threadId, messages);
    delete threadTimeouts[threadId];
  }, 300000); // 5 minutes in milliseconds
}

function resetThreadTimeout(threadId) {
  clearTimeout(threadTimeouts[threadId]);
  setThreadTimeout(threadId);
}

async function sendEmail(threadId, messages) {
  const emailBody = formatMessages(threadId, messages.data);
  const lastMessageDate = new Date(messages.data[messages.data.length - 1].created_at * 1000);
  const formattedDate = lastMessageDate.toLocaleDateString();

  await emailTransporter.sendMail({
    from: process.env.EMAIL_ADDRESS,
    to: process.env.EMAIL_ADDRESS, // Ensure this is defined in your .env or elsewhere in your script
    subject: `New Chat History from ${formattedDate}`,
    text: emailBody
  });
}


function formatMessages(threadId, messages) {
  // Add a new line between different messages for clarity
  return messages.reverse().map(msg => {
    const role = msg.role === "user" ? "User" : "Assistant";
    const text = msg.content[0].text.value;
    return `${role}: ${text}`;
  }).join('\n\n'); // Two new lines for more space between messages
}
port = 8080;

app.listen(port, () => {
  console.log("Server running on port 8080");
});
