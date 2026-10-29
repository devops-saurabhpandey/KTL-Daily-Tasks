# KTL Daily Tasks — Self-hosting

This runs the app and MongoDB on a computer you control. It does not require Render or MongoDB Atlas.

## Requirements
- A Windows 10/11, Linux, or macOS computer that can remain powered on
- Docker Desktop (Windows/macOS) or Docker Engine + Compose (Linux)
- Reliable internet for remote use; local use works on the same network

## Start
1. Install Docker.
2. Download/clone this repository on the server computer.
3. In the project folder, run:
   `docker compose up -d --build`
4. On the server computer open `http://localhost:3000`.
5. On another device on the same Wi-Fi, open `http://SERVER-LAN-IP:3000` (replace with the computer's local IP).

## Check and stop
- Status: `docker compose ps`
- Logs: `docker compose logs -f app`
- Stop app: `docker compose down`
- Restart: `docker compose up -d`

MongoDB data is stored in the persistent Docker volume `ktl_mongo_data`. Do not run `docker compose down -v` unless you intentionally want to delete that database volume.

## Important security note
The current app does not have user login/authentication. Do not expose port 3000 to the public internet or store real customer personal data until authentication, authorization, backups, and HTTPS are implemented. MongoDB is intentionally not published as a host port.

For access from outside your home/office, set up a secure HTTPS tunnel or VPN only after securing the app. Your router, ISP, internet connection, power, and computer must remain on for 24/7 availability. Local hosting avoids hosting subscriptions, but is not literally cost-free: electricity and internet still cost money, and power/internet outages take the app offline.

## WhatsApp
If you configure WhatsApp Cloud API, copy `.env.example` to `.env`, enter credentials locally, and keep `.env` private. Never paste access tokens into chat or commit them to GitHub. A valid approved template and customer opt-in may be required.
