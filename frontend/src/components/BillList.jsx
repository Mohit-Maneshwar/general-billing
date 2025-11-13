import React, { useEffect, useState } from 'react';
import { sendPrintToAgent, pushBillToAgent } from '../lib/api';

export default function BillList() {
    const [bills, setBills] = useState([]);
    function load() {
        const raw = localStorage.getItem('gb_bills');
        const all = raw ? JSON.parse(raw) : [];
        setBills(all.sort((a, b) => b.createdAt - a.createdAt));
    }
    useEffect(() => { load(); }, []);
    async function reprint(b) {
        try {
            await sendPrintToAgent(b);
            alert('Sent to printer');
        } catch (e) { alert('Agent not reachable'); }
    }
    async function push(b) {
        try {
            await pushBillToAgent(b);
            alert('Pushed to agent DB');
        } catch (e) { alert('Agent not reachable'); }
    }
    function deleteBill(id) {
        if (!window.confirm('Delete this bill?')) return;
        const raw = localStorage.getItem('gb_bills');
        if (!raw) return load();
        const arr = JSON.parse(raw).filter(b => b.id !== id);
        localStorage.setItem('gb_bills', JSON.stringify(arr));
        load();
    }
    function cleanupOlderThan(hours = 24) {
        const cutoff = Date.now() - hours * 3600000;
        const raw = localStorage.getItem('gb_bills');
        if (!raw) return load();
        const arr = JSON.parse(raw).filter(b => b.createdAt >= cutoff);
        localStorage.setItem('gb_bills', JSON.stringify(arr));
        load();
    }
    return (
        <div>
            <h4>Local Bills</h4>
            <button onClick={async () => { cleanupOlderThan(24); }}>Cleanup older than 24 hours</button>
            {bills.map(b => (
                <div key={b.id} style={{ border: '1px solid #ddd', padding: 8, margin: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>{b.user} - ₹{b.total.toFixed(2)}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button style={{ background: '#5daf76ff', color: '#fff' }} onClick={() => reprint(b)}>Reprint</button>
                            
                            <button style={{ background: '#FF6347', color: '#fff' }} onClick={() => deleteBill(b.id)}>Delete</button>
                        </div>
                    </div>
                    <div>{new Date(b.createdAt).toLocaleString()}</div>
                </div>
            ))}
        </div>
    );
}
