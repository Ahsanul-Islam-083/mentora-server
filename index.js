const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.send('Mentora Server is Running');
})

app.listen(port, () => {
    console.log(`Mentora Server is Running at http://localhost:${port}`)
})
