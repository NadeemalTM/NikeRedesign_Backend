const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_development');
const { auth } = require('../middleware/auth');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Create payment intent
router.post('/create-payment-intent', auth, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, notes = '' } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name price image stock');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Check stock availability
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Not enough stock for ${product.name}. Only ${product.stock} available.` 
        });
      }
    }

    // Calculate totals
    const subtotal = cart.total;
    const shippingCost = subtotal > 5000 ? 0 : 200;
    const tax = subtotal * 0.13;
    const total = Math.round((subtotal + shippingCost + tax) * 100); // Convert to cents for Stripe

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'pkr',
      metadata: {
        userId: req.user._id.toString(),
        cartId: cart._id.toString(),
        shippingAddress: JSON.stringify(shippingAddress)
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: total / 100 // Convert back to rupees
    });
  } catch (error) {
    console.error('Stripe payment intent error:', error);
    res.status(500).json({ message: 'Failed to create payment intent', error: error.message });
  }
});

// Handle Stripe webhook for payment confirmation
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await handlePaymentIntentSucceeded(paymentIntent);
      break;
    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object;
      await handlePaymentIntentFailed(failedPaymentIntent);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Handle successful payment
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    const { userId, cartId, shippingAddress } = paymentIntent.metadata;
    const parsedShippingAddress = JSON.parse(shippingAddress);

    // Get user's cart
    const cart = await Cart.findOne({ _id: cartId, user: userId })
      .populate('items.product', 'name price image stock');

    if (!cart) {
      console.error('Cart not found for payment:', cartId);
      return;
    }

    // Calculate totals
    const subtotal = cart.total;
    const shippingCost = subtotal > 5000 ? 0 : 200;
    const tax = subtotal * 0.13;
    const total = subtotal + shippingCost + tax;

    // Create order items
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      price: item.price,
      name: item.product.name,
      image: item.product.image
    }));

    // Create new order
    const order = new Order({
      user: userId,
      items: orderItems,
      shippingAddress: parsedShippingAddress,
      subtotal,
      shippingCost,
      tax,
      total,
      paymentMethod: 'stripe',
      paymentStatus: 'completed',
      stripePaymentId: paymentIntent.id,
      orderStatus: 'confirmed'
    });

    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { stock: -item.quantity } }
      );
    }

    // Clear user's cart
    cart.items = [];
    await cart.save();
    await order.save();

    console.log(`Order created successfully for payment: ${paymentIntent.id}`);

  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

// Handle failed payment
async function handlePaymentIntentFailed(paymentIntent) {
  console.log(`Payment failed: ${paymentIntent.id}`);
  // You might want to update order status or send notification here
}

// Verify payment and get order details
router.get('/payment/:paymentIntentId', auth, async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    // Get payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not completed' });
    }

    // Find order by stripePaymentId
    const order = await Order.findOne({ 
      stripePaymentId: paymentIntentId,
      user: req.user._id 
    }).populate('items.product', 'name price image');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ message: 'Failed to verify payment', error: error.message });
  }
});

module.exports = router;
