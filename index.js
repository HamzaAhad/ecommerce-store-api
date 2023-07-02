const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("../../models/index");
const UserModel = db.users;
const ProductModel = db.products;
const CartModel = db.cart;
var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
const config = require("../../config/auth.config");

const { Server } = require("socket.io");

const stripe = require("stripe")(process.env.STRIPE_KEY);
///APP CONFIG
const app = express();

//MIDDLEWARES
app.use(cors({ origin: true }));
app.use(express.json());

const server = http.createServer(app);
//API ROUTES
app.get("/", (req, res) => {
  res.status(200).send("HELLO");
});

app.post("/payment/create", async (req, res) => {
  const total = req.query.total;
  console.log("Payment request recieved", total);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: total,
    currency: "inr",
  });
  console.log(paymentIntent);
  res.status(201).send({
    clientSecret: paymentIntent.client_secret,
  });
});

checkDuplicateUsernameOrEmail = async (req, res, next) => {
  try {
    const existingUser = await UserModel.findOne({
      where: {
        $or: [{ name: req.body.name }, { email: req.body.email }],
      },
    });

    if (existingUser) {
      return res.status(400).send({
        message: "Failed! Username or email is already in use!",
      });
    }

    next(); // Move on to the next middleware or route handler
  } catch (error) {
    // Handle any errors that occur during the process
    console.error(error);
    return res.status(500).send({
      message: "Internal server error",
    });
  }
};

app.post("/signup", checkDuplicateUsernameOrEmail, async (req, res) => {
  UserModel.create({
    name: req?.body?.name,
    email: req?.body?.email,
    password: bcrypt.hashSync(req.body.password, 8),
    roleId: req?.body?.roleId,
  }).then(() => {
    res.send({ message: "USER REGISTERED" });
  });
});

app.post("/signin", async (req, res) => {
  UserModel.findOne({
    where: {
      name: req.body.name,
    },
  })
    .then((user) => {
      console.log(user);
      if (!user) {
        return res.status(404).send({ message: "User Not found." });
      }

      var passwordIsValid = bcrypt.compareSync(
        req.body.password,
        user.password
      );
      if (!passwordIsValid) {
        return res.status(401).send({
          accessToken: null,
          message: "Invalid Password!",
        });
      }
      var token = jwt.sign({ id: user.id }, config.secret, {
        expiresIn: 1.577e8, // 24 hours
      });

      res.status(200).send({
        id: user.id,
        name: user.name,
        email: user.email,
        accessToken: token,
      });
    })
    .catch((err) => {
      console.log(err.message);
      res.status(500).send({ message: err.message });
    });
});

app.get("/product", async (req, res) => {
  if (!req?.body?.sellerId) {
    res.status(400).send("Send seller id");
  }

  const data = ProductModel.findAll({
    where: {
      sellerId: req?.body?.sellerId,
    },
  });
  res.status(200).send(data);
});

app.post("/product", async (req, res) => {
  const data = ProductModel.create({
    name: req?.body?.name,
    sellerId: req?.body?.sellerId,
    rating: req?.body?.rating,
    prices: req?.body?.prices,
    image: req?.body?.image,
  });
  res.status(200).send("Product created successfully");
});

app.put("/product/:id", async (req, res) => {
  const data = ProductModel.update(
    {
      name: req?.body?.name,
      sellerId: req?.body?.sellerId,
      rating: req?.body?.rating,
      prices: req?.body?.prices,
      image: req?.body?.image, // Update the email field with the new value
    },
    {
      where: {
        id: req?.params?.id, // Specify the condition to identify the record(s) you want to update
      },
    }
  );
  res.status(200).send("Product updated successfully");
});

app.delete("/product/:id", async (req, res) => {
  const data = ProductModel.destroy({
    where: {
      id: req?.params?.id, // Specify the condition to identify the record(s) you want to delete
    },
  });
  if (data) {
    res.send({ message: "Product deleted successfully" });
  }
});

app.get("/cart/:userId", async (req, res) => {
  if (!req?.body?.userId) {
    res.status(400).send("Send user id");
  }

  const data = CartModel.findAll({
    where: {
      userId: req?.body?.userId,
    },
  });

  const productIds = [];
  if (data?.length) {
    for (const item of data) {
      productIds.push(item?.productId);
    }
  }

  let responseData;
  if (productIds?.length) {
    responseData = ProductModel.findAll({
      where: {
        id: productIds,
      },
    });
  }
  res.status(200).send(data);
});

app.post("/cart", async (req, res) => {
  const data = CartModel.bulkCreate({
    userId: req?.body?.userId,
    productId: req?.body?.productId,
  });
  res.status(200).send("Added to cart");
});

app.delete("/cart/:id", async (req, res) => {
  const data = CartModel.destroy({
    where: {
      id: req?.params?.id, // Specify the condition to identify the record(s) you want to delete
    },
  });
  if (data) {
    res.send({ message: "Cart cleared successfully" });
  }
});

// socket

// Create an io server and allow for CORS from http://localhost:3000 with GET and POST methods
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Add this
// Listen for when the client connects via socket.io-client
io.on("connection", (socket) => {
  console.log(`User connected ${socket.id}`);

  // We can write our socket event listeners in here...
  // Add a user to a room
  socket.on("join", (room) => {
    socket.join(room);
  });

  socket.on("chatMessage", (room, message) => {
    io.to(room).emit("message", message);
  });
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 8000;
}

app.listen(port, () => {
  console.log("Server Started");
});
