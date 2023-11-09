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
app.use(cors());
app.use(express.json());

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

async function run() {
  try {
    const foodItemCollection = client.db("food").collection("foodItems");

    const myCartDatabase = client.db("foodCartDb");
    const myCartCollection = myCartDatabase.collection("foodCart");
    //auth related api

    //services related API
    app.get("/foodItems", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const sortDirection = req.query.sortDirection || "asc";
      const sortField = req.query.sortField || "price";
      const searchTerm = req.query.searchTerm || "";

      const sortObject = {};
      sortObject[sortField] = sortDirection === "asc" ? 1 : -1;

      const filterObject = {
        $and: [
          {
            $or: [{ food: { $regex: searchTerm, $options: "i" } }],
          },
        ],
      };

      const cursor = foodItemCollection
        .find(filterObject)
        .sort(sortObject)
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

    //food order
    app.get("/mycart", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await myCartCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/mycart", async (req, res) => {
      const foods = req.body;
      console.log(foods);
      const result = await myCartCollection.insertOne(foods);
      res.send(result);
    });

    app.delete("/mycart/:id", async (req, res) => {
      const id = req.params.id;
      console.log("Received DELETE request for id:", id);

      try {
        const result = await myCartCollection.deleteOne({
          _id: new ObjectId(id),
        });

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

    app.get("/topSellingFoodItems", async (req, res) => {
      try {
        const topSellingFoodItems = await myCartCollection
          .aggregate([
            {
              $match: {
                quantity: { $type: "number" },
              },
            },
            {
              $group: {
                _id: "$food",
                count: { $sum: "$quantity" },
                name: { $first: "$food" },
                image: { $first: "$image" },
                category: { $first: "$food" },
                price: { $first: "$price" },
                userEmail: { $first: "$email" },
              },
            },
            {
              $sort: { count: -1 },
            },
            {
              $limit: 6,
            },
            {
              $project: {
                "Food ID": "$_id",
                name: "$name",
                Image: "$image",
                category: "$category",
                Price: "$price",
                userEmail: "$userEmail",
                "Details Button": {
                  $concat: ["/foodDetails/", "$name"],
                },
                count: 1,
              },
            },
          ])
          .toArray();

        res.send(topSellingFoodItems);
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send("An error occurred while fetching top-selling food items.");
      }
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Port is Running at ${port}`);
});
