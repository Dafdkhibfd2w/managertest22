// server.js
require('dotenv').config();

const express       = require('express');
const path = require("path");
const cookieParser  = require('cookie-parser');
const bodyParser    = require('body-parser');
const mongoose      = require('mongoose');
const multer        = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { connectMongoose } = require('./db');
const bcrypt = require('bcrypt');
// ===== Models =====
const { requireAuth } = require("./public/middlewares/auth");

const Dispersal  = require('./models/Dispersal');
const Supplier   = require('./models/Supplier');
const Task = require("./models/Task");
const DailyOrder = require('./models/DailyOrder');
const Invoice    = require('./models/Invoice'); // ודא נתיב נכון אצלך
const Shift = require('./models/Shift');
const helmet        = require('helmet');
const rateLimit     = require('express-rate-limit');
const hpp           = require('hpp');
const cors          = require('cors');
const { z }         = require('zod');
const csrf          = require('csurf');
const FileType      = require('file-type');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const CLOUD_FOLDER = process.env.CLOUDINARY_FOLDER || 'invoices';
const SECRET = process.env.JWT_SECRET || "supersecret";
const isProd = process.env.NODE_ENV === 'production';
// ===== Utils =====
function isAllowedMime(m) {
  return ['image/jpeg','image/png','image/webp','application/pdf'].includes(m);
}

// ===== App =====
const app  = express();
const PORT = process.env.PORT || 6000;
app.use(cookieParser());

// ===== Middlewares =====
app.post('/upload-invoice', requireAuth(), upload.single('file'), async (req, res) => {
  try {
    const date = (req.body?.date || '').trim();
    const supplier = (req.body?.supplier || '').trim();
    const f = req.file;

    if (!date || !supplier || !f) {
      return res.status(400).json({ ok:false, message:'חסר date / supplier / קובץ' });
    }

    const fileType = require("file-type");

    async function detectFileType(buffer) {
      if (fileType.fileTypeFromBuffer) {
        // גרסה חדשה (v17+)
        return await fileType.fileTypeFromBuffer(buffer);
      }
      if (fileType.fromBuffer) {
        // גרסה ישנה (v16-)
        return await fileType.fromBuffer(buffer);
      }
      throw new Error("❌ file-type לא נתמך בגרסה הזאת");
    }

    // 🟢 כאן היה חסר – לקרוא לפונקציה
    const type = await detectFileType(f.buffer);

    if (!type || !isAllowedMime(type.mime)) {
      return res.status(400).json({ ok:false, message:'קובץ לא מאומת' });
    }

    const folder = `${CLOUD_FOLDER}/shifts/${date}/${encodeURIComponent(supplier)}`;

    // 🟢 העלאה ל-Cloudinary עם הבטחה
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (err, res) => {
          if (err) return reject(err);
          resolve(res);
        }
      );
      stream.end(f.buffer);
    });

    // 🟢 יצירת הרשומה במסד
    const row = await Invoice.create({
      shiftDate:   date,
      supplier,
      url:         result.secure_url,
      publicId:    result.public_id,
      resourceType:result.resource_type,
      format:      result.format,
      bytes:       result.bytes,
      width:       result.width,
      height:      result.height,
      originalName:f.originalname,
      uploadedBy:  req.user?.name || "system"
    });

    res.json({ ok:true, message:'החשבונית הועלתה בהצלחה', invoice: row });

  } catch (e) {
    console.error('upload-invoice error:', e);
    res.status(500).json({ ok:false, message:'שגיאה בהעלאת חשבונית' });
  }
});

const session = require("express-session");
app.use(session({
  secret: process.env.SESSION_SECRET || "secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // אם תריץ ב-https תשנה ל-true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public', {
  maxAge: 0,            // לא לשמור ב־cache
  etag: false,          // לא להחזיר ETag
  lastModified: false   // לא להשתמש בתאריך עדכון
}));
app.set('trust proxy', 1);
app.disable('x-powered-by');
function isAllowedMime(m) {
  return ['image/jpeg','image/png','image/webp','application/pdf'].includes(m);
}

app.use(cors({
  origin: ['http://localhost:3000','https://closemanages.vercel.app'],
  credentials: true
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-site" },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],

      scriptSrc: [
        "'self'",
        "'unsafe-inline'",       // אם אפשר – הסר בפרודקשן
        "'unsafe-eval'",         // אם אפשר – הסר בפרודקשן
        "https://www.gstatic.com",
        "https://www.googleapis.com",
        "https://www.google.com",
        "https://apis.google.com",
        "https://www.recaptcha.net",
        "https://cdn.jsdelivr.net",
        "https://vercel.live", "https://*.vercel.live",
      ],

      connectSrc: [
        "'self'",
        "https://www.gstatic.com",
        "https://www.googleapis.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://firebaseapp.com",
        "https://*.firebaseapp.com",
        "https://*.googleapis.com",
        "https://www.recaptcha.net",
        "https://cdn.jsdelivr.net",
          "https://vercel.live", "https://*.vercel.live",
          "wss://vercel.live",   "wss://*.vercel.live",
      ],

      frameSrc: [
        "'self'",
        "https://www.google.com",
        "https://www.gstatic.com",
        "https://*.firebaseapp.com",
        "https://www.recaptcha.net",
        "https://vercel.live", "https://*.vercel.live"
      ],

      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "*.cloudinary.com",
        "https:",
      ],

      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com",
      ],

      fontSrc: [
        "'self'",
        "data:",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com",
      ],
    },
  },
}));


function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

app.use(hpp());
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
});
app.use(['/login','/register'], authLimiter);
app.use(['/orders','/invoices'], apiLimiter);
// ===== Cloudinary =====




;['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'].forEach(k => {
  if (!process.env[k]) console.error(`❌ Missing ${k} in .env`);
});
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
app.use((req, res, next) => {
  console.log(`[EXPRESS] ${req.method} ${req.url}`);
    if (req.url.endsWith(".html")) {
    res.setHeader("Cache-Control", "no-store"); 
  }
    if (req.url.endsWith(".css") || req.url.endsWith(".js")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});


// ===== MongoDB Connect =====
// מומלץ לשים ב-.env: MONGO_URI=mongodb+srv://user:pass@cluster/dbName
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://aviel:aviel998898@cluster0.3po9ias.mongodb.net/';

app.use(async (req, res, next) => {
  try {
    await connectMongoose();
    return next();
  } catch (e) {
    console.error('❌ DB connect failed', e);
    return res.status(503).json({ ok: false, message: 'Database not ready', error: e.message });
  }
});



const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd
  }
});
app.use(csrfProtection);
// החזרת הטוקן ל-Frontend
app.get("/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

const nodemailer = require('nodemailer');
const emailOtpStore = {};

// מיילר

const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
    tls: {
    rejectUnauthorized: false   // ← מתעלם מבדיקת התעודה
  },
    debug: true,           // 🟢 הדפסות debug
  logger: true           // 🟢 לוגים למסוף
});

// מחולל קוד
function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// בדיקת אימייל בסיסית
function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str||'').toLowerCase());
}
function normalizeTeam(team) {
  if (Array.isArray(team)) return team.map(n => String(n).trim()).filter(Boolean);
  if (typeof team === 'string') return team.split(',').map(n => n.trim()).filter(Boolean);
  return [];
}
function upsertExecutions(targetExec, incomingExec) {
  const cats = ['daily', 'weekly', 'monthly'];
  cats.forEach(cat => {
    const t = Array.isArray(targetExec?.[cat]) ? targetExec[cat] : (targetExec[cat] = []);
    const inc = Array.isArray(incomingExec?.[cat]) ? incomingExec[cat] : [];
    inc.forEach(e => {
      if (!e || !e.task) return;
      const hit = t.find(x => x.task === e.task);
      if (hit) {
        if (e.worker !== undefined) hit.worker = e.worker;
        if (e.time   !== undefined) hit.time   = e.time;
      } else {
        t.push({ task: e.task, worker: e.worker || '', time: e.time || '' });
      }
    });
  });
}

function alignExecutionsByTasks(shift, executions) {
  const out = { daily: [], weekly: [], monthly: [] };
  ['daily', 'weekly', 'monthly'].forEach(cat => {
    const tasks = Array.isArray(shift?.tasks?.[cat]) ? shift.tasks[cat] : [];
    const inReq = Array.isArray(executions?.[cat]) ? executions[cat] : [];
    const byTask = new Map(inReq.map(e => [e.task, { worker: e.worker || '', time: e.time || '' }]));
    out[cat] = tasks.map(t => {
      const hit = byTask.get(t);
      return { task: t, worker: hit?.worker || '', time: hit?.time || '' };
    });
  });
  return out;
}
// 0=א',1=ב',2=ג',3=ד',4=ה'  (מתאריך YYYY-MM-DD)
function weekdayIndexFromDateStr(yyyy_mm_dd) {
  const [y,m,d] = yyyy_mm_dd.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m-1, d)).getUTCDay(); // 0=Sunday..6=Saturday
  return (wd === 0) ? 0 : wd; // כאן יוצא 0=ראשון, 1=שני, ...
}

// מושך את ההעדפות לכל העובדים לשבוע הבא
// פונקציה שמחזירה את התאריך של יום ראשון הקרוב (שבוע הבא)
function getNextSunday() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = 7 - day; // עוד כמה ימים עד יום ראשון הבא
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + diff);
  nextSunday.setHours(0,0,0,0);
  return nextSunday;
}

// ===== API: שליפת העדפות =====
app.get("/preferences/next-week", requireAuth(), async (req, res) => {
  try {
    const { weekStart, weekEnd } = getNextWeekRange();

const submissions = await ShiftSubmission.find({
  weekStartDate: { $gte: weekStart, $lte: weekEnd }
}).populate("userId", "username role").lean();

res.json({ ok: true, submissions, weekStart, weekEnd });
  } catch (err) {
    console.error("preferences error", err);
    res.json({ ok: false, submissions: [] });
  }
});

// ===== Views =====

app.get('/', requireAuth(), (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

app.get('/admin', requireAuth('manager'), (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});



app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});



// ===== Cloudinary helper =====
function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

// ===== API: חשבוניות =====


// GET /invoices?date=YYYY-MM-DD&supplier=שם&skip=0&limit=20
app.get('/invoices', async (req, res) => {
  try {
    const { date, supplier, skip = 0, limit = 20 } = req.query;
    const q = {};
    if (date) q.shiftDate = String(date);
    if (supplier) q.supplier = new RegExp(String(supplier).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const s = Math.max(0, parseInt(skip));
    const l = Math.min(100, Math.max(1, parseInt(limit)));

    const [items, total] = await Promise.all([
      Invoice.find(q).sort({ createdAt: -1 }).skip(s).limit(l).lean(),
      Invoice.countDocuments(q)
    ]);

    res.json({ items, total, skip: s, limit: l });
  } catch (e) {
    console.error('invoices error:', e);
    res.status(500).json({ items: [], total: 0, skip: 0, limit: 20 });
  }
});

app.delete('/invoice/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const row = await Invoice.findById(id);
    if (!row) return res.status(404).json({ ok:false, message:'לא נמצאה חשבונית' });

    await cloudinary.uploader.destroy(row.publicId, { resource_type: row.resourceType || 'image' });
    await row.deleteOne();

    res.json({ ok:true, message:'נמחק' });
  } catch (e) {
    console.error('delete-invoice error:', e);
    res.status(500).json({ ok:false, message:'שגיאה במחיקה' });
  }
});

// ===== View: Profile page =====
app.get("/profile", requireAuth(), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "profile.html"));
});

// ===== API: Profile Data =====
app.get("/profile-data", requireAuth(), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ ok: false, message: "משתמש לא נמצא" });
    }

    res.json({ ok: true, user });
  } catch (err) {
    console.error("profile error:", err);
    res.status(500).json({ ok: false, message: "שגיאה בשרת" });
  }
});

app.get("/profile-edit", requireAuth(), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "profile-edit.html"));
});

// ===== API: Update Profile =====

// API לעדכון פרופיל עם העלאת תמונה
app.post("/profile-update", requireAuth(), upload.single("avatar"), async (req, res) => {
  try {
    const { username, password } = req.body;
    const update = {};

    if (username) update.username = username.trim().toLowerCase();
    if (password) {
      update.passwordHash = await bcrypt.hash(password, 12);
    }

    // אם עלה קובץ -> נעלה ל-Cloudinary
    if (req.file) {
      const folder = `users/${req.user.id}/avatar`;
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder, resource_type: "image" },
          (err, res) => (err ? reject(err) : resolve(res))
        ).end(req.file.buffer);
      });

      update.avatarUrl = result.secure_url;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true }
    ).select("-passwordHash");

    res.json({ ok: true, user });
  } catch (err) {
    console.error("profile-update error:", err);
    res.status(500).json({ ok: false, message: "שגיאה בעדכון" });
  }
});


// ===== API: משמרות =====
app.get('/get-all-shifts', async (req, res) => {
  try {
    const all = await Shift.find().sort({ date: -1 });
    res.json(all);
  } catch (e) {
    console.error('get-all-shifts error:', e);
    res.status(500).json([]);
  }
});
app.get('/get-shift', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.json(null);
    const shift = await Shift.findOne({ date });
    res.json(shift || null);
  } catch (e) {
    console.error('get-shift error:', e);
    res.status(500).json(null);
  }
});
app.post('/save-shift', requireAuth(), async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.team = normalizeTeam(payload.team);

await Shift.findOneAndUpdate(
  { date: payload.date },
  {
    $set: { ...payload},  // 🟢 תמיד נשמר מי עדכן
    $setOnInsert: {
      executions: { daily: [], weekly: [], monthly: [] },
        runtimeNotes: [],   // ⬅️ ככה תמיד יהיה השדה
      scores: {},
      createdBy: req.user.name                       // 🟢 רק ביצירה ראשונה
    }
  },
  { upsert: true, new: true }
);

    res.json({ status: 'ok', message: 'המשמרת נשמרה בהצלחה!' });
  } catch (e) {
    console.error('save-shift error:', e);
    res.status(500).json({ status: 'error', message: 'שגיאה בשמירה' });
  }
});
app.post('/update-shift', async (req, res) => {
  try {
    const { date, executions } = req.body || {};
    if (!date) return res.status(400).json({ message: 'date חובה' });

    const shift = await Shift.findOne({ date });
    if (!shift) return res.status(404).json({ message: 'Shift not found' });

    const aligned = alignExecutionsByTasks(shift, executions);
    shift.executions = aligned;
    await shift.save();

    res.json({ message: 'עודכן בהצלחה' });
  } catch (e) {
    console.error('update-shift error:', e);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

app.post('/update-single-task', async (req, res) => {
  try {
    const { date, category, task, worker, time } = req.body || {};
    if (!date || !category || !task) {
      return res.status(400).json({ message: 'חובה date, category, task' });
    }

    const shift = await Shift.findOne({ date });
    if (!shift) return res.status(404).json({ message: 'Shift not found' });

    if (!shift.executions) {
      shift.executions = { daily: [], weekly: [], monthly: [] };
    }

    const list = Array.isArray(shift.executions[category])
      ? shift.executions[category]
      : (shift.executions[category] = []);

    const existing = list.find(e => e.task === task);

    if (existing) {
      if (worker !== undefined) existing.worker = worker;
      if (time   !== undefined) existing.time   = time;
    } else {
      list.push({ task, worker: worker || "", time: time || "" });
    }

    await shift.save();
    res.json({ ok: true, message: "נשמר ✔", shift });
  } catch (e) {
    console.error("update-single-task error:", e);
    res.status(500).json({ ok: false, message: "שגיאת שרת" });
  }
});

// בקובץ server.js או איפה שיש לך את הראוטים
const XLSX = require("xlsx");

app.get("/invoices/export", async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ ok: false, message: "חסר year או month" });
    }

    // התאמה על "YYYY-MM"
    const regex = new RegExp(`^${year}-${month.padStart(2, "0")}`);

    const items = await Invoice.find({
      shiftDate: { $regex: regex }
    }).sort({ shiftDate: -1 })   // 🟢 ממיין מהתאריך הכי חדש לישן
.lean();

    const rows = items.map(r => ({
      "תאריך": formatDate(r.shiftDate) || "",
      "ספק": r.supplier || "",
      "שם קובץ": r.originalName || "",
      "העלה": r.uploadedBy || "",
      "קישור": r.url || ""
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "חשבוניות");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", `attachment; filename=invoices_${year}_${month}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (err) {
    console.error("שגיאה ביצוא:", err);
    res.status(500).json({ ok: false, message: "שגיאה ביצוא" });
  }
});
app.get("/dispersals/export", async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ ok: false, message: "חסר year או month" });
    }

    // התאמה על "YYYY-MM"
    const regex = new RegExp(`^${year}-${month.padStart(2, "0")}`);

    const items = await Dispersal.find({
      shiftDate: { $regex: regex }
    }).lean();

    const rows = items.map(r => ({
      "תאריך": formatDate(r.shiftDate) || "",
      "מחיר": r.price || "",
      "מונית": r.taxi || "",
      "אנשים": Array.isArray(r.people) ? r.people.join(", ") : (r.people || ""),
      "מי שילם": r.payer || "",
      "הערות": r.notes || ""
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "פיזורים");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", `attachment; filename=dispersals_${year}_${month}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (err) {
    console.error("שגיאה ביצוא פיזורים:", err);
    res.status(500).json({ ok: false, message: "שגיאה ביצוא" });
  }
});

// ===== OTP Store (בינתיים בזיכרון, אפשר להעביר ל-DB) =====
// ===== OTP Store (בזיכרון) =====
app.post('/auth/request-email-code', authLimiter, async (req,res)=>{
  try {
    const { name, email } = req.body;
    const cleanName = String(name||'').trim();
    const cleanEmail = String(email||'').trim().toLowerCase();

    if (!cleanName || !isEmail(cleanEmail))
      return res.status(400).json({ ok:false, message:"שם/אימייל לא תקינים" });

    const code = genCode();
    emailOtpStore[cleanEmail] = { code, name: cleanName, expires: Date.now()+5*60*1000 };

    await mailer.sendMail({
      from: `"New Deli" <${process.env.SMTP_USER}>`,
      to: cleanEmail,
      subject: "קוד התחברות",
      text: `שלום ${cleanName}, הקוד שלך הוא: ${code} (תקף ל-5 דקות).`
    });

    res.json({ ok:true, message:"נשלח קוד לאימייל" });
  } catch (err) {
    console.error("request-email-code error:", err);
    res.status(500).json({ ok:false, message:"שגיאה בשליחת הקוד" });
  }
});

app.post('/auth/verify-email-code', async (req,res) => {
  try {
    const { email, code } = req.body;
    const cleanEmail = String(email||'').trim().toLowerCase();
    const rec = emailOtpStore[cleanEmail];

    if (!isEmail(cleanEmail)) 
      return res.status(400).json({ ok:false, message:"אימייל לא תקין" });
    if (!rec) 
      return res.status(400).json({ ok:false, message:"לא נשלח קוד" });
    if (rec.expires < Date.now()) {
      delete emailOtpStore[cleanEmail];
      return res.status(400).json({ ok:false, message:"קוד פג תוקף" });
    }
    if (rec.code !== String(code)) 
      return res.status(400).json({ ok:false, message:"קוד שגוי" });

    // בדיקת משתמש קיים או יצירה
    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      user = await User.create({ 
        username: rec.name, 
        email: cleanEmail, 
        role: 'user' 
      });
    }

    // צור טוקן עם id בלבד
    const payload = { id: user._id.toString() };
    const token = jwt.sign(payload, SECRET, { expiresIn: "7d" });

    // שמור טוקן כ־cookie יחיד
    res.cookie("token", token, {
      sameSite: 'lax',
      secure: false,   // אם תריץ ב-https תשנה ל-true
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    // מחק מהחנות OTP
    delete emailOtpStore[cleanEmail];

    // החזר מידע ל־frontend
    res.json({
      ok: true,
      message: "מחובר!",
      user: {
        id: user._id,
        username: user.username || rec.name || cleanEmail.split("@")[0],
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error("verify-email-code error:", err);
    res.status(500).json({ ok:false, message:"שגיאה באימות" });
  }
});




app.post('/admin-update-shift', async (req, res) => {
  try {
    const { date, manager, team, notes } = req.body || {};
    if (!date) return res.status(400).json({ ok: false, message: 'date חובה.' });

    const update = {};
    if (typeof manager === 'string') update.manager = manager.trim();
    if (team !== undefined) update.team = normalizeTeam(team);
    if (typeof notes === 'string') update.notes = notes.trim();

    const shift = await Shift.findOneAndUpdate(
      { date },
      { $set: update },
      { new: true }
    );
    if (!shift) return res.status(404).json({ ok: false, message: 'Shift not found' });

    return res.json({ ok: true, message: 'הפרטים נשמרו בהצלחה' });
  } catch (e) {
    console.error('admin-update-shift error:', e);
    return res.status(500).json({ ok: false, message: 'שגיאת שרת' });
  }
});

// ========= Runtime Notes: Add =========
app.post('/add-runtime-note', async (req, res) => {
  try {
    const { date, text, author } = req.body || {};
    if (!date || !text) {
      return res.status(400).json({ ok: false, message: 'חובה תאריך וטקסט הערה' });
    }

    // אוספים
    const mongoose = require('mongoose');
    const col = mongoose.connection.collection('shifts');

    // כמו הישן: לא יוצרים משמרת אם לא קיימת – מחזירים 404
    const shift = await col.findOne({ date });
    if (!shift) {
      return res.status(404).json({ ok: false, message: 'לא נמצאה משמרת' });
    }

    // מזהה ייחודי כמו קודם (זמן + רנדום)
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    const note = {
      id,
      text: String(text).trim(),
      author: author || shift.manager || 'אחמ״ש',
      time: new Date().toISOString(),
    };

    // נעדכן ונחזיר את המסמך אחרי העדכון (כדי להחזיר runtimeNotes עדכני)
    const result = await col.findOneAndUpdate(
      { date },
      { $push: { runtimeNotes: note } },
      { returnDocument: 'after', projection: { _id: 0, runtimeNotes: 1 } }
    );

    return res.json({
      ok: true,
      message: 'הערה נוספה',
      runtimeNotes: (result.value && result.value.runtimeNotes) || []
    });
  } catch (e) {
    console.error('add-runtime-note error', e);
    return res.status(500).json({ ok: false, message: 'שגיאה בשרת' });
  }
});


// ========= Runtime Notes: Delete =========
app.post('/delete-runtime-note', async (req, res) => {
  try {
    const { date, noteId, index } = req.body || {};
    if (!date || (!noteId && (index === undefined || index === null))) {
      return res.status(400).json({ ok: false, message: 'חובה להעביר date וגם noteId או index' });
    }

    const mongoose = require('mongoose');
    const col = mongoose.connection.collection('shifts');

    // קודם נוודא שהמשמרת קיימת
    const shift = await col.findOne({ date }, { projection: { _id: 0, runtimeNotes: 1 } });
    if (!shift) return res.status(404).json({ ok: false, message: 'לא נמצאה משמרת' });

    const notes = Array.isArray(shift.runtimeNotes) ? shift.runtimeNotes : [];

    let removed = false;

    // 1) מחיקה לפי id (העדפה ראשונה – כמו בקוד הישן)
    if (noteId) {
      const pullRes = await col.updateOne(
        { date },
        { $pull: { runtimeNotes: { id: noteId } } }
      );
      removed = pullRes.modifiedCount > 0;
    }

    // 2) אם לא הוסר לפי id ויש index – מחיקה לפי אינדקס
    if (!removed && (index !== undefined && index !== null)) {
      const idx = Number(index);
      if (!Number.isNaN(idx) && idx >= 0 && idx < notes.length) {
        // נבנה מערך חדש בלי אותו אינדקס
        const newNotes = notes.slice(0, idx).concat(notes.slice(idx + 1));
        const setRes = await col.updateOne(
          { date },
          { $set: { runtimeNotes: newNotes } }
        );
        removed = setRes.modifiedCount > 0;
      }
    }

    if (!removed) {
      return res.status(404).json({ ok: false, message: 'הערה לא נמצאה' });
    }

    // נחזיר את המצב העדכני של ההערות
    const updated = await col.findOne(
      { date },
      { projection: { _id: 0, runtimeNotes: 1 } }
    );

    return res.json({
      ok: true,
      message: 'הערה נמחקה',
      runtimeNotes: (updated && updated.runtimeNotes) || []
    });
  } catch (e) {
    console.error('delete-runtime-note error', e);
    return res.status(500).json({ ok: false, message: 'שגיאה בשרת' });
  }
});
app.get("/me", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.json({ ok: false });

    const decoded = jwt.verify(token, SECRET);
    const user = await User.findById(decoded.id).lean();

    if (!user) return res.json({ ok: false });

    res.json({ ok: true, user });
  } catch (err) {
    res.json({ ok: false });
  }
});





app.post('/finalize-shift', requireAuth(), async (req, res) => {
  try {
    const { date, manager, team, executions } = req.body || {};
    if (!date) return res.status(400).json({ ok: false, message: 'date חובה.' });

    let shift = await Shift.findOne({ date });
    if (!shift) {
      shift = new Shift({
        date,
        manager: manager || '',
        team: normalizeTeam(team),
        tasks: { daily: [], weekly: [], monthly: [] },
          runtimeNotes: [],   // ⬅️ ככה תמיד יהיה השדה
        executions: { daily: [], weekly: [], monthly: [] },
        createdBy: req.user.name  // 🟢 מי יצר אם חדש
      });
    } else {
      if (manager !== undefined) shift.manager = manager;
      if (team !== undefined)    shift.team    = normalizeTeam(team);
    }

    if (!shift.executions) shift.executions = { daily: [], weekly: [], monthly: [] };
    if (executions) upsertExecutions(shift.executions, executions);

    shift.closed  = true;
    shift.closedAt = new Date();
    shift.closedBy = req.user.name; 

    await shift.save();
    return res.json({ ok: true, message: 'המשמרת נסגרה בהצלחה.', shift });
  } catch (err) {
    console.error('finalize-shift error:', err);
    return res.status(500).json({ ok: false, message: 'שגיאה בסגירת המשמרת.' });
  }
});

// ===== API: הזמנות יומיות =====
// GET /orders?date=YYYY-MM-DD  → מחזיר/יוצר טופס לפי ספקים פעילים ליום הזה
// ✅ להשאיר – בונה מחדש אם אין מסמך או אם ה־blocks ריק
// GET /orders?date=YYYY-MM-DD&mode=merge|replace
// משדרג תמיד את המסמך לסט הספקים הכי עדכני לאותו יום.
// ברירת מחדל: merge (שומר כמויות/הערות). mode=replace ידרוס הכל.
app.get('/orders', async (req, res) => {
  try {
    const { date, mode = 'merge' } = req.query;
    if (!date) return res.status(400).json({ ok:false, message:'חסר date' });

    // ה־blocks ה"תקניים" לפי הספקים העדכניים
    const freshBlocks = await buildBlocksFromSuppliers(date);

    // אם אין בכלל ספקים ליום הזה – ניצור/נחזיר מסמך ריק עם blocks=[]
    if (!freshBlocks.length) {
      let emptyDoc = await DailyOrder.findOne({ date });
      if (!emptyDoc) emptyDoc = await DailyOrder.create({ date, blocks: [], notes: '' });
      return res.json({ ok:true, order: emptyDoc });
    }

    let doc = await DailyOrder.findOne({ date });
    if (!doc) {
      // אין מסמך — ניצור חדש ישר מהספקים
      doc = await DailyOrder.create({ date, blocks: freshBlocks, notes: '' });
      return res.json({ ok:true, order: doc });
    }

    // יש מסמך — נעדכן אותו לפי מצב הספקים הנוכחי
    if (mode === 'replace') {
      doc.blocks = freshBlocks; // דריסה מלאה
    } else {
      // merge: שומר כמויות/הערות קיימות על מוצרים שנשארו
      doc.blocks = mergeBlocksKeepQuantities(doc.blocks, freshBlocks);
    }
    await doc.save();

    res.json({ ok:true, order: doc });
  } catch (e) {
    console.error('GET /orders error', e);
    res.status(500).json({ ok:false, message:'שגיאת שרת' });
  }
});
// קבלת כל המשתמשים
// app.get("/admin/users", async (req, res) => {
//   const users = await User.find({}, "name email role avatar");
//   res.json(users);
// });
app.get("/admin/users", async (req, res) => {
  const users = await User.find({}, "username role avatar");
  res.json(users);
});
// עדכון role
app.post("/admin/update-role", async (req, res) => {
  const { userId, role } = req.body;
  try {
    const user = await User.findByIdAndUpdate(userId, { role }, { new: true });

    // הנפקת טוקן חדש
    const payload = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role
    };
    const token = jwt.sign(payload, SECRET, { expiresIn: "7d" });

    res.cookie("token", token, {
      sameSite: 'lax',
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


app.post('/orders', requireAuth(), async (req, res) => {
  try {
    const { date, blocks, notes } = req.body || {};
    if (!date || !Array.isArray(blocks)) {
      return res.status(400).json({ ok:false, message:'חסר date/blocks' });
    }

    const cleanBlocks = (blocks || []).map(b => ({
      supplierId: b.supplierId,
      supplier:   b.supplier,
      items: (Array.isArray(b.items) ? b.items : []).map(it => ({
        name: (it && it.name) ? String(it.name).trim() : "",
        unit: (it && it.unit) ? String(it.unit).trim() : "",
        currentQty: it && it.currentQty ? Number(it.currentQty) : 0,
        toOrderQty: it && it.toOrderQty ? Number(it.toOrderQty) : 0,
        notes: it && it.notes ? String(it.notes).trim() : ""
      })).filter(x => x.name)
    }));

    const saved = await DailyOrder.findOneAndUpdate(
      { date },
      { 
        $set: { 
          blocks: cleanBlocks, 
          notes: notes || '',
          updatedAt: new Date(),
          updatedBy: req.user.name   // 🟢 שמור גם מי עדכן
        },
        $setOnInsert: {
          createdBy: req.user.name,  // 🟢 מי יצר לראשונה
          createdAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    res.json({ ok:true, order: saved });
  } catch (e) {
    console.error('POST /orders error', e);
    res.status(500).json({ ok:false, message:'שגיאה בשמירה' });
  }
});

// בונה blocks לפי ספקים פעילים של היום (א׳=0 ... ש׳=6)
async function buildBlocksFromSuppliers(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m-1, d)).getUTCDay(); // 0..6

  const suppliers = await Supplier.find({
    active: true,
    $or: [{ days: wd }, { days: String(wd) }] // תמיכה גם במחרוזות ישנות
  }).lean();

  return suppliers.map(s => ({
    supplierId: s._id,
    supplier:   s.name,
    items: (s.items || []).map(it => ({
      name: it.name,
      unit: it.unit || '',
      currentQty: 0,
      toOrderQty: 0,
      notes: ''
    }))
  }));
}

// ממזג blocks חדשים עם קיימים – שומר כמויות/הערות לפי שם מוצר+יחידה
function mergeBlocksKeepQuantities(oldBlocks = [], freshBlocks = []) {
  const oldBySupplier = new Map(
    oldBlocks.map(b => [String(b.supplier), b])
  );

  return freshBlocks.map(fb => {
    const ob = oldBySupplier.get(String(fb.supplier));
    if (!ob) return fb; // ספק חדש לגמרי

    // מיפוי פריטים ישנים לפי שם+יחידה
    const oldItemMap = new Map(
      (ob.items || []).map(it => [ `${it.name}__${it.unit||''}`, it ])
    );

    const mergedItems = (fb.items || []).map(nit => {
      const key = `${nit.name}__${nit.unit||''}`;
      const hit = oldItemMap.get(key);
      return hit ? {
        ...nit,
        currentQty: Number(hit.currentQty || 0),
        toOrderQty: Number(hit.toOrderQty || 0),
        notes: String(hit.notes || '')
      } : nit;
    });

    return {
      ...fb,
      items: mergedItems
    };
  });
}

app.get('/orders-list', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '30')));
    const rows = await DailyOrder.find({}, { date:1, createdAt:1, updatedAt:1 })
      .sort({ date: -1 }).limit(limit).lean();
    res.json({ ok:true, days: rows });
  } catch (e) {
    console.error('GET /orders-list error', e);
    res.status(500).json({ ok:false, days: [] });
  }
});

app.get('/users-list', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '30')));
    const rows = await User.find({}, { date:1, createdAt:1, updatedAt:1 })
      .sort({ date: -1 }).limit(limit).lean();
    res.json({ ok:true, users: rows });
  } catch (e) {
    console.error('GET /users-list error', e);
    res.status(500).json({ ok:false, users: [] });
  }
});

app.get('/suppliers-list', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '30')));
    const rows = await Supplier.find({}, { date:1, createdAt:1, updatedAt:1 })
      .sort({ date: -1 }).limit(limit).lean();
    res.json({ ok:true, days: rows });
  } catch (e) {
    console.error('GET /suppliers-list error', e);
    res.status(500).json({ ok:false, days: [] });
  }
});
// // GET /orders-list?limit=30
// app.get('/orders', async (req, res) => {
//   try {
//     const { date } = req.query;
//     if (!date) return res.status(400).json({ ok:false, message:'חסר date' });

//     let doc = await DailyOrder.findOne({ date });
//     const wd = weekdayIndexFromDateStr(date); // 0=א'..6=ש'

//     // בונה ספקים ליום הזה
//     const suppliers = await Supplier.find({
//       active: true,
//       $or: [{ days: wd }, { days: String(wd) }] // תומך גם במחרוזות ישנות
//     }).lean();

//     // אם אין blocks או שהמסמך לא קיים → נבנה חדשים
//     if (!doc || !doc.blocks || !doc.blocks.length) {
//       const blocks = suppliers.map(s => ({
//         supplierId: s._id,
//         supplier: s.name,
//         items: (s.items || []).map(it => ({
//           name: it.name, unit: it.unit || '', currentQty: 0, toOrderQty: 0, notes: ''
//         }))
//       }));

//       if (!doc) {
//         doc = await DailyOrder.create({ date, blocks, notes: '' });
//       } else {
//         doc.blocks = blocks;
//         await doc.save();
//       }
//     }

//     res.json({ ok:true, order: doc });
//   } catch (e) {
//     console.error('GET /orders error', e);
//     res.status(500).json({ ok:false, message:'שגיאת שרת' });
//   }
// });

// ===== API: ספקים (ניהול מלא) =====
app.get('/suppliers', async (req, res) => {
  try {
    const { active } = req.query;
    const q = {};
    if (active === 'true') q.active = true;
    if (active === 'false') q.active = false;
    const rows = await Supplier.find(q).sort({ name: 1 }).lean();
    res.json({ ok:true, suppliers: rows });
  } catch (e) {
    console.error('GET /suppliers error', e);
    res.status(500).json({ ok:false, suppliers: [] });
  }
});
app.post('/migrate-add-runtimeNotes', async (req, res) => {
  try {
    const r = await Shift.updateMany(
      { runtimeNotes: { $exists: false } },
      { $set: { runtimeNotes: [] } }
    );
    res.json({ ok:true, modified: r.modifiedCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false });
  }
});
app.post('/suppliers', requireAuth(), async (req, res) => {

  try {
    const { name, phone, days, items, active } = req.body || {};
    const doc = await Supplier.create({
      name: String(name).trim(),
      phone: String(phone||'').trim(),
      days: Array.isArray(days) ? days.map(Number) : [], // <<< חשוב
      items: Array.isArray(items) ? items.map(it => ({ name: it.name, unit: it.unit||'' })) : [],
      active: active !== undefined ? !!active : true,
      createdBy: req.user?.username || "לא נמצא"
    });
console.log("Current user:", req.user);

    res.json({ ok:true, supplier: doc });
  } catch (e) {
    console.error('POST /suppliers error', e);
    res.status(500).json({ ok:false, message: 'שגיאה ביצירה' });
  }
});
app.get("/tasks", async (req, res) => {
  try {
    const tasks = await Task.find(); // מוציא את כל המשימות
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ ok: false, message: "שגיאה בטעינת משימות" });
  }
});

const ShiftSubmission = require("./models/ShiftSubmission");
function getNextWeekRange() {
  const now = new Date();
  // מוצא את יום ראשון הבא
  const day = now.getDay();
  const diff = 7 - day; // ימים עד ראשון הבא
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0,0,0,0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23,59,59,999);

  return { weekStart, weekEnd };
}
// יצירת/עדכון סידור
// שליחת סידור
app.post("/shift-submissions", requireAuth(), async (req, res) => {
  try {
    const { shifts, notes } = req.body;
    const userId = req.user._id;
    const username = req.user.username;

    // מחשבים את תחילת השבוע הבא
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + (7 - now.getDay())); // יום ראשון הבא
    nextSunday.setHours(0,0,0,0);

const { weekStart, weekEnd } = getNextWeekRange();

const submission = await ShiftSubmission.findOneAndUpdate(
  { userId: req.user._id, weekStartDate: weekStart }, // שים לב
  { 
    shifts, 
    notes, 
    username: req.user.username, 
    weekStartDate: weekStart  // חייב להכניס למסמך
  },
  { upsert: true, new: true }
);

    res.json({ ok: true, submission });
  } catch (err) {
    console.error("submit shifts error", err);
    res.status(500).json({ ok: false, message: "שגיאה בהגשת סידור" });
  }
});

// קבלת ההגשה האישית לשבוע הבא
app.get("/shift-submissions/my", requireAuth(), async (req, res) => {
  try {
    const userId = req.user._id;

    // חישוב טווח השבוע הבא
    const now = new Date();
    const day = now.getDay(); // 0=ראשון
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - day + 7);
    weekStart.setHours(0,0,0,0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23,59,59,999);

    // חיפוש לפי userId + טווח
    const submission = await ShiftSubmission.findOne({
      userId,
      weekStartDate: { $gte: weekStart, $lte: weekEnd }
    }).lean();

    res.json({ ok: true, submission });
  } catch (err) {
    console.error("get my shift-submission error", err);
    res.status(500).json({ ok: false, message: "שגיאה בשרת" });
  }
});

// שליפת סידור נוכחי למשתמש
app.get("/shift-submissions/current", requireAuth(), async (req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0,0,0,0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23,59,59,999);

    const sub = await ShiftSubmission.findOne({
      userId: req.user._id,
      weekStart: { $gte: weekStart },
      weekEnd: { $lte: weekEnd }
    }).lean();

    res.json({ ok: true, submission: sub, weekStart, weekEnd });
  } catch (e) {
    res.status(500).json({ ok: false, message: "שגיאה בשליפה" });
  }
});

app.get("/shift-submissions/next", requireAuth(), async (req, res) => {
  try {
    const { weekStart, weekEnd } = getNextWeekRange();

    const sub = await ShiftSubmission.findOne({
      userId: req.user._id,
      username: req.user.username,
      weekStart,
      weekEnd
    }).lean();

    res.json({ ok: true, submission: sub, weekStart, weekEnd });
  } catch (e) {
    res.status(500).json({ ok: false, message: "שגיאה בשליפה" });
  }
});


const Schedule = require("./models/Schedule");
const {OpenAI} = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
function cleanSchedule(schedule, employees) {
  const validNames = new Set(employees.map(e => e.name));
  const days = Object.keys(schedule);

  days.forEach(day => {
    const shifts = schedule[day];
    const usedToday = new Set();

    ["morning", "mid", "evening"].forEach(shift => {
      if (!Array.isArray(shifts[shift])) return;

      const seen = new Set();
      shifts[shift] = shifts[shift].map(name => {
        if (!name || name === "-") return "-";

        // 🟢 אם השם לא קיים ברשימת העובדים – מחליפים ל "-"
        if (!validNames.has(name)) return "-";

        // כפילויות במשמרת / ביום
        if (seen.has(name) || usedToday.has(name)) return "-";

        seen.add(name);
        usedToday.add(name);
        return name;
      });

      // בדיוק 3 ערכים
      while (shifts[shift].length < 3) shifts[shift].push("-");
      if (shifts[shift].length > 3) shifts[shift] = shifts[shift].slice(0, 3);
    });
  });

  return schedule;
}


app.post("/ai-schedule", async (req, res) => {
  try {
    const { weekStart, weekEnd } = getNextWeekRange();

    // מושכים את כל ההעדפות לשבוע הבא
    const submissions = await ShiftSubmission.find({
      weekStartDate: { $gte: weekStart, $lte: weekEnd }
    })
      .populate("userId", "username role")
      .lean();

    if (!submissions.length) {
      return res.json({ ok: false, message: "אין הגשות לשבוע הבא" });
    }

    const employees = submissions.map(s => ({
      name: s.userId?.username || s.username || "אנונימי",
      role: s.userId?.role || "user",
      shifts: s.shifts,
      notes: s.notes
    }));

const prompt = `
אתה מחולל סידורי עבודה שבועיים.

חוקים:
1. בכל יום יש שלוש משמרות: בוקר, אמצע, וערב.
2. בכל משמרת צריכים להיות בדיוק 3 ערכים במערך.
3. לפחות אחד בכל משמרת חייב להיות עובד עם role = "admin".
4. אסור לחזור על אותו עובד פעמיים באותה משמרת. 
5. אסור לחזור על אותו עובד פעמיים באותו יום (אם עובד כבר שובץ ביום מסוים – אל תכניס אותו למשמרת נוספת באותו יום).
6. נסה לחלק את העובדים באופן שוויוני לאורך השבוע – שלא יהיו אותם עובדים בכל יום ובכל משמרת.
7. אם אין מספיק עובדים → אל תמציא שמות חדשים (כמו admin1, admin2 וכו').
   תחתוך עם "-" עד שיש שלושה ערכים. 
   דוגמה חוקית: ["אבי", "-", "-"].
   דוגמה לא חוקית: ["admin1","admin2","admin3"] אם הם לא קיימים ברשימה.
8. מותר להשתמש **רק** בעובדים מהרשימה שאספק לך. 
9. "אמצע" קיימת רק בימים ראשון וחמישי. בשאר הימים תחזיר מערך ריק [].
החזרה תהיה אך ורק JSON תקין, במבנה:
{
  "sun": { "morning": ["...", "...", "..."], "mid": ["...", "...", "..."], "evening": ["...", "...", "..."] },
  "mon": { "morning": ["...", "...", "..."], "mid": [], "evening": ["...", "...", "..."] },
}

רשימת העובדים הזמינים:
${JSON.stringify(employees, null, 2)}

שבוע שמתחיל בתאריך: ${weekStart}
`;





    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "אתה מחולל סידורי עבודה. תחזיר אך ורק JSON תקין, בלי טקסט נוסף." },
        { role: "user", content: prompt },
        { role: "user", content: `נתוני העובדים: ${JSON.stringify(employees)}` }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    let text = completion.choices[0].message.content.trim();
    if (text.startsWith("```")) {
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    }

let schedule;
try {
  schedule = JSON.parse(text);
} catch (err) {
  return res.json({ ok: false, message: "AI החזיר טקסט לא חוקי", raw: text });
}
schedule = cleanSchedule(schedule, employees);
    // 🟢 שמירה למסד עם weekStart + weekEnd
const saved = await Schedule.create({
  weekStart,
  weekEnd,
  schedule
});

res.json({ ok: true, schedule: saved.schedule, id: saved._id });
  } catch (err) {
    console.error("ai-schedule error:", err);
    res.json({ ok: false, message: "שגיאה בשרת", error: String(err) });
  }
});



app.post("/auto-schedule", async (req, res) => {
  try {
    const { weekStart, weekEnd } = getNextWeekRange();
    // שליפת ההגשות
    const submissions = await ShiftSubmission.find({
      weekStartDate: { $gte: weekStart, $lte: weekEnd }
    }).populate("userId", "username role").lean();

    // חלוקה לפי תפקיד
    const managers = submissions.filter(s => s.userId?.role === "manager" || s.userId?.role === "admin");
    const employees = submissions.filter(s => s.userId?.role === "user");

    const days = ["sun","mon","tue","wed","thu","fri"];
    const shifts = ["morning","evening"];

    const schedule = {};

    days.forEach(day => {
      schedule[day] = {};
      shifts.forEach(shift => {
        // מוצאים את כל הזמינים
        const availableManagers = managers.filter(s => s.shifts?.[day]?.includes(shift));
        const availableEmployees = employees.filter(s => s.shifts?.[day]?.includes(shift));

        // בוחרים אחד אקראי מהמנהלים + שני עובדים
        const manager = availableManagers.length ? availableManagers[Math.floor(Math.random() * availableManagers.length)] : null;
        const workers = availableEmployees.sort(() => 0.5 - Math.random()).slice(0, 2);

        schedule[day][shift] = {
          manager: manager ? manager.userId.username : "❌ אין אחמ״ש",
          workers: workers.map(w => w.userId?.username || "—")
        };
      });
    });

    res.json({ ok: true, schedule });
  } catch (err) {
    console.error("auto schedule error", err);
    res.status(500).json({ ok: false, message: "שגיאה בבניית סידור" });
  }
});
async function getLastAISchedule() {
  // מביא את הסידור האחרון שנשמר
  const last = await Schedule.findOne().sort({ createdAt: -1 }).lean();
  return last ? last.schedule : {};  // אם לא נמצא מחזיר אובייקט ריק
}



app.get("/schedule-preview", async (req, res) => {
  try {
    const schedule = await getLastAISchedule();
    if (!schedule || !Object.keys(schedule).length) {
      return res.json({ ok: false, message: "לא נמצא סידור" });
    }
    res.json({ ok: true, schedule });
  } catch (err) {
    console.error("schedule-preview error:", err);
    res.status(500).json({ ok: false, message: "שגיאה בשרת" });
  }
});




// יצירת משימה
app.post("/tasks", async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();
    res.json({ ok: true, task });
  } catch (err) {
    res.json({ ok: false, message: "שגיאה בשמירה" });
  }
});
app.put("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category } = req.body;

    const updated = await Task.findByIdAndUpdate(
      id,
      { $set: { name, category } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ ok: false, message: "משימה לא נמצאה" });
    }

    res.json({ ok: true, task: updated });
  } catch (err) {
    res.status(500).json({ ok: false, message: "שגיאה בעדכון משימה" });
  }
});

// מחיקת משימה
app.delete("/tasks/:id", async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
// POST /orders/rebuild  { date: 'YYYY-MM-DD' }
app.post('/orders/rebuild', async (req, res) => {
  try {
    const { date } = req.body || {};
    if (!date) return res.status(400).json({ ok:false, message:'חסר date' });

    let doc = await DailyOrder.findOne({ date });
    const wd = weekdayIndexFromDateStr(date);

    const suppliers = await Supplier.find({
      active: true,
      $or: [{ days: wd }, { days: String(wd) }]
    }).lean();

    const blocks = suppliers.map(s => ({
      supplierId: s._id,
      supplier: s.name,
      items: (s.items || []).map(it => ({
        name: it.name, unit: it.unit || '', currentQty: 0, toOrderQty: 0, notes: ''
      }))
    }));

    if (!doc) {
      doc = await DailyOrder.create({ date, blocks, notes: '' });
    } else {
      doc.blocks = blocks;
      await doc.save();
    }
    res.json({ ok:true, order: doc });
  } catch (e) {
    console.error('rebuild-order error', e);
    res.status(500).json({ ok:false, message:'שגיאה בעדכון' });
  }
});
app.delete('/orders/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const r = await DailyOrder.deleteOne({ date });
    res.json({ ok:true, deleted: r.deletedCount });
  } catch (e) {
    console.error('DELETE /orders/:date error', e);
    res.status(500).json({ ok:false, message:'שגיאה במחיקה' });
  }
});
app.put('/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, days, items, active } = req.body || {};
    const doc = await Supplier.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
          ...(days !== undefined ? { days: (Array.isArray(days) ? days.map(Number) : []) } : {}), // <<< חשוב
          ...(items !== undefined ? { items: (Array.isArray(items) ? items.map(it => ({ name: it.name, unit: it.unit||'' })) : []) } : {}),
          ...(active !== undefined ? { active: !!active } : {})
        }
      },
      { new: true }
    );
    res.json({ ok:true, supplier: doc });
  } catch (e) {
    console.error('PUT /suppliers/:id error', e);
    res.status(500).json({ ok:false, message: 'שגיאה בעדכון' });
  }
});

app.delete('/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Supplier.findByIdAndDelete(id);
    res.json({ ok:true });
  } catch (e) {
    console.error('DELETE /suppliers/:id error', e);
    res.status(500).json({ ok:false, message: 'שגיאה במחיקה' });
  }
});

app.patch('/suppliers/:id/active', async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body || {};
    const doc = await Supplier.findByIdAndUpdate(id, { $set: { active: !!active } }, { new: true });
    res.json({ ok:true, supplier: doc });
  } catch (e) {
    console.error('PATCH /suppliers/:id/active error', e);
    res.status(500).json({ ok:false, message: 'שגיאה' });
  }
});

// 🔧 מיגרציה חד־פעמית: להפוך days ממחרוזות למספרים לכל הספקים (תריץ פעם אחת ואז תסיר/תנעל)
app.post('/suppliers/migrate-days-to-numbers', async (req, res) => {
  try {
    const all = await Supplier.find({}).lean();
    const ops = [];
    for (const s of all) {
      if (Array.isArray(s.days) && s.days.some(v => typeof v === 'string')) {
        ops.push({
          updateOne: {
            filter: { _id: s._id },
            update: { $set: { days: s.days.map(n => Number(n)) } }
          }
        });
      }
    }
    if (ops.length) await Supplier.bulkWrite(ops);
    res.json({ ok:true, updated: ops.length });
  } catch (e) {
    console.error('migrate-days error', e);
    res.status(500).json({ ok:false, message:'migration failed' });
  }
});




const webpush = require('web-push');

const publicVapidKey = 'BGEYruudNkeNhSyxPmrvHjnvUFnFe3Ca2KmA6IZU6UJU7_fJvVldk4qd90nNil_i_HRR6dY02I_j8oD6hS-4U0E';
const privateVapidKey = 'e_R-V_uyRhsRMONuURKqwkMKQGhGguivKjFsNUd0a_A';

webpush.setVapidDetails(
  "mailto:admin@newdeli.com",
  publicVapidKey,
  privateVapidKey
);
// app.use(express.json());
const PushSubscription = require("./models/PushSubscription");

app.post("/save-subscription", async (req, res) => {
  if (!req.body || !req.body.endpoint) {
    return res.status(400).json({ ok: false, error: "No subscription" });
  }

  try {
    await PushSubscription.findOneAndUpdate(
      { endpoint: req.body.endpoint },
      req.body,
      { upsert: true, new: true }
    );
    console.log("✅ Subscription saved:", req.body.endpoint);
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ DB error:", err);
    res.status(500).json({ ok: false, error: "DB error" });
  }
});

app.post("/send-notification", async (req, res) => {
  const message = req.body.message || "התראה חדשה";
  const payload = JSON.stringify({
    title: "📢 הודעת מנהל",
    body: message
  });

  const subs = await PushSubscription.find({});
  let sent = 0, failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log("⚠️ Subscription expired:", sub.endpoint);
        await PushSubscription.deleteOne({ endpoint: sub.endpoint });
      } else {
        console.error("❌ Error sending push:", err.message);
      }
    }
  }

  res.json({ ok: true, sent, failed });
});


const User = require('./models/user');

const jwt = require('jsonwebtoken');

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});
app.get("/ai", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "ai-schedule.html"));
});
app.get("/manager", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "manager.html"));
});

app.post("/logout", (req, res) => {
  res.clearCookie("user", { sameSite: "lax" });
  res.json({ ok: true, message: "התנתקת בהצלחה" });
});
app.get("/logout", (req, res) => {
  res.clearCookie("user", { sameSite: "lax" });
  res.redirect("/login"); // אחרי לוגאאוט מחזיר לעמוד התחברות
});

// --- Register with username/password (אופציונלי)
app.post('/register', async (req, res) => {
  try {
    const { username, email, name } = req.body;

    if (!username || !email || !name) {
      return res.status(400).json({ ok: false, message: "חסר נתונים" });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // בדיקה אם כבר קיים משתמש עם אותו username או email
    const existingUser = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }]
    });

    if (existingUser) {
      return res.status(400).json({ ok: false, message: "שם משתמש או אימייל כבר בשימוש" });
    }

    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      name: name.trim(),
      role: "user"
    });

    res.json({
      ok: true,
      message: "נרשמת בהצלחה",
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ ok: false, message: "שגיאה ברישום" });
  }
});




app.get("/user", (req, res) => {
  if (req.cookies && req.cookies.user) {
    try {
      const user = JSON.parse(req.cookies.user);
      return res.json({ ok: true, user });
    } catch {
      return res.json({ ok: false });
    }
  }
  res.json({ ok: false });
});



// ===== API: פיזורים =====
app.post('/dispersals', async (req, res) => {
  try {
    const { date, price, taxi, people, payer, notes } = req.body;
    if (!date || !price) return res.status(400).json({ ok:false, message:'חובה תאריך ומחיר' });

    const doc = await Dispersal.create({
      shiftDate: new Date(date), // ← שמירה כ־Date אמיתי
      price,
      taxi: taxi || '',
      people: Array.isArray(people) ? people : String(people||'').split(',').map(x => x.trim()).filter(Boolean),
      payer: payer || '',
      notes: notes || ''
    });

    res.json({ ok:true, dispersal: doc });
  } catch (e) {
    console.error('create dispersal error', e);
    res.status(500).json({ ok:false, message:'שגיאה ביצירה' });
  }
});

app.get('/dispersals', async (req, res) => {
  try {
    const { date } = req.query;
    const q = {};
    if (date) q.shiftDate = new Date(date); // ← תמיכה בסינון לפי תאריך
    const items = await Dispersal.find(q).sort({ shiftDate: -1 }).lean();

    const formatted = items.map(i => ({
      ...i,
      shiftDate: new Date(i.shiftDate).toLocaleDateString("he-IL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      })
    }));

    res.json(formatted);
  } catch (e) {
    console.error('list dispersals error', e);
    res.status(500).json([]);
  }
});

app.delete('/dispersals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Dispersal.findByIdAndDelete(id);
    res.json({ ok:true });
  } catch (e) {
    console.error('delete dispersal error', e);
    res.status(500).json({ ok:false });
  }
});

app.use((err, req, res, next) => {
  console.error("🔥 Express Error:", err);
  res.status(500).json({ ok:false, message: "Server error", error: err.message });
});
// ===== Start server =====
// app.listen(PORT, () => console.log(`🚀 Server listening on :${PORT}`));ss
if (process.env.VERCEL) {
  module.exports = app; // אין app.listen ב-Vercel
} else {
  app.listen(8080, () => console.log(`🚀 Server listening on :8080`));
}



// === DEBUG: /ping מחזיר JSON ===
app.get('/ping', (req, res) => {
  res.json({ ok: true, where: 'server', url: req.url, vercel: !!process.env.VERCEL });
});

// === DEBUG: רשימת ראוטים שיש לאפליקציה (כולל שיטות) ===
app.get('/debug-routes', (req, res) => {
  const routes = [];
  const stack = app._router?.stack || [];
  for (const layer of stack) {
    if (layer.route) {
      const path = layer.route.path;
      const methods = Object.keys(layer.route.methods).filter(Boolean);
      routes.push({ path, methods });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      for (const l2 of layer.handle.stack) {
        if (l2.route) {
          const path = l2.route.path;
          const methods = Object.keys(l2.route.methods).filter(Boolean);
          routes.push({ path, methods });
        }
      }
    }
  }
  res.json({ vercel: !!process.env.VERCEL, routes });
});