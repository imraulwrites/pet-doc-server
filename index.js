import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import { requireAuth } from './middleware/requireAuth.js';

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

    const db = client.db('petdoc');
    const userCollection = db.collection('user');
    const doctorsCollection = db.collection('doctors');
    const reviewsCollection = db.collection('reviews');
    const appointmentCollection = db.collection('appointment');

    app.post('/signup', async (req, res) => {
      const document = {
        name: req.body.name,
        email: req.body.email,

      };


      const newUser = await userCollection.insertOne(document);

      res.send(newUser);
    });

    // all doctors list
    app.get('/all-appointments', async (req, res) => {
      const doctors = await doctorsCollection.find({}).toArray();

      // console.log('doctors', doctors);
      res.send(doctors);
    });

    // Details for each Doctors
    app.get('/details/:id', async (req, res) => {
      // console.log('req received', req.params.id);
      const details = await doctorsCollection.findOne({ _id: new ObjectId(req.params.id) });

      // console.log('details for each doctor', details);

      res.send(details);
    });

    // post doctor reviews

    app.post('/reviews', requireAuth, async (req, res) => {
      // console.log('passed requireAuth');
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

    // Booking Doctors appointment
    app.post('/booking', requireAuth, async (req, res) => {
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

        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get User Information
    app.get('/user/:id', requireAuth, async (req, res) => {
      // console.log("check userid", await req.params.id)
      const userId = await req.params.id;
      try {
        const result = await userCollection.findOne({ _id: new ObjectId(req.params.id) });
        // console.log("user data in route", result)
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get My Bookings / appointments in my profile
    app.get('/my-bookings/:userId', requireAuth, async (req, res) => {
      // console.log('params userid', await req.params.userId);
      try {
        const result = await appointmentCollection
          .aggregate([
            {
              $match: {
                userId: new ObjectId(req.params.userId),
              },
            },
            {
              $lookup: {
                from: 'doctors',
                localField: 'doctorId',
                foreignField: '_id',
                as: 'doctor',
              },
            },
            {
              $unwind: '$doctor',
            },
            {
              $project: {
                doctorName: '$doctor.name',
                specialty: '$doctor.specialty',
                hospital: '$doctor.hospital',
                fee: '$doctor.fee',
                doctorImage: '$doctor.image',
                availability: '$doctor.availability',
                name: 1,
                time: 1,
                date: 1,
              },
            },
          ])
          .toArray();

        // console.log(`result from appointment`, result);

        res.send(result);
      } catch (error) {
        console.log('error from server my-bookings route', error);
      }
    });

    // update my bookings / appointment
    app.post('/my-bookings/update', requireAuth, async (req, res) => {
      try {
        const result = await appointmentCollection.updateOne(
          { _id: new ObjectId(req.body.appointmentId) },
          {
            $set: {
              time: req.body.time,
              date: new Date(req.body.date),
            },
          }
        );

        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({
          message: 'Failed to update appointment',
          error: error.message,
        });
      }
    });

    // delete an appointment
    app.delete(`/delete/:appointmentId`, requireAuth, async (req, res) => {
      const { appointmentId } = await req.params;

      // console.log('check param id', await req.params)

      if (!ObjectId.isValid(appointmentId)) {
        return res.status(400).send({
          message: 'Invalid request',
        });
      }
      try {
        const result = await appointmentCollection.deleteOne({
          _id: new ObjectId(appointmentId),
        });

        // console.log('result from delete', result);

        if (result.deletedCount === 0) {
          return res.status(404).send({
            message: 'Booking not found',
          });
        }

        res.send({
          message: 'Booking deleted successfully',
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: 'Failed to delete booking',
        });
      }
    });

    // get top doctors

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
