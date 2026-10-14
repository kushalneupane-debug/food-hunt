# Deploying Food Hunt to AWS EC2

The whole app (React frontend, Express API, MySQL) runs on **one EC2 instance**
with Docker Compose. The frontend and API share one URL: `http://<EC2-public-IP>/`.

```
Browser ──HTTP :80──▶ EC2 (Ubuntu 24.04)
                       ├─ app container: Express API + built React app
                       └─ db container:  MySQL 8.4 (not exposed to the internet)
```

## 1. Launch the instance (AWS Console, ~5 min)
1. Log in as your IAM user (not root). Pick one region, e.g. **US East (Ohio)**.
2. **EC2 → Launch instance**
   - Name: `food-hunt`
   - AMI: **Ubuntu Server 24.04 LTS**
   - Instance type: **t3.micro** (free-tier eligible; t2.micro is fine too)
   - Key pair: **Create new key pair** → `food-hunt-key`, type RSA, format `.pem` → it downloads. Keep it safe and never commit it.
   - Network settings → **Edit**:
     - Allow **SSH** from **My IP**
     - Allow **HTTP** from **Anywhere** (0.0.0.0/0)
   - Storage: 20 GB gp3
3. **Launch instance**, open it, and copy the **Public IPv4 address**.

Optional but recommended: **EC2 → Elastic IPs → Allocate → Associate** with the
instance so the IP doesn't change when the instance restarts. (An Elastic IP is
free only while it's attached to a running instance.)

## 2. Connect
Easiest: on the instance page click **Connect → EC2 Instance Connect → Connect**
(opens a terminal in the browser).

Or from a Mac terminal:
```bash
chmod 400 ~/Downloads/food-hunt-key.pem
ssh -i ~/Downloads/food-hunt-key.pem ubuntu@<EC2-public-IP>
```

## 3. Install and start the app (one command)
On the EC2 terminal:
```bash
curl -fsSL https://raw.githubusercontent.com/kushalneupane-debug/food-hunt/main/deploy/ec2-setup.sh | bash
```
It adds swap, installs Docker, clones the repo, generates database passwords
into `~/food-hunt/.env` (server only), and starts everything. The first build
takes 3–6 minutes.

Check:
- `http://<EC2-public-IP>/api/health` shows `{"status":"ok","db":"up"}`
- `http://<EC2-public-IP>/` shows the Food Hunt home page

## 4. Deploy new changes
After a pull request is merged into `main`:
```bash
~/food-hunt/deploy/update.sh
```

## Troubleshooting
| Problem | Fix |
|---|---|
| Page doesn't load at all | Security group must allow HTTP (port 80) from 0.0.0.0/0. Use `http://`, not `https://`. |
| `/api/health` says `"db":"down"` | MySQL is still starting; wait 30 s. Then `sudo docker compose -f docker-compose.prod.yml logs db` |
| Need logs | `cd ~/food-hunt && sudo docker compose -f docker-compose.prod.yml logs -f app` |
| Reset the database to sample data | `sudo docker compose -f docker-compose.prod.yml down -v && sudo docker compose -f docker-compose.prod.yml up -d` |
| "Location" button uses Texarkana | Browsers only allow geolocation on HTTPS; on plain HTTP the app falls back to Texarkana. HTTPS comes later. |

## Cost control
- Keep an **AWS Budgets** alarm (e.g. $5) on the account.
- Stop the instance when you're not demoing (**Instance state → Stop**). The data is kept on the disk.
