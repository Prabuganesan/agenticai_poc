function InvoiceDetail({ invoice, onBack }) {
    const { header, line_items } = invoice;

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
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
        <div className="invoice-detail">
            <button onClick={onBack} className="back-button">
                ← Back to List
            </button>

            {/* Mail Metadata */}
            <div className="card mail-metadata">
                <h3>📧 Email Details</h3>
                <div className="metadata-grid">
                    <div>
                        <strong>Subject:</strong> {header.subject}
                    </div>
                    <div>
                        <strong>From:</strong> {header.sender}
                    </div>
                    <div>
                        <strong>Received:</strong> {formatDate(header.received_date)}
                    </div>
                    <div>
                        <strong>Gmail ID:</strong> {header.gmail_message_id}
                    </div>
                </div>
            </div>

            {/* Invoice Header */}
            <div className="card invoice-header">
                <h3>📄 Invoice Details</h3>
                <div className="header-grid">
                    <div>
                        <strong>Invoice Number:</strong> {header.invoice_number}
                    </div>
                    <div>
                        <strong>Invoice Date:</strong> {formatDate(header.invoice_date)}
                    </div>
                    <div>
                        <strong>Vendor:</strong> {header.vendor_name}
                    </div>
                    <div>
                        <strong>Currency:</strong> {header.currency}
                    </div>
                </div>

                {header.vendor_address && (
                    <div className="address">
                        <strong>Vendor Address:</strong>
                        <p>{header.vendor_address}</p>
                    </div>
                )}

                {header.billing_address && (
                    <div className="address">
                        <strong>Billing Address:</strong>
                        <p>{header.billing_address}</p>
                    </div>
                )}
            </div>

            {/* Line Items */}
            <div className="card line-items">
                <h3>📋 Line Items</h3>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Description</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {line_items.map((item) => (
                            <tr key={item.id}>
                                <td>{item.line_number}</td>
                                <td>{item.description}</td>
                                <td>{item.quantity}</td>
                                <td>{formatCurrency(item.unit_price, header.currency)}</td>
                                <td className="amount">
                                    {formatCurrency(item.amount, header.currency)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="card totals">
                <h3>💰 Totals</h3>
                <div className="totals-grid">
                    <div className="total-row">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(header.subtotal, header.currency)}</span>
                    </div>
                    <div className="total-row">
                        <span>Tax ({header.tax_percentage}%):</span>
                        <span>{formatCurrency(header.tax_amount, header.currency)}</span>
                    </div>
                    <div className="total-row final">
                        <span><strong>Total Amount:</strong></span>
                        <span><strong>{formatCurrency(header.total_amount, header.currency)}</strong></span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default InvoiceDetail;
