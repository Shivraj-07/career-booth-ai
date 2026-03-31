const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");
const fetch = require("node-fetch");
const PDFDocument = require("pdfkit");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

/* ================= AI REPORT ROUTE ================= */
/* ================= AI REPORT ROUTE ================= */
app.post("/analyze", async (req, res) => {
  const { answers } = req.body;

  const prompt = `
You are a career guidance AI.

Based on these answers:
${answers}

Give:
1. 3 career options
2. Skills required
3. Step-by-step roadmap
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();

    console.log("AI RESPONSE:", data);

    const result = data.choices?.[0]?.message?.content || "No response";

    res.json({ result });

  } catch (err) {
    console.log("AI ERROR:", err);
    res.status(500).send("AI failed");
  }
});

/* ================= SMART NEXT QUESTION ================= */
app.post("/next-question", async (req, res) => {
  const { previousAnswers = [], previousQuestions = [] } = req.body;

const formattedAnswers = previousAnswers
  .map((a, i) => `Answer ${i + 1}: ${a}`)
  .join("\n");

  console.log("REQ BODY:", req.body);

  const prompt = `
You are an intelligent career guidance AI.

You are interviewing a student to understand their personality, interests, and strengths.

Here are their previous answers:
${formattedAnswers}

Previous questions:
${previousQuestions?.join("\n")}

Now ask the NEXT best question.

STRICT RULES:
- Ask ONLY ONE question
- Do NOT repeat any previous questions
- Each question must be DIFFERENT
- Avoid generic questions like "tell me more about yourself"
- Make it specific (skills, interests, goals, personality)
- Keep it short (1 line)
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.9
      })
    });

    const data = await response.json();

    let question; // ✅ declare first

    try {
      if (data.choices && data.choices.length > 0) {
        const msg = data?.choices?.[0]?.message;

        if (typeof msg === "string") {
          question = msg;
        } else if (msg?.content) {
          question = msg.content;
        }
      }

      if (!question || question.length < 10) {
        question = "What subjects do you enjoy the most?";
      }

      question = question.trim();
      // 🔥 HARD ANTI-REPEAT CHECK
if (previousQuestions) {
  const isSimilar = previousQuestions.some(q =>
    q.toLowerCase().slice(0, 20) === question.toLowerCase().slice(0, 20)
  );

  if (isSimilar) {
    const fallbackQuestions = [
      "What type of work environment do you prefer?",
      "Do you enjoy working with technology or people more?",
      "What motivates you to work hard?",
      "What are your long-term goals?",
      "Do you prefer practical or theoretical work?",
      "What kind of challenges excite you?",
      "Do you enjoy leadership roles?",
      "How do you handle failure or setbacks?"
    ];

    question =
      fallbackQuestions[
        previousAnswers.length % fallbackQuestions.length
      ];
  }
}

    } catch (e) {
      console.log("Parsing error:", e);
      question = "What subjects do you enjoy the most?";
    }

    // 🔥 fallback anti-repeat
    if (
      !question ||
      question.length < 10 ||
      question.toLowerCase().includes("tell me more")
    ) {
      const fallbackQuestions = [
        "What subjects do you enjoy the most and why?",
        "Do you prefer working alone or in a team?",
        "What are your strongest skills?",
        "What kind of problems do you enjoy solving?",
        "What are your career goals?",
        "Do you enjoy technical or creative work more?",
        "What motivates you the most?",
        "What are your weaknesses?",
        "What type of work environment do you prefer?",
        "Do you like working with people, data, or machines?"
      ];

      question =
        fallbackQuestions[previousAnswers.length % fallbackQuestions.length];
    }

    // ✅ log AFTER assignment
    console.log("QUESTION TEXT:", question);

    res.json({ question });

  } catch (err) {
    console.log(err);
    res.status(500).send("Error generating question");
  }
});

/* ================= PDF DOWNLOAD ================= */
app.post("/download-pdf", (req, res) => {
  const { report = "No report generated", name = "User" } = req.body;

  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=Career_Report_${name}.pdf`
  );

  doc.pipe(res);

  /* ===== HEADER ===== */
  doc
    .rect(0, 0, doc.page.width, 100)
    .fill("#518ECA");
    const path = require("path");

const logoPath = path.join(__dirname, "public/logo.png");

try {
  doc.image(logoPath, 450, 20, { width: 50 });
} catch (e) {
  console.log("Logo not found, skipping...");
}

  doc
    .fillColor("white")
    .fontSize(24)
    .text("Career Booth AI", 50, 40);

  doc
    .fontSize(12)
    .text("Personalized Career Guidance Report", 50, 70);

  /* ===== USER NAME ===== */
  doc
    .fillColor("#333")
    .fontSize(14)
    .text(`Prepared for: ${name}`, 50, 120);

  doc.moveDown(2);

  /* ===== DIVIDER ===== */
  doc
    .moveTo(50, doc.y)
    .lineTo(550, doc.y)
    .stroke("#1E40AF");

  doc.moveDown();

  /* ===== FORMAT REPORT ===== */
  const lines = report.split("\n");

  lines.forEach((line) => {
    if (
  line.toLowerCase().includes("career") ||
  line.toLowerCase().includes("skills") ||
  line.toLowerCase().includes("roadmap")
) {
  doc.moveDown();

  // 🎨 BOX BACKGROUND
  doc
    .roundedRect(45, doc.y - 5, 510, 30, 8)
    .fill("#FDE8E4");

  // 🧾 HEADING TEXT
  doc
    .fillColor("#1E40AF")
    .fontSize(16)
    .text(line, 55, doc.y - 25);

  doc.moveDown(1);

    } else {
      // NORMAL TEXT
      doc
        .fontSize(12)
        .fillColor("#444")
        .text(line, {
          lineGap: 6
        });
    }
  });

  doc.moveDown(2);

  /* ===== FOOTER ===== */
  doc
    .fontSize(10)
    .fillColor("gray")
    
    .text(
      "Generated by Career Booth AI • Smart Career Guidance System",
      50,
      
      doc.page.height - 50,
      { align: "center" }
    );

  doc.end();
});

/* ================= EMAIL ================= */
app.post("/send-email", async (req, res) => {
  const { email, report } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Career Guidance Report",
      text: report
    });

    res.send("Email sent successfully");
  } catch (err) {
    console.log("EMAIL ERROR:", err);
    res.status(500).send("Email sending failed");
  }
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});