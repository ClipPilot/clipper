# GPU Worker ECS Infrastructure
# Processes ComfyUI face swap jobs from GPU SQS queue

# ECR Repository for GPU Worker
resource "aws_ecr_repository" "gpu_worker" {
  name                 = "${var.project_name}-gpu-worker-${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-gpu-worker-ecr-${var.environment}"
  }
}

resource "aws_ecr_lifecycle_policy" "gpu_worker" {
  repository = aws_ecr_repository.gpu_worker.name

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

# CloudWatch Log Group for GPU Worker
resource "aws_cloudwatch_log_group" "gpu_worker" {
  name              = "/ecs/${var.project_name}-gpu-worker-${var.environment}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-gpu-worker-logs-${var.environment}"
  }
}

# ECS Task Definition for GPU Worker
resource "aws_ecs_task_definition" "gpu_worker" {
  family                   = "${var.project_name}-gpu-worker-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.gpu_worker_cpu
  memory                   = var.gpu_worker_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_gpu_worker_task.arn

  container_definitions = jsonencode([{
    name  = "gpu-worker"
    image = "${aws_ecr_repository.gpu_worker.repository_url}:latest"

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
        name  = "GPU_SQS_QUEUE_URL"
        value = aws_sqs_queue.gpu_processing.url
      },
      {
        name  = "SUPABASE_URL"
        value = var.supabase_url
      },
      {
        name  = "API_INTERNAL_URL"
        value = var.api_domain != "" ? "https://${var.api_domain}" : "http://${aws_lb.backend.dns_name}"
      }
    ]

    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = aws_secretsmanager_secret.database_url.arn
      },
      {
        name      = "SUPABASE_ANON_KEY"
        valueFrom = aws_secretsmanager_secret.supabase_anon_key.arn
      },
      {
        name      = "DEEPGRAM_API_KEY"
        valueFrom = aws_secretsmanager_secret.deepgram_api_key.arn
      },
      {
        name      = "RESEND_API_KEY"
        valueFrom = aws_secretsmanager_secret.resend_api_key.arn
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.gpu_worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    essential = true
  }])

  tags = {
    Name = "${var.project_name}-gpu-worker-task-${var.environment}"
  }
}

# ECS Service for GPU Worker
resource "aws_ecs_service" "gpu_worker" {
  name            = "${var.project_name}-gpu-worker-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.gpu_worker.arn
  desired_count   = var.gpu_worker_min_capacity

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 4
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = {
    Name = "${var.project_name}-gpu-worker-service-${var.environment}"
  }
}

# Auto Scaling Target
resource "aws_appautoscaling_target" "gpu_worker" {
  max_capacity       = var.gpu_worker_max_capacity
  min_capacity       = var.gpu_worker_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.gpu_worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Scale based on SQS queue depth
resource "aws_appautoscaling_policy" "gpu_worker_sqs_scaling" {
  name               = "${var.project_name}-gpu-worker-sqs-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.gpu_worker.resource_id
  scalable_dimension = aws_appautoscaling_target.gpu_worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.gpu_worker.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 1 # 1 message per worker
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    customized_metric_specification {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      statistic   = "Average"

      dimensions {
        name  = "QueueName"
        value = aws_sqs_queue.gpu_processing.name
      }
    }
  }
}
