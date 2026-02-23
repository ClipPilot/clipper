# Lambda function for facecam detection using Python + OpenCV DNN
# Detects webcam overlay bounding boxes in gaming streams

# ECR Repository for Facecam Detect Lambda
# Prod uses 'clipster-facecam-detect-lambda', staging uses 'clipster-facecam-detect-lambda-staging'
resource "aws_ecr_repository" "facecam_detect_lambda" {
  name                 = var.environment == "prod" ? "${var.project_name}-facecam-detect-lambda" : "${var.project_name}-facecam-detect-lambda-${var.environment}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = var.environment == "prod" ? "${var.project_name}-facecam-detect-lambda" : "${var.project_name}-facecam-detect-lambda-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_ecr_lifecycle_policy" "facecam_detect_lambda" {
  repository = aws_ecr_repository.facecam_detect_lambda.name

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

# IAM Role for Facecam Detect Lambda
resource "aws_iam_role" "facecam_detect_lambda" {
  name = "${var.project_name}-facecam-detect-lambda-role"

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
    Name = "${var.project_name}-facecam-detect-lambda-role"
  }
}

# Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "facecam_detect_lambda_basic" {
  role       = aws_iam_role.facecam_detect_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 access policy for Facecam Detect Lambda
resource "aws_iam_role_policy" "facecam_detect_lambda_s3" {
  name = "${var.project_name}-facecam-detect-lambda-s3-policy"
  role = aws_iam_role.facecam_detect_lambda.id

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

# Facecam Detect Lambda Function
resource "aws_lambda_function" "facecam_detect" {
  function_name = "${var.project_name}-facecam-detect-${var.environment}"
  role          = aws_iam_role.facecam_detect_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.facecam_detect_lambda.repository_url}:latest"
  timeout       = 300  # 5 minutes — lighter than face-detect (only 12 frames, no edge refinement)
  memory_size   = 2048 # 2GB — less memory needed since we process fewer frames sequentially

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.facecam_detect_lambda_basic,
    aws_iam_role_policy.facecam_detect_lambda_s3
  ]

  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name        = "${var.project_name}-facecam-detect-${var.environment}"
    Environment = var.environment
  }
}

# CloudWatch Log Group for Facecam Detect Lambda
resource "aws_cloudwatch_log_group" "facecam_detect_lambda" {
  name              = "/aws/lambda/${var.project_name}-facecam-detect-${var.environment}"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-facecam-detect-logs"
  }
}

# Allow ECS backend tasks to invoke this Lambda
resource "aws_iam_role_policy" "ecs_task_invoke_facecam_detect" {
  name = "${var.project_name}-ecs-task-invoke-facecam-detect-${var.environment}"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = aws_lambda_function.facecam_detect.arn
      }
    ]
  })
}

# Output the Lambda ARN
output "facecam_detect_lambda_arn" {
  description = "ARN of the facecam detect Lambda function"
  value       = aws_lambda_function.facecam_detect.arn
}
