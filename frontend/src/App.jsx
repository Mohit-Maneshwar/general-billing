import React, { useState } from 'react';
import BillForm from './components/BillForm';
import BillList from './components/BillList';

export default function App() {
  const [tick, setTick] = useState(0);
  return (
    <div className="app-container">
      <BillForm onSaved={() => setTick(t => t + 1)} />
      <BillList key={tick} />
    </div>
  );
}
