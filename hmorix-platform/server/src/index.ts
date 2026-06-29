import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import path from 'path'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Database setup (SQLite - compatible with Cloudflare D1 schema)
const dbPath = path.join(__dirname, '..', 'data', 'hmorix.db')
const db = new Database(dbPath)

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    status TEXT DEFAULT 'in_progress',
    progress INTEGER DEFAULT 0,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    product TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending',
    due_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ai_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    task_type TEXT NOT NULL,
    client_name TEXT,
    status TEXT DEFAULT 'queued',
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS pdf_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    total_docs INTEGER DEFAULT 1,
    processed_docs INTEGER DEFAULT 0,
    status TEXT DEFAULT 'processing',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS contact_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    service TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

// Seed some demo data
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any
if (userCount.count === 0) {
  db.prepare(`INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)`).run('admin@hmorix.com', 'Admin User', 'hashed_password', 'admin')
  
  db.prepare(`INSERT INTO projects (name, client_name, status, progress) VALUES (?, ?, ?, ?)`).run('CRM Rebuild', 'Meridian Corp', 'in_progress', 87)
  db.prepare(`INSERT INTO projects (name, client_name, status, progress) VALUES (?, ?, ?, ?)`).run('Security Audit', 'NovaTech', 'in_progress', 64)
  db.prepare(`INSERT INTO projects (name, client_name, status, progress) VALUES (?, ?, ?, ?)`).run('PDF Migration', 'Apex Corp', 'complete', 100)

  db.prepare(`INSERT INTO invoices (invoice_number, client_name, amount, status, due_date) VALUES (?, ?, ?, ?, ?)`).run('INV-2841', 'Meridian Corp', 4200, 'paid', '2024-07-15')
  db.prepare(`INSERT INTO invoices (invoice_number, client_name, amount, status, due_date) VALUES (?, ?, ?, ?, ?)`).run('INV-2842', 'NovaTech', 8750, 'pending', '2024-07-20')
  db.prepare(`INSERT INTO invoices (invoice_number, client_name, amount, status, due_date) VALUES (?, ?, ?, ?, ?)`).run('INV-2843', 'Apex Corp', 2100, 'paid', '2024-07-10')

  db.prepare(`INSERT INTO ai_jobs (job_id, task_type, client_name, status) VALUES (?, ?, ?, ?)`).run('AGT-4821', 'Website Generation', 'Meridian', 'complete')
  db.prepare(`INSERT INTO ai_jobs (job_id, task_type, client_name, status) VALUES (?, ?, ?, ?)`).run('AGT-4822', 'Workflow Automation', 'NovaTech', 'running')

  db.prepare(`INSERT INTO pdf_jobs (job_id, filename, total_docs, processed_docs, status) VALUES (?, ?, ?, ?, ?)`).run('PDF-9912', 'contracts_batch_Q3.csv', 2840, 2840, 'complete')
  db.prepare(`INSERT INTO pdf_jobs (job_id, filename, total_docs, processed_docs, status) VALUES (?, ?, ?, ?, ?)`).run('PDF-9913', 'invoices_june.zip', 1420, 1089, 'processing')
}

// ============ API ROUTES ============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
})

// Auth routes
app.post('/api/auth/signin', (req, res) => {
  const { email, password } = req.body
  const user = db.prepare('SELECT id, email, name, role FROM users WHERE email = ?').get(email) as any
  if (user) {
    res.json({ success: true, user, token: 'demo_jwt_token_' + user.id })
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' })
  }
})

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body
  res.json({ success: true, message: 'Password reset link sent to ' + email })
})

app.post('/api/auth/verify', (req, res) => {
  const { code } = req.body
  res.json({ success: true, message: 'Account verified successfully' })
})

// Projects
app.get('/api/projects', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()
  res.json({ success: true, data: projects })
})

// Invoices
app.get('/api/invoices', (req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all()
  res.json({ success: true, data: invoices })
})

app.post('/api/invoices', (req, res) => {
  const { invoice_number, client_name, amount, currency, due_date } = req.body
  const result = db.prepare('INSERT INTO invoices (invoice_number, client_name, amount, currency, due_date) VALUES (?, ?, ?, ?, ?)').run(invoice_number, client_name, amount, currency || 'USD', due_date)
  res.json({ success: true, id: result.lastInsertRowid })
})

// Support Tickets
app.get('/api/tickets', (req, res) => {
  const tickets = db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC').all()
  res.json({ success: true, data: tickets })
})

app.post('/api/tickets', (req, res) => {
  const { subject, description, priority, product } = req.body
  const result = db.prepare('INSERT INTO support_tickets (subject, description, priority, product) VALUES (?, ?, ?, ?)').run(subject, description, priority || 'medium', product)
  res.json({ success: true, id: result.lastInsertRowid })
})

// AI Jobs
app.get('/api/ai-jobs', (req, res) => {
  const jobs = db.prepare('SELECT * FROM ai_jobs ORDER BY created_at DESC').all()
  res.json({ success: true, data: jobs })
})

// PDF Jobs
app.get('/api/pdf-jobs', (req, res) => {
  const jobs = db.prepare('SELECT * FROM pdf_jobs ORDER BY created_at DESC').all()
  res.json({ success: true, data: jobs })
})

// Contact form
app.post('/api/contact', (req, res) => {
  const { first_name, last_name, email, service, message } = req.body
  const result = db.prepare('INSERT INTO contact_submissions (first_name, last_name, email, service, message) VALUES (?, ?, ?, ?, ?)').run(first_name, last_name, email, service, message)
  res.json({ success: true, id: result.lastInsertRowid })
})

// Notifications
app.get('/api/notifications', (req, res) => {
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20').all()
  res.json({ success: true, data: notifications })
})

// Dashboard stats
app.get('/api/dashboard/stats', (req, res) => {
  const projectCount = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as any).count
  const invoiceTotal = (db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = ?').get('paid') as any).total
  const aiJobCount = (db.prepare('SELECT COUNT(*) as count FROM ai_jobs').get() as any).count
  const ticketCount = (db.prepare('SELECT COUNT(*) as count FROM support_tickets WHERE status != ?').get('resolved') as any).count

  res.json({
    success: true,
    data: {
      revenue: invoiceTotal,
      active_projects: projectCount,
      ai_jobs_completed: aiJobCount,
      open_tickets: ticketCount,
      security_score: 98.7,
      uptime: 99.98,
    }
  })
})

// System status
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      overall: 'operational',
      services: [
        { name: 'HMorix Cloud Platform', status: 'operational', uptime: 99.99 },
        { name: 'BillingFlow API', status: 'operational', uptime: 99.98 },
        { name: 'AI Agent Service', status: 'operational', uptime: 99.95 },
        { name: 'PDF Processing Engine', status: 'operational', uptime: 99.97 },
        { name: 'Smart Home Gateway', status: 'operational', uptime: 99.96 },
        { name: 'Authentication Service', status: 'operational', uptime: 99.99 },
        { name: 'CDN & Static Assets', status: 'operational', uptime: 100 },
        { name: 'Database Cluster', status: 'operational', uptime: 99.99 },
      ]
    }
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HMorix API Server running on port ${PORT}`)
})

export default app
