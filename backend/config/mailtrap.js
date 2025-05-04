import { MailtrapClient } from "mailtrap";
import { MAILTRAP_TOKEN, MAILTRAP_ENDPOINT } from "./env.js";

export const mailtrapClient = new MailtrapClient({
	endpoint: MAILTRAP_ENDPOINT,
	token: MAILTRAP_TOKEN,
});

export const sender = {
	email: "reset@anime-ray.com",
	name: "AnimeRay",
};
