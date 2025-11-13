import axios from 'axios';
// Use localhost for local agent during development
export const AGENT_BASE = 'http://localhost:3000';

export async function checkPrinterStatus() {
  // Check if thermal printer is connected to the agent
  try {
    const res = await axios.get(`${AGENT_BASE}/printer-status`, { timeout: 3000 });
    return res.data.connected || false;
  } catch (e) {
    // If agent not reachable, printer is definitely not connected
    return false;
  }
}

export async function sendPrintToAgent(bill) {
  // bill object: { id, user, lines: [{desc, qty, price, total}], total, createdAt }
  try {
    const res = await axios.post(`${AGENT_BASE}/print`, bill, { timeout: 5000 });
    return res.data;
  } catch (e) {
    throw e;
  }
}

export async function pushBillToAgent(bill) {
  try {
    const res = await axios.post(`${AGENT_BASE}/bills`, bill, { timeout: 5000 });
    return res.data;
  } catch (e) {
    throw e;
  }
}

export async function fetchReport() {
  const res = await axios.get(`${AGENT_BASE}/report`);
  return res.data;
}
