// server.js
require('dotenv').config();

const express       = require('express');
const path          = require('path');
const cookieParser  = require('cookie-parser');
const bodyParser    = require('body-parser');
const mongoose      = require('mongoose');
const multer        = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { connectMongoose } = require('./db');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const CLOUD_FOLDER = process.env.CLOUDINARY_FOLDER || 'invoices';

// ===== Models =====
const Dispersal  = require('./models/Dispersal');
const Supplier   = require('./models/Supplier');
const Task = require("./models/Task");
const DailyOrder = require('./models/DailyOrder');
const Invoice    = require('./models/Invoice'); // ודא נתיב נכון אצלך

// ===== Utils =====
function isAllowedMime(m) {
  return ['image/jpeg','image/png','image/webp','application/pdf'].includes(m);
}

// ===== App =====
const app  = express();
const PORT = process.env.PORT || 3000;

// ===== Middlewares =====
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());

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


// ===== Schemas for Shifts (כמו אצלך) =====
const ExecutionSchema = new mongoose.Schema({
  task:   { type: String, required: true },
  worker: { type: String, default: '' },
  time:   { type: String, default: '' },
}, { _id: false });

const RuntimeNoteSchema = new mongoose.Schema({
  id:     { type: String, required: true },
  text:   { type: String, required: true },
  author: { type: String, default: 'אחמ״ש' },
  time:   { type: Date,   default: Date.now }
}, { _id: false });

const ShiftSchema = new mongoose.Schema({
  date:   { type: String, required: true, unique: true }, // YYYY-MM-DD
  manager:{ type: String, default: '' },
  team:   { type: [String], default: [] },
scores: {
  type: Map,
  of: Number,
  default: () => new Map()
},
  tasks: {
    daily:   { type: [String], default: [] },
    weekly:  { type: [String], default: [] },
    monthly: { type: [String], default: [] },
  },

  executions: {
    daily:   { type: [ExecutionSchema], default: [] },
    weekly:  { type: [ExecutionSchema], default: [] },
    monthly: { type: [ExecutionSchema], default: [] },
  },

  notes:         { type: String, default: '' },
  runtimeNotes:  { type: [RuntimeNoteSchema], default: [] },
  closed:        { type: Boolean, default: false },
  closedAt:      { type: Date, default: null },
}, { timestamps: true });

const Shift = mongoose.model('Shift', ShiftSchema);

// ===== Helpers =====
const ADMIN_PIN = process.env.ADMIN_PIN || '1111';
function requireLogin(req, res, next) {
  if (req.cookies && req.cookies.user) {
    try {
      req.user = JSON.parse(req.cookies.user); // שיהיה לך user זמין ב־req
      return next();
    } catch {
      res.clearCookie("user");
      return res.redirect("/login");
    }
  }
  return res.redirect("/login");
}
function requireUser(req, res, next) {
  const cookie = req.cookies.user;
  if (!cookie) return res.status(401).json({ ok:false, message:"חייב להתחבר" });

  try {
    const parsed = JSON.parse(cookie);
    if (!parsed.name) {
      return res.status(400).json({ ok:false, message:"משתמש לא תקין (אין שם)" });
    }
    req.user = parsed;
    next();
  } catch {
    return res.status(400).json({ ok:false, message:"קוקי לא תקין" });
  }
}



function requireAdmin(req, res, next) {
  if (req.cookies && req.cookies.adminAuth === 'yes') return next();
  return res.redirect('/admin-login');
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

// ===== Views =====
app.get('/create',requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});
app.get('/', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});
app.get('/manage',requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'manage.html'));
});
app.get('/dispersals-page',requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dispersals.html'));
});
app.get('/orders-page',requireLogin, (req, res) => {               // << דף ההזמנות
  res.sendFile(path.join(__dirname, 'views', 'orders.html'));
});
app.get('/invoices-page',requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'invoices.html'));
});
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'test.html'));
});


app.get('/task', requireLogin,(req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'tasks.html'));
});
app.get('/suppliers-page', requireLogin,(req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'suppliers.html'));
});
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});
// ===== Admin auth pages =====
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin-login.html'));
});
app.post('/admin-login', (req, res) => {
  const { pin } = req.body || {};
  if (pin === ADMIN_PIN) {
    res.cookie('adminAuth', 'yes', {
      httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8
    });
    return res.redirect('/admin');
  }
  return res.status(401).send(`
    <meta charset="utf-8">
    <div style="font-family:system-ui;direction:rtl;padding:20px">
      <h3>קוד שגוי</h3>
      <p>נסה שוב.</p>
      <a href="/admin-login">חזרה</a>
    </div>
  `);
});
app.post('/admin-logout', (req, res) => {
  res.clearCookie('adminAuth', { sameSite: 'lax' });
  res.redirect('/admin-login');
});
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// ===== Cloudinary helper =====
function uploadToCloudinary(buffer, opts = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

// ===== API: חשבוניות =====
app.post('/upload-invoice', upload.single('file'), async (req, res) => {
  try {
    const date = (req.body?.date || '').trim();
    const supplier = (req.body?.supplier || '').trim();
    const f = req.file;

    if (!date || !supplier || !f) {
      return res.status(400).json({ ok:false, message:'חסר date / supplier / קובץ' });
    }
    if (!isAllowedMime(f.mimetype)) {
      return res.status(400).json({ ok:false, message:'סוג קובץ לא נתמך' });
    }

    const folder = `${CLOUD_FOLDER}/shifts/${date}/${encodeURIComponent(supplier)}`;
    const result = await uploadToCloudinary(f.buffer, {
      folder,
      resource_type: 'auto',
      filename_override: f.originalname,
      use_filename: true,
      unique_filename: true
    });

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
      uploadedBy:  'אחמ״ש'
    });

    res.json({ ok:true, message:'החשבונית הועלתה בהצלחה', invoice: row });
  } catch (e) {
    console.error('upload-invoice error:', e);
    res.status(500).json({ ok:false, message:'שגיאה בהעלאת חשבונית' });
  }
});

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
app.post('/save-shift', async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.team = normalizeTeam(payload.team);

await Shift.findOneAndUpdate(
  { date: payload.date },
  {
    $set: payload,
    $setOnInsert: {
      executions: { daily: [], weekly: [], monthly: [] }, // <- היה xecutions
      scores: {} // יווצר במסמך חדש
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

    // === הוספת ניקוד אוטומטית ===
if (worker) {
  const pointsMap = { daily: 1, weekly: 3, monthly: 5 };
  const points = pointsMap[category] || 1;

  // ודא ש-shift.scores קיים
  if (!shift.scores) shift.scores = new Map();

  const currentPoints = shift.scores.get(worker) || 0;
  shift.scores.set(worker, currentPoints + points);
} else {
  console.log("its old")
}

    await shift.save();
    res.json({ ok: true, message: "נשמר ✔", shift });
  } catch (e) {
    console.error("update-single-task error:", e);
    res.status(500).json({ ok: false, message: "שגיאת שרת" });
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

app.post('/finalize-shift', async (req, res) => {
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
        executions: { daily: [], weekly: [], monthly: [] }
      });
    } else {
      if (manager !== undefined) shift.manager = manager;
      if (team !== undefined)    shift.team    = normalizeTeam(team);
    }

    if (!shift.executions) shift.executions = { daily: [], weekly: [], monthly: [] };
    if (executions) upsertExecutions(shift.executions, executions);

    shift.closed  = true;
    shift.closedAt = new Date();

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
app.post('/orders', requireUser, async (req, res) => {
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

app.post('/suppliers', async (req, res) => {
  try {
    const { name, phone, days, items, active } = req.body || {};
    const doc = await Supplier.create({
      name: String(name).trim(),
      phone: String(phone||'').trim(),
      days: Array.isArray(days) ? days.map(Number) : [], // <<< חשוב
      items: Array.isArray(items) ? items.map(it => ({ name: it.name, unit: it.unit||'' })) : [],
      active: active !== undefined ? !!active : true
    });
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

const subscriptions = [];

app.post("/save-subscription", (req, res) => {
  console.log("Got subscription:", req.body);
  if (!req.body || !req.body.endpoint) {
    return res.status(400).json({ ok: false, error: "No subscription" });
  }
  subscriptions.push(req.body);
  res.json({ ok: true });
});
// שליחת הודעה
app.post("/send-notification", async (req, res) => {
  const message = req.body.message || "התראה חדשה";
  const payload = JSON.stringify({
    title: "📢 הודעה מהאדמין",
    body: message
  });

  try {
    await Promise.all(
      subscriptions.map(sub => webpush.sendNotification(sub, payload))
    );
    res.json({ ok: true, message: "נשלח בהצלחה" });
  } catch (err) {
    console.error("שגיאה בשליחת התראה:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


const User = require('./models/user');

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});
app.post("/logout", (req, res) => {
  res.clearCookie("user", { sameSite: "lax" });
  res.json({ ok: true, message: "התנתקת בהצלחה" });
});
app.get("/logout", (req, res) => {
  res.clearCookie("user", { sameSite: "lax" });
  res.redirect("/login"); // אחרי לוגאאוט מחזיר לעמוד התחברות
});
app.post("/login", async (req, res) => {
  const { name, role } = req.body;
  if (!name) return res.json({ ok: false, message: "חובה שם" });

  const user = await User.findOneAndUpdate(
    { name },
    { $set: { name, role } },
    { upsert: true, new: true }
  );

  res.cookie("user", JSON.stringify({ name: user.name, role: user.role }), {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7
  });

  res.json({ ok: true, user });
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
// הוספת נקודות לעובד
app.post("/points/add", async (req, res) => {
  try {
    const { date, worker, amount } = req.body;
    const shift = await Shift.findOne({ date });
    if (!shift) return res.status(404).json({ ok: false, message: "Shift not found" });

    if (!shift.scores) shift.scores = new Map();
    const add = Number(amount || 1);
    const cur = shift.scores.get(worker) || 0;
    shift.scores.set(worker, cur + add);

    await shift.save();
    res.json({ ok: true, worker, points: shift.scores.get(worker) });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});


// דירוג כללי (Leaderboard)
app.get("/points/leaderboard", async (req, res) => {
  try {
    const shifts = await Shift.find({}); // בלי lean כדי ש-Mongoose Map יעבוד
    const totals = {};

    shifts.forEach(s => {
      if (s.scores) {
        s.scores.forEach((pts, name) => {
          totals[name] = (totals[name] || 0) + (pts || 0);
        });
      }
    });

    const leaderboard = Object.entries(totals)
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points);

    res.json({ ok: true, leaderboard });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
}); 




// ===== API: פיזורים =====
app.post('/dispersals', async (req, res) => {
  try {
    const { date, price, taxi, people, payer, notes } = req.body;
    if (!date || !price) return res.status(400).json({ ok:false, message:'חובה תאריך ומחיר' });

    const doc = await Dispersal.create({
      shiftDate: date,
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
    if (date) q.shiftDate = date;
    const items = await Dispersal.find(q).sort({ createdAt: -1 }).lean();
    res.json(items);
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

// ===== Start server =====
// app.listen(PORT, () => console.log(`🚀 Server listening on :${PORT}`));ss
if (process.env.VERCEL) {
  module.exports = app; // אין app.listen ב-Vercel
} else {
  app.listen(PORT, () => console.log(`🚀 Server listening on :${PORT}`));
}

// === DEBUG MIDDLEWARE (מדפיס כל בקשה שמגיעה ל-Express) ===
app.use((req, res, next) => {
  console.log(`[EXPRESS] ${process.env.VERCEL ? 'VERCEL' : 'LOCAL'} ${req.method} ${req.url}`);
  next();
});

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