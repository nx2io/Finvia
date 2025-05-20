import { MailtrapClient } from "mailtrap";
import { MAILTRAP_TOKEN } from "./env.js";

export const mailtrapClient = new MailtrapClient({
	token: 'a9355bc2578cda37327c1fe4aa810501',
});

export const sender = {
	email: "hello@demomailtrap.co",
	name: "Finvia",
};
