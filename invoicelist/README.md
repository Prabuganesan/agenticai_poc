# Invoice List Application

Simple React + Express application to view invoices extracted from Gmail and stored in PostgreSQL.

## 🏗️ Architecture

```
┌─────────────┐      HTTP      ┌─────────────┐      SQL       ┌──────────────┐
│   React     │ ────────────► │   Express   │ ────────────► │  PostgreSQL  │
│  (Port 5173)│ ◄──────────── │  (Port 5000)│ ◄──────────── │   Database   │
└─────────────┘     JSON       └─────────────┘    Results     └──────────────┘
```

## 📦 Setup

### 1. Backend (Express Server)

```bash
cd server

# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Start server
npm start
```

Server will run on `http://localhost:5000`

### 2. Frontend (React App)

```bash
cd client

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

App will run on `http://localhost:5173`

## 🔌 API Endpoints

### GET /api/invoices
List all invoices with mail metadata

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 1,
      "invoice_number": "0792449123100011",
      "vendor_name": "Khalids Biriyani",
      "invoice_date": "2025-12-31",
      "total_amount": "424.20",
      "currency": "INR",
      "subject": "Your Swiggy order was delivered",
      "sender": "Swiggy <noreply@swiggy.in>",
      "received_date": "2025-12-31T22:50:35.000Z"
    }
  ]
}
```

### GET /api/invoices/:id
Get invoice details with line items

**Response:**
```json
{
  "success": true,
  "data": {
    "header": { ... },
    "line_items": [ ... ]
  }
}
```

## 🎨 Features

- ✅ View all invoices in a table
- ✅ Click to see invoice details
- ✅ Display mail metadata (subject, sender, date)
- ✅ Show line items with quantities and prices
- ✅ Calculate totals (subtotal, tax, total)
- ✅ Responsive design
- ✅ Currency formatting (INR)

## 📁 Project Structure

```
invoicelist/
├── server/
│   ├── index.js          # Express server
│   ├── package.json
│   └── .env.example
└── client/
    ├── src/
    │   ├── App.jsx       # Main app
    │   ├── App.css       # Styles
    │   └── components/
    │       ├── InvoiceList.jsx
    │       └── InvoiceDetail.jsx
    └── package.json
```

## 🚀 Usage

1. **Start the backend:**
   ```bash
   cd server && npm start
   ```

2. **Start the frontend:**
   ```bash
   cd client && npm run dev
   ```

3. **Open browser:**
   Navigate to `http://localhost:5173`

4. **View invoices:**
   - See all invoices in the table
   - Click any row to view details
   - Click "Back to List" to return

## 🔧 Environment Variables

Create `server/.env` with:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=prabu
DB_PASSWORD=postgres
DB_NAME=agent
PORT=5000
```

## 📝 Notes

- Backend must be running for frontend to fetch data
- Database must have invoice data (populated by the agentflow)
- CORS is enabled for local development
