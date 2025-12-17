# Application Load Balancer
resource "aws_lb" "backend" {
  name               = "${var.project_name}-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = var.environment == "prod" ? true : false

  # Increase idle timeout for WebSocket support
  idle_timeout = 3600

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

  # Enable sticky sessions for WebSocket/Socket.io support
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400 # 24 hours
    enabled         = true
  }

  deregistration_delay = 30

  tags = {
    Name = "${var.project_name}-tg-${var.environment}"
  }
}

# HTTP Listener - redirects to HTTPS when custom domain is configured
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.backend.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = var.api_domain != "" ? "redirect" : "forward"

    dynamic "redirect" {
      for_each = var.api_domain != "" ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }

    target_group_arn = var.api_domain == "" ? aws_lb_target_group.backend.arn : null
  }
}

# HTTPS Listener - enabled when custom domain is configured
resource "aws_lb_listener" "https" {
  count = var.api_domain != "" ? 1 : 0

  load_balancer_arn = aws_lb.backend.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.backend[0].arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  depends_on = [aws_acm_certificate_validation.backend]
}

# ACM Certificate - created when custom domain is configured
resource "aws_acm_certificate" "backend" {
  count = var.api_domain != "" ? 1 : 0

  domain_name       = var.api_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-cert-${var.environment}"
  }
}

resource "aws_acm_certificate_validation" "backend" {
  count = var.api_domain != "" ? 1 : 0

  certificate_arn = aws_acm_certificate.backend[0].arn

  timeouts {
    create = "30m"
  }
}
