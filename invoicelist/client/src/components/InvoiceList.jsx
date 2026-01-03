function InvoiceList({ invoices, onSelect }) {
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatCurrency = (amount, currency = 'INR') => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency
        }).format(amount);
    };

    return (
        <div className="invoice-list">
            <h2>All Invoices ({invoices.length})</h2>

            {invoices.length === 0 ? (
                <div className="empty-state">
                    <p>No invoices found</p>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Vendor</th>
                                <th>Date</th>
                                <th>Total</th>
                                <th>Email Subject</th>
                                <th>Received</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((invoice) => (
                                <tr
                                    key={invoice.id}
                                    onClick={() => onSelect(invoice.id)}
                                    className="clickable"
                                >
                                    <td className="invoice-number">{invoice.invoice_number}</td>
                                    <td>{invoice.vendor_name}</td>
                                    <td>{formatDate(invoice.invoice_date)}</td>
                                    <td className="amount">
                                        {formatCurrency(invoice.total_amount, invoice.currency)}
                                    </td>
                                    <td className="subject">{invoice.subject}</td>
                                    <td>{formatDate(invoice.received_date)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default InvoiceList;
