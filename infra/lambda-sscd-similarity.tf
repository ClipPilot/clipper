# Lambda function for SSCD (Self-Supervised Copy Detection) similarity checking
# Computes cosine similarity between original and modified videos to verify uniquification

# ECR Repository for SSCD Similarity Lambda
resource "aws_ecr_repository" "sscd_similarity_lambda" {
  name                 = var.environment == "prod" ? "${var.project_name}-sscd-similarity-lambda" : "${var.project_name}-sscd-similarity-lambda-${var.environment}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = var.environment == "prod" ? "${var.project_name}-sscd-similarity-lambda" : "${var.project_name}-sscd-similarity-lambda-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_ecr_lifecycle_policy" "sscd_similarity_lambda" {
  repository = aws_ecr_repository.sscd_similarity_lambda.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# IAM Role for SSCD Similarity Lambda
resource "aws_iam_role" "sscd_similarity_lambda" {
  name = "${var.project_name}-sscd-similarity-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-sscd-similarity-lambda-role-${var.environment}"
  }
}

# Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "sscd_similarity_lambda_basic" {
  role       = aws_iam_role.sscd_similarity_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 access policy for SSCD Similarity Lambda
resource "aws_iam_role_policy" "sscd_similarity_lambda_s3" {
  name = "${var.project_name}-sscd-similarity-lambda-s3-policy-${var.environment}"
  role = aws_iam_role.sscd_similarity_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-videos-staging-${data.aws_caller_identity.current.account_id}/*",
          "arn:aws:s3:::${var.project_name}-videos-prod-${data.aws_caller_identity.current.account_id}/*"
        ]
      }
    ]
  })
}

# SSCD Similarity Lambda Function
resource "aws_lambda_function" "sscd_similarity" {
  function_name = "${var.project_name}-sscd-similarity-${var.environment}"
  role          = aws_iam_role.sscd_similarity_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.sscd_similarity_lambda.repository_url}:latest"
  timeout       = 120  # 2 minutes - processes only first 5-10s of video
  memory_size   = 4096 # 4GB - SSCD model + PyTorch inference needs more memory

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.sscd_similarity_lambda_basic,
    aws_iam_role_policy.sscd_similarity_lambda_s3
  ]

  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name        = "${var.project_name}-sscd-similarity-${var.environment}"
    Environment = var.environment
  }
}

# CloudWatch Log Group for SSCD Similarity Lambda
resource "aws_cloudwatch_log_group" "sscd_similarity_lambda" {
  name              = "/aws/lambda/${var.project_name}-sscd-similarity-${var.environment}"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-sscd-similarity-logs-${var.environment}"
  }
}

# Allow ECS backend tasks to invoke this Lambda
resource "aws_iam_role_policy" "ecs_task_invoke_sscd_similarity" {
  name = "${var.project_name}-ecs-task-invoke-sscd-similarity-${var.environment}"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = aws_lambda_function.sscd_similarity.arn
      }
    ]
  })
}

# Output the Lambda ARN
output "sscd_similarity_lambda_arn" {
  description = "ARN of the SSCD similarity Lambda function"
  value       = aws_lambda_function.sscd_similarity.arn
}
