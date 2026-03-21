# Agent Service ECS Infrastructure
# Mastra-based AI agent service

# ECR Repository for Agent Service
resource "aws_ecr_repository" "agent_service" {
  name                 = "${var.project_name}-agent-service-${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-agent-service-ecr-${var.environment}"
  }
}

# ECR Lifecycle Policy
resource "aws_ecr_lifecycle_policy" "agent_service" {
  repository = aws_ecr_repository.agent_service.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "agent_service" {
  name              = "/ecs/${var.project_name}-agent-service-${var.environment}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-agent-service-logs-${var.environment}"
  }
}

# --- Internal ALB for Agent Service ---

resource "aws_security_group" "agent_service_alb" {
  name        = "${var.project_name}-agent-service-alb-sg-${var.environment}"
  description = "Security group for internal agent service ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow traffic from ECS tasks"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-agent-service-alb-sg-${var.environment}"
  }
}

resource "aws_lb" "agent_service" {
  name               = "${var.project_name}-agent-svc-${var.environment}"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [aws_security_group.agent_service_alb.id]
  subnets            = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-agent-service-alb-${var.environment}"
  }
}

resource "aws_lb_target_group" "agent_service" {
  name        = "${var.project_name}-agent-svc-tg-${var.environment}"
  port        = 4111
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-agent-service-tg-${var.environment}"
  }
}

resource "aws_lb_listener" "agent_service" {
  load_balancer_arn = aws_lb.agent_service.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.agent_service.arn
  }
}

# --- ECS Task Definition ---

resource "aws_ecs_task_definition" "agent_service" {
  family                   = "${var.project_name}-agent-service-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.agent_service_cpu
  memory                   = var.agent_service_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "agent-service"
    image = "${aws_ecr_repository.agent_service.repository_url}:latest"

    portMappings = [{
      containerPort = 4111
      protocol      = "tcp"
    }]

    environment = [
      {
        name  = "PORT"
        value = "4111"
      },
      {
        name  = "NODE_ENV"
        value = var.node_env
      },
      {
        name  = "AWS_REGION"
        value = var.aws_region
      },
      {
        name  = "AWS_S3_BUCKET"
        value = local.s3_bucket_id
      },
      {
        name  = "SUPABASE_URL"
        value = var.supabase_url
      },
      {
        name  = "BACKEND_URL"
        value = var.api_domain != "" ? "https://${var.api_domain}" : "http://${aws_lb.backend.dns_name}"
      }
    ]

    secrets = [
      {
        name      = "OPENAI_API_KEY"
        valueFrom = aws_secretsmanager_secret.openai_api_key.arn
      },
      {
        name      = "DATABASE_URL"
        valueFrom = aws_secretsmanager_secret.database_url.arn
      },
      {
        name      = "SUPABASE_ANON_KEY"
        valueFrom = aws_secretsmanager_secret.supabase_anon_key.arn
      },
      {
        name      = "GEMINI_API_KEY"
        valueFrom = aws_secretsmanager_secret.gemini_api_key.arn
      },
      {
        name      = "GOOGLE_GENERATIVE_AI_API_KEY"
        valueFrom = aws_secretsmanager_secret.gemini_api_key.arn
      },
      {
        name      = "INTERNAL_API_KEY"
        valueFrom = aws_secretsmanager_secret.internal_api_key.arn
      },
      {
        name      = "TAVILY_API_KEY"
        valueFrom = aws_secretsmanager_secret.tavily_api_key.arn
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.agent_service.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:4111/api/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }

    essential = true
  }])

  tags = {
    Name = "${var.project_name}-agent-service-task-${var.environment}"
  }
}

# --- ECS Service ---

resource "aws_ecs_service" "agent_service" {
  name            = "${var.project_name}-agent-service-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.agent_service.arn
  desired_count   = var.agent_service_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.agent_service.arn
    container_name   = "agent-service"
    container_port   = 4111
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.agent_service]

  tags = {
    Name = "${var.project_name}-agent-service-${var.environment}"
  }
}

# --- Cloud Map (retained temporarily until registered instances drain) ---
# TODO: Remove these resources once no instances are registered in Cloud Map

resource "aws_service_discovery_private_dns_namespace" "agent" {
  count = var.agent_service_desired_count > 0 ? 1 : 0

  name        = "${var.project_name}-${var.environment}.local"
  description = "Service discovery for internal services"
  vpc         = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-service-discovery-${var.environment}"
  }
}

resource "aws_service_discovery_service" "agent_service" {
  count = var.agent_service_desired_count > 0 ? 1 : 0

  name = "agent-service"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.agent[0].id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}
