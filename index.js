require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const con = require('./DB_Conn.js');  // your MySQL connection
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const publicpath = path.join(__dirname, 'public');
app.use(express.static(publicpath));

// Home
app.get('/Home', (req, res) => {
    res.sendFile(path.join(publicpath, 'index.html'));
});

// Login
app.get('/Login', (req, res) => {
    res.sendFile(path.join(publicpath, 'login.html'));
});

// Registration
app.get('/Registration', (req, res) => {
    res.sendFile(path.join(publicpath, 'register.html'));
});

// Quiz
app.get('/Quiz', (req, res) => {
    res.sendFile(path.join(publicpath, 'Quiz.html'));
});

// Know
app.get('/Know', (req, res) => {
    res.sendFile(path.join(publicpath, 'Know.html'));
});

// Tutorial (added in main branch)
app.get('/tutorial', (req, res) => {
    res.sendFile(path.join(publicpath, 'tutorial.html'));
});

// Forgot Password - form
app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(publicpath, 'forgot-password.html'));
});

// Forgot Password - send email with token
app.post('/forgot-password', (req, res) => {
    const email = req.body.email;
    const resetToken = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expirationTime = new Date(Date.now() + 3600000); // 1 hour

    const sql = 'UPDATE register SET resetToken = ?, resetTokenExpiration = ? WHERE email = ?';
    con.query(sql, [hashedToken, expirationTime, email], (err, result) => {
        if (err) {
            console.error('Error updating token:', err);
            return res.status(500).send('Internal Server Error');
        }

        console.log("Reset token generated:", resetToken);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'ruhisayyed929@gmail.com',
                pass: 'ntsvmnumglnpctsd', // Use app password
            },
            tls: {
                rejectUnauthorized: false,
            }
        });

        const BASE_URL = process.env.BASE_URL || 'http://localhost:8100';
        const resetLink = `${BASE_URL}/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: 'ruhisayyed929@gmail.com',
            to: email,
            subject: 'Password Reset Request',
            text: `Click the link to reset your password: ${resetLink}`,
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.error('Error sending email:', err);
                return res.status(500).send('Error sending email');
            }
            console.log("Reset email sent to:", email);
            res.send('Password reset email sent!');
        });
    });
});

// Reset Password - GET
app.get('/reset-password', (req, res) => {
    const token = req.query.token;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const sql = 'SELECT * FROM register WHERE resetToken = ? AND resetTokenExpiration > NOW()';
    con.query(sql, [hashedToken], (err, result) => {
        if (err) {
            console.error(err);
            return res.send('Error occurred.');
        }

        if (result.length > 0) {
            res.send(`
                <form action="/reset-password" method="POST">
                    <input type="password" name="newPassword" placeholder="New Password" required>
                    <input type="password" name="confirmPassword" placeholder="Confirm Password" required>
                    <input type="hidden" name="token" value="${token}">
                    <button type="submit">Reset Password</button>
                </form>
            `);
        } else {
            res.send('Invalid or expired token.');
        }
    });
});

// Reset Password - POST
app.post('/reset-password', (req, res) => {
    const { newPassword, confirmPassword, token } = req.body;

    if (newPassword !== confirmPassword) {
        return res.send('Passwords do not match!');
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const sql = 'SELECT * FROM register WHERE resetToken = ? AND resetTokenExpiration > NOW()';

    con.query(sql, [hashedToken], (err, result) => {
        if (err) {
            console.error(err);
            return res.send('Error occurred.');
        }

        if (result.length > 0) {
            const updateSql = 'UPDATE register SET password = ?, resetToken = NULL, resetTokenExpiration = NULL WHERE resetToken = ?';
            con.query(updateSql, [newPassword, hashedToken], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.send('Error updating password.');
                }
                res.send('Your password has been reset successfully!');
            });
        } else {
            res.send('Invalid or expired token.');
        }
    });
});

// Register
app.post("/RegisterData", (req, res) => {
    const { fname, lname, email, phone, pass } = req.body;
    const sql = 'INSERT INTO register (fname, lname, email, phone, password) VALUES (?, ?, ?, ?, ?)';
    con.query(sql, [fname, lname, email, phone, pass], (err, result) => {
        if (err) {
            console.error(err);
            return res.send("Error registering user");
        }
        console.log("Data Inserted Successfully");
        res.redirect('/Home');
    });
});

// Login
app.post("/Loginvalidation", (req, res) => {
    const { Lemail: email, Lpass: pass } = req.body;
    const sql = 'SELECT * FROM register WHERE email = ? AND password = ?';
    con.query(sql, [email, pass], (err, result) => {
        if (err) {
            console.error(err);
            return res.send("Error occurred during login");
        }

        if (result.length > 0) {
            console.log('Login Successfully');
            res.redirect('/Home');
        } else {
            res.redirect('/Login?errorMessage=' + encodeURIComponent('These credentials do not match our records.'));
        }
    });
});

// Feedback POST endpoint
app.post('/feedback', (req, res) => {
    const { feedback } = req.body;

    if (!feedback || feedback.trim().length === 0) {
        return res.status(400).send('Feedback cannot be empty.');
    }

    const sql = 'INSERT INTO feedback (feedback) VALUES (?)';
    con.query(sql, [feedback], (err, result) => {
        if (err) {
            console.error('Error saving feedback:', err);
            return res.status(500).send('Failed to save feedback.');
        }
        console.log('Feedback saved successfully.');
        res.send('Thank you for your feedback!');
    });
});

// Feedback GET endpoint
app.get('/feedbacks', (req, res) => {
    const sql = 'SELECT * FROM feedback ORDER BY id DESC';
    con.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching feedback:', err);
            return res.status(500).json({ error: 'Failed to fetch feedback' });
        }
        res.json(results);
    });
});

// Start the server

const PORT = process.env.PORT || 8100;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
