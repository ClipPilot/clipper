# ECS Task Execution Role
resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-ecs-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "${var.project_name}-ecs-execution-role-${var.environment}"
  }
}

# Attach AWS managed policy for ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Policy for accessing Secrets Manager
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.project_name}-ecs-execution-secrets-${var.environment}"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = [
        aws_secretsmanager_secret.openai_api_key.arn,
        aws_secretsmanager_secret.deepgram_api_key.arn,
        aws_secretsmanager_secret.database_url.arn,
        aws_secretsmanager_secret.supabase_anon_key.arn,
        aws_secretsmanager_secret.internal_api_key.arn,
        aws_secretsmanager_secret.stripe_secret_key.arn,
        aws_secretsmanager_secret.stripe_webhook_secret.arn,
        aws_secretsmanager_secret.resend_api_key.arn,
        aws_secretsmanager_secret.gemini_api_key.arn,
        aws_secretsmanager_secret.admin_jwt_secret.arn,
        aws_secretsmanager_secret.sync_key.arn,
        aws_secretsmanager_secret.elevenlabs_api_key.arn,
        aws_secretsmanager_secret.fal_key.arn,
        aws_secretsmanager_secret.wavespeed_key.arn,
        aws_secretsmanager_secret.apify_api_token.arn,
        aws_secretsmanager_secret.socialdata_api_key.arn,
        aws_secretsmanager_secret.ad_posting_webhook_secret.arn,
        aws_secretsmanager_secret.google_service_account_private_key.arn,
        aws_secretsmanager_secret.tavily_api_key.arn
      ]
    }]
  })
}

# ECS Task Role
resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-ecs-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "${var.project_name}-ecs-task-role-${var.environment}"
  }
}

# Policy for S3 access
resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${var.project_name}-ecs-task-s3-${var.environment}"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ]
      Resource = concat(
        [local.s3_bucket_arn, "${local.s3_bucket_arn}/*"],
        # Always include prod bucket for staging to access shared clips
        var.environment == "staging" ? [
          "arn:aws:s3:::${var.project_name}-videos-prod-${data.aws_caller_identity.current.account_id}",
          "arn:aws:s3:::${var.project_name}-videos-prod-${data.aws_caller_identity.current.account_id}/*"
        ] : []
      )
    }]
  })
}

# Policy for SQS access (API - send messages + read attributes for health checks)
resource "aws_iam_role_policy" "ecs_task_sqs" {
  name = "${var.project_name}-ecs-task-sqs-${var.environment}"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sqs:SendMessage",
        "sqs:GetQueueUrl",
        "sqs:GetQueueAttributes"
      ]
      Resource = [
        aws_sqs_queue.video_processing.arn
      ]
    }]
  })
}

# Policy for ECS DescribeServices (API health check for worker)
resource "aws_iam_role_policy" "ecs_task_ecs_describe" {
  name = "${var.project_name}-ecs-task-ecs-describe-${var.environment}"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ecs:DescribeServices"
      ]
      Resource = ["*"]
      Condition = {
        ArnEquals = {
          "ecs:cluster" = aws_ecs_cluster.main.arn
        }
      }
    }]
  })
}

# Worker ECS Task Role (needs full SQS access + S3)
resource "aws_iam_role" "ecs_worker_task" {
  name = "${var.project_name}-ecs-worker-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "${var.project_name}-ecs-worker-task-role-${var.environment}"
  }
}

# Worker S3 access policy
resource "aws_iam_role_policy" "ecs_worker_s3" {
  name = "${var.project_name}-ecs-worker-s3-${var.environment}"
  role = aws_iam_role.ecs_worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ]
      Resource = concat(
        [local.s3_bucket_arn, "${local.s3_bucket_arn}/*"],
        # Always include prod bucket for staging to access shared clips
        var.environment == "staging" ? [
          "arn:aws:s3:::${var.project_name}-videos-prod-${data.aws_caller_identity.current.account_id}",
          "arn:aws:s3:::${var.project_name}-videos-prod-${data.aws_caller_identity.current.account_id}/*"
        ] : []
      )
    }]
  })
}

# Worker SQS access policy (receive, delete, change visibility)
resource "aws_iam_role_policy" "ecs_worker_sqs" {
  name = "${var.project_name}-ecs-worker-sqs-${var.environment}"
  role = aws_iam_role.ecs_worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueUrl",
        "sqs:GetQueueAttributes",
        "sqs:ChangeMessageVisibility",
        "sqs:SendMessage"
      ]
      Resource = [
        aws_sqs_queue.video_processing.arn
      ]
    }]
  })
}

# Worker Lambda invoke policy (facecam-detect, face-detect, scene-detect)
resource "aws_iam_role_policy" "ecs_worker_lambda_invoke" {
  name = "${var.project_name}-ecs-worker-lambda-invoke-${var.environment}"
  role = aws_iam_role.ecs_worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "lambda:InvokeFunction"
      ]
      Resource = [
        "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-facecam-detect-${var.environment}",
        "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-face-detect-${var.environment}",
        "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-scene-detect-${var.environment}",
        "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-sscd-similarity-${var.environment}"
      ]
    }]
  })
}

# Worker ECS task protection policy (prevent scale-in during job processing)
resource "aws_iam_role_policy" "ecs_worker_task_protection" {
  name = "${var.project_name}-ecs-worker-task-protection-${var.environment}"
  role = aws_iam_role.ecs_worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ecs:UpdateTaskProtection",
        "ecs:GetTaskProtection"
      ]
      Resource = "*"
      Condition = {
        ArnEquals = {
          "ecs:cluster" = aws_ecs_cluster.main.arn
        }
      }
    }]
  })
}


