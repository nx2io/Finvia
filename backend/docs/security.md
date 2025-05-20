### 1. Network and Communication

* [ ] Enforce HTTPS using TLS 1.3 only.
* [ ] Enable HSTS Header.
* [ ] Close all unused ports on the server (via firewall).
* [ ] Enable DDoS Protection at the VPS provider level.

---

### 2. Authentication and Authorization

* [ ] Use JWT with strong signature algorithm (HS256 or RS256).
* [ ] Implement short-lived tokens with refresh tokens.
* [ ] Enable Two-Factor Authentication (2FA) using TOTP.
* [ ] Bind tokens to IP address or User-Agent to prevent reuse from another device.

---

### 3. API Protection

* [ ] Apply smart Rate Limiting based on request type and user role.
* [ ] Add CSRF token to sensitive requests.
* [ ] Use Nonce or Timestamp to prevent Replay Attacks.
* [ ] Enforce content-type validation (Content-Type = application/json).
* [ ] Restrict access to sensitive APIs from untrusted sources (strict CORS policy).
* [ ] Track request count per API path per IP/user to detect abuse or brute-force attempts.

---

### 4. Anomaly Detection

* [ ] Log all login attempts and sensitive API requests.
* [ ] Analyze visitor IP, geolocation, and ASN.
* [ ] Send alerts via email or dashboard on suspicious activity detection.
* [ ] Monitor repeated transfers to the same recipient to detect suspicious patterns.
* [ ] Detect IP geolocation changes per user and trigger review or 2FA if drastic.
* [ ] Flag users with excessive failed transfers or abnormal frequency.

---

### 5. Data Protection

* [ ] Encrypt sensitive data in the database (e.g., AES-256).
* [ ] Never store passwords in plain text (use bcrypt or Argon2).
* [ ] Keep API keys in environment variables only.

---

### 6. Bot and Attack Mitigation

* [ ] Enable Bot Protection system.
* [ ] Use CAPTCHA during registration and sensitive operations.
* [ ] Use a Web Application Firewall (WAF).

---

### 7. Maintenance and Monitoring

* [ ] Monitor server uptime using tools like UptimeRobot or Grafana.
* [ ] Log errors with monitoring tools like Sentry or LogRocket.
* [ ] Conduct regular log reviews to detect breaches or threats.
