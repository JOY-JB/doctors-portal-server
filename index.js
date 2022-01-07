const express = require('express')
const app = express();
require('dotenv').config();
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");
const cors = require('cors');
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json())


const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// const serviceAccount = require("./doctors-portal-firebase-adminsdk.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nzciw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function tokenVerify(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(" ")[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}

async function run() {
    try {
        await client.connect();

        const database = client.db("doctors_portal");
        const appointmentCollection = database.collection("appointment");
        const UserCollection = database.collection("user");

        app.get('/appointments', async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            const query = { email, date };
            const cursor = appointmentCollection.find(query);
            const result = await cursor.toArray();
            // console.log(result);
            res.json(result);
        });

        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentCollection.insertOne(appointment);
            res.json(result);
        });

        //Add user to mongodb
        app.post('/user', async (req, res) => {
            const user = req.body;
            const result = await UserCollection.insertOne(user);
            res.json(result);
        });
        //update or insert user from google sign in
        app.put('/user', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await UserCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });

        //admin add and authentication
        app.put('/user/admin', tokenVerify, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await UserCollection.findOne({ email: requester });

                if (requesterAccount.role === "Admin") {
                    const filter = { email: user.email }
                    const updateDoc = { $set: { role: "Admin" } }
                    const result = await UserCollection.updateOne(filter, updateDoc)
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: "you do not have access to make admin" });
            }
        });

        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email };
            const user = await UserCollection.findOne(filter);
            let admin = false;
            if (user?.role === "Admin") {
                admin = true;
            }
            res.json({ admin: admin })
        })

    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello Doctors Portal!')
})

app.listen(port, () => {
    console.log(` listening at ${port}`)
})