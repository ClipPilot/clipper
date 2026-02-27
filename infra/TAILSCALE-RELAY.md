# Tailscale Subnet Router Relay for Mac Renderer

## How It Works

ECS workers run in **private VPC subnets** with no public IP — they can only reach the internet through a NAT gateway. Your laptop (or Mac Mini) sits outside AWS entirely. There's no direct path between them.

Tailscale creates a **WireGuard mesh VPN** between devices. But ECS Fargate tasks can't run Tailscale themselves (no control over the host). So we use a relay:

```
ECS Worker (10.0.10.x)
    |
    |  Packet destined for 100.x.y.z:3100 (your laptop's Tailscale IP)
    |
    v
VPC Route Table
    |  "100.64.0.0/10 -> relay ENI"
    |
    v
EC2 Relay (t3.micro, 10.0.10.z)
    |  source_dest_check = false  (AWS normally drops packets not addressed to the instance)
    |  IP forwarding enabled      (kernel forwards packets instead of consuming them)
    |  Tailscale running          (WireGuard tunnel to your tailnet)
    |
    v
NAT Gateway -> Internet -> WireGuard tunnel -> Tailscale coordination server
    |
    v
Your Laptop / Mac Mini (100.x.y.z)
    |  Tailscale running, listening on :3100
    |
    v
mac-renderer (Puppeteer + Apple fonts)
```

The `100.64.0.0/10` CIDR is Tailscale's reserved address range (CGNAT space). Every device on your tailnet gets an IP in this range. By routing that whole range through the relay, any Tailscale device is reachable from your VPC.

The relay also **advertises `10.0.0.0/16`** (your VPC CIDR) back to the tailnet, so once you approve the subnet routes in the Tailscale admin console, your laptop can reach VPC resources too (useful for debugging).

**Cost:** ~$8.50/month per relay (t3.micro + 8GB gp3)

All Terraform resources are conditional — set `tailscale_auth_key = ""` to disable.

## Setup Steps

### 1. Create Tailscale account & install

```bash
brew install --cask tailscale
```

Open the Tailscale app and sign in (Google/GitHub/etc).

### 2. Generate an auth key for the relay

Go to **Tailscale Admin Console** > Settings > Keys > **Generate auth key**:
- **Reusable**: yes (so the relay can reconnect after reboots)
- **Pre-authorized**: yes (skips manual approval for the relay device)
- **Expiry**: set to the longest option available

Copy the key (`tskey-auth-k...`).

### 3. Add GitHub secrets

In your repo's Settings > Secrets > **production** environment:
- `TAILSCALE_AUTH_KEY` = `tskey-auth-k...`
- `MAC_RENDERER_URL` = (leave empty for now)

Do the same for the **staging** environment if needed.

### 4. Push infra changes

Terraform will create the relay instance. Once deployed:

### 5. Approve subnet routes

Go to **Tailscale Admin Console** > Machines > find `clipster-vpc-relay-prod` > **Edit route settings** > approve `10.0.0.0/16`.

### 6. Get your Tailscale IP and set the renderer URL

```bash
tailscale ip -4
# e.g. 100.100.100.50
```

Update GitHub secret:
- `MAC_RENDERER_URL` = `http://100.100.100.50:3100`

Then re-run the Terraform workflow (or trigger a worker redeploy) so the new URL gets picked up.

### 7. Verify

```bash
# SSM into the relay (no SSH key needed)
aws ssm start-session --target <instance-id-from-terraform-output>

# On the relay:
tailscale status                              # should show your laptop as a peer
curl http://100.100.100.50:3100/health        # should reach your mac-renderer
```

## When the Mac Mini Arrives

Same Tailscale setup — it just replaces your laptop as the renderer host:

1. Install Tailscale on the Mac Mini (`brew install --cask tailscale`, sign in)
2. Start the mac-renderer service (`node server.js` or set up as a launchd service)
3. Get the Mac Mini's Tailscale IP: `tailscale ip -4`
4. Update `MAC_RENDERER_URL` GitHub secret to `http://<mac-mini-tailscale-ip>:3100`
5. Re-run Terraform or redeploy the worker

The relay doesn't change — only the destination IP does. You can run both simultaneously during migration since they'll have different Tailscale IPs.

## Key Rotation

The auth key in user_data is a **one-time bootstrap**. After the relay joins your tailnet, Tailscale maintains the connection via its own key exchange. The `ignore_changes = [user_data]` lifecycle rule means rotating the GitHub secret won't destroy/recreate the relay.

If you need to re-key the relay manually:

```bash
aws ssm start-session --target <instance-id>
# then on the relay:
tailscale up --authkey=<new-key>
```

## Security

- **End-to-end encrypted** via WireGuard — even if packets are intercepted on the public internet, they're unreadable.
- **Tailscale handles key rotation** automatically after initial bootstrap.
- **The relay advertises your entire VPC CIDR** (`10.0.0.0/16`) to your tailnet. Any device on your Tailscale account can reach your VPC. Fine for a personal account, but if you add other people to your tailnet, use [Tailscale ACLs](https://tailscale.com/kb/1018/acls) to restrict access.
- **The mac-renderer has no auth** on port 3100, but it's only reachable via Tailscale (not the public internet). Tailscale itself is the auth layer.
- **The auth key in user_data** is a one-time bootstrap token. After the relay joins, Tailscale uses its own key exchange. The `ignore_changes` lifecycle rule prevents Terraform from re-evaluating it.

## Mac Mini Production Setup

### Auto-start the renderer with launchd

Create `~/Library/LaunchAgents/com.cuttr.mac-renderer.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cuttr.mac-renderer</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/YOUR_USER/mac-renderer/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/YOUR_USER/mac-renderer</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/mac-renderer.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/mac-renderer.stderr.log</string>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.cuttr.mac-renderer.plist
```

- **RunAtLoad** — starts on login (and on boot if auto-login is enabled)
- **KeepAlive** — restarts the process automatically if it crashes

### Resilience after power outages

1. **Auto-login**: System Settings > Users & Groups > Login Options > enable auto-login for your user (so launchd agents start after reboot)
2. **Auto power on**: System Settings > Energy > "Start up automatically after a power failure"
3. **Tailscale auto-start**: The Tailscale app starts on login by default — verify it's in System Settings > Login Items

With all three configured: power outage ends > Mac Mini boots > auto-logs in > Tailscale reconnects > launchd starts the renderer. ECS workers will get connection errors during the outage but will retry via SQS once the renderer is back up.
