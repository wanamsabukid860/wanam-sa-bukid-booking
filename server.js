const os = require('os');
const express = require('express');
const sql = require('mssql');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer'); // Add this line
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static(__dirname));

// Route for booking page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'bookingweb.html'));
});
// Database configuration
const config = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'WanamSaBukidDB',
    user: process.env.DB_USER || 's-a',
    password: process.env.DB_PASSWORD || '08172003',
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve Admin System (from admin folder)
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Serve User Ordering System (from ordering folder)
app.use('/order', express.static(path.join(__dirname, 'ordering')));

// Serve Booking System (from booking folder)
app.use('/booking', express.static(path.join(__dirname, 'booking')));

// Simple database connection test
async function testConnection() {
    try {
        const pool = await sql.connect(config);
        console.log('✅ Database connection successful!');
        // Don't close the connection here - let it stay open for the app to use
        return true;
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        return false;
    }
}

// Routes
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Input validation
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }
        
        // For demo purposes - remove this in production
        if (username === 'demo' && password === 'demo') {
            return res.json({ 
                message: 'Login successful', 
                user: { 
                    id: 1, 
                    username: 'demo', 
                    role: 'admin' 
                } 
            });
        }
        
        // Test database connection first
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed. Please check your database settings.' });
        }
        
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM Admins WHERE username = @username');
        
        if (result.recordset.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        
        const user = result.recordset[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        
        res.json({ 
            message: 'Login successful', 
            user: { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            } 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

app.post('/api/signup', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        // Input validation
        if (!username || !password || !role) {
            return res.status(400).json({ message: 'Username, password and role are required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }
        
        // Test database connection first
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed. Please check your database settings.' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, hashedPassword)
            .input('role', sql.NVarChar, role)
            .query('INSERT INTO Admins (username, password, role) OUTPUT INSERTED.id VALUES (@username, @password, @role)');
        
        res.json({ 
            message: 'User created successfully', 
            userId: result.recordset[0].id 
        });
    } catch (error) {
        console.error('Signup error:', error);
        if (error.number === 2627) { // SQL Server unique constraint violation
            res.status(400).json({ message: 'Username already exists' });
        } else {
            res.status(500).json({ message: 'Server error: ' + error.message });
        }
    }
});

app.get('/api/dashboard-stats', async (req, res) => {
    try {
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.json({
                revenue: 0,
                reservations: 0,
                menuItems: 0
            });
        }
        
        const pool = await sql.connect(config);
        
        // Get today's revenue from Sales table
        const revenueResult = await pool.request()
            .query("SELECT ISNULL(SUM(total_amount), 0) as revenue FROM Sales WHERE CONVERT(DATE, order_date) = CONVERT(DATE, GETDATE())");
        
        // Get today's reservations
        const reservationsResult = await pool.request()
            .query("SELECT COUNT(*) as reservations FROM Reservations WHERE CONVERT(DATE, reservation_date) = CONVERT(DATE, GETDATE()) AND status = 'confirmed'");
        
        // Get available menu items
        const menuResult = await pool.request()
            .query("SELECT COUNT(*) as menuItems FROM MenuItems WHERE available = 1");
        
        res.json({
            revenue: revenueResult.recordset[0].revenue,
            reservations: reservationsResult.recordset[0].reservations,
            menuItems: menuResult.recordset[0].menuItems
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.json({
            revenue: 0,
            reservations: 0,
            menuItems: 0
        });
    }
});

// Serve the admin dashboard page
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

// Backward compatibility for old dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

// Serve the admin login page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Serve the user ordering page (default route)
app.get('/', (req, res) => {
    res.redirect('http://192.168.102.235:3000/order/orderinguser.html');
});

// Serve the user ordering page directly
app.get('/order', (req, res) => {
    res.sendFile(path.join(__dirname, 'ordering', 'orderinguser.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Add this function before app.listen():
function getNetworkIP() {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

let NETWORK_IP = 'localhost';

// Add this endpoint before app.listen():
app.get('/api/network-info', (req, res) => {
    res.json({ 
        networkIP: NETWORK_IP,
        port: port,
        fullUrl: `http://${NETWORK_IP}:${port}`
    });
});

// Start server
app.listen(port, '0.0.0.0', async () => {
    NETWORK_IP = getNetworkIP();
    
    console.log('\n========================================');
    console.log(`✅ Server running on port ${port}`);
    console.log('========================================');
    console.log('\n📱 ACCESS FROM PHONE (same WiFi network):');
    console.log(`   http://${NETWORK_IP}:${port}/order`);
    console.log('\n💻 ACCESS FROM THIS COMPUTER:');
    console.log(`   Admin System: http://localhost:${port}/admin`);
    console.log(`   Ordering System: http://localhost:${port}/order`);
    console.log(`   Dashboard: http://localhost:${port}/admin/dashboard`);
    console.log('\n🔗 NETWORK ADDRESS FOR QR CODES:');
    console.log(`   ${NETWORK_IP}:${port}`);
    console.log('========================================\n');
    
// Test database connection on startup
    const dbConnected = await testConnection();
    if (dbConnected) {
        console.log('Database connection successful!');
        await initializeDatabase();
    } else {
        console.log('Database connection failed. Please check your database settings.');
    }
});


async function initializeDatabase() {
    let pool;
    try {
        // Connect to database
        pool = await sql.connect(config);
        console.log('🔄 Initializing database...');
        
        // Check if super admin exists, if not create one
        const result = await pool.request()
            .query("SELECT COUNT(*) as count FROM Admins WHERE role = 'superadmin'");
        
        if (result.recordset[0].count === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await pool.request()
                .input('username', sql.NVarChar, 'superadmin')
                .input('password', sql.NVarChar, hashedPassword)
                .input('role', sql.NVarChar, 'superadmin')
                .query('INSERT INTO Admins (username, password, role) VALUES (@username, @password, @role)');
            
            console.log('👤 Default super admin created: username=superadmin, password=admin123');
        }
        
        // Create Orders table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Orders' AND xtype='U')
            CREATE TABLE Orders (
                order_id INT IDENTITY(1,1) PRIMARY KEY,
                session_id NVARCHAR(50),
                table_number INT NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                order_type NVARCHAR(50) NOT NULL,
                items NVARCHAR(MAX),
                status NVARCHAR(50) DEFAULT 'pending',
                created_at DATETIME DEFAULT GETDATE()
            )
        `);
        
        // Create OrderSessions table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OrderSessions' AND xtype='U')
            CREATE TABLE OrderSessions (
                session_id NVARCHAR(50) PRIMARY KEY,
                table_number INT NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                is_paused BIT DEFAULT 0,
                is_finished BIT DEFAULT 0,
                created_at DATETIME DEFAULT GETDATE()
            )
        `);
        
        // Create OrderItems table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OrderItems' AND xtype='U')
            CREATE TABLE OrderItems (
                id INT IDENTITY(1,1) PRIMARY KEY,
                order_id INT,
                item_name NVARCHAR(255) NOT NULL,
                quantity INT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                FOREIGN KEY (order_id) REFERENCES Orders(order_id)
            )
        `);

        // Create Customers table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Customers' AND xtype='U')
            CREATE TABLE Customers (
                id INT IDENTITY(1,1) PRIMARY KEY,
                fullname NVARCHAR(100) NOT NULL,
                birthday DATE NOT NULL,
                contact NVARCHAR(20) NOT NULL UNIQUE,
                email NVARCHAR(100) NOT NULL UNIQUE,
                password NVARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT GETDATE()
            )
        `);

        // Create Bookings table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Bookings' AND xtype='U')
            CREATE TABLE Bookings (
                id INT IDENTITY(1,1) PRIMARY KEY,
                user_id INT,
                booking_id NVARCHAR(20) NOT NULL UNIQUE,
                booking_type NVARCHAR(50) NOT NULL,
                details NVARCHAR(MAX) NOT NULL,
                pre_order NVARCHAR(MAX),
                total_amount DECIMAL(10,2) NOT NULL,
                payment_method NVARCHAR(50),
                payment_details NVARCHAR(MAX),
                payment_deadline DATETIME NOT NULL,
                status NVARCHAR(50) DEFAULT 'pending',
                created_at DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (user_id) REFERENCES Customers(id)
            )
        `);
        
        // ✅ NO SAMPLE DATA - ONLY REAL ORDERS!
        
        console.log('✅ Database initialization completed successfully!');
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        throw error;
    }
}
// Customer Authentication Routes
app.post('/api/customer/signup', async (req, res) => {
    try {
        const { fullname, birthday, contact, email, password } = req.body;
        
        // Input validation
        if (!fullname || !birthday || !contact || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }
        
        // Test database connection first
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const pool = await sql.connect(config);
        
        // Check if user already exists
        const existingUser = await pool.request()
            .input('contact', sql.NVarChar, contact)
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM Customers WHERE contact = @contact OR email = @email');
        
        if (existingUser.recordset.length > 0) {
            return res.status(400).json({ message: 'User with this contact number or email already exists' });
        }
        
        // Insert new customer
        const result = await pool.request()
            .input('fullname', sql.NVarChar, fullname)
            .input('birthday', sql.Date, birthday)
            .input('contact', sql.NVarChar, contact)
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, hashedPassword)
            .query(`INSERT INTO Customers (fullname, birthday, contact, email, password, created_at) 
                    OUTPUT INSERTED.id, INSERTED.fullname, INSERTED.birthday, INSERTED.contact, INSERTED.email
                    VALUES (@fullname, @birthday, @contact, @email, @password, GETDATE())`);
        
        const user = result.recordset[0];
        
        // Generate verification token
        const token = 'verify_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
        
        // Send verification email
        const emailSent = await sendVerificationEmail(email, token, fullname);
        
        res.json({ 
            message: emailSent 
                ? 'Account created successfully! Verification email has been sent to your email address.'
                : 'Account created successfully! Please check the verification link below.',
            emailSent: emailSent,
            verificationToken: !emailSent ? token : undefined,
            user: {
                id: user.id,
                fullname: user.fullname,
                birthday: user.birthday,
                contact: user.contact,
                email: user.email,
                is_verified: false
            }
        });
    } catch (error) {
        console.error('Customer signup error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

app.post('/api/customer/login', async (req, res) => {
    try {
        const { contact, password } = req.body;
        
        if (!contact || !password) {
            return res.status(400).json({ message: 'Contact number/email and password are required' });
        }
        
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }
        
        const pool = await sql.connect(config);
        
        // Check if input is email or contact number
        const isEmail = contact.includes('@');
        
        let result;
        if (isEmail) {
            result = await pool.request()
                .input('email', sql.NVarChar, contact)
                .query('SELECT * FROM Customers WHERE email = @email');
        } else {
            result = await pool.request()
                .input('contact', sql.NVarChar, contact)
                .query('SELECT * FROM Customers WHERE contact = @contact');
        }
        
        if (result.recordset.length === 0) {
            return res.status(401).json({ message: 'Invalid contact number/email or password' });
        }
        
        const user = result.recordset[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid contact number/email or password' });
        }
        
        res.json({ 
            message: 'Login successful', 
            user: {
                id: user.id,
                fullname: user.fullname,
                birthday: user.birthday,
                contact: user.contact,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Customer login error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

app.put('/api/customer/profile', async (req, res) => {
    try {
        const { userId, fullname, birthday, contact, email } = req.body;
        
        if (!userId || !fullname || !birthday || !contact || !email) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }
        
        const pool = await sql.connect(config);
        
        // Check if contact or email is taken by another user
        const existingUser = await pool.request()
            .input('userId', sql.Int, userId)
            .input('contact', sql.NVarChar, contact)
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM Customers WHERE (contact = @contact OR email = @email) AND id != @userId');
        
        if (existingUser.recordset.length > 0) {
            return res.status(400).json({ message: 'Contact number or email already exists' });
        }
        
        // Update customer profile
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('fullname', sql.NVarChar, fullname)
            .input('birthday', sql.Date, birthday)
            .input('contact', sql.NVarChar, contact)
            .input('email', sql.NVarChar, email)
            .query('UPDATE Customers SET fullname = @fullname, birthday = @birthday, contact = @contact, email = @email WHERE id = @userId');
        
        res.json({ 
            message: 'Profile updated successfully',
            user: {
                id: userId,
                fullname,
                birthday,
                contact,
                email
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Booking API
app.post('/api/bookings', async (req, res) => {
    try {
        const { userId, bookingType, details, preOrder, totalAmount, paymentMethod, paymentDetails } = req.body;
        
        if (!userId || !bookingType || !details || !totalAmount) {
            return res.status(400).json({ message: 'Required fields are missing' });
        }
        
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }
        
        const pool = await sql.connect(config);
        
        // Generate booking ID
        const bookingId = 'WNM' + Math.random().toString(36).substr(2, 6).toUpperCase();
        const paymentDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
        
        // Insert booking
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .input('bookingId', sql.NVarChar, bookingId)
            .input('bookingType', sql.NVarChar, bookingType)
            .input('details', sql.NVarChar, JSON.stringify(details))
            .input('preOrder', sql.NVarChar, JSON.stringify(preOrder))
            .input('totalAmount', sql.Decimal(10, 2), totalAmount)
            .input('paymentMethod', sql.NVarChar, paymentMethod)
            .input('paymentDetails', sql.NVarChar, JSON.stringify(paymentDetails))
            .input('paymentDeadline', sql.DateTime, paymentDeadline)
            .query(`INSERT INTO Bookings (user_id, booking_id, booking_type, details, pre_order, total_amount, payment_method, payment_details, payment_deadline, status, created_at) 
                    OUTPUT INSERTED.id
                    VALUES (@userId, @bookingId, @bookingType, @details, @preOrder, @totalAmount, @paymentMethod, @paymentDetails, @paymentDeadline, 'pending', GETDATE())`);
        
        res.json({ 
            message: 'Booking created successfully', 
            bookingId: bookingId,
            paymentDeadline: paymentDeadline
        });
    } catch (error) {
        console.error('Booking creation error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// API for order sessions - FIXED VERSION
app.post('/api/order-sessions', async (req, res) => {
    try {
        const { tableNumber, durationMinutes = 30 } = req.body;
        
        if (!tableNumber) {
            return res.status(400).json({ message: 'Table number is required' });
        }

        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        // Generate unique session ID
        const sessionId = 'SESS' + Math.random().toString(36).substr(2, 9).toUpperCase();
        
        // Calculate times in JavaScript to avoid SQL timezone issues
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + (durationMinutes * 60000));

        console.log('🕐 Session time calculation:');
        console.log('   Start:', startTime);
        console.log('   End:', endTime);
        console.log('   Duration:', durationMinutes, 'minutes');

        // Create new session
        await pool.request()
            .input('sessionId', sql.NVarChar, sessionId)
            .input('tableNumber', sql.Int, tableNumber)
            .input('startTime', sql.DateTime, startTime)
            .input('endTime', sql.DateTime, endTime)
            .query(`INSERT INTO OrderSessions (session_id, table_number, start_time, end_time) 
                    VALUES (@sessionId, @tableNumber, @startTime, @endTime)`);

        res.json({ 
            message: 'Order session created', 
            sessionId: sessionId,
            tableNumber: tableNumber,
            endTime: endTime.toISOString() // Send as ISO string to avoid timezone issues
        });
    } catch (error) {
        console.error('Order session creation error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// API to control session timer
app.put('/api/order-sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { action } = req.body;

        console.log(`🔄 Session ${sessionId} action: ${action}`);

        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        let query;
        
        switch (action) {
            case 'pause':
                query = 'UPDATE OrderSessions SET is_paused = 1 WHERE session_id = @sessionId';
                await pool.request()
                    .input('sessionId', sql.NVarChar, sessionId)
                    .query(query);
                console.log('✅ Session PAUSED in database');
                break;
                
            case 'resume':
                query = 'UPDATE OrderSessions SET is_paused = 0 WHERE session_id = @sessionId';
                await pool.request()
                    .input('sessionId', sql.NVarChar, sessionId)
                    .query(query);
                console.log('✅ Session RESUMED in database');
                break;
                
            case 'stop':
                query = 'UPDATE OrderSessions SET is_finished = 1 WHERE session_id = @sessionId';
                await pool.request()
                    .input('sessionId', sql.NVarChar, sessionId)
                    .query(query);
                console.log('✅ Session STOPPED in database');
                break;
                
            default:
                return res.status(400).json({ message: 'Invalid action' });
        }

        res.json({ 
            message: `Session ${action} successful`,
            sessionId: sessionId,
            action: action 
        });
        
    } catch (error) {
        console.error('❌ Session update error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// NEW: Dedicated reset endpoint - FIXED VERSION
app.post('/api/order-sessions/:sessionId/reset', async (req, res) => {
    try {
        const { sessionId } = req.params;

        console.log(`🔄 RESETTING session ${sessionId} to 30 minutes from NOW`);

        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        // Calculate new end time in JavaScript
        const newEndTime = new Date(Date.now() + (30 * 60000));
        
        console.log('🕐 Reset time calculation:', newEndTime);

        // Set end_time to exactly 30 minutes from NOW and unpause
        const query = 'UPDATE OrderSessions SET end_time = @newEndTime, is_paused = 0 WHERE session_id = @sessionId';
        
        await pool.request()
            .input('sessionId', sql.NVarChar, sessionId)
            .input('newEndTime', sql.DateTime, newEndTime)
            .query(query);
        
        res.json({ 
            message: 'Session reset to 30 minutes',
            sessionId: sessionId,
            newEndTime: newEndTime.toISOString() // Send as ISO string
        });
        
    } catch (error) {
        console.error('❌ Session reset error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// API to get session status
app.get('/api/order-sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        const result = await pool.request()
            .input('sessionId', sql.NVarChar, sessionId)
            .query('SELECT * FROM OrderSessions WHERE session_id = @sessionId');

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Session not found' });
        }

        const session = result.recordset[0];
        res.json({ session });
    } catch (error) {
        console.error('Session fetch error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// API to get orders by table
app.get('/api/orders/table/:tableNumber', async (req, res) => {
    try {
        const { tableNumber } = req.params;

        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        const result = await pool.request()
            .input('tableNumber', sql.Int, tableNumber)
            .query(`SELECT o.*, s.session_id, s.start_time 
                    FROM Orders o 
                    LEFT JOIN OrderSessions s ON o.session_id = s.session_id 
                    WHERE o.table_number = @tableNumber 
                    ORDER BY o.created_at DESC`);

        res.json({ orders: result.recordset });
    } catch (error) {
        console.error('Orders fetch error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// API for customer orders - FIXED ORDER TYPE
app.post('/api/orders', async (req, res) => {
    console.log('📦 Receiving order:', req.body);
    
    try {
        const { sessionId, tableNumber, items, totalAmount, orderType = 'dine_in' } = req.body; // ✅ Changed from 'main' to 'dine_in'
        
        // Validation
        if (!tableNumber || !items || !totalAmount) {
            console.error('❌ Missing required fields:', { tableNumber, items: !!items, totalAmount });
            return res.status(400).json({ message: 'Table number, items, and total amount are required' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            console.error('❌ Invalid items array');
            return res.status(400).json({ message: 'Items must be a non-empty array' });
        }

        // Test database connection
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.error('❌ Database connection failed');
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        console.log('💾 Saving order to database...');
        
        // ✅ INSERT INTO ORDERS TABLE
        const orderResult = await pool.request()
            .input('sessionId', sql.NVarChar, sessionId || null)
            .input('tableNumber', sql.Int, tableNumber)
            .input('totalAmount', sql.Decimal(10, 2), totalAmount)
            .input('orderType', sql.NVarChar, orderType)
            .input('items', sql.NVarChar, JSON.stringify(items))
            .query(`INSERT INTO Orders (session_id, table_number, total_amount, order_type, items, status) 
                    OUTPUT INSERTED.order_id 
                    VALUES (@sessionId, @tableNumber, @totalAmount, @orderType, @items, 'pending')`);
        
        const orderId = orderResult.recordset[0].order_id;
        console.log('✅ Order saved to Orders table, ID:', orderId);

        // ✅ ALSO INSERT INTO SALES TABLE FOR REPORTING
        await pool.request()
            .input('totalAmount', sql.Decimal(10, 2), totalAmount)
            .input('orderType', sql.NVarChar, orderType)
            .query(`INSERT INTO Sales (order_date, total_amount, order_type) 
                    VALUES (GETDATE(), @totalAmount, @orderType)`);

        console.log('✅ Order saved to Sales table');
        console.log('🎉 Order completed successfully!');

        res.json({ 
            success: true,
            message: 'Order placed successfully', 
            orderId: orderId 
        });
        
    } catch (error) {
        console.error('❌ Order placement error:', error);
        console.error('Error details:', error.message);
        res.status(500).json({ 
            success: false,
            message: 'Server error: ' + error.message 
        });
    }
});

// Serve the customer ordering page with session validation
app.get('/order/session/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    console.log('Session access attempt:', sessionId);
    
    // Clean the session ID by removing any newlines or special characters
    const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9]/g, '');
    
    if (sessionId !== cleanSessionId) {
        console.log('Cleaned session ID from', sessionId, 'to', cleanSessionId);
        // Redirect to clean URL
        return res.redirect(`/order/session/${cleanSessionId}`);
    }
    
    res.sendFile(path.join(__dirname, 'ordering', 'orderinguser.html'));
});
// EMERGENCY: Fix broken sessions showing 500+ minutes
app.post('/api/fix-broken-sessions', async (req, res) => {
    try {
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        // Fix all sessions with end_time more than 2 hours in the future
        const result = await pool.request()
            .query(`UPDATE OrderSessions 
                    SET end_time = DATEADD(MINUTE, 30, start_time) 
                    WHERE DATEDIFF(MINUTE, start_time, end_time) > 120`);
        
        console.log('✅ Fixed broken sessions:', result.rowsAffected);
        
        res.json({ 
            message: `Fixed ${result.rowsAffected} broken sessions`,
            fixedCount: result.rowsAffected
        });
        
    } catch (error) {
        console.error('❌ Fix sessions error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});
// API to reset/clear all sales data
app.post('/api/reset-sales-data', async (req, res) => {
    try {
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        // Clear all orders
        await pool.request().query('DELETE FROM Orders');
        
        // Clear all sales
        await pool.request().query('DELETE FROM Sales');
        
        // Reset identity columns
        await pool.request().query('DBCC CHECKIDENT (\'Orders\', RESEED, 0)');
        await pool.request().query('DBCC CHECKIDENT (\'Sales\', RESEED, 0)');
        
        console.log('✅ All sales data cleared');
        
        res.json({ 
            message: 'All sales data has been reset to zero',
            success: true
        });
    } catch (error) {
        console.error('❌ Error resetting sales data:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// API to get sales data for reports
app.get('/api/sales-data', async (req, res) => {
    try {
        const { period = 'daily', date } = req.query;
        
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        let query;
        
        switch(period) {
            case 'daily':
                // Get hourly sales for today
                query = `
                    SELECT 
                        DATEPART(HOUR, order_date) as hour,
                        SUM(total_amount) as total
                    FROM Sales 
                    WHERE CONVERT(DATE, order_date) = CONVERT(DATE, GETDATE())
                    GROUP BY DATEPART(HOUR, order_date)
                    ORDER BY hour
                `;
                break;
                
            case 'weekly':
                // Get daily sales for this week
                query = `
                    SELECT 
                        DATENAME(WEEKDAY, order_date) as day_name,
                        DATEPART(WEEKDAY, order_date) as day_num,
                        SUM(total_amount) as total
                    FROM Sales 
                    WHERE order_date >= DATEADD(DAY, -7, GETDATE())
                    GROUP BY DATENAME(WEEKDAY, order_date), DATEPART(WEEKDAY, order_date)
                    ORDER BY day_num
                `;
                break;
                
            case 'monthly':
                // Get weekly sales for this month
                query = `
                    SELECT 
                        DATEPART(WEEK, order_date) as week_num,
                        SUM(total_amount) as total
                    FROM Sales 
                    WHERE MONTH(order_date) = MONTH(GETDATE()) 
                    AND YEAR(order_date) = YEAR(GETDATE())
                    GROUP BY DATEPART(WEEK, order_date)
                    ORDER BY week_num
                `;
                break;
                
            case 'yearly':
                // Get monthly sales for this year
                query = `
                    SELECT 
                        MONTH(order_date) as month_num,
                        DATENAME(MONTH, order_date) as month_name,
                        SUM(total_amount) as total
                    FROM Sales 
                    WHERE YEAR(order_date) = YEAR(GETDATE())
                    GROUP BY MONTH(order_date), DATENAME(MONTH, order_date)
                    ORDER BY month_num
                `;
                break;
                
            default:
                return res.status(400).json({ message: 'Invalid period' });
        }
        
        const result = await pool.request().query(query);
        
        res.json({ 
            period: period,
            data: result.recordset
        });
    } catch (error) {
        console.error('❌ Error fetching sales data:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// API to get sales summary
app.get('/api/sales-summary', async (req, res) => {
    try {
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.json({
                todayRevenue: 0,
                weeklyRevenue: 0,
                ordersToday: 0,
                avgOrderValue: 0
            });
        }

        const pool = await sql.connect(config);
        
        // Today's revenue
        const todayResult = await pool.request()
            .query(`SELECT ISNULL(SUM(total_amount), 0) as total, COUNT(*) as count 
                    FROM Sales 
                    WHERE CONVERT(DATE, order_date) = CONVERT(DATE, GETDATE())`);
        
        // Weekly revenue
        const weeklyResult = await pool.request()
            .query(`SELECT ISNULL(SUM(total_amount), 0) as total 
                    FROM Sales 
                    WHERE order_date >= DATEADD(DAY, -7, GETDATE())`);
        
        const todayTotal = todayResult.recordset[0].total;
        const todayCount = todayResult.recordset[0].count;
        const weeklyTotal = weeklyResult.recordset[0].total;
        const avgOrder = todayCount > 0 ? todayTotal / todayCount : 0;
        
        res.json({
            todayRevenue: todayTotal,
            weeklyRevenue: weeklyTotal,
            ordersToday: todayCount,
            avgOrderValue: avgOrder
        });
    } catch (error) {
        console.error('❌ Error fetching sales summary:', error);
        res.json({
            todayRevenue: 0,
            weeklyRevenue: 0,
            ordersToday: 0,
            avgOrderValue: 0
        });
    }
});

// API to get detailed sales report
app.get('/api/detailed-sales', async (req, res) => {
    try {
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.json({ sales: [] });
        }

        const pool = await sql.connect(config);
        
        // Get last 7 days of sales
        const result = await pool.request()
            .query(`
                SELECT 
                    CONVERT(DATE, order_date) as sale_date,
                    SUM(total_amount) as total_sales,
                    COUNT(*) as order_count,
                    AVG(total_amount) as avg_order
                FROM Sales 
                WHERE order_date >= DATEADD(DAY, -7, GETDATE())
                GROUP BY CONVERT(DATE, order_date)
                ORDER BY sale_date DESC
            `);
        
        res.json({ sales: result.recordset });
    } catch (error) {
        console.error('❌ Error fetching detailed sales:', error);
        res.json({ sales: [] });
    }
});
// Initialize the sales chart with REAL data from database
// GET all reservations for admin
app.get('/api/admin/reservations', async (req, res) => {
    try {
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        // Get all reservations with customer information
        const result = await pool.request()
            .query(`
                SELECT 
                    b.id,
                    b.booking_id,
                    b.booking_type,
                    b.details,
                    b.pre_order,
                    b.total_amount,
                    b.payment_method,
                    b.status,
                    b.created_at,
                    b.payment_deadline,
                    c.fullname as customer_name,
                    c.contact as customer_contact,
                    c.email as customer_email
                FROM Bookings b
                LEFT JOIN Customers c ON b.user_id = c.id
                ORDER BY b.created_at DESC
            `);
        
        // Parse JSON fields
        const reservations = result.recordset.map(reservation => {
            return {
                ...reservation,
                details: reservation.details ? JSON.parse(reservation.details) : {},
                pre_order: reservation.pre_order ? JSON.parse(reservation.pre_order) : {},
                payment_details: reservation.payment_details ? JSON.parse(reservation.payment_details) : {}
            };
        });

        res.json({ reservations });
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// GET single reservation by ID
app.get('/api/admin/reservations/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT 
                    b.*,
                    c.fullname as customer_name,
                    c.contact as customer_contact,
                    c.email as customer_email,
                    c.birthday as customer_birthday
                FROM Bookings b
                LEFT JOIN Customers c ON b.user_id = c.id
                WHERE b.id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Reservation not found' });
        }

        const reservation = result.recordset[0];
        // Parse JSON fields
        reservation.details = reservation.details ? JSON.parse(reservation.details) : {};
        reservation.pre_order = reservation.pre_order ? JSON.parse(reservation.pre_order) : {};
        reservation.payment_details = reservation.payment_details ? JSON.parse(reservation.payment_details) : {};

        res.json({ reservation });
    } catch (error) {
        console.error('Error fetching reservation:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// PUT update reservation
app.put('/api/admin/reservations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            booking_type, 
            details, 
            pre_order, 
            total_amount, 
            payment_method, 
            payment_details, 
            status 
        } = req.body;

        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        await pool.request()
            .input('id', sql.Int, id)
            .input('booking_type', sql.NVarChar, booking_type)
            .input('details', sql.NVarChar, JSON.stringify(details))
            .input('pre_order', sql.NVarChar, JSON.stringify(pre_order))
            .input('total_amount', sql.Decimal(10, 2), total_amount)
            .input('payment_method', sql.NVarChar, payment_method)
            .input('payment_details', sql.NVarChar, JSON.stringify(payment_details))
            .input('status', sql.NVarChar, status)
            .query(`
                UPDATE Bookings 
                SET 
                    booking_type = @booking_type,
                    details = @details,
                    pre_order = @pre_order,
                    total_amount = @total_amount,
                    payment_method = @payment_method,
                    payment_details = @payment_details,
                    status = @status
                WHERE id = @id
            `);

        res.json({ message: 'Reservation updated successfully' });
    } catch (error) {
        console.error('Error updating reservation:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// DELETE reservation
app.delete('/api/admin/reservations/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Bookings WHERE id = @id');

        res.json({ message: 'Reservation deleted successfully' });
    } catch (error) {
        console.error('Error deleting reservation:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// POST create reservation (admin side)
app.post('/api/admin/reservations', async (req, res) => {
    try {
        const { 
            customer_name,
            customer_contact,
            customer_email,
            booking_type, 
            details, 
            pre_order, 
            total_amount, 
            payment_method, 
            payment_details,
            status = 'confirmed'
        } = req.body;

        if (!customer_name || !customer_contact || !booking_type || !details || !total_amount) {
            return res.status(400).json({ message: 'Required fields are missing' });
        }

        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        // Check if customer exists, if not create a temporary customer
        let customerResult = await pool.request()
            .input('contact', sql.NVarChar, customer_contact)
            .query('SELECT id FROM Customers WHERE contact = @contact');

        let userId;
        if (customerResult.recordset.length === 0) {
            // Create temporary customer
            const tempCustomer = await pool.request()
                .input('fullname', sql.NVarChar, customer_name)
                .input('birthday', sql.Date, new Date('2000-01-01'))
                .input('contact', sql.NVarChar, customer_contact)
                .input('email', sql.NVarChar, customer_email || 'temp@wanamsabukid.com')
                .input('password', sql.NVarChar, 'temp_password')
                .query(`INSERT INTO Customers (fullname, birthday, contact, email, password) 
                        OUTPUT INSERTED.id 
                        VALUES (@fullname, @birthday, @contact, @email, @password)`);
            
            userId = tempCustomer.recordset[0].id;
        } else {
            userId = customerResult.recordset[0].id;
        }

        // Generate booking ID
        const bookingId = 'ADM' + Math.random().toString(36).substr(2, 6).toUpperCase();
        const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

        // Insert booking
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .input('bookingId', sql.NVarChar, bookingId)
            .input('bookingType', sql.NVarChar, booking_type)
            .input('details', sql.NVarChar, JSON.stringify(details))
            .input('preOrder', sql.NVarChar, JSON.stringify(pre_order))
            .input('totalAmount', sql.Decimal(10, 2), total_amount)
            .input('paymentMethod', sql.NVarChar, payment_method)
            .input('paymentDetails', sql.NVarChar, JSON.stringify(payment_details))
            .input('paymentDeadline', sql.DateTime, paymentDeadline)
            .input('status', sql.NVarChar, status)
            .query(`INSERT INTO Bookings (user_id, booking_id, booking_type, details, pre_order, total_amount, payment_method, payment_details, payment_deadline, status) 
                    OUTPUT INSERTED.id
                    VALUES (@userId, @bookingId, @bookingType, @details, @preOrder, @totalAmount, @paymentMethod, @paymentDetails, @paymentDeadline, @status)`);

        res.json({ 
            message: 'Reservation created successfully', 
            bookingId: bookingId,
            reservationId: result.recordset[0].id
        });
    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});
// Add these enhanced API endpoints to your server.js

// GET reservation statistics for dashboard
app.get('/api/admin/reservation-stats', async (req, res) => {
    try {
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        // Get counts by status
        const result = await pool.request()
            .query(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM Bookings 
                GROUP BY status
            `);
        
        const stats = {
            pending: 0,
            confirmed: 0,
            cancelled: 0,
            total: 0
        };

        result.recordset.forEach(row => {
            stats[row.status] = row.count;
            stats.total += row.count;
        });

        res.json(stats);
    } catch (error) {
        console.error('Error fetching reservation stats:', error);
        res.json({
            pending: 0,
            confirmed: 0,
            cancelled: 0,
            total: 0
        });
    }
});

// Enhanced PUT update reservation with all fields
app.put('/api/admin/reservations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            customer_name,
            customer_contact, 
            customer_email,
            booking_type, 
            details, 
            pre_order, 
            total_amount, 
            payment_method, 
            payment_details, 
            status,
            payment_deadline
        } = req.body;

        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        // First get the reservation to find the user_id
        const reservationResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT user_id FROM Bookings WHERE id = @id');

        if (reservationResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Reservation not found' });
        }

        const userId = reservationResult.recordset[0].user_id;

        // Update customer information if provided
        if (customer_name || customer_contact || customer_email) {
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('fullname', sql.NVarChar, customer_name)
                .input('contact', sql.NVarChar, customer_contact)
                .input('email', sql.NVarChar, customer_email)
                .query(`
                    UPDATE Customers 
                    SET 
                        fullname = ISNULL(@fullname, fullname),
                        contact = ISNULL(@contact, contact),
                        email = ISNULL(@email, email)
                    WHERE id = @userId
                `);
        }

        // Update booking information
        await pool.request()
            .input('id', sql.Int, id)
            .input('booking_type', sql.NVarChar, booking_type)
            .input('details', sql.NVarChar, JSON.stringify(details))
            .input('pre_order', sql.NVarChar, JSON.stringify(pre_order))
            .input('total_amount', sql.Decimal(10, 2), total_amount)
            .input('payment_method', sql.NVarChar, payment_method)
            .input('payment_details', sql.NVarChar, JSON.stringify(payment_details))
            .input('status', sql.NVarChar, status)
            .input('payment_deadline', sql.DateTime, payment_deadline)
            .query(`
                UPDATE Bookings 
                SET 
                    booking_type = @booking_type,
                    details = @details,
                    pre_order = @pre_order,
                    total_amount = @total_amount,
                    payment_method = @payment_method,
                    payment_details = @payment_details,
                    status = @status,
                    payment_deadline = @payment_deadline
                WHERE id = @id
            `);

        res.json({ message: 'Reservation updated successfully' });
    } catch (error) {
        console.error('Error updating reservation:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});
// Add these enhanced API endpoints to your server.js

// GET reservation statistics for dashboard
app.get('/api/admin/reservation-stats', async (req, res) => {
    try {
        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        // Get counts by status
        const result = await pool.request()
            .query(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM Bookings 
                GROUP BY status
            `);
        
        const stats = {
            pending: 0,
            confirmed: 0,
            cancelled: 0,
            total: 0
        };

        result.recordset.forEach(row => {
            stats[row.status] = row.count;
            stats.total += row.count;
        });

        res.json(stats);
    } catch (error) {
        console.error('Error fetching reservation stats:', error);
        res.json({
            pending: 0,
            confirmed: 0,
            cancelled: 0,
            total: 0
        });
    }
});

// Enhanced PUT update reservation with all fields
app.put('/api/admin/reservations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            customer_name,
            customer_contact, 
            customer_email,
            booking_type, 
            details, 
            pre_order, 
            total_amount, 
            payment_method, 
            payment_details, 
            status,
            payment_deadline
        } = req.body;

        const dbConnected = await testConnection();
        if (!dbConnected) {
            return res.status(500).json({ message: 'Database connection failed' });
        }

        const pool = await sql.connect(config);
        
        // First get the reservation to find the user_id
        const reservationResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT user_id FROM Bookings WHERE id = @id');

        if (reservationResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Reservation not found' });
        }

        const userId = reservationResult.recordset[0].user_id;

        // Update customer information if provided
        if (customer_name || customer_contact || customer_email) {
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('fullname', sql.NVarChar, customer_name)
                .input('contact', sql.NVarChar, customer_contact)
                .input('email', sql.NVarChar, customer_email)
                .query(`
                    UPDATE Customers 
                    SET 
                        fullname = ISNULL(@fullname, fullname),
                        contact = ISNULL(@contact, contact),
                        email = ISNULL(@email, email)
                    WHERE id = @userId
                `);
        }

        // Update booking information
        await pool.request()
            .input('id', sql.Int, id)
            .input('booking_type', sql.NVarChar, booking_type)
            .input('details', sql.NVarChar, JSON.stringify(details))
            .input('pre_order', sql.NVarChar, JSON.stringify(pre_order))
            .input('total_amount', sql.Decimal(10, 2), total_amount)
            .input('payment_method', sql.NVarChar, payment_method)
            .input('payment_details', sql.NVarChar, JSON.stringify(payment_details))
            .input('status', sql.NVarChar, status)
            .input('payment_deadline', sql.DateTime, payment_deadline)
            .query(`
                UPDATE Bookings 
                SET 
                    booking_type = @booking_type,
                    details = @details,
                    pre_order = @pre_order,
                    total_amount = @total_amount,
                    payment_method = @payment_method,
                    payment_details = @payment_details,
                    status = @status,
                    payment_deadline = @payment_deadline
                WHERE id = @id
            `);

        res.json({ message: 'Reservation updated successfully' });
    } catch (error) {
        console.error('Error updating reservation:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});
console.log('📧 Initializing SendGrid email configuration...');

// Validate email configuration
const emailFrom = process.env.EMAIL_FROM;
const emailPass = process.env.EMAIL_PASS;

if (!emailFrom || !emailPass) {
    console.log('❌ Email configuration incomplete:');
    console.log('   - EMAIL_FROM:', emailFrom || 'MISSING');
    console.log('   - EMAIL_PASS:', emailPass ? '***' + emailPass.slice(-4) : 'MISSING');
    console.log('💡 Please check your .env file configuration');
}

// SendGrid Email Configuration
const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'apikey',
        pass: process.env.EMAIL_PASS
    }
};

// Create transporter
let transporter;
try {
    transporter = nodemailer.createTransport(emailConfig);
    console.log('✅ Email transporter created successfully');
} catch (error) {
    console.error('❌ Failed to create email transporter:', error.message);
    transporter = null;
}

// Verify email configuration
if (transporter) {
    transporter.verify(function (error, success) {
        if (error) {
            console.log('❌ Email configuration error:', error.message);
            console.log('💡 Make sure your SendGrid API key is correct in the .env file');
        } else {
            console.log('✅ SendGrid is ready to send messages');
        }
    });
}

async function sendVerificationEmail(email, token, fullname) {
    // Validate required email configuration
    if (!process.env.EMAIL_FROM) {
        console.log('❌ EMAIL_FROM not configured - falling back to development mode');
        showDevelopmentVerification(email, token, fullname);
        return false;
    }

    if (!process.env.EMAIL_PASS) {
        console.log('❌ EMAIL_PASS not configured - falling back to development mode');
        showDevelopmentVerification(email, token, fullname);
        return false;
    }

    // If email transporter failed to create, use development mode
    if (!transporter) {
        console.log('📧 Email transporter not available - falling back to development mode');
        showDevelopmentVerification(email, token, fullname);
        return false;
    }

    const verificationLink = `http://localhost:${process.env.PORT || 3000}/api/verify-email?token=${token}`;
    
    const mailOptions = {
        from: {
            name: 'Wanam Sa Bukid Restaurant',
            address: process.env.EMAIL_FROM
        },
        to: email,
        subject: 'Verify Your Email - Wanam Sa Bukid Restaurant',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { color: white; margin: 0; font-size: 28px; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; text-align: center; }
                    .verification-code { background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; font-family: monospace; word-break: break-all; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>WANAM SA BUKID</h1>
                    <p style="color: white; margin: 5px 0 0 0;">RESTAURANT & EVENT HALL</p>
                </div>
                
                <div class="content">
                    <h2>Email Verification Required</h2>
                    
                    <p>Hello <strong>${fullname}</strong>,</p>
                    
                    <p>Thank you for creating an account with Wanam Sa Bukid Restaurant! To complete your registration and start making reservations, please verify your email address by clicking the button below:</p>
                    
                    <div style="text-align: center;">
                        <a href="${verificationLink}" class="button">Verify Email Address</a>
                    </div>
                    
                    <p>Or copy and paste this link in your browser:</p>
                    <div class="verification-code">
                        ${verificationLink}
                    </div>
                    
                    <p><strong>Important:</strong> This verification link will expire in 24 hours.</p>
                    
                    <p>If you didn't create an account with Wanam Sa Bukid, please ignore this email.</p>
                    
                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                        <p>Wanam Sa Bukid Restaurant &copy; 2025. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        console.log('📧 Attempting to send verification email to:', email);
        console.log('📧 From address:', process.env.EMAIL_FROM);
        
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Verification email sent to:', email);
        console.log('📧 Message ID:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Failed to send verification email:', error.message);
        
        // Fallback to development mode
        showDevelopmentVerification(email, token, fullname);
        return false;
    }
}

async function sendVerificationEmail(email, token, fullname) {
    const verificationLink = `http://localhost:${port}/api/verify-email?token=${token}`;
    
    const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@wanamsabukid.com',
        to: email,
        subject: 'Verify Your Email - Wanam Sa Bukid Restaurant',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { color: white; margin: 0; font-size: 28px; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; text-align: center; }
                    .verification-code { background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; font-family: monospace; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>WANAM SA BUKID</h1>
                    <p style="color: white; margin: 5px 0 0 0;">RESTAURANT & EVENT HALL</p>
                </div>
                
                <div class="content">
                    <h2>Email Verification Required</h2>
                    
                    <p>Hello <strong>${fullname}</strong>,</p>
                    
                    <p>Thank you for creating an account with Wanam Sa Bukid Restaurant! To complete your registration and start making reservations, please verify your email address by clicking the button below:</p>
                    
                    <div style="text-align: center;">
                        <a href="${verificationLink}" class="button">Verify Email Address</a>
                    </div>
                    
                    <p>Or copy and paste this link in your browser:</p>
                    <div class="verification-code">
                        <a href="${verificationLink}">${verificationLink}</a>
                    </div>
                    
                    <p><strong>Important:</strong> This verification link will expire in 24 hours.</p>
                    
                    <p>If you didn't create an account with Wanam Sa Bukid, please ignore this email.</p>
                    
                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                        <p>Wanam Sa Bukid Restaurant &copy; 2025. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Verification email sent to:', email);
        console.log('📧 Message ID:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Failed to send verification email:', error.message);
        
        // Fallback: Show the link in console for development
        console.log('\n📧 ===== EMAIL SENDING FAILED - DEVELOPMENT MODE =====');
        console.log('📧 To:', email);
        console.log('📧 For:', fullname);
        console.log('📧 Verification Link:', verificationLink);
        console.log('📧 =================================================\n');
        
        return false;
    }
}
// Simple verification endpoint for development
app.get('/api/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        
        console.log('📧 Email verification attempt with token:', token);
        
        // For development, we'll just show a success message
        // In production, you would verify the token against the database
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Email Verified - Wanam Sa Bukid</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; background: #f5f7fa; text-align: center; }
                    .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); }
                    .success { color: #2ecc71; font-size: 48px; margin-bottom: 20px; }
                    h1 { color: #2d5016; margin-bottom: 20px; }
                    p { margin-bottom: 20px; line-height: 1.6; color: #333; }
                    .btn { background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success">✅</div>
                    <h1>Email Verified Successfully!</h1>
                    <p>Your email has been verified. You can now login to your account.</p>
                    <p><strong>Development Note:</strong> In production, this would update your account status in the database.</p>
                    <a href="http://localhost:3000/booking/bookingweb.html" class="btn">Go to Login</a>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).send('Verification failed');
    }
});
// Development mode fallback function
function showDevelopmentVerification(email, token, fullname) {
    const verificationLink = `http://localhost:${process.env.PORT || 3000}/api/verify-email?token=${token}`;
    
    console.log('\n📧 ===== DEVELOPMENT MODE - EMAIL VERIFICATION =====');
    console.log('📧 To:', email);
    console.log('📧 For:', fullname);
    console.log('📧 Verification Link:', verificationLink);
    console.log('📧 ================================================\n');
    
    // Create a test HTML file
    const fs = require('fs');
    const testPage = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Email Verification Test - Wanam Sa Bukid</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: #f5f7fa; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); }
            .success { color: #2ecc71; font-size: 48px; text-align: center; }
            h1 { color: #2d5016; text-align: center; }
            .btn { background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; margin: 20px 0; }
            .link-box { background: #e8f5e9; padding: 15px; border-radius: 10px; margin: 20px 0; word-break: break-all; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="success">📧</div>
            <h1>Email Verification Test</h1>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Name:</strong> ${fullname}</p>
            <p>In production, this would be sent via email. For development, use the link below:</p>
            
            <div style="text-align: center;">
                <a href="${verificationLink}" class="btn">Verify Email Now</a>
            </div>
            
            <div class="link-box">
                <strong>Or copy this link:</strong><br>
                ${verificationLink}
            </div>
            
            <p><em>This is a development test page. The verification system is working!</em></p>
        </div>
    </body>
    </html>
    `;
    
    fs.writeFileSync('verification-test.html', testPage);
    console.log('📄 Test page created: verification-test.html');

}
