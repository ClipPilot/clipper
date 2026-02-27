# Tailscale Subnet Router Relay for Mac Renderer
#
# A t3.micro EC2 instance that bridges the VPC to your Tailscale mesh network,
# allowing ECS workers in private subnets to reach the Mac renderer on your laptop.
#
# Architecture:
#   ECS Worker (private subnet) -> VPC route table (100.64.0.0/10) -> EC2 relay (t3.micro)
#     -> WireGuard tunnel via NAT GW -> Your laptop (Tailscale IP 100.x.y.z:3100)
#
# All resources are conditional on var.tailscale_auth_key being set.
# Cost: ~$8.50/month (t3.micro + 8GB gp3)

variable "mac_renderer_url" {
  description = "URL for the Mac rendering service (Tailscale IP, e.g. http://100.x.y.z:3100)"
  type        = string
  default     = ""
}

variable "mac_renderer_port" {
  description = "Port for the Mac rendering HTTP service"
  type        = number
  default     = 3100
}

locals {
  tailscale_enabled = nonsensitive(var.tailscale_auth_key != "")
}

# --- AMI ---

data "aws_ami" "amazon_linux_2023" {
  count       = local.tailscale_enabled ? 1 : 0
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# --- Security Group ---

resource "aws_security_group" "tailscale_relay" {
  count       = local.tailscale_enabled ? 1 : 0
  name        = "${var.project_name}-tailscale-relay-sg-${var.environment}"
  description = "Security group for Tailscale VPC relay"
  vpc_id      = aws_vpc.main.id

  # Allow all inbound from VPC (ECS workers routing through this instance)
  ingress {
    description = "All traffic from VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  # Allow all outbound (Tailscale WireGuard + general internet via NAT)
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-tailscale-relay-sg-${var.environment}"
  }
}

# --- IAM Role (SSM access for management) ---

resource "aws_iam_role" "tailscale_relay" {
  count = local.tailscale_enabled ? 1 : 0
  name  = "${var.project_name}-tailscale-relay-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "${var.project_name}-tailscale-relay-role-${var.environment}"
  }
}

resource "aws_iam_role_policy_attachment" "tailscale_relay_ssm" {
  count      = local.tailscale_enabled ? 1 : 0
  role       = aws_iam_role.tailscale_relay[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "tailscale_relay" {
  count = local.tailscale_enabled ? 1 : 0
  name  = "${var.project_name}-tailscale-relay-profile-${var.environment}"
  role  = aws_iam_role.tailscale_relay[0].name
}

# --- EC2 Instance ---

resource "aws_instance" "tailscale_relay" {
  count                = local.tailscale_enabled ? 1 : 0
  ami                  = data.aws_ami.amazon_linux_2023[0].id
  instance_type        = "t3.micro"
  subnet_id            = aws_subnet.private[0].id
  iam_instance_profile = aws_iam_instance_profile.tailscale_relay[0].name
  source_dest_check    = false

  vpc_security_group_ids = [aws_security_group.tailscale_relay[0].id]

  user_data = base64encode(<<-USERDATA
    #!/bin/bash
    set -euo pipefail

    # Enable IP forwarding
    echo 'net.ipv4.ip_forward = 1' >> /etc/sysctl.d/99-tailscale.conf
    echo 'net.ipv6.conf.all.forwarding = 1' >> /etc/sysctl.d/99-tailscale.conf
    sysctl -p /etc/sysctl.d/99-tailscale.conf

    # Install Tailscale
    dnf install -y dnf-plugins-core
    dnf config-manager --add-repo https://pkgs.tailscale.com/stable/amazon-linux/2023/tailscale.repo
    dnf install -y tailscale
    systemctl enable --now tailscaled

    # Join tailnet as subnet router (advertise VPC CIDR so laptop can reach VPC too)
    tailscale up \
      --authkey="${var.tailscale_auth_key}" \
      --advertise-routes=10.0.0.0/16 \
      --accept-routes \
      --hostname="${var.project_name}-vpc-relay-${var.environment}"
    USERDATA
  )

  root_block_device {
    volume_type = "gp3"
    volume_size = 30
  }

  tags = {
    Name = "${var.project_name}-tailscale-relay-${var.environment}"
  }

  lifecycle {
    ignore_changes = [user_data]
  }
}

# --- Outputs ---

output "tailscale_relay_private_ip" {
  description = "Private IP of the Tailscale relay instance"
  value       = local.tailscale_enabled ? aws_instance.tailscale_relay[0].private_ip : ""
  sensitive   = true
}

output "tailscale_relay_instance_id" {
  description = "Instance ID of the Tailscale relay (use with SSM)"
  value       = local.tailscale_enabled ? aws_instance.tailscale_relay[0].id : ""
  sensitive   = true
}
