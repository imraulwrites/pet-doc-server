const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8000;

app.get('/', (req, res) => {
  res.send('Response from Server');
});

app.listen(port, (req, res) => {
  console.log(`Successfully connected to port: ${port}`);
});
