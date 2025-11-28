# Inventory Management System

## Overview
This is a full-stack Inventory Management System designed to manage products, customers, suppliers, sales, credits, and stock. It features a Node.js/Express backend with a MySQL database and a static HTML/CSS/JS frontend.

---

## Folder Structure

```
project-root/
│
├── backend/
│   ├── config/         # Database configuration
│   ├── controllers/    # Express route controllers (business logic)
│   ├── models/         # Database models and queries
│   ├── public/         # Static assets (images, uploads)
│   ├── routes/         # Express route definitions
│   └── scheduler/      # Scheduled/cron jobs (e.g., interest calculation)
│
├── frontend/           # Static HTML, CSS, JS for the UI
│   ├── css/            # Stylesheets
│   ├── js/             # Frontend JavaScript
│   ├── image/          # Frontend images
│   └── *.html          # Main HTML pages
│
├── server.js           # Main Express server entry point
├── package.json        # Node.js dependencies and scripts
├── package-lock.json   # Dependency lock file
└── README.md           # Project documentation
```

---

## Setup Instructions

### 1. Prerequisites
- Node.js (v14+ recommended)
- MySQL server

### 2. Clone the Repository
```sh
git clone <your-repo-url>
cd inventory_management
```

### 3. Install Dependencies
```sh
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the project root with your database credentials:

```
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=fertilizer_inventory
```

### 5. Initialize the Database
- Create a MySQL database named `fertilizer_inventory`.
- Ensure required tables exist (see `backend/models/` for table structure).

### 6. Start the Server
```sh
node server.js
```
- The backend API will run on [http://localhost:3001](http://localhost:3001)
- The frontend is served statically from the `frontend/` folder.

---

## File & Folder Descriptions

### Backend
- **config/db.js**: Database connection and pool setup.
- **controllers/**: Business logic for each resource (customers, orders, etc.).
- **models/**: SQL queries and data access logic.
- **routes/**: API endpoints for each resource.
- **public/**: Static files (images, uploaded product images).
- **scheduler/interestCron.js**: Scheduled tasks (e.g., interest calculation).

### Frontend
- **.html files**: Main UI pages (dashboard, customers, sales, etc.).
- **css/**: Stylesheets for each page/component.
- **js/**: Frontend logic for each page.
- **image/**: Images used in the frontend.

### Root
- **server.js**: Main Express server, serves API and static frontend.
- **package.json**: Project dependencies and scripts.
- **README.md**: This documentation.

---

## Troubleshooting
- **Access denied for user**: Check your `.env` file for correct DB credentials.
- **Database does not exist**: Create the `fertilizer_inventory` database in MySQL.
- **Port already in use**: Change the port in `server.js` or stop the conflicting process.
- **Static files not loading**: Ensure you access via the correct port and the `frontend/` folder exists.

---

## License
[Specify your license here] 