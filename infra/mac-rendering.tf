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
  default     = "us-west-2b"
}

# Look up which private subnet is in the Mac AZ
data "aws_subnet" "mac_rendering" {
  count  = var.enable_mac_rendering ? 1 : 0
  vpc_id = aws_vpc.main.id

  filter {
    name   = "availability-zone"
    values = [var.mac_availability_zone]
  }

  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-private-subnet-*"]
  }
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
  subnet_id     = data.aws_subnet.mac_rendering[0].id

  vpc_security_group_ids = [aws_security_group.mac_rendering[0].id]
  key_name               = var.mac_ssh_public_key != "" ? aws_key_pair.mac_rendering[0].key_name : null

  root_block_device {
    volume_size = 120
    volume_type = "gp3"
  }

  user_data = base64encode(<<-USERDATA
#!/bin/zsh
set -e

export HOME=/Users/ec2-user
cd $HOME

# Install Node.js via Homebrew
su - ec2-user -c 'brew install node@22'
su - ec2-user -c 'echo "export PATH=/opt/homebrew/opt/node@22/bin:\$PATH" >> ~/.zshrc'
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

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

# Install dependencies
su - ec2-user -c 'cd $HOME/mac-renderer && /opt/homebrew/opt/node@22/bin/npm install'

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
launchctl load /Library/LaunchDaemons/com.cuttr.mac-renderer.plist

echo "Mac renderer setup complete"
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
