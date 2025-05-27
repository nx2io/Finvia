import arcjet, { shield, detectBot, tokenBucket } from "@arcjet/node";
import { ARCJET_KEY } from './env.js';

const aj = arcjet({
  key: ARCJET_KEY,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: [ "CATEGORY:SEARCH_ENGINE" ],
    }),
    tokenBucket({
      mode: "LIVE",
      refillRate: 1,  // Refill 20 tokens per interval
      interval: 5,    // Refill every 10 seconds
      capacity: 2,    // Bucket capacity of 60 tokens
    }),
  ],
});

export default aj;
