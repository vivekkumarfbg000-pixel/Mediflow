import React from 'react';
import './InvoiceCard.css';

interface InvoiceCardProps {
  invoiceId: string;
  patientName: string;
  amount: number;
  status: 'unpaid' | 'paid' | 'refunded';
  onPay?: () => void;
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({ invoiceId, patientName, amount, status, onPay }) => {
  return (
    <div className="invoice-card">
      <h3>Invoice #{invoiceId}</h3>
      <p>Patient: {patientName}</p>
      <p>Amount: ₹{amount.toFixed(2)}</p>
      <p>Status: <span className={`status ${status}`}>{status}</span></p>
      {status === 'unpaid' && onPay && (
        <button className="pay-btn" onClick={onPay}>Pay Now</button>
      )}
    </div>
  );
};
