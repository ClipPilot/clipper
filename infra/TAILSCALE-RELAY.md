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
