const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
//middleware
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

console.log(process.env.DB_PASS);
console.log(process.env.DB_User);
console.log("ACCESS_TOKEN_SECRET", process.env.ACCESS_TOKEN_SECRET);

app.get("/", (req, res) => {
  res.send("food server is Running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kyfxv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//own middleware
const logger = async (req, res, next) => {
  console.log("called:", req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token; // Access the token from cookies
  console.log("value of token", token);

  if (!token) {
    return res.status(401).send({ message: "not authorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // Handle errors or continue based on verification result
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized" });
    }

    // If token is valid, it will be decoded
    console.log("value in the decoded token", decoded);
    req.user = decoded;
    // Continue to the next middleware or route
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    // Send a ping to confirm a successful connection

    const foodItemCollection = client.db("food").collection("foodItems");

    const myCartDatabase = client.db("foodCartDb");
    const myCartCollection = myCartDatabase.collection("foodCart");
    //auth related api
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "100h",
      });
      console.log(token);

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true, // Update to 'true' in a production environment (with HTTPS)
          sameSite: "none",
          path: "/", // Update to 'none' in a production environment
        })
        .header("Access-Control-Allow-Origin", "http://localhost:5173") // Update to the correct origin
        .header("Access-Control-Allow-Credentials", "true")
        .send({ success: true });
    });

    //services related API
    app.get("/foodItems", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      console.log("pagination", req.query, page, size);
      const cursor = foodItemCollection
        .find()
        .skip(page * size)
        .limit(size);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/foodItems/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await foodItemCollection.findOne(query);
      res.send(result);
    });
    app.post("/foodItems", async (req, res) => {
      const newFood = req.body;
      console.log(newFood);

      const result = await foodItemCollection.insertOne(newFood);
      res.send(result);
      console.log(result);
    });

    app.patch("/foodItems/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedFood = req.body;
      const food = {
        $set: {
          food: updatedFood.food,
          image: updatedFood.image,
          category: updatedFood.category,
          quantity: updatedFood.quantity,
          price: updatedFood.price,
          description: updatedFood.description,
          origin: updatedFood.origin,
        },
      };

      const result = await foodItemCollection.updateOne(filter, food, options);
      res.send(result);
    });

    //bookings
    app.get("/mycart", verifyToken, async (req, res) => {
      console.log(req.query.email);
      // console.log("tok tok token", req.cookies.token);
      console.log("from valid user", req.user);
      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await myCartCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/mycart", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await myCartCollection.insertOne(booking);
      res.send(result);
    });

    app.delete("/mycart/:id", async (req, res) => {
      const id = req.params.id;
      console.log("Received DELETE request for id:", id);

      try {
        console.log("Received ID:", id);

        const result = await myCartCollection.deleteOne({ _id: id });

        console.log("Delete result:", result);

        if (result.deletedCount === 0) {
          return res.status(404).send("Item not found");
        }

        res.send(result);
      } catch (error) {
        console.error("Error deleting item:", error);
        res.status(500).send("Error deleting item.");
      }
    });

    // app.get("/mycart", async (req, res) => {
    //   // console.log(req.query.email);
    //   // console.log("tok tok token", req.cookies.token);
    //   // console.log("from valid user", req.user);
    //   // if (req.query.email !== req.user.email) {
    //   //   return res.status(403).send({ message: "forbidden access" });
    //   // }
    //   // let query = {};
    //   // if (req.query?.email) {
    //   //   query = { email: req.query.email };
    //   // }
    //   const result = await cartCollection.find(query).toArray();
    //   res.send(result);
    // });

    // app.patch("/mycart/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) };

    //   const updatedBooking = req.body;
    //   const updateDoc = {
    //     $set: {
    //       status: updatedBooking.status,
    //     },
    //   };
    //   const result = await bookingCollection.updateOne(filter, updateDoc);
    //   res.send(result);
    // });

    // app.delete("/mycart", async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await bookingCollection.deleteOne(query);
    //   res.send(result);
    // });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Port is Running at ${port}`);
});
