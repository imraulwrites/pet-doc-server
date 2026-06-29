import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8000;

const uri = `mongodb+srv://basicUser:BIoBEqO9IV8tsxTE@cluster0.iaswwa9.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

export async function runStableAPIConnect() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();

    // // Send a ping to confirm a successful connection
    // const result = await client.db('petdoc').command({ ping: 1 });
    // console.log('Pinged your deployment. You successfully connected to MongoDB!');

    const db = client.db('petdoc');
    const userCollection = db.collection('users');
    const doctorsCollection = db.collection('doctors');
    const reviewsCollection = db.collection('reviews');
    const appointmentCollection = db.collection('appointment');

    app.post('/signup', async (req, res) => {
      const document = {
        name: req.body.name,
        email: req.body.email,
        // password: req.body.password,
        // photoURL: req.body.photoURL,
      };

      // console.log('first');

      const newUser = await userCollection.insertOne(document);

      res.send(newUser);
    });

    app.get('/all-appointments', async (req, res) => {
      const doctors = await doctorsCollection.find({}).toArray();

      // console.log('doctors', doctors);
      res.send(doctors);
    });

    app.get('/details/:id', async (req, res) => {
      // console.log('req received', req.params.id);
      const details = await doctorsCollection.findOne({ _id: new ObjectId(req.params.id) });

      console.log('details for each doctor', details);

      res.send(details);
    });

    // reviews

    app.post('/reviews', async (req, res) => {
      const document = {
        doctorId: new ObjectId(req.body.doctorId),
        userId: new ObjectId(req.body.userId),
        rating: req.body.rating,
        remarks: req.body.remarks,
      };

      try {
        const existingReview = await reviewsCollection.findOne({
          doctorId: document.doctorId,
          userId: document.userId,
        });

        if (existingReview) {
          return res.status(400).send({ message: 'You have already reviewed this doctor.' });
        }

        const result = await reviewsCollection.insertOne(document);

        const allReview = await reviewsCollection
          .find({ doctorId: new ObjectId(req.body.doctorId) })
          .toArray();

        const total = allReview.reduce((sum, review) => sum + review.rating, 0);
        const reviewCount = allReview.length;

        const averageRating = reviewCount > 0 ? Number((total / reviewCount).toFixed(1)) : 0;

        await doctorsCollection.updateOne(
          { _id: new ObjectId(req.body.doctorId) },
          {
            $set: {
              averageRating,
              reviewCount,
            },
          }
        );

        res.send(result);
      } catch (error) {
        console.log('Review update failed.', error);

        res.status(500).send({
          success: false,
          message: 'Internal server error',
        });
      }
    });

    // Booking Doctors
    app.post('/booking', async (req, res) => {
      try {
        const document = {
          doctorId: new ObjectId(req.body.doctorId),
          userId: new ObjectId(req.body.userId),
          name: req.body.name,
          gender: req.body.gender,
          phone: req.body.phone,
          email: req.body.email,
          date: new Date(req.body.date),
          time: req.body.time,
          details: req.body.details,
        };

       const result = await appointmentCollection.insertOne(document);

       res.send(result)

      } catch (error) {
        console.log(error);
      }
    });

    // top doctors

    app.get('/top-doctors', async (req, res) => {
      try {
        const topDoc = await doctorsCollection
          .find()
          .sort({
            averageRating: -1,
            reviewCount: -1,
          })
          .limit(3)
          .toArray();

        res.send(topDoc);
      } catch (error) {
        console.error(error);
        res.status(500).send({
          message: 'Failed to fetch Top Doctors',
        });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
runStableAPIConnect().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Response from Server');
});

app.listen(port, (req, res) => {
  console.log(`Successfully connected to port: ${port}`);
});
