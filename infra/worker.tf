# Worker ECS Infrastructure
# Dedicated worker service for processing video jobs from SQS

# ECR Repository for GPU Worker (kept for existing images, no longer actively used)
resource "aws_ecr_repository" "gpu_worker" {
  name                 = "${var.project_name}-gpu-worker-${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = "${var.project_name}-gpu-worker-ecr-${var.environment}"
  }
}

# ECR Repository for Worker
resource "aws_ecr_repository" "worker" {
  name                 = "${var.project_name}-worker-${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-worker-ecr-${var.environment}"
  }
}

# ECR Lifecycle Policy for Worker
resource "aws_ecr_lifecycle_policy" "worker" {
  repository = aws_ecr_repository.worker.name

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

# CloudWatch Log Group for Worker
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.project_name}-worker-${var.environment}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-worker-logs-${var.environment}"
  }
}

# ECS Task Definition for Worker
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.project_name}-worker-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_worker_task.arn

  container_definitions = jsonencode([{
    name  = "worker"
    image = "${aws_ecr_repository.worker.repository_url}:latest"

    environment = [
      {
        name  = "NODE_ENV"
        value = var.node_env
      },
      {
        name  = "AWS_S3_BUCKET"
        value = local.s3_bucket_id
      },
      {
        name  = "AWS_REGION"
        value = var.aws_region
      },
      {
        name  = "SQS_QUEUE_URL"
        value = aws_sqs_queue.video_processing.url
      },
      {
        name  = "SUPABASE_URL"
        value = var.supabase_url
      },
      {
        name  = "API_INTERNAL_URL"
        value = var.api_domain != "" ? "https://${var.api_domain}" : "http://${aws_lb.backend.dns_name}"
      },
      {
        name  = "GOOGLE_SERVICE_ACCOUNT_EMAIL"
        value = var.google_service_account_email
      },
      {
        name  = "GOOGLE_DRIVE_PARENT_FOLDER_ID"
        value = var.google_drive_parent_folder_id
      },
      {
        name  = "MAC_RENDERER_URL"
        value = var.mac_renderer_url
      },
      {
        name  = "AGENT_SERVICE_URL"
        value = "http://${aws_lb.agent_service.dns_name}"
      }
    ]

    secrets = [
      {
        name      = "OPENAI_API_KEY"
        valueFrom = aws_secretsmanager_secret.openai_api_key.arn
      },
      {
        name      = "DEEPGRAM_API_KEY"
        valueFrom = aws_secretsmanager_secret.deepgram_api_key.arn
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
        name      = "INTERNAL_API_KEY"
        valueFrom = aws_secretsmanager_secret.internal_api_key.arn
      },
      {
        name      = "RESEND_API_KEY"
        valueFrom = aws_secretsmanager_secret.resend_api_key.arn
      },
      {
        name      = "STRIPE_SECRET_KEY"
        valueFrom = aws_secretsmanager_secret.stripe_secret_key.arn
      },
      {
        name      = "STRIPE_WEBHOOK_SECRET"
        valueFrom = aws_secretsmanager_secret.stripe_webhook_secret.arn
      },
      {
        name      = "GEMINI_API_KEY"
        valueFrom = aws_secretsmanager_secret.gemini_api_key.arn
      },
      {
        name      = "ELEVENLABS_API_KEY"
        valueFrom = aws_secretsmanager_secret.elevenlabs_api_key.arn
      },
      {
        name      = "FAL_KEY"
        valueFrom = aws_secretsmanager_secret.fal_key.arn
      },
      {
        name      = "WAVESPEED_KEY"
        valueFrom = aws_secretsmanager_secret.wavespeed_key.arn
      },
      {
        name      = "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
        valueFrom = aws_secretsmanager_secret.google_service_account_private_key.arn
      },
      {
        name      = "SYNC_KEY"
        valueFrom = aws_secretsmanager_secret.sync_key.arn
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    essential    = true
    stopTimeout  = 120
  }])

  tags = {
    Name = "${var.project_name}-worker-task-${var.environment}"
  }
}

# ECS Service for Worker (no load balancer - polls SQS)
resource "aws_ecs_service" "worker" {
  name            = "${var.project_name}-worker-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_min_capacity

  # Use Fargate Spot for cost savings (70% cheaper)
  # Base worker uses regular Fargate, scaled workers use Spot
  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1 # Always keep 1 regular Fargate task (reliable)
  }

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 4 # Prefer Spot for additional tasks (4:1 ratio)
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  # Allow external changes to desired_count without Terraform interference
  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = {
    Name = "${var.project_name}-worker-service-${var.environment}"
  }
}

# Auto Scaling Target for Worker
resource "aws_appautoscaling_target" "worker" {
  max_capacity       = var.worker_max_capacity
  min_capacity       = var.worker_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Scale based on SQS queue depth
resource "aws_appautoscaling_policy" "worker_sqs_scaling" {
  name               = "${var.project_name}-worker-sqs-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.worker_messages_per_task
    scale_in_cooldown  = 120 # 2 minutes before scaling down
    scale_out_cooldown = 30  # 30 seconds before scaling up (fast response)

    customized_metric_specification {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      statistic   = "Average"

      dimensions {
        name  = "QueueName"
        value = aws_sqs_queue.video_processing.name
      }
    }
  }
}
