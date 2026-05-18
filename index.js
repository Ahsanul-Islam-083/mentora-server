const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
dotenv.config();
const app = express();
const port = process.env.PORT || 8080;

const uri = process.env.MONGODB_URI;
app.use(cors());
app.use(express.json());
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)

const verifyToken = async (req, res, next) => {
    const { authorization } = req.headers;
    const token = authorization.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    try {

        const { payload } = await jwtVerify(token, JWKS)
        // return payload
        req.user = payload;
        // console.log(req.user)
        next();
    } catch (error) {
        console.error('Token validation failed:', error)
        return res.status(403).json({ message: "Forbidden" })
    }

}


async function run() {
    try {
        // Connect the client to the server (optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });

        const db = client.db('mentoradb');
        const coursesCollection = db.collection('courses');
        const enrollmentCollection = db.collection('enrollments');

        app.post('/courses', verifyToken, async (req, res) => {
            const data = req.body;
            const result = await coursesCollection.insertOne(data);
            res.send(result);
        })

        app.get('/courses', async (req, res) => {
            const { search } = req.query;
            let cursor;
            if (search) {
                // cursor = coursesCollection.find({ title: {
                //     $regex : search,
                //     $options : "i"
                // }})
                cursor = coursesCollection.find({
                    $or: [
                        {
                            title: {
                                $regex: search,
                                $options: "i"
                            }
                        },
                        {
                            instructor: {
                                $regex: search,
                                $options: "i"
                            }
                        }
                    ]
                })
            } else {
                cursor = coursesCollection.find();
            }
            const result = await cursor.toArray();
            res.send(result);
            // console.log(result);
        });

        app.get('/featured', async (req, res) => {
            const cursor = coursesCollection.find().limit(4);
            const result = await cursor.toArray();
            res.send(result);
            // console.log(result);
        });
        app.get('/courses/:coursId', verifyToken, async (req, res) => {
            // console.log(req.user);

            const { coursId } = req.params;
            const result = await coursesCollection.findOne({ _id: new ObjectId(coursId) });
            res.send(result);
        });

        app.get('/enrollments/:userId', verifyToken, async (req, res) => {
            const { userId } = req.params;
            const result = await enrollmentCollection.find({ userId: userId }).toArray();
            res.send(result);

        })

        app.patch("/enrollments/:courseId", verifyToken, async (req, res) => {
            // console.log("enrolllllll");

            const { courseId } = req.params;
            const enrollmentData = req.body;
            // console.log(enrollmentData);

            const course = await coursesCollection.findOne({ _id: new ObjectId(courseId) });
            if (!course) {
                return res.status(404).json({ message: "Course Not Found" })
            }
            await coursesCollection.updateOne(
                { _id: new ObjectId(courseId) },
                { $inc: { enrollCount: 1 }, $set: { lastEnrollesAt: new Date() } }
            )
            const result = await enrollmentCollection.insertOne({ ...enrollmentData, enrolledAt: new Date() })
            res.send(result);
        })

        app.delete("/enrollments/:id", verifyToken, async (req, res) => {
            const { id } = req.params;
            const enrollment = await enrollmentCollection.findOne({ _id: new ObjectId(id)});
            const courseId = enrollment?.courseId;

            const result = await enrollmentCollection.deleteOne({ _id: new ObjectId(id) });

            await coursesCollection.updateOne(
                { _id: new ObjectId(courseId) },
                { $inc: { enrollCount: -1 } }
            )

            res.send(result);
        })

        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Mentora Server is Running');
});

app.listen(port, () => {
    console.log(`Mentora Server is Running at http://localhost:${port}`);
});