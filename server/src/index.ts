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
    company TEXT,
    phone TEXT,
    avatar_url TEXT,
    two_factor_enabled INTEGER DEFAULT 0,
    plan TEXT DEFAULT 'free',
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
    deadline TEXT,
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
    assigned_to TEXT,
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
    items TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ai_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    task_type TEXT NOT NULL,
    client_name TEXT,
    status TEXT DEFAULT 'queued',
    result TEXT,
    tokens_used INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
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
    confidence REAL DEFAULT 0,
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
    type TEXT DEFAULT 'info',
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'general',
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    last_used DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    device TEXT NOT NULL,
    ip_address TEXT,
    location TEXT,
    is_current INTEGER DEFAULT 0,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    theme TEXT DEFAULT 'dark',
    accent_color TEXT DEFAULT '#C8FF00',
    language TEXT DEFAULT 'en-US',
    timezone TEXT DEFAULT 'America/Los_Angeles',
    date_format TEXT DEFAULT 'MM/DD/YYYY',
    currency TEXT DEFAULT 'USD',
    email_notifications INTEGER DEFAULT 1,
    push_notifications INTEGER DEFAULT 1,
    security_alerts INTEGER DEFAULT 1,
    product_updates INTEGER DEFAULT 0,
    weekly_digest INTEGER DEFAULT 1,
    sidebar_expanded INTEGER DEFAULT 1,
    font_size INTEGER DEFAULT 14,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    connected INTEGER DEFAULT 0,
    config TEXT,
    connected_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

// Seed demo data
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any
if (userCount.count === 0) {
  db.prepare(`INSERT INTO users (email, name, password_hash, role, company, phone, two_factor_enabled, plan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('admin@hmorix.com', 'John Doe', 'hashed_password', 'admin', 'HMorix Technologies', '+1 (555) 123-4567', 1, 'enterprise')
  
  db.prepare(`INSERT INTO projects (name, client_name, status, progress, deadline) VALUES (?, ?, ?, ?, ?)`).run('CRM Platform Rebuild', 'Meridian Corp', 'in_progress', 87, '2024-08-15')
  db.prepare(`INSERT INTO projects (name, client_name, status, progress, deadline) VALUES (?, ?, ?, ?, ?)`).run('Security Audit & Compliance', 'NovaTech', 'in_progress', 64, '2024-09-01')
  db.prepare(`INSERT INTO projects (name, client_name, status, progress, deadline) VALUES (?, ?, ?, ?, ?)`).run('PDF Migration System', 'Apex Corp', 'complete', 100, '2024-07-01')

  db.prepare(`INSERT INTO invoices (invoice_number, client_name, amount, status, due_date) VALUES (?, ?, ?, ?, ?)`).run('INV-2841', 'Meridian Corp', 4200, 'paid', '2024-07-15')
  db.prepare(`INSERT INTO invoices (invoice_number, client_name, amount, status, due_date) VALUES (?, ?, ?, ?, ?)`).run('INV-2842', 'NovaTech', 8750, 'pending', '2024-07-20')
  db.prepare(`INSERT INTO invoices (invoice_number, client_name, amount, status, due_date) VALUES (?, ?, ?, ?, ?)`).run('INV-2843', 'Apex Corp', 2100, 'paid', '2024-07-10')

  db.prepare(`INSERT INTO ai_jobs (job_id, task_type, client_name, status, tokens_used, duration_ms) VALUES (?, ?, ?, ?, ?, ?)`).run('AGT-4821', 'Website Generation', 'Meridian', 'complete', 4821, 12400)
  db.prepare(`INSERT INTO ai_jobs (job_id, task_type, client_name, status, tokens_used, duration_ms) VALUES (?, ?, ?, ?, ?, ?)`).run('AGT-4822', 'Workflow Automation', 'NovaTech', 'running', 2100, 0)
  db.prepare(`INSERT INTO ai_jobs (job_id, task_type, client_name, status, tokens_used, duration_ms) VALUES (?, ?, ?, ?, ?, ?)`).run('AGT-4823', 'Document Summarization', 'Apex Corp', 'complete', 1247, 3421)

  db.prepare(`INSERT INTO pdf_jobs (job_id, filename, total_docs, processed_docs, status, confidence) VALUES (?, ?, ?, ?, ?, ?)`).run('PDF-9912', 'contracts_batch_Q3.csv', 2840, 2840, 'complete', 0.987)
  db.prepare(`INSERT INTO pdf_jobs (job_id, filename, total_docs, processed_docs, status, confidence) VALUES (?, ?, ?, ?, ?, ?)`).run('PDF-9913', 'invoices_june.zip', 1420, 1089, 'processing', 0.992)

  db.prepare(`INSERT INTO support_tickets (subject, description, priority, status, product, assigned_to) VALUES (?, ?, ?, ?, ?, ?)`).run('BillingFlow webhook not firing', 'Webhooks configured for invoice.paid event are not being delivered', 'high', 'in_progress', 'BillingFlow', 'Mike Johnson')
  db.prepare(`INSERT INTO support_tickets (subject, description, priority, status, product, assigned_to) VALUES (?, ?, ?, ?, ?, ?)`).run('PDF extraction accuracy issue', 'Tables in scanned documents have lower accuracy', 'medium', 'open', 'PDF Automation', 'Emily Park')

  db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`).run(1, 'Deployment successful', 'BillingFlow v2.4.1 deployed to production', 'deploy')
  db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`).run(1, 'New ticket assigned', 'TKT-4522 requires your attention', 'ticket')
  db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`).run(1, 'Security scan complete', 'No vulnerabilities found in latest scan', 'security')

  db.prepare(`INSERT INTO activity_log (user_id, action, description, type) VALUES (?, ?, ?, ?)`).run(1, 'Deployed BillingFlow v2.4', 'Production deployment to all regions', 'deploy')
  db.prepare(`INSERT INTO activity_log (user_id, action, description, type) VALUES (?, ?, ?, ?)`).run(1, 'Updated security settings', 'Enabled IP allowlisting', 'security')
  db.prepare(`INSERT INTO activity_log (user_id, action, description, type) VALUES (?, ?, ?, ?)`).run(1, 'Created new API key', 'Production key for CI/CD pipeline', 'api')
  db.prepare(`INSERT INTO activity_log (user_id, action, description, type) VALUES (?, ?, ?, ?)`).run(1, 'Invited team member', 'sarah@hmorix.com added to Engineering', 'team')
  db.prepare(`INSERT INTO activity_log (user_id, action, description, type) VALUES (?, ?, ?, ?)`).run(1, 'Resolved ticket TKT-4521', 'BillingFlow webhook issue fixed', 'ticket')

  db.prepare(`INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?)`).run(1, 'Production Key', 'hm_live_sk_...4f2a', 'hash1')
  db.prepare(`INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?)`).run(1, 'Development Key', 'hm_test_sk_...8b1c', 'hash2')
  db.prepare(`INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?)`).run(1, 'CI/CD Pipeline', 'hm_live_sk_...9d3e', 'hash3')

  db.prepare(`INSERT INTO sessions (user_id, device, ip_address, location, is_current) VALUES (?, ?, ?, ?, ?)`).run(1, 'MacBook Pro - Chrome', '192.168.1.1', 'San Francisco, CA', 1)
  db.prepare(`INSERT INTO sessions (user_id, device, ip_address, location, is_current) VALUES (?, ?, ?, ?, ?)`).run(1, 'iPhone 15 - Safari', '192.168.1.2', 'San Francisco, CA', 0)
  db.prepare(`INSERT INTO sessions (user_id, device, ip_address, location, is_current) VALUES (?, ?, ?, ?, ?)`).run(1, 'Windows PC - Firefox', '10.0.0.5', 'New York, NY', 0)

  db.prepare(`INSERT INTO user_settings (user_id) VALUES (?)`).run(1)

  db.prepare(`INSERT INTO integrations (user_id, name, provider, connected) VALUES (?, ?, ?, ?)`).run(1, 'Slack', 'slack', 1)
  db.prepare(`INSERT INTO integrations (user_id, name, provider, connected) VALUES (?, ?, ?, ?)`).run(1, 'GitHub', 'github', 1)
  db.prepare(`INSERT INTO integrations (user_id, name, provider, connected) VALUES (?, ?, ?, ?)`).run(1, 'Stripe', 'stripe', 1)
  db.prepare(`INSERT INTO integrations (user_id, name, provider, connected) VALUES (?, ?, ?, ?)`).run(1, 'AWS', 'aws', 1)
  db.prepare(`INSERT INTO integrations (user_id, name, provider, connected) VALUES (?, ?, ?, ?)`).run(1, 'Jira', 'jira', 0)
  db.prepare(`INSERT INTO integrations (user_id, name, provider, connected) VALUES (?, ?, ?, ?)`).run(1, 'Google Workspace', 'google', 0)
}

// ============ API ROUTES ============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' })
})

// ============ AUTH ============
app.post('/api/auth/signin', (req, res) => {
  const { email, password } = req.body
  const user = db.prepare('SELECT id, email, name, role, company, plan FROM users WHERE email = ?').get(email) as any
  if (user) {
    res.json({ success: true, user, token: 'demo_jwt_token_' + user.id })
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' })
  }
})

app.post('/api/auth/signup', (req, res) => {
  const { email, name, password, company } = req.body
  try {
    const result = db.prepare('INSERT INTO users (email, name, password_hash, company) VALUES (?, ?, ?, ?)').run(email, name, 'hashed_' + password, company || '')
    res.json({ success: true, id: result.lastInsertRowid, message: 'Account created. Please verify your email.' })
  } catch (e: any) {
    res.status(400).json({ success: false, message: 'Email already registered' })
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

app.post('/api/auth/search-account', (req, res) => {
  const { query } = req.body
  const user = db.prepare('SELECT id, email, name FROM users WHERE email = ? OR phone = ?').get(query, query) as any
  if (user) {
    res.json({ success: true, found: true, user: { name: user.name, email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') } })
  } else {
    res.json({ success: true, found: false })
  }
})

// ============ PROFILE ============
app.get('/api/profile', (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, company, phone, two_factor_enabled, plan, created_at FROM users WHERE id = 1').get() as any
  res.json({ success: true, data: user })
})

app.put('/api/profile', (req, res) => {
  const { name, email, phone, company } = req.body
  db.prepare('UPDATE users SET name = ?, email = ?, phone = ?, company = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(name, email, phone, company)
  res.json({ success: true, message: 'Profile updated' })
})

app.put('/api/profile/password', (req, res) => {
  const { current_password, new_password } = req.body
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run('hashed_' + new_password)
  res.json({ success: true, message: 'Password updated' })
})

// ============ SETTINGS ============
app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = 1').get() as any
  res.json({ success: true, data: settings })
})

app.put('/api/settings', (req, res) => {
  const fields = req.body
  const keys = Object.keys(fields)
  const setClause = keys.map(k => `${k} = ?`).join(', ')
  const values = keys.map(k => fields[k])
  db.prepare(`UPDATE user_settings SET ${setClause} WHERE user_id = 1`).run(...values)
  res.json({ success: true, message: 'Settings updated' })
})

// ============ API KEYS ============
app.get('/api/keys', (req, res) => {
  const keys = db.prepare('SELECT id, name, key_prefix, last_used, created_at FROM api_keys WHERE user_id = 1').all()
  res.json({ success: true, data: keys })
})

app.post('/api/keys', (req, res) => {
  const { name } = req.body
  const prefix = 'hm_live_sk_...' + Math.random().toString(36).substring(2, 6)
  const result = db.prepare('INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?)').run(1, name, prefix, 'hash_' + Date.now())
  res.json({ success: true, id: result.lastInsertRowid, key: 'hm_live_sk_' + Math.random().toString(36).substring(2, 34) })
})

app.delete('/api/keys/:id', (req, res) => {
  db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = 1').run(req.params.id)
  res.json({ success: true, message: 'API key revoked' })
})

// ============ SESSIONS ============
app.get('/api/sessions', (req, res) => {
  const sessions = db.prepare('SELECT * FROM sessions WHERE user_id = 1 ORDER BY last_active DESC').all()
  res.json({ success: true, data: sessions })
})

app.delete('/api/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = 1 AND is_current = 0').run(req.params.id)
  res.json({ success: true, message: 'Session revoked' })
})

// ============ INTEGRATIONS ============
app.get('/api/integrations', (req, res) => {
  const integrations = db.prepare('SELECT * FROM integrations WHERE user_id = 1').all()
  res.json({ success: true, data: integrations })
})

app.put('/api/integrations/:id/connect', (req, res) => {
  db.prepare('UPDATE integrations SET connected = 1, connected_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = 1').run(req.params.id)
  res.json({ success: true, message: 'Integration connected' })
})

app.put('/api/integrations/:id/disconnect', (req, res) => {
  db.prepare('UPDATE integrations SET connected = 0, connected_at = NULL WHERE id = ? AND user_id = 1').run(req.params.id)
  res.json({ success: true, message: 'Integration disconnected' })
})

// ============ ACTIVITY ============
app.get('/api/activity', (req, res) => {
  const activity = db.prepare('SELECT * FROM activity_log WHERE user_id = 1 ORDER BY created_at DESC LIMIT 50').all()
  res.json({ success: true, data: activity })
})

// ============ PROJECTS ============
app.get('/api/projects', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()
  res.json({ success: true, data: projects })
})

app.post('/api/projects', (req, res) => {
  const { name, client_name, description, deadline } = req.body
  const result = db.prepare('INSERT INTO projects (name, client_name, description, deadline) VALUES (?, ?, ?, ?)').run(name, client_name, description, deadline)
  res.json({ success: true, id: result.lastInsertRowid })
})

// ============ INVOICES ============
app.get('/api/invoices', (req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all()
  res.json({ success: true, data: invoices })
})

app.post('/api/invoices', (req, res) => {
  const { invoice_number, client_name, amount, currency, due_date, items } = req.body
  const result = db.prepare('INSERT INTO invoices (invoice_number, client_name, amount, currency, due_date, items) VALUES (?, ?, ?, ?, ?, ?)').run(invoice_number, client_name, amount, currency || 'USD', due_date, JSON.stringify(items || []))
  res.json({ success: true, id: result.lastInsertRowid })
})

// ============ SUPPORT TICKETS ============
app.get('/api/tickets', (req, res) => {
  const tickets = db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC').all()
  res.json({ success: true, data: tickets })
})

app.post('/api/tickets', (req, res) => {
  const { subject, description, priority, product } = req.body
  const result = db.prepare('INSERT INTO support_tickets (subject, description, priority, product) VALUES (?, ?, ?, ?)').run(subject, description, priority || 'medium', product)
  res.json({ success: true, id: result.lastInsertRowid })
})

app.put('/api/tickets/:id/status', (req, res) => {
  const { status } = req.body
  db.prepare('UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id)
  res.json({ success: true, message: 'Ticket updated' })
})

// ============ AI JOBS ============
app.get('/api/ai-jobs', (req, res) => {
  const jobs = db.prepare('SELECT * FROM ai_jobs ORDER BY created_at DESC').all()
  res.json({ success: true, data: jobs })
})

app.post('/api/ai-jobs', (req, res) => {
  const { task_type, client_name } = req.body
  const jobId = 'AGT-' + Math.floor(Math.random() * 10000)
  const result = db.prepare('INSERT INTO ai_jobs (job_id, task_type, client_name, status) VALUES (?, ?, ?, ?)').run(jobId, task_type, client_name, 'queued')
  res.json({ success: true, id: result.lastInsertRowid, job_id: jobId })
})

// ============ PDF JOBS ============
app.get('/api/pdf-jobs', (req, res) => {
  const jobs = db.prepare('SELECT * FROM pdf_jobs ORDER BY created_at DESC').all()
  res.json({ success: true, data: jobs })
})

app.post('/api/pdf-jobs', (req, res) => {
  const { filename, total_docs } = req.body
  const jobId = 'PDF-' + Math.floor(Math.random() * 10000)
  const result = db.prepare('INSERT INTO pdf_jobs (job_id, filename, total_docs, status) VALUES (?, ?, ?, ?)').run(jobId, filename, total_docs || 1, 'processing')
  res.json({ success: true, id: result.lastInsertRowid, job_id: jobId })
})

// ============ CONTACT ============
app.post('/api/contact', (req, res) => {
  const { first_name, last_name, email, service, message } = req.body
  const result = db.prepare('INSERT INTO contact_submissions (first_name, last_name, email, service, message) VALUES (?, ?, ?, ?, ?)').run(first_name, last_name, email, service, message)
  res.json({ success: true, id: result.lastInsertRowid })
})

// ============ NOTIFICATIONS ============
app.get('/api/notifications', (req, res) => {
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = 1 ORDER BY created_at DESC LIMIT 20').all()
  res.json({ success: true, data: notifications })
})

app.put('/api/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = 1').run()
  res.json({ success: true, message: 'All notifications marked as read' })
})

app.put('/api/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = 1').run(req.params.id)
  res.json({ success: true })
})

// ============ DASHBOARD STATS ============
app.get('/api/dashboard/stats', (req, res) => {
  const projectCount = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as any).count
  const invoiceTotal = (db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = ?').get('paid') as any).total
  const aiJobCount = (db.prepare('SELECT COUNT(*) as count FROM ai_jobs').get() as any).count
  const pdfJobCount = (db.prepare('SELECT COUNT(*) as count FROM pdf_jobs').get() as any).count
  const ticketCount = (db.prepare('SELECT COUNT(*) as count FROM support_tickets WHERE status != ?').get('resolved') as any).count

  res.json({
    success: true,
    data: {
      revenue: invoiceTotal,
      revenue_change: '+12.4%',
      active_projects: projectCount,
      ai_jobs_completed: aiJobCount,
      pdf_jobs_total: pdfJobCount,
      open_tickets: ticketCount,
      security_score: 98.7,
      uptime: 99.98,
      api_calls_30d: 48291,
      storage_used_gb: 2.4,
      team_members: 8,
    }
  })
})

// ============ SYSTEM STATUS ============
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      overall: 'operational',
      last_incident: '2024-06-15T10:30:00Z',
      services: [
        { name: 'HMorix Cloud Platform', status: 'operational', uptime: 99.99, latency_ms: 12 },
        { name: 'BillingFlow API', status: 'operational', uptime: 99.98, latency_ms: 45 },
        { name: 'AI Agent Service', status: 'operational', uptime: 99.95, latency_ms: 230 },
        { name: 'PDF Processing Engine', status: 'operational', uptime: 99.97, latency_ms: 180 },
        { name: 'Smart Home Gateway', status: 'operational', uptime: 99.96, latency_ms: 35 },
        { name: 'Authentication Service', status: 'operational', uptime: 99.99, latency_ms: 8 },
        { name: 'CDN & Static Assets', status: 'operational', uptime: 100, latency_ms: 3 },
        { name: 'Database Cluster', status: 'operational', uptime: 99.99, latency_ms: 5 },
        { name: 'Webhook Delivery', status: 'operational', uptime: 99.94, latency_ms: 120 },
        { name: 'Email Service', status: 'operational', uptime: 99.98, latency_ms: 250 },
      ]
    }
  })
})

// ============ SEARCH (Universal) ============
app.get('/api/search', (req, res) => {
  const q = (req.query.q as string || '').toLowerCase()
  const results: any[] = []

  // Search projects
  const projects = db.prepare("SELECT 'project' as type, name as title, client_name as subtitle FROM projects WHERE LOWER(name) LIKE ? OR LOWER(client_name) LIKE ?").all(`%${q}%`, `%${q}%`)
  results.push(...projects)

  // Search invoices
  const invoices = db.prepare("SELECT 'invoice' as type, invoice_number as title, client_name as subtitle FROM invoices WHERE LOWER(invoice_number) LIKE ? OR LOWER(client_name) LIKE ?").all(`%${q}%`, `%${q}%`)
  results.push(...invoices)

  // Search tickets
  const tickets = db.prepare("SELECT 'ticket' as type, subject as title, product as subtitle FROM support_tickets WHERE LOWER(subject) LIKE ? OR LOWER(product) LIKE ?").all(`%${q}%`, `%${q}%`)
  results.push(...tickets)

  res.json({ success: true, data: results, total: results.length })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HMorix API Server running on port ${PORT}`)
})

export default app
