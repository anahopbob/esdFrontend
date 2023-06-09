import React, { useEffect, useState } from "react";
import axios from "axios";
import Button from "./Button";
// import { Spinner } from "@stripe/ui-extension-sdk/ui";
//socket io listener
import io from "socket.io-client";
import {
  PaymentElement,
  LinkAuthenticationElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import toast from "react-hot-toast";

export default function CheckoutForm({ userData, clientSecret }) {
  const stripe = useStripe();
  const elements = useElements();
  const [recommendation, setRecommendation] = useState([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(null);
  const data = {
    amount: userData["coursePrice"],
    amount_capturable: 0,
    amount_details: {
      tip: {},
    },
    amount_received: userData["coursePrice"],
    automatic_payment_methods: {
      enabled: true,
    },
    capture_method: "automatic",
    client_secret: clientSecret,
    confirmation_method: "automatic",
    created: 1680003858,
    currency: "sgd",
    id: "pi_3MqawoJTqG9NvRuT1CIECYYH",
    latest_charge: {
      id: "ch_3MqawoJTqG9NvRuT1geYkf4z",
    },
    livemode: false,
    metadata: {
      courseDescription: userData["courseDescription"],
      userEmail: userData["userEmail"],
      coursename: userData["coursename"]?.replace(/\s+/g, "-"),
      runID: userData["runID"].toString(),
      orderID: userData["orderID"],
      userID: userData["userID"],
      classId: userData["classID"].toString(),
    },
    object: "payment_intent",
    payment_method: {
      id: "pm_1Mqax8JTqG9NvRuTdQ8sxHYn",
    },
    payment_method_options: {
      card: {
        request_three_d_secure: "automatic",
      },
      paynow: {},
    },
    payment_method_types: ["card", "paynow"],
    status: "succeeded",
  };

  useEffect(() => {
    setFormData(data);
    const socket = io("http://localhost:8000", {
      path: "/consumer_service/socket.io",
    });
    // const socket = io("http://localhost:5011");

    socket.on("connect", () => {});

    socket.on("disconnect", () => {});
    socket.on("message", (data) => {
      // Update the React state or UI based on the message data
      setRecommendation(data.recommendation);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (recommendation !== undefined) {
      if (recommendation.length > 0) {
        updateRecommendedClasses(recommendation);
      }
    }
  }, [recommendation]);

  const updateRecommendedClasses = async (classes) => {
    await axios
      .put(`http://localhost:8000/users/recc/${userData["userID"]}`, {
        recommended_classes: classes,
      })
      .then((res) => {})
      .catch((err) => {
        console.log(err);
      });
  };

  const doPurchase = async () => {
    await axios
      // error with this route for now
      .post("http://localhost:8000/process_booking/update_payment", formData)
      .then((res) => {})
      .catch((err) => {
        console.log(err);
      });
  };
  useEffect(() => {
    if (!stripe) {
      return;
    }

    const clientSecret = new URLSearchParams(window.location.search).get(
      "payment_intent_client_secret"
    );

    if (!clientSecret) {
      return;
    }

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      switch (paymentIntent.status) {
        case "succeeded":
          setMessage("Payment succeeded!");
          break;
        case "processing":
          setMessage("Your payment is processing.");
          break;
        case "requires_payment_method":
          setMessage("Your payment was not successful, please try again.");
          break;
        default:
          setMessage("Something went wrong.");
          break;
      }
    });
  }, [stripe]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    toast.loading("Processing Payment...", { duration: 6000 });
    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return;
    }

    setIsLoading(true);
    await doPurchase();
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Make sure to change this to your payment completion page
        return_url: `${window.location.origin}/confirmation`,
        receipt_email: email,
        payment_method_data: {
          billing_details: { email: email },
        },
      },
    });

    // This point will only be reached if there is an immediate error when
    // confirming the payment. Otherwise, your customer will be redirected to
    // your `return_url`. For some payment methods like iDEAL, your customer will
    // be redirected to an intermediate site first to authorize the payment, then
    // redirected to the `return_url`.

    if (error.type === "card_error" || error.type === "validation_error") {
      setMessage(error.message);
    } else {
      setMessage("An unexpected error occurred.");
    }

    setIsLoading(false);
  };

  const paymentElementOptions = {
    layout: "tabs",
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      <PaymentElement id="payment-element" options={paymentElementOptions} />
      <LinkAuthenticationElement
        id="link-authentication-element"
        onChange={(e) => setEmail(e.target)}
      />
      <button
        className="mt-5 w-fit rounded-lg bg-green-500 px-5 py-2.5 text-sm font-medium  duration-150 hover:bg-green-400 focus:outline-none focus:ring-4"
        disabled={isLoading || !stripe || !elements}
        id="submit"
      >
        <span id="button-text">{isLoading ? "Processing..." : "Pay now"}</span>
      </button>
    </form>
  );
}
