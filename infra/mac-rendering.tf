# Mac Rendering Instance
# Dedicated macOS EC2 instance for Puppeteer text rendering with Apple fonts
# Used by the worker to render heading/text overlays with native Apple Color Emoji

variable "enable_mac_rendering" {
  description = "Enable the dedicated Mac rendering instance (only enable in prod — staging uses local Puppeteer fallback)"
  type        = bool
  default     = false
}

variable "mac_ami_id" {
  description = "macOS AMI ID (default: macOS Tahoe ARM)"
  type        = string
  default     = "ami-0b3b28bdf71ca43d4"
}

variable "mac_ssh_public_key" {
  description = "SSH public key for Mac rendering instance access"
  type        = string
  default     = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO7siIAWQl9heHRgVuM6aTGACVU2KXbLvGMO5lwxKpJm cuttr-mac-rendering"
}

variable "mac_renderer_port" {
  description = "Port for the Mac rendering HTTP service"
  type        = number
  default     = 3100
}

variable "mac_instance_type" {
  description = "Mac EC2 instance type (mac1.metal = Intel, mac2.metal = M1)"
  type        = string
  default     = "mac2.metal"
}

variable "mac_availability_zone" {
  description = "AZ for Mac dedicated host (must support Mac instances — check with: aws ec2 describe-instance-type-offerings --filters Name=instance-type,Values=mac2.metal --location-type availability-zone --region us-west-2)"
  type        = string
  default     = "us-west-2a"
}

# Find the private subnet index that matches the Mac AZ
locals {
  mac_subnet_index = var.enable_mac_rendering ? index(
    data.aws_availability_zones.available.names,
    var.mac_availability_zone
  ) : 0
}

# Dedicated Host (required for Mac instances — minimum 24hr allocation)
resource "aws_ec2_host" "mac_rendering" {
  count             = var.enable_mac_rendering ? 1 : 0
  instance_type     = var.mac_instance_type
  availability_zone = var.mac_availability_zone
  auto_placement    = "on"

  tags = {
    Name = "${var.project_name}-mac-rendering-host-${var.environment}"
  }
}

# Security Group — only accepts traffic from ECS worker tasks
resource "aws_security_group" "mac_rendering" {
  count       = var.enable_mac_rendering ? 1 : 0
  name        = "${var.project_name}-mac-rendering-sg-${var.environment}"
  description = "Security group for Mac rendering instance"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Rendering service from ECS tasks"
    from_port       = var.mac_renderer_port
    to_port         = var.mac_renderer_port
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  ingress {
    description = "SSH access from VPC"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    description = "Allow all outbound (package installs, Google Fonts)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-mac-rendering-sg-${var.environment}"
  }
}

# IAM Role for SSM Session Manager access
resource "aws_iam_role" "mac_rendering" {
  count = var.enable_mac_rendering ? 1 : 0
  name  = "${var.project_name}-mac-rendering-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = {
    Name = "${var.project_name}-mac-rendering-role-${var.environment}"
  }
}

resource "aws_iam_role_policy_attachment" "mac_rendering_ssm" {
  count      = var.enable_mac_rendering ? 1 : 0
  role       = aws_iam_role.mac_rendering[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "mac_rendering" {
  count = var.enable_mac_rendering ? 1 : 0
  name  = "${var.project_name}-mac-rendering-${var.environment}"
  role  = aws_iam_role.mac_rendering[0].name
}

# SSH Key Pair
resource "aws_key_pair" "mac_rendering" {
  count      = var.enable_mac_rendering && var.mac_ssh_public_key != "" ? 1 : 0
  key_name   = "${var.project_name}-mac-rendering-${var.environment}"
  public_key = var.mac_ssh_public_key

  tags = {
    Name = "${var.project_name}-mac-rendering-key-${var.environment}"
  }
}

# Mac EC2 Instance
resource "aws_instance" "mac_rendering" {
  count         = var.enable_mac_rendering ? 1 : 0
  ami           = var.mac_ami_id
  instance_type = var.mac_instance_type
  host_id       = aws_ec2_host.mac_rendering[0].id
  subnet_id     = aws_subnet.private[local.mac_subnet_index].id

  vpc_security_group_ids = [aws_security_group.mac_rendering[0].id]
  iam_instance_profile   = aws_iam_instance_profile.mac_rendering[0].name
  key_name               = var.mac_ssh_public_key != "" ? aws_key_pair.mac_rendering[0].key_name : null

  root_block_device {
    volume_size = 120
    volume_type = "gp3"
  }

  user_data = base64encode(<<-USERDATA
#!/bin/bash
# ec2-macos-init runs this as root via the Execute-User-Data module (RunPerInstance)
# SSM Agent is pre-installed on AWS macOS AMIs — no install needed

# Log everything for debugging (check via: cat /var/log/user-data.log)
exec > /var/log/user-data.log 2>&1
echo "=== user_data started at $(date) ==="
echo "=== Running as: $(whoami) ==="
echo "=== Instance: $(curl -s http://169.254.169.254/latest/meta-data/instance-id) ==="

# Ensure SSM Agent is running (pre-installed on AMI, just verify)
echo "=== Verifying SSM Agent ==="
launchctl load -w /Library/LaunchDaemons/com.amazon.aws.ssm.plist 2>/dev/null || true
launchctl start com.amazon.aws.ssm 2>/dev/null || true
echo "SSM Agent status: $(launchctl list | grep ssm || echo 'not found')"

export HOME=/Users/ec2-user
export HOMEBREW_PREFIX="/opt/homebrew"
export PATH="$HOMEBREW_PREFIX/opt/node@22/bin:$HOMEBREW_PREFIX/bin:$PATH"

# Install Node.js via Homebrew
echo "=== Installing Node.js ==="
sudo -u ec2-user $HOMEBREW_PREFIX/bin/brew update 2>&1 || true
sudo -u ec2-user $HOMEBREW_PREFIX/bin/brew install node@22 2>&1
echo "Node version: $(node --version 2>&1 || echo 'not found')"
echo "npm version: $(npm --version 2>&1 || echo 'not found')"

# Create the rendering service directory
mkdir -p $HOME/mac-renderer
cat > $HOME/mac-renderer/package.json << 'PKGJSON'
{
  "name": "mac-renderer",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "express": "^5.1.0",
    "puppeteer": "^24.0.0"
  }
}
PKGJSON

cat > $HOME/mac-renderer/server.js << 'SERVERJS'
import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = ${var.mac_renderer_port};
const MAX_BODY = "10mb";

app.use(express.json({ limit: MAX_BODY }));

// Keep a persistent browser instance (pages are cheap, browsers are expensive)
let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--font-render-hinting=none",
      ],
    });
  }
  return browser;
}

// POST /render — accepts HTML, returns PNG
app.post("/render", async (req, res) => {
  const { html, width = 1080, height = 400, deviceScaleFactor = 1 } = req.body;

  if (!html) {
    return res.status(400).json({ error: "html is required" });
  }

  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate("document.fonts.ready");

    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: true,
    });

    res.type("image/png").send(screenshot);
  } catch (err) {
    console.error("[render] Error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// POST /render-and-measure — accepts HTML, returns PNG + bounding box dimensions
app.post("/render-and-measure", async (req, res) => {
  const { html, selector = ".comment", width = 800, height = 400, deviceScaleFactor = 2, padding = 32 } = req.body;

  if (!html) {
    return res.status(400).json({ error: "html is required" });
  }

  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate("document.fonts.ready");

    const el = await page.$(selector);
    if (!el) {
      return res.status(400).json({ error: "selector not found: " + selector });
    }

    const box = await el.boundingBox();
    const clipWidth = Math.ceil(box.width) + padding;
    const clipHeight = Math.ceil(box.height) + padding;

    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: true,
      clip: {
        x: Math.max(0, box.x - padding / 2),
        y: Math.max(0, box.y - padding / 2),
        width: clipWidth,
        height: clipHeight,
      },
    });

    res.type("image/png");
    res.set("X-Render-Width", String(clipWidth));
    res.set("X-Render-Height", String(clipHeight));
    res.send(screenshot);
  } catch (err) {
    console.error("[render-and-measure] Error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", browser: browser?.connected ?? false });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Mac renderer listening on port " + PORT);
  // Pre-warm the browser
  getBrowser().then(() => console.log("Browser pre-warmed"));
});
SERVERJS

# Fix ownership (files created by root above)
chown -R ec2-user:staff $HOME/mac-renderer

# Install dependencies
echo "=== Installing npm dependencies ==="
sudo -u ec2-user bash -c "cd $HOME/mac-renderer && $HOMEBREW_PREFIX/opt/node@22/bin/npm install" 2>&1

# Create launchd plist to run on boot
cat > /Library/LaunchDaemons/com.cuttr.mac-renderer.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cuttr.mac-renderer</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/opt/node@22/bin/node</string>
        <string>/Users/ec2-user/mac-renderer/server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>UserName</key>
    <string>ec2-user</string>
    <key>WorkingDirectory</key>
    <string>/Users/ec2-user/mac-renderer</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/ec2-user/mac-renderer/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/ec2-user/mac-renderer/stderr.log</string>
</dict>
</plist>
PLIST

# Load and start the service
echo "=== Starting mac-renderer service ==="
launchctl load -w /Library/LaunchDaemons/com.cuttr.mac-renderer.plist

# Wait a moment and verify it's running
sleep 5
echo "=== Service status ==="
launchctl list | grep cuttr || echo "Service not found in launchctl"
curl -s http://localhost:${var.mac_renderer_port}/health || echo "Health check failed (service may still be starting)"

echo "=== user_data complete at $(date) ==="
echo "=== Logs: /Users/ec2-user/mac-renderer/stdout.log and stderr.log ==="
USERDATA
  )

  tags = {
    Name = "${var.project_name}-mac-rendering-${var.environment}"
  }
}

# Outputs
output "mac_renderer_private_ip" {
  description = "Private IP of the Mac rendering instance"
  value       = var.enable_mac_rendering ? aws_instance.mac_rendering[0].private_ip : ""
}

output "mac_renderer_url" {
  description = "URL for the Mac rendering service"
  value       = var.enable_mac_rendering ? "http://${aws_instance.mac_rendering[0].private_ip}:${var.mac_renderer_port}" : ""
}
