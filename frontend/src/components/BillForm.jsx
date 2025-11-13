import React, { useState, useEffect, useRef } from 'react';
import { sendPrintToAgent, pushBillToAgent, checkPrinterStatus } from '../lib/api';
import { v4 as uuidv4 } from 'uuid';

export default function BillForm({ onSaved }) {
    const [desc, setDesc] = useState('General Item');
    const [qty, setQty] = useState('');
    const [price, setPrice] = useState('');
    const [userName, setUserName] = useState(localStorage.getItem('gb_user') || 'User1');
    const [items, setItems] = useState([]);

    const descRef = useRef(null);
    const qtyRef = useRef(null);
    const priceRef = useRef(null);
    const addBtnRef = useRef(null);

    useEffect(() => {
        const saved = localStorage.getItem('gb_cart');
        if (saved) setItems(JSON.parse(saved));
        // focus first input on mount
        setTimeout(() => descRef.current && descRef.current.focus(), 50);
    }, []);

    function saveCart(next) {
        setItems(next);
        localStorage.setItem('gb_cart', JSON.stringify(next));
    }

    function addItem() {
        const q = Number(qty), p = Number(price);
        if (!q || !p) return alert('Quantity and price required');
        const line = { id: uuidv4(), desc: desc || 'General Item', qty: q, price: p, total: q * p };
        const next = [...items, line];
        saveCart(next);
        setQty(''); setPrice(''); setDesc('General Item');
        // focus quantity for next entry
        setTimeout(() => qtyRef.current && qtyRef.current.focus(), 50);
    }

    function removeItem(id) {
        const next = items.filter(i => i.id !== id);
        saveCart(next);
    }

    function clearCart() {
        saveCart([]);
    }

    function buildBill() {
        if (items.length === 0) return null;
        const id = uuidv4();
        const total = items.reduce((s, i) => s + (i.total || 0), 0);
        return { id, user: userName, lines: items, total, createdAt: Date.now() };
    }

    function saveBillToHistory(bill) {
        const raw = localStorage.getItem('gb_bills');
        const arr = raw ? JSON.parse(raw) : [];
        arr.push(bill);
        localStorage.setItem('gb_bills', JSON.stringify(arr));
    }

    function openPrintPreview(bill) {
        const w = window.open('about:blank', '_blank');
        if (!w) return alert('Popup blocked');
        const rows = bill.lines.map(l => `<tr><td>${l.desc}</td><td>${l.qty}</td><td>₹${l.price.toFixed(2)}</td><td>₹${l.total.toFixed(2)}</td></tr>`).join('');
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bill</title><style>body{font-family:Arial;padding:12px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border:1px solid #ccc;text-align:left}h2{margin-top:0}</style></head><body><h2>Bill - ${bill.user}</h2><div>${new Date(bill.createdAt).toLocaleString()}</div><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3"><strong>Total</strong></td><td><strong>₹${bill.total.toFixed(2)}</strong></td></tr></tfoot></table></body></html>`;
        w.document.write(html);
        w.document.close();
    }

    async function handlePrintPreview() {
        const bill = buildBill();
        if (!bill) return alert('Cart is empty');
        saveBillToHistory(bill);
        openPrintPreview(bill);
        clearCart();
        onSaved && onSaved();
    }

    async function handleShare() {
        const bill = buildBill();
        if (!bill) return alert('Cart is empty');
        const text = `Bill for ${bill.user}\nTotal: ₹${bill.total.toFixed(2)}\nItems:\n` + bill.lines.map(l => `${l.desc} - ${l.qty} x ₹${l.price} = ₹${l.total}`).join('\n');
        if (navigator.share) {
            try { await navigator.share({ title: 'Bill', text }); return; } catch (e) { /* ignore */ }
        }
        try { await navigator.clipboard.writeText(text); alert('Bill copied to clipboard'); } catch (e) { alert(text); }
        // save to history too
        saveBillToHistory(bill);
        clearCart();
        onSaved && onSaved();
    }

    async function handleBluetoothPrint() {
        const bill = buildBill();
        if (!bill) return alert('Cart is empty');

        try {
            // Check if thermal printer is connected
            const printerConnected = await checkPrinterStatus();

            if (!printerConnected) {
                alert('❌ Please connect the thermal printer');
                return;
            }

            // Printer is connected, send to print
            await sendPrintToAgent(bill);
            alert('✓ Bill printed successfully');
            saveBillToHistory(bill);
            clearCart();
            onSaved && onSaved();
        } catch (e) {
            alert('❌ Failed to send bill to printer. Please try again.');
        }
    }

    // keyboard handling: Enter moves to next input or triggers add
    function onDescKey(e) { if (e.key === 'Enter') { e.preventDefault(); qtyRef.current && qtyRef.current.focus(); } }
    function onQtyKey(e) { if (e.key === 'Enter') { e.preventDefault(); priceRef.current && priceRef.current.focus(); } }
    function onPriceKey(e) { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }

    return (
        <div>
            <h3>Billing App</h3>
            <label style={{ display: 'block', marginBottom: 6 }}>User: <input value={userName} onChange={e => { setUserName(e.target.value); localStorage.setItem('gb_user', e.target.value) }} /></label>
            <div style={{ marginBottom: 8 }}>
                <label>Item description</label>
                <input ref={descRef} value={desc} onKeyDown={onDescKey} onChange={e => setDesc(e.target.value)} placeholder="Item description" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <label>Quantity</label>
                    <input ref={qtyRef} value={qty} onKeyDown={onQtyKey} onChange={e => setQty(e.target.value)} type="number" />
                </div>
                <div style={{ flex: 1 }}>
                    <label>Price</label>
                    <input ref={priceRef} value={price} onKeyDown={onPriceKey} onChange={e => setPrice(e.target.value)} type="number" />
                </div>
            </div>
            <div style={{ marginTop: 8 }}>
                <button ref={addBtnRef} onClick={addItem}>Add To Cart</button>
            </div>

            <div style={{ marginTop: 12 }}>
                {items.map(i => (
                    <div key={i.id} style={{ border: '1px solid #ddd', padding: 8, marginBottom: 8 }}>
                        <div>{i.desc} - {i.qty} x ₹{i.price} = ₹{i.total.toFixed(2)}</div>
                        <button onClick={() => removeItem(i.id)}>Remove</button>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button style={{ background: '#3CB371', color: '#fff' }} onClick={handlePrintPreview}>Print Preview</button>
                <button style={{ background: '#FF6347', color: '#fff' }} onClick={() => { clearCart(); }}>Clear Bill</button>
                <button style={{ background: '#1E90FF', color: '#fff' }} onClick={handleShare}>Share Bill</button>
                <button style={{ background: '#800080', color: '#fff' }} onClick={handleBluetoothPrint}>Bluetooth Print</button>
            </div>
        </div>
    );
}
