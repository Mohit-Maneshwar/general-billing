// print-agent/agent.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { Printer } = require('node-thermal-printer'); // example
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const DB_PATH = path.join(__dirname, 'bills.db');
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    user TEXT,
    total REAL,
    json TEXT,
    createdAt INTEGER
  )`);
});

// Configure your thermal printer here (USB/Serial/Ethernet) per node-thermal-printer docs
let thermalPrinter = null;
let printerAvailable = false;
try {
    thermalPrinter = new Printer({
        type: Printer.PRINTER_TYPES.APOS,
        interface: '/dev/usb/lp0' // change to correct port on Windows e.g. 'usb' or 'COM3' etc.
    });
    printerAvailable = true;
} catch (e) {
    console.warn('Printer not configured or unavailable:', e && e.message);
    printerAvailable = false;
}

// helper to store
function storeBill(b) {
    return new Promise((res, rej) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO bills (id, user, total, json, createdAt) VALUES (?, ?, ?, ?, ?)`);
        stmt.run(b.id, b.user, b.total, JSON.stringify(b), b.createdAt, (err) => {
            if (err) return rej(err);
            res(true);
        });
    });
}

app.post('/bills', async (req, res) => {
    const bill = req.body;
    if (!bill || !bill.id) return res.status(400).send({ error: 'invalid' });
    try {
        await storeBill(bill);
        res.send({ ok: true });
    } catch (e) { res.status(500).send({ error: e.message }); }
});

app.post('/print', async (req, res) => {
    const bill = req.body;
    try {
        await storeBill(bill);
        if (printerAvailable) {
            try {
                // build print text using ESC/POS
                thermalPrinter.alignCenter();
                thermalPrinter.println("General Billing");
                thermalPrinter.drawLine();
                thermalPrinter.newLine();
                thermalPrinter.println(`User: ${bill.user}`);
                thermalPrinter.println(`Date: ${new Date(bill.createdAt).toLocaleString()}`);
                bill.lines.forEach(l => {
                    thermalPrinter.println(`${l.desc} - ${l.qty} x ₹${l.price} = ₹${l.total}`);
                });
                thermalPrinter.drawLine();
                thermalPrinter.println(`Total: ₹${bill.total}`);
                thermalPrinter.cut();
                const printed = await thermalPrinter.execute(); // may throw
                res.send({ ok: true, printed });
            } catch (pe) {
                console.error('Printing failed:', pe && pe.message);
                // still respond OK since we stored the bill
                res.send({ ok: true, printed: false, warning: 'printing failed' });
            }
        } else {
            // No printer configured; storage succeeded
            res.send({ ok: true, printed: false, warning: 'printer not configured' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).send({ error: e.message });
    }
});

app.get('/printer-status', (req, res) => {
    // Check if thermal printer is available/connected
    res.send({ connected: printerAvailable });
});

app.get('/report', (req, res) => {
    // return bills in last 24 hours aggregated by user
    const cutoff = Date.now() - 24 * 3600000;
    db.all(`SELECT user, COUNT(*) as count, SUM(total) as sum FROM bills WHERE createdAt >= ? GROUP BY user`, [cutoff], (err, rows) => {
        if (err) return res.status(500).send({ error: err.message });
        res.send({ rows });
    });
});

// Cleanup older than 24 hours: run every hour
cron.schedule('0 * * * *', () => {
    const cutoff = Date.now() - 24 * 3600000;
    db.run(`DELETE FROM bills WHERE createdAt < ?`, [cutoff], function (err) {
        if (err) return console.error('cleanup error', err);
        if (this.changes) console.log('Deleted old bills:', this.changes);
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Print agent running on port ${PORT}`));
