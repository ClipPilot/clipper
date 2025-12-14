# Application Load Balancer
resource "aws_lb" "backend" {
  name               = "${var.project_name}-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = var.environment == "prod" ? true : false

  tags = {
    Name = "${var.project_name}-alb-${var.environment}"
  }
}

# Target Group
resource "aws_lb_target_group" "backend" {
  name        = "${var.project_name}-tg-${var.environment}"
  port        = var.backend_container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "${var.project_name}-tg-${var.environment}"
  }
}

# HTTP Listener (no HTTPS for now - add custom domain later)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.backend.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# HTTPS Listener - Commented out until custom domain is configured
# Uncomment and configure when you have a domain in GoDaddy
#
# resource "aws_lb_listener" "https" {
#   load_balancer_arn = aws_lb.backend.arn
#   port              = "443"
#   protocol          = "HTTPS"
#   ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
#   certificate_arn   = aws_acm_certificate.backend.arn
#
#   default_action {
#     type             = "forward"
#     target_group_arn = aws_lb_target_group.backend.arn
#   }
#
#   depends_on = [aws_acm_certificate_validation.backend]
# }

# ACM Certificate - Commented out until custom domain is configured
# To enable:
# 1. Uncomment this section
# 2. Update domain_name with your actual domain (e.g., api.yourdomain.com)
# 3. Run terraform apply
# 4. Add the DNS validation CNAME records to GoDaddy
# 5. Wait for validation to complete
#
# resource "aws_acm_certificate" "backend" {
#   domain_name       = "api.${var.project_name}.com"  # Update with your domain
#   validation_method = "DNS"
#
#   lifecycle {
#     create_before_destroy = true
#   }
#
#   tags = {
#     Name = "${var.project_name}-cert-${var.environment}"
#   }
# }
#
# resource "aws_acm_certificate_validation" "backend" {
#   certificate_arn = aws_acm_certificate.backend.arn
#
#   timeouts {
#     create = "5m"
#   }
# }
