const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const admin = require("firebase-admin");

// Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.project_id,
        clientEmail: process.env.client_email,
        privateKey: process.env.private_key?.replace(/\\n/g, "\n")
    })
});

const app = express();
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

// Health check
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Railway WebRTC Signaling Server Running"
    });
});

// Firebase token verification API
app.post("/verify", async (req, res) => {

    try {

        const token = req.body.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: "No token"
            });
        }

        const decoded =
            await admin.auth()
                       .verifyIdToken(token);

        return res.json({
            success: true,
            uid: decoded.uid,
            email: decoded.email
        });

    } catch (e) {

        return res.status(401).json({
            success: false,
            error: e.message
        });
    }
});

// Socket authentication
io.use(async (socket, next) => {

    try {

        const token =
            socket.handshake.auth.token;

        if (!token) {
            return next(
                new Error("No token")
            );
        }

        const decoded =
            await admin.auth()
                       .verifyIdToken(token);

        socket.uid =
            decoded.uid;

        socket.email =
            decoded.email;

        console.log(
            "AUTH:",
            decoded.email
        );

        next();

    } catch (e) {

        console.error(
            "AUTH ERROR:",
            e.message
        );

        next(
            new Error(
                "Unauthorized"
            )
        );
    }
});

// Socket connection
io.on("connection", (socket) => {

    console.log(
        "CONNECTED:",
        socket.uid,
        socket.email
    );

    // Offer
    socket.on("offer", (data) => {

        socket.broadcast.emit(
            "offer",
            data
        );
    });

    // Answer
    socket.on("answer", (data) => {

        socket.broadcast.emit(
            "answer",
            data
        );
    });

    // ICE Candidate
    socket.on("ice", (data) => {

        socket.broadcast.emit(
            "ice",
            data
        );
    });

    // Disconnect
    socket.on("disconnect", () => {

        console.log(
            "DISCONNECTED:",
            socket.uid
        );
    });
});

// Start server
const PORT =
    process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );
});
