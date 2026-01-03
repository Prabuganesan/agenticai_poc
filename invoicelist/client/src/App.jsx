import { useState, useEffect } from 'react';
import axios from 'axios';
import InvoiceList from './components/InvoiceList';
import InvoiceDetail from './components/InvoiceDetail';
import './App.css';

const API_URL = '/api';

function App() {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/invoices`);
      setInvoices(response.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch invoices: ' + err.message);
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInvoice = async (id) => {
    try {
      const response = await axios.get(`${API_URL}/invoices/${id}`);
      setSelectedInvoice(response.data.data);
    } catch (err) {
      setError('Failed to fetch invoice details: ' + err.message);
      console.error('Error fetching invoice details:', err);
    }
  };

  const handleBack = () => {
    setSelectedInvoice(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📧 Invoice Manager</h1>
        <p>Invoices extracted from Gmail</p>
      </header>

      <main className="app-main">
        {loading ? (
          <div className="loading">Loading invoices...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : selectedInvoice ? (
          <InvoiceDetail invoice={selectedInvoice} onBack={handleBack} />
        ) : (
          <InvoiceList invoices={invoices} onSelect={handleSelectInvoice} />
        )}
      </main>
    </div>
  );
}

export default App;
